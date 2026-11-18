import type {
  CheckinProblemChoice,
  IncidentCategory,
  IncidentEvent,
  IncidentEvidence,
  IncidentSeverity,
  IncidentStatus,
  IncidentSubtype,
  IntegrityOperationalMetrics,
  OperationalIncident,
  PartnerComplianceMeasure,
  PartnerComplianceProfile,
  PartnerProgressiveMeasureLevel,
  UserProgressiveMeasureLevel,
  UserReliabilityProfile,
  UserRestrictionRecord,
} from '../types/integrity';
import { CHECKIN_PROBLEM_OPTIONS } from '../types/integrity';
import { generateUUID } from '../utils/slug';
import { getUserProfileIdentity } from './authService';
import { getPartnerFeeLedger } from './partnerCommercialStore';
import { supabase } from './supabaseClient';
import { getReservations } from './superappStore';
import { getCheckinAuditEvents, getVisitProofs } from './visitProofStore';

const KEYS = {
  INCIDENTS: 'borario_integrity_incidents_v1',
  USER_RESTRICTIONS: 'borario_integrity_user_restrictions_v1',
  PARTNER_MEASURES: 'borario_integrity_partner_measures_v1',
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

async function getAccessToken(): Promise<string | null> {
  try {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

export function getLocalIncidents(filters?: {
  restaurantId?: string;
  userId?: string;
  status?: IncidentStatus;
}): OperationalIncident[] {
  const all = readJson<OperationalIncident[]>(KEYS.INCIDENTS, []);
  return all.filter((inc) => {
    if (filters?.restaurantId && inc.restaurant_id !== filters.restaurantId) return false;
    if (filters?.userId && inc.user_id !== filters.userId) return false;
    if (filters?.status && inc.status !== filters.status) return false;
    return true;
  });
}

export async function fetchIncidentsFromServer(filters?: {
  restaurantId?: string;
  status?: IncidentStatus;
}): Promise<{ ok: boolean; incidents: OperationalIncident[]; fromServer: boolean }> {
  try {
    const token = await getAccessToken();
    if (!token) {
      return { ok: true, incidents: getLocalIncidents(filters), fromServer: false };
    }
    const qs = new URLSearchParams();
    if (filters?.restaurantId) qs.set('restaurantId', filters.restaurantId);
    if (filters?.status) qs.set('status', filters.status);
    const res = await fetch(`/api/integrity/incidents?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      return { ok: true, incidents: getLocalIncidents(filters), fromServer: false };
    }
    const json = (await res.json()) as { ok?: boolean; incidents?: OperationalIncident[] };
    if (json.ok && Array.isArray(json.incidents)) {
      if (!filters?.restaurantId && !filters?.status) {
        writeJson(KEYS.INCIDENTS, json.incidents);
      }
      return { ok: true, incidents: json.incidents, fromServer: true };
    }
  } catch {
    // Fallback local
  }
  return { ok: true, incidents: getLocalIncidents(filters), fromServer: false };
}

export async function openCheckinProblemIncident(params: {
  choice: CheckinProblemChoice;
  restaurantId: string;
  restaurantName: string;
  reservationId?: string;
  offeringId?: string;
  description: string;
  evidenceSummary?: string;
  evidenceUrl?: string;
}): Promise<{ ok: boolean; incident: OperationalIncident; message: string }> {
  const option =
    CHECKIN_PROBLEM_OPTIONS.find((o) => o.choice === params.choice) ||
    CHECKIN_PROBLEM_OPTIONS[CHECKIN_PROBLEM_OPTIONS.length - 1];
  const profile = getUserProfileIdentity();
  const idempotencyKey = `checkin_prob:${params.reservationId || 'nores'}:${params.choice}:${profile.id}`;
  const now = new Date().toISOString();

  // Tenta envio autoritativo ao servidor primeiro
  try {
    const token = await getAccessToken();
    if (token) {
      const res = await fetch('/api/integrity/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          idempotencyKey,
          category: option.category,
          subtype: option.subtype,
          severity: option.category === 'PARTNER' ? 'HIGH' : 'MEDIUM',
          restaurantId: params.restaurantId,
          reservationId: params.reservationId,
          offeringId: params.offeringId,
          title: option.label,
          description: params.description.trim() || option.label,
          evidenceSummary: params.evidenceSummary,
          evidenceUrl: params.evidenceUrl,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { ok?: boolean; incident?: OperationalIncident };
        if (json.ok && json.incident) {
          const existing = getLocalIncidents().filter((i) => i.id !== json.incident!.id);
          writeJson(KEYS.INCIDENTS, [json.incident, ...existing]);
          return {
            ok: true,
            incident: json.incident,
            message: 'Ocorrência registrada com protocolo de análise. Nenhuma penalidade automática foi aplicada.',
          };
        }
      }
    }
  } catch {
    // Continua com persistência local resiliente
  }

  // Fallback local idempotente
  const existingLocal = getLocalIncidents().find((i) => i.idempotency_key === idempotencyKey);
  if (existingLocal) {
    return {
      ok: true,
      incident: existingLocal,
      message: 'Ocorrência já registrada anteriormente para este atendimento.',
    };
  }

  const incidentId = generateUUID();
  const initialStatus: IncidentStatus =
    option.category === 'PARTNER' ? 'WAITING_PARTNER' : 'OPEN';

  const initialEvent: IncidentEvent = {
    id: generateUUID(),
    incident_id: incidentId,
    actor_user_id: profile.id,
    actor_role: 'USER',
    event_type: 'INCIDENT_OPENED',
    previous_status: null,
    new_status: initialStatus,
    justification: 'Ocorrência registrada pelo consumidor durante tentativa de check-in.',
    created_at: now,
  };

  const evidences: IncidentEvidence[] = params.evidenceSummary?.trim()
    ? [
        {
          id: generateUUID(),
          incident_id: incidentId,
          submitted_by_user_id: profile.id,
          submitted_by_role: 'USER',
          evidence_type: params.evidenceUrl ? 'SCREENSHOT_URL' : 'TEXT_STATEMENT',
          summary: params.evidenceSummary.trim(),
          payload_url: params.evidenceUrl || null,
          created_at: now,
        },
      ]
    : [];

  const incident: OperationalIncident = {
    id: incidentId,
    idempotency_key: idempotencyKey,
    category: option.category,
    subtype: option.subtype,
    status: initialStatus,
    severity: option.category === 'PARTNER' ? 'HIGH' : 'MEDIUM',
    user_id: profile.id,
    user_display_label: profile.display_name || profile.email || 'Consumidor',
    restaurant_id: params.restaurantId,
    restaurant_name: params.restaurantName,
    reservation_id: params.reservationId || null,
    offering_id: params.offeringId || null,
    visit_operational_status:
      option.category === 'TECHNICAL' ? 'QR_FAILED_PENDING' : 'DISPUTED',
    title: option.label,
    description: params.description.trim() || option.label,
    possible_fraud: false,
    created_at: now,
    updated_at: now,
    events: [initialEvent],
    evidences,
  };

  writeJson(KEYS.INCIDENTS, [incident, ...getLocalIncidents()]);
  return {
    ok: true,
    incident,
    message: 'Ocorrência registrada para análise. Sua confiabilidade não é prejudicada por falhas operacionais ou técnicas.',
  };
}

export async function submitIncidentResponse(params: {
  incidentId: string;
  actorRole: 'USER' | 'PARTNER';
  message: string;
  evidenceSummary?: string;
  evidenceUrl?: string;
}): Promise<{ ok: boolean; message: string }> {
  if (!params.message.trim()) {
    return { ok: false, message: 'Informe uma justificativa ou manifestação antes de enviar.' };
  }

  try {
    const token = await getAccessToken();
    if (token) {
      const res = await fetch('/api/integrity/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          incidentId: params.incidentId,
          message: params.message.trim(),
          evidenceSummary: params.evidenceSummary,
          evidenceUrl: params.evidenceUrl,
        }),
      });
      if (res.ok) {
        return { ok: true, message: 'Manifestação enviada e encaminhada para análise da plataforma.' };
      }
    }
  } catch {
    // Fallback local
  }

  const profile = getUserProfileIdentity();
  const now = new Date().toISOString();
  const list = getLocalIncidents().map((inc) => {
    if (inc.id !== params.incidentId) return inc;
    // Parceiro nunca pode encerrar unilateralmente uma contestação
    const nextStatus: IncidentStatus =
      inc.status === 'CLOSED' || inc.status.startsWith('RESOLVED_')
        ? inc.status
        : 'UNDER_REVIEW';

    const newEvent: IncidentEvent = {
      id: generateUUID(),
      incident_id: inc.id,
      actor_user_id: profile.id,
      actor_role: params.actorRole,
      event_type: params.actorRole === 'PARTNER' ? 'PARTNER_RESPONDED' : 'USER_RESPONDED',
      previous_status: inc.status,
      new_status: nextStatus,
      justification: params.message.trim(),
      created_at: now,
    };

    const newEvidences = [...(inc.evidences || [])];
    if (params.evidenceSummary?.trim()) {
      newEvidences.push({
        id: generateUUID(),
        incident_id: inc.id,
        submitted_by_user_id: profile.id,
        submitted_by_role: params.actorRole,
        evidence_type: params.evidenceUrl ? 'RECEIPT_URL' : 'TEXT_STATEMENT',
        summary: params.evidenceSummary.trim(),
        payload_url: params.evidenceUrl || null,
        created_at: now,
      });
    }

    return {
      ...inc,
      status: nextStatus,
      updated_at: now,
      events: [...(inc.events || []), newEvent],
      evidences: newEvidences,
    };
  });

  writeJson(KEYS.INCIDENTS, list);
  return {
    ok: true,
    message: 'Manifestação registrada no histórico da ocorrência e enviada para análise.',
  };
}

export async function validateTemporaryPinOnServer(params: {
  reservationId: string;
  pinCode: string;
  hasGeo?: boolean;
}): Promise<{ ok: boolean; message: string; serverValidated?: boolean }> {
  const cleanPin = params.pinCode.trim().toUpperCase();
  if (!cleanPin || cleanPin.length < 4) {
    return { ok: false, message: 'Informe o PIN temporário fornecido pelo estabelecimento.' };
  }

  try {
    const token = await getAccessToken();
    if (token) {
      const res = await fetch('/api/integrity/pin-fallback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: params.reservationId,
          pinCode: cleanPin,
          hasGeo: Boolean(params.hasGeo),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (res.ok && json.ok) {
        return {
          ok: true,
          serverValidated: true,
          message: 'PIN temporário validado pelo servidor!',
        };
      }
      if (res.status === 400) {
        return {
          ok: false,
          serverValidated: true,
          message: json.message || 'PIN inválido, expirado ou não vinculado a esta visita.',
        };
      }
    }
  } catch {
    // Se serverless indisponível, o chamador decide via validação de token local
  }

  return {
    ok: false,
    serverValidated: false,
    message: 'Validação via servidor indisponível no momento. Verifique o PIN emitido pelo balcão.',
  };
}

export async function applyAdminIncidentDecision(params: {
  incidentId: string;
  newStatus: IncidentStatus;
  justification: string;
  confirmPostVisit?: boolean;
  userMeasureLevel?: UserProgressiveMeasureLevel;
  partnerMeasureLevel?: PartnerProgressiveMeasureLevel;
  measureExpiresDays?: number;
}): Promise<{ ok: boolean; message: string }> {
  if (!params.justification.trim()) {
    return {
      ok: false,
      message: 'Uma justificativa explícita é obrigatória para qualquer decisão administrativa.',
    };
  }

  try {
    const token = await getAccessToken();
    if (token) {
      const res = await fetch('/api/integrity/admin/decide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (res.ok && json.ok) {
        return { ok: true, message: 'Decisão administrativa registrada no servidor com trilha de auditoria.' };
      }
    }
  } catch {
    // Fallback local
  }

  const profile = getUserProfileIdentity();
  const now = new Date().toISOString();
  let targetIncident: OperationalIncident | undefined;

  const updated = getLocalIncidents().map((inc) => {
    if (inc.id !== params.incidentId) return inc;
    targetIncident = inc;
    const isResolved =
      params.newStatus.startsWith('RESOLVED_') ||
      params.newStatus === 'UNFOUNDED' ||
      params.newStatus === 'CLOSED';

    const ev: IncidentEvent = {
      id: generateUUID(),
      incident_id: inc.id,
      actor_user_id: profile.id,
      actor_role: 'ADMIN',
      event_type: params.confirmPostVisit
        ? 'POST_VISIT_CONFIRMED'
        : params.newStatus === 'RESOLVED_TECHNICAL'
          ? 'TECHNICAL_CLASSIFIED'
          : 'STATUS_CHANGED',
      previous_status: inc.status,
      new_status: params.newStatus,
      justification: params.justification.trim(),
      created_at: now,
    };

    return {
      ...inc,
      status: params.newStatus,
      visit_operational_status: params.confirmPostVisit
        ? ('CONFIRMED_POST_VISIT' as const)
        : inc.visit_operational_status,
      resolution_summary: isResolved ? params.justification.trim() : inc.resolution_summary,
      resolved_by_user_id: isResolved ? profile.id : inc.resolved_by_user_id,
      resolved_at: isResolved ? now : inc.resolved_at,
      updated_at: now,
      events: [...(inc.events || []), ev],
    };
  });

  writeJson(KEYS.INCIDENTS, updated);

  const expiresAt = params.measureExpiresDays
    ? new Date(Date.now() + params.measureExpiresDays * 86400_000).toISOString()
    : null;

  if (params.userMeasureLevel && targetIncident?.user_id) {
    const restrictions = readJson<UserRestrictionRecord[]>(KEYS.USER_RESTRICTIONS, []);
    writeJson(KEYS.USER_RESTRICTIONS, [
      {
        id: generateUUID(),
        user_id: targetIncident.user_id,
        incident_id: targetIncident.id,
        measure_level: params.userMeasureLevel,
        reason: params.justification.trim(),
        active: true,
        starts_at: now,
        expires_at: expiresAt,
        review_eligible_at: expiresAt,
        issued_by_user_id: profile.id,
        created_at: now,
      },
      ...restrictions,
    ]);
  }

  if (params.partnerMeasureLevel && targetIncident?.restaurant_id) {
    const measures = readJson<PartnerComplianceMeasure[]>(KEYS.PARTNER_MEASURES, []);
    writeJson(KEYS.PARTNER_MEASURES, [
      {
        id: generateUUID(),
        restaurant_id: targetIncident.restaurant_id,
        incident_id: targetIncident.id,
        measure_level: params.partnerMeasureLevel,
        reason: params.justification.trim(),
        active: true,
        starts_at: now,
        expires_at: expiresAt,
        issued_by_user_id: profile.id,
        created_at: now,
      },
      ...measures,
    ]);
  }

  return { ok: true, message: 'Decisão administrativa registrada com histórico de auditoria.' };
}

export function createSystemIncidentRecord(params: {
  category: IncidentCategory;
  subtype: IncidentSubtype;
  severity?: IncidentSeverity;
  restaurantId?: string;
  restaurantName?: string;
  reservationId?: string;
  title: string;
  description: string;
  possibleFraud?: boolean;
}): OperationalIncident {
  const profile = getUserProfileIdentity();
  const now = new Date().toISOString();
  const id = generateUUID();
  const inc: OperationalIncident = {
    id,
    category: params.category,
    subtype: params.subtype,
    status: params.category === 'TECHNICAL' ? 'RESOLVED_TECHNICAL' : 'OPEN',
    severity: params.severity || 'LOW',
    user_id: profile.id,
    user_display_label: profile.display_name || profile.email || 'Consumidor',
    restaurant_id: params.restaurantId || null,
    restaurant_name: params.restaurantName || null,
    reservation_id: params.reservationId || null,
    title: params.title,
    description: params.description,
    possible_fraud: Boolean(params.possibleFraud),
    created_at: now,
    updated_at: now,
    events: [
      {
        id: generateUUID(),
        incident_id: id,
        actor_role: 'SYSTEM',
        event_type: params.category === 'TECHNICAL' ? 'TECHNICAL_CLASSIFIED' : 'INCIDENT_OPENED',
        previous_status: null,
        new_status: params.category === 'TECHNICAL' ? 'RESOLVED_TECHNICAL' : 'OPEN',
        justification: 'Registro automático de evento operacional.',
        created_at: now,
      },
    ],
    evidences: [],
  };
  writeJson(KEYS.INCIDENTS, [inc, ...getLocalIncidents()]);
  return inc;
}

export function computeUserReliabilityProfile(userId?: string): UserReliabilityProfile {
  const profile = getUserProfileIdentity();
  const targetUserId = userId || profile.id;
  const reservations = getReservations();
  const incidents = getLocalIncidents({ userId: targetUserId });
  const restrictions = readJson<UserRestrictionRecord[]>(KEYS.USER_RESTRICTIONS, []).filter(
    (r) => r.user_id === targetUserId && r.active
  );

  const confirmedAttendances = reservations.filter(
    (r) =>
      r.stage === 'CHECKED_IN' ||
      r.stage === 'VERIFIED_VISIT' ||
      r.stage === 'VERIFIED_CONSUMPTION'
  ).length;
  const timelyCancellations = reservations.filter(
    (r) => r.stage === 'CANCELLED' || r.status === 'CANCELLED'
  ).length;
  const confirmedNoShows = reservations.filter((r) => r.stage === 'NO_SHOW').length;
  const technicalIncidents = incidents.filter(
    (i) => i.category === 'TECHNICAL' || i.status === 'RESOLVED_TECHNICAL'
  ).length;
  const upheldDisputes = incidents.filter((i) => i.status === 'RESOLVED_USER').length;
  const provenInfractions = incidents.filter(
    (i) => i.category === 'CONSUMER' && i.status === 'RESOLVED_PARTNER'
  ).length;

  return {
    user_id: targetUserId,
    total_reservations: reservations.length,
    confirmed_attendances: confirmedAttendances,
    timely_cancellations: timelyCancellations,
    confirmed_no_shows: confirmedNoShows,
    technical_incidents: technicalIncidents,
    upheld_disputes: upheldDisputes,
    proven_infractions: provenInfractions,
    active_restrictions: restrictions,
    updated_at: new Date().toISOString(),
  };
}

export function computePartnerComplianceProfile(
  restaurantId: string,
  restaurantName?: string
): PartnerComplianceProfile {
  const incidents = getLocalIncidents({ restaurantId });
  const measures = readJson<PartnerComplianceMeasure[]>(KEYS.PARTNER_MEASURES, []).filter(
    (m) => m.restaurant_id === restaurantId && m.active
  );

  return {
    restaurant_id: restaurantId,
    restaurant_name: restaurantName,
    checkin_refusals: incidents.filter((i) => i.subtype === 'PARTNER_REFUSED_QR').length,
    recurring_qr_failures: incidents.filter(
      (i) =>
        i.subtype === 'QR_UNAVAILABLE_OR_EXPIRED_OP' ||
        i.subtype === 'QR_GENERATION_OR_READ_FAILURE'
    ).length,
    offer_complaints: incidents.filter((i) => i.subtype === 'OFFER_TERMS_MISMATCH').length,
    valid_reservation_refusals: incidents.filter(
      (i) => i.subtype === 'PARTNER_REFUSED_VALID_RESERVATION'
    ).length,
    unhonored_benefits: incidents.filter((i) => i.subtype === 'BENEFIT_OR_REWARD_REFUSED').length,
    attendance_divergences: incidents.filter(
      (i) => i.subtype === 'INCORRECT_ATTENDANCE_RECORD'
    ).length,
    confirmed_post_visits: incidents.filter(
      (i) => i.visit_operational_status === 'CONFIRMED_POST_VISIT'
    ).length,
    manipulation_attempts: incidents.filter(
      (i) => i.subtype === 'CHECKIN_POINTS_OR_FEE_MANIPULATION' || i.possible_fraud
    ).length,
    upheld_disputes_against_partner: incidents.filter(
      (i) => i.category === 'PARTNER' && i.status === 'RESOLVED_USER'
    ).length,
    monitoring_active: measures.some(
      (m) =>
        m.measure_level === 'TEMPORARY_MONITORING' ||
        m.measure_level === 'OFFER_SUSPENSION' ||
        m.measure_level === 'TEMP_PARTNER_SUSPENSION'
    ),
    active_measures: measures,
    updated_at: new Date().toISOString(),
  };
}

export function computeIntegrityMetrics(incidentsOverride?: OperationalIncident[]): IntegrityOperationalMetrics {
  const incidents = incidentsOverride || getLocalIncidents();
  const reservations = getReservations();
  const auditEvents = getCheckinAuditEvents();
  const visitProofs = getVisitProofs();
  const feeLedger = getPartnerFeeLedger();

  const checkedInCount = reservations.filter(
    (r) =>
      r.stage === 'CHECKED_IN' ||
      r.stage === 'VERIFIED_VISIT' ||
      r.stage === 'VERIFIED_CONSUMPTION'
  ).length;
  const totalRes = Math.max(1, reservations.length);
  const qrRejectedCount = auditEvents.filter(
    (e) =>
      e.event_type === 'CHECKIN_REJECTED_EXPIRED' ||
      e.event_type === 'CHECKIN_REJECTED_INVALID'
  ).length;
  const qrAttempts = Math.max(1, visitProofs.length + qrRejectedCount);

  const resolvedIncidents = incidents.filter(
    (i) =>
      i.status.startsWith('RESOLVED_') ||
      i.status === 'UNFOUNDED' ||
      i.status === 'CLOSED'
  );

  const avgResolutionHours =
    resolvedIncidents.length > 0
      ? Math.round(
          (resolvedIncidents.reduce((acc, inc) => {
            const start = new Date(inc.created_at).getTime();
            const end = new Date(inc.resolved_at || inc.updated_at).getTime();
            return acc + Math.max(0.5, (end - start) / 3600_000);
          }, 0) /
            resolvedIncidents.length) *
            10
        ) / 10
      : 0;

  const partnerDisputes = incidents.filter((i) => i.category === 'PARTNER');
  const upheldUser = partnerDisputes.filter((i) => i.status === 'RESOLVED_USER').length;

  const partnerCounts = new Map<string, number>();
  const userCounts = new Map<string, number>();
  for (const inc of incidents) {
    if (inc.status === 'RESOLVED_USER' && inc.restaurant_id) {
      partnerCounts.set(inc.restaurant_id, (partnerCounts.get(inc.restaurant_id) || 0) + 1);
    }
    if (inc.status === 'RESOLVED_PARTNER' && inc.user_id) {
      userCounts.set(inc.user_id, (userCounts.get(inc.user_id) || 0) + 1);
    }
  }

  return {
    successfulCheckinRatePct: Math.round((checkedInCount / totalRes) * 100),
    qrFailureRatePct: Math.round((qrRejectedCount / qrAttempts) * 100),
    incidentsPerReservationPct: Math.round((incidents.length / totalRes) * 100),
    confirmedNoShowCount: reservations.filter((r) => r.stage === 'NO_SHOW').length,
    partnerCheckinRefusals: incidents.filter((i) => i.subtype === 'PARTNER_REFUSED_QR').length,
    avgResolutionHours,
    upheldDisputesPct:
      partnerDisputes.length > 0 ? Math.round((upheldUser / partnerDisputes.length) * 100) : 0,
    repeatOffenderPartners: Array.from(partnerCounts.values()).filter((c) => c >= 2).length,
    repeatOffenderUsers: Array.from(userCounts.values()).filter((c) => c >= 2).length,
    recoveredVisitsPostDispute: incidents.filter(
      (i) => i.visit_operational_status === 'CONFIRMED_POST_VISIT'
    ).length,
    feeDivergenceCount: feeLedger.filter((f) => f.status === 'DISPUTED').length,
    totalOpen: incidents.filter((i) => i.status === 'OPEN').length,
    waitingPartner: incidents.filter((i) => i.status === 'WAITING_PARTNER').length,
    waitingUser: incidents.filter((i) => i.status === 'WAITING_USER').length,
    underReview: incidents.filter((i) => i.status === 'UNDER_REVIEW').length,
    resolvedCount: resolvedIncidents.length,
    possibleFraudCount: incidents.filter((i) => i.possible_fraud).length,
  };
}

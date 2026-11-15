import type { ReservationRequest } from '../types/experience';
import type {
  CheckinAuditEvent,
  CheckinAuditEventType,
  OfflineContingencyCheckin,
  VenueQrToken,
  VisitEvidenceMethod,
  VisitProofLevel,
  VisitProofRecord,
} from '../types/verification';
import { generateUUID } from '../utils/slug';
import { getUserProfileIdentity } from './authService';
import { isValidUuid, supabase } from './supabaseClient';

const KEYS = {
  QR_TOKENS: 'borario_venue_qr_tokens_v1',
  VISIT_PROOFS: 'borario_visit_proofs_v1',
  AUDIT_EVENTS: 'borario_checkin_audit_events_v1',
  CONTINGENCY_QUEUE: 'borario_offline_contingency_checkins_v1',
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function appendAuditEvent(params: {
  event_type: CheckinAuditEventType;
  restaurant_id: string;
  reservation_id?: string;
  visit_proof_id?: string;
  actor_role: CheckinAuditEvent['actor_role'];
  message: string;
}): CheckinAuditEvent {
  const event: CheckinAuditEvent = {
    id: generateUUID(),
    ...params,
    created_at: new Date().toISOString(),
  };
  const current = readJson<CheckinAuditEvent[]>(KEYS.AUDIT_EVENTS, []);
  writeJson(KEYS.AUDIT_EVENTS, [event, ...current].slice(0, 250));
  return event;
}

export function recordVoucherAuditEvent(params: {
  event_type: 'REWARD_VOUCHER_VALIDATED' | 'REWARD_VOUCHER_CANCELLED';
  restaurantId: string;
  actorRole: CheckinAuditEvent['actor_role'];
  message: string;
}): void {
  appendAuditEvent({
    event_type: params.event_type,
    restaurant_id: params.restaurantId,
    actor_role: params.actorRole,
    message: params.message,
  });
}

export function getCheckinAuditEvents(restaurantId?: string): CheckinAuditEvent[] {
  const events = readJson<CheckinAuditEvent[]>(KEYS.AUDIT_EVENTS, []);
  if (!restaurantId) return events;
  return events.filter((e) => e.restaurant_id === restaurantId);
}

export function getVenueQrTokens(restaurantId?: string): VenueQrToken[] {
  const tokens = readJson<VenueQrToken[]>(KEYS.QR_TOKENS, []);
  if (!restaurantId) return tokens;
  return tokens.filter((t) => t.restaurant_id === restaurantId);
}

export function getActiveVenueQrToken(restaurantId: string): VenueQrToken | null {
  const now = Date.now();
  return (
    getVenueQrTokens(restaurantId).find(
      (t) =>
        !t.revoked &&
        new Date(t.expires_at).getTime() > now &&
        t.consumed_count < t.max_uses
    ) || null
  );
}

function generateShortTokenCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BR-QR-${suffix}`;
}

function generateContingencyPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function issueDynamicVenueQrToken(params: {
  restaurantId: string;
  ttlSeconds?: number;
  maxUses?: number;
  issuedByLabel?: string;
}): VenueQrToken {
  const ttl = Math.max(60, Math.min(params.ttlSeconds ?? 300, 1800));
  const maxUses = Math.max(1, Math.min(params.maxUses ?? 1, 50));
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttl * 1000);

  // Revoga tokens anteriores não expirados do mesmo estabelecimento para garantir rotação limpa
  const existing = readJson<VenueQrToken[]>(KEYS.QR_TOKENS, []).map((t) =>
    t.restaurant_id === params.restaurantId && !t.revoked
      ? { ...t, revoked: true }
      : t
  );

  const token: VenueQrToken = {
    id: generateUUID(),
    restaurant_id: params.restaurantId,
    token_code: generateShortTokenCode(),
    contingency_pin: generateContingencyPin(),
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    max_uses: maxUses,
    consumed_count: 0,
    revoked: false,
    issued_by_label: params.issuedByLabel || 'Balcão Parceiro',
  };

  writeJson(KEYS.QR_TOKENS, [token, ...existing].slice(0, 120));

  appendAuditEvent({
    event_type: 'QR_ISSUED',
    restaurant_id: params.restaurantId,
    actor_role: 'PARTNER',
    message: `QR dinâmico temporário emitido (${token.token_code}, validade ${Math.round(
      ttl / 60
    )} min).`,
  });

  if (supabase && isValidUuid(params.restaurantId)) {
    void supabase
      .rpc('issue_venue_qr_token', {
        p_restaurant_id: params.restaurantId,
        p_ttl_seconds: ttl,
        p_max_uses: maxUses,
      })
      .then(() => undefined, () => undefined);
  }

  return token;
}

export function revokeVenueQrToken(tokenId: string): VenueQrToken[] {
  let targetRestaurantId = '';
  const next = readJson<VenueQrToken[]>(KEYS.QR_TOKENS, []).map((t) => {
    if (t.id !== tokenId) return t;
    targetRestaurantId = t.restaurant_id;
    return { ...t, revoked: true };
  });
  writeJson(KEYS.QR_TOKENS, next);

  if (targetRestaurantId) {
    appendAuditEvent({
      event_type: 'QR_REVOKED',
      restaurant_id: targetRestaurantId,
      actor_role: 'PARTNER',
      message: 'Token QR dinâmico revogado manualmente pelo estabelecimento.',
    });
  }
  return next;
}

export function getVisitProofs(filters?: {
  restaurantId?: string;
  userId?: string;
}): VisitProofRecord[] {
  const proofs = readJson<VisitProofRecord[]>(KEYS.VISIT_PROOFS, []);
  return proofs.filter((p) => {
    if (filters?.restaurantId && p.restaurant_id !== filters.restaurantId) return false;
    if (filters?.userId && p.user_id !== filters.userId) return false;
    return true;
  });
}

export function getVisitProofsForReservation(reservationId: string): VisitProofRecord[] {
  return getVisitProofs().filter((p) => p.reservation_id === reservationId);
}

export function getVisitProofForReservation(reservationId: string): VisitProofRecord | undefined {
  const list = getVisitProofsForReservation(reservationId);
  return list.find((p) => (p.participant_slot ?? 1) === 1) || list[0];
}

export function hasVerifiedVisitForVenue(experienceId: string): boolean {
  return getVisitProofs({ restaurantId: experienceId }).some(
    (p) =>
      p.presence_level === 'VERIFIED_VISIT' ||
      p.presence_level === 'VERIFIED_CONSUMPTION' ||
      p.presence_level === 'PRESENCE_WITH_EVIDENCE' ||
      p.presence_level === 'CHECKIN_REGISTERED'
  );
}

export function hasVerifiedConsumptionForVenue(experienceId: string): boolean {
  return getVisitProofs({ restaurantId: experienceId }).some(
    (p) => p.presence_level === 'VERIFIED_CONSUMPTION'
  );
}

export interface ValidateCheckinResult {
  ok: boolean;
  errorCode?:
    | 'INVALID_RESERVATION'
    | 'PENDING_PARTNER_CONFIRMATION'
    | 'DUPLICATE'
    | 'SELF_APPROVAL_BLOCKED'
    | 'EXPIRED'
    | 'INVALID_TOKEN';
  message: string;
  proof?: VisitProofRecord;
  evidenceMethod?: VisitEvidenceMethod;
}

/**
 * Valida check-in dinâmico temporário vinculado à reserva e ao estabelecimento.
 * - Bloqueia reutilização, expiração, divergência de estabelecimento e autovalidação unilateral.
 * - QR isolado NUNCA gera VERIFIED_CONSUMPTION (consistente com restrição estrutural do banco).
 */
export function validateReservationDynamicCheckin(params: {
  reservation: ReservationRequest;
  scannedCodeOrPin: string;
  actorContext?: 'USER' | 'PARTNER';
  hasGeolocationEvidence?: boolean;
  participantSlot?: number;
  participantLabel?: string;
  participantUserId?: string;
}): ValidateCheckinResult {
  const { reservation } = params;
  const actorRole = params.actorContext || 'USER';
  const normalized = params.scannedCodeOrPin.trim().toUpperCase();
  const participantSlot = Math.max(1, Math.round(params.participantSlot ?? 1));
  const maxGuests = Math.max(1, reservation.guests || 1);

  if (
    reservation.status === 'CANCELLED' ||
    reservation.stage === 'CANCELLED' ||
    reservation.stage === 'NO_SHOW' ||
    reservation.stage === 'ENDED_WITHOUT_GOAL'
  ) {
    appendAuditEvent({
      event_type: 'CHECKIN_REJECTED_INVALID',
      restaurant_id: reservation.experience_id,
      reservation_id: reservation.id,
      actor_role: actorRole,
      message: `Tentativa de check-in em reserva inativa (${reservation.stage || reservation.status}).`,
    });
    return {
      ok: false,
      errorCode: 'INVALID_RESERVATION',
      message: 'Esta reserva está cancelada ou encerrada e não aceita check-in.',
    };
  }

  if (participantSlot > maxGuests) {
    return {
      ok: false,
      errorCode: 'INVALID_RESERVATION',
      message: `Slot #${participantSlot} excede a quantidade de pessoas da reserva (${maxGuests}).`,
    };
  }

  if (
    reservation.modality === 'DEMAND_OFFER' &&
    reservation.stage !== 'CONFIRMED' &&
    reservation.status !== 'CONFIRMED'
  ) {
    appendAuditEvent({
      event_type: 'CHECKIN_REJECTED_INVALID',
      restaurant_id: reservation.experience_id,
      reservation_id: reservation.id,
      actor_role: actorRole,
      message: 'Tentativa de check-in antes da confirmação da oferta por demanda pelo parceiro.',
    });
    return {
      ok: false,
      errorCode: 'PENDING_PARTNER_CONFIRMATION',
      message:
        'Esta solicitação em reserva por demanda ainda aguarda a confirmação final do estabelecimento.',
    };
  }

  // Bloqueio de duplicidade por participante dentro da mesma reserva (titular slot #1 ou acompanhante #2..N)
  const existingForSlot = getVisitProofsForReservation(reservation.id).find(
    (p) =>
      (p.participant_slot ?? 1) === participantSlot ||
      (params.participantUserId && p.user_id === params.participantUserId)
  );
  if (existingForSlot) {
    appendAuditEvent({
      event_type: 'CHECKIN_REJECTED_DUPLICATE',
      restaurant_id: reservation.experience_id,
      reservation_id: reservation.id,
      visit_proof_id: existingForSlot.id,
      actor_role: actorRole,
      message: `Check-in duplicado bloqueado para participante #${participantSlot} na mesma reserva.`,
    });
    return {
      ok: false,
      errorCode: 'DUPLICATE',
      message:
        participantSlot === 1
          ? 'Check-in já validado anteriormente para esta reserva (proteção antifraude).'
          : `Participante #${participantSlot} já teve presença validada nesta reserva.`,
    };
  }

  if (!normalized) {
    return {
      ok: false,
      errorCode: 'INVALID_TOKEN',
      message: 'Informe ou escaneie o código QR dinâmico ou PIN operacional do estabelecimento.',
    };
  }

  const allTokens = readJson<VenueQrToken[]>(KEYS.QR_TOKENS, []);
  const matchedAnyVenue = allTokens.find(
    (t) => t.token_code.toUpperCase() === normalized || t.contingency_pin.toUpperCase() === normalized
  );

  // Bloqueia autovalidação unilateral com strings estáticas/arbitrárias ou código de outro local
  if (!matchedAnyVenue) {
    appendAuditEvent({
      event_type: 'CHECKIN_REJECTED_SELF_APPROVAL',
      restaurant_id: reservation.experience_id,
      reservation_id: reservation.id,
      actor_role: actorRole,
      message: `Token "${normalized}" inexistente ou não emitido por um parceiro autorizado.`,
    });
    return {
      ok: false,
      errorCode: 'SELF_APPROVAL_BLOCKED',
      message:
        'Código inválido ou não emitido pelo estabelecimento. Ao chegar, solicite o QR Code dinâmico oficial ao atendente.',
    };
  }

  if (matchedAnyVenue.restaurant_id !== reservation.experience_id) {
    appendAuditEvent({
      event_type: 'CHECKIN_REJECTED_SELF_APPROVAL',
      restaurant_id: reservation.experience_id,
      reservation_id: reservation.id,
      actor_role: actorRole,
      message: `Divergência de estabelecimento: token emitido para outro parceiro.`,
    });
    return {
      ok: false,
      errorCode: 'SELF_APPROVAL_BLOCKED',
      message:
        'Este código pertence a outro estabelecimento e não corresponde à sua reserva.',
    };
  }

  if (matchedAnyVenue.revoked) {
    appendAuditEvent({
      event_type: 'CHECKIN_REJECTED_INVALID',
      restaurant_id: reservation.experience_id,
      reservation_id: reservation.id,
      actor_role: actorRole,
      message: `Tentativa com token QR revogado (${matchedAnyVenue.token_code}).`,
    });
    return {
      ok: false,
      errorCode: 'INVALID_TOKEN',
      message: 'Este QR dinâmico foi substituído ou revogado. Solicite o código atual no balcão.',
    };
  }

  if (new Date(matchedAnyVenue.expires_at).getTime() < Date.now()) {
    appendAuditEvent({
      event_type: 'CHECKIN_REJECTED_EXPIRED',
      restaurant_id: reservation.experience_id,
      reservation_id: reservation.id,
      actor_role: actorRole,
      message: `QR dinâmico expirado (${matchedAnyVenue.token_code}).`,
    });
    return {
      ok: false,
      errorCode: 'EXPIRED',
      message: 'QR Code expirado (janela temporária encerrada). Peça um novo QR no estabelecimento.',
    };
  }

  if (matchedAnyVenue.consumed_count >= matchedAnyVenue.max_uses) {
    appendAuditEvent({
      event_type: 'CHECKIN_REJECTED_DUPLICATE',
      restaurant_id: reservation.experience_id,
      reservation_id: reservation.id,
      actor_role: actorRole,
      message: `Token QR atingiu o limite máximo de utilizações (${matchedAnyVenue.token_code}).`,
    });
    return {
      ok: false,
      errorCode: 'DUPLICATE',
      message: 'Este QR Code já atingiu o limite de utilizações e não pode ser reutilizado.',
    };
  }

  // Consome token e grava Prova de Visita
  const updatedTokens = allTokens.map((t) =>
    t.id === matchedAnyVenue.id ? { ...t, consumed_count: t.consumed_count + 1 } : t
  );
  writeJson(KEYS.QR_TOKENS, updatedTokens);

  const matchedByPin = matchedAnyVenue.contingency_pin.toUpperCase() === normalized;
  let evidenceMethod: VisitEvidenceMethod = 'DYNAMIC_QR';
  if (matchedByPin) {
    evidenceMethod = 'CONTINGENCY_PIN';
  } else if (params.hasGeolocationEvidence) {
    evidenceMethod = 'DYNAMIC_QR_GEO';
  }

  // Nunca atribui VERIFIED_CONSUMPTION por QR isolado
  const presenceLevel: VisitProofLevel =
    reservation.status === 'CONFIRMED' || reservation.stage === 'CONFIRMED'
      ? 'VERIFIED_VISIT'
      : params.hasGeolocationEvidence
        ? 'PRESENCE_WITH_EVIDENCE'
        : 'CHECKIN_REGISTERED';

  const me = getUserProfileIdentity();
  const resolvedUserId =
    participantSlot === 1
      ? me.id
      : params.participantUserId || `guest-slot-${participantSlot}-${reservation.id}`;
  const resolvedLabel =
    params.participantLabel?.trim() ||
    (participantSlot === 1 ? `${me.display_name} (Titular)` : `Acompanhante #${participantSlot}`);

  const proof: VisitProofRecord = {
    id: generateUUID(),
    restaurant_id: reservation.experience_id,
    restaurant_name: reservation.experience_name,
    reservation_id: reservation.id,
    user_id: resolvedUserId,
    participant_slot: participantSlot,
    participant_label: resolvedLabel,
    group_booking_owner_id: me.id,
    qr_token_id: matchedAnyVenue.id,
    qr_code_used: matchedAnyVenue.token_code,
    presence_level: presenceLevel,
    evidence_method: evidenceMethod,
    guests_count: participantSlot === 1 ? maxGuests : 1,
    presence_verified_at: new Date().toISOString(),
    is_demonstrative: false,
    notes:
      participantSlot === 1
        ? matchedByPin
          ? 'Check-in validado com código operacional de contingência do estabelecimento.'
          : 'Check-in validado com QR dinâmico temporário antes do consumo.'
        : `Check-in individual de acompanhante (#${participantSlot} — ${resolvedLabel}) validado sem pontuar ao titular.`,
  };

  const currentProofs = readJson<VisitProofRecord[]>(KEYS.VISIT_PROOFS, []);
  writeJson(KEYS.VISIT_PROOFS, [proof, ...currentProofs]);

  appendAuditEvent({
    event_type: participantSlot >= 2 ? 'GROUP_PARTICIPANT_VALIDATED' : 'CHECKIN_VALIDATED',
    restaurant_id: reservation.experience_id,
    reservation_id: reservation.id,
    visit_proof_id: proof.id,
    actor_role: actorRole,
    message:
      participantSlot >= 2
        ? `Participante de grupo validado individualmente (${resolvedLabel}, slot #${participantSlot} via ${evidenceMethod}). Titular recebe 0 pontos extras.`
        : `Presença validada (${presenceLevel} via ${evidenceMethod}) para reserva de ${maxGuests} pessoa(s).`,
  });

  if (participantSlot === 1 && supabase && isValidUuid(reservation.id) && isValidUuid(me.id)) {
    void supabase
      .rpc('validate_dynamic_qr_checkin', {
        p_reservation_id: reservation.id,
        p_token_code: normalized,
        p_evidence_method: evidenceMethod,
      })
      .then(() => undefined, () => undefined);
  }

  return {
    ok: true,
    message:
      participantSlot >= 2
        ? `Check-in individual de ${resolvedLabel} validado!`
        : presenceLevel === 'VERIFIED_VISIT'
          ? 'Visita Verificada registrada com sucesso via QR dinâmico!'
          : 'Check-in de chegada registrado! Aguardando evidência complementar para consumo verificado.',
    proof,
    evidenceMethod,
  };
}

export function getOfflineContingencyCheckins(restaurantId?: string): OfflineContingencyCheckin[] {
  const list = readJson<OfflineContingencyCheckin[]>(KEYS.CONTINGENCY_QUEUE, []);
  if (!restaurantId) return list;
  return list.filter((item) => item.restaurant_id === restaurantId);
}

/**
 * Protocolo de contingência operacional quando câmera falhar ou dispositivo estiver offline.
 * Não aprova consumo unilateralmente; registra entrada auditável para conciliação pelo parceiro.
 */
export function queueOfflineContingencyCheckin(params: {
  reservation: ReservationRequest;
  contingencyPinEntered: string;
}): { ok: boolean; message: string; entry?: OfflineContingencyCheckin } {
  const pin = params.contingencyPinEntered.trim();
  if (pin.length < 4) {
    return {
      ok: false,
      message: 'Informe o PIN de contingência de 6 dígitos fornecido pelo estabelecimento.',
    };
  }

  const existingProof = getVisitProofForReservation(params.reservation.id);
  if (existingProof) {
    return { ok: false, message: 'Esta reserva já possui check-in validado.' };
  }

  const entry: OfflineContingencyCheckin = {
    id: generateUUID(),
    reservation_id: params.reservation.id,
    restaurant_id: params.reservation.experience_id,
    restaurant_name: params.reservation.experience_name,
    contingency_pin_entered: pin,
    guests_count: Math.max(1, params.reservation.guests || 1),
    queued_at: new Date().toISOString(),
    reconciliation_status: 'PENDING_PARTNER_RECONCILE',
  };

  const current = readJson<OfflineContingencyCheckin[]>(KEYS.CONTINGENCY_QUEUE, []);
  writeJson(KEYS.CONTINGENCY_QUEUE, [entry, ...current]);

  appendAuditEvent({
    event_type: 'OFFLINE_CONTINGENCY_QUEUED',
    restaurant_id: params.reservation.experience_id,
    reservation_id: params.reservation.id,
    actor_role: 'USER',
    message: `Check-in em contingência operacional registrado (PIN ${pin}) para conciliação do parceiro.`,
  });

  return {
    ok: true,
    message:
      'Contingência registrada! O estabelecimento confirmará a conciliação da sua chegada no painel.',
    entry,
  };
}

export function reconcileContingencyCheckin(params: {
  contingencyId: string;
  reservation: ReservationRequest;
  decision: 'RECONCILED' | 'REJECTED';
  partnerLabel: string;
}): { ok: boolean; message: string; proof?: VisitProofRecord } {
  const queue = readJson<OfflineContingencyCheckin[]>(KEYS.CONTINGENCY_QUEUE, []);
  const target = queue.find((item) => item.id === params.contingencyId);
  if (!target) {
    return { ok: false, message: 'Registro de contingência não encontrado.' };
  }

  const updatedQueue = queue.map((item) =>
    item.id === params.contingencyId
      ? { ...item, reconciliation_status: params.decision }
      : item
  );
  writeJson(KEYS.CONTINGENCY_QUEUE, updatedQueue);

  if (params.decision === 'REJECTED') {
    appendAuditEvent({
      event_type: 'CHECKIN_REJECTED_INVALID',
      restaurant_id: target.restaurant_id,
      reservation_id: target.reservation_id,
      actor_role: 'PARTNER',
      message: `Contingência offline recusada por ${params.partnerLabel}.`,
    });
    return { ok: true, message: 'Registro de contingência recusado e auditado.' };
  }

  const me = getUserProfileIdentity();
  const proof: VisitProofRecord = {
    id: generateUUID(),
    restaurant_id: params.reservation.experience_id,
    restaurant_name: params.reservation.experience_name,
    reservation_id: params.reservation.id,
    user_id: me.id,
    presence_level: 'VERIFIED_VISIT',
    evidence_method: 'OFFLINE_CONTINGENCY_RECONCILED',
    guests_count: target.guests_count,
    presence_verified_at: new Date().toISOString(),
    partner_confirmed_by: params.partnerLabel,
    is_demonstrative: false,
    notes: `Conciliado em contingência operacional com PIN ${target.contingency_pin_entered}.`,
  };

  const currentProofs = readJson<VisitProofRecord[]>(KEYS.VISIT_PROOFS, []);
  writeJson(KEYS.VISIT_PROOFS, [proof, ...currentProofs]);

  appendAuditEvent({
    event_type: 'OFFLINE_CONTINGENCY_RECONCILED',
    restaurant_id: target.restaurant_id,
    reservation_id: target.reservation_id,
    visit_proof_id: proof.id,
    actor_role: 'PARTNER',
    message: `Contingência conciliada como Visita Verificada por ${params.partnerLabel}.`,
  });

  return {
    ok: true,
    message: 'Check-in de contingência conciliado como Visita Verificada!',
    proof,
  };
}

/**
 * Promove uma visita para Consumo Verificado SOMENTE com confirmação adicional do parceiro ou comprovante/PDV.
 */
export function confirmPostConsumptionVerification(params: {
  visitProofId: string;
  partnerLabel: string;
  evidenceType: 'PARTNER_POST_CONSUMPTION' | 'POS_RECEIPT';
  consumptionReference: string;
}): { ok: boolean; message: string; proof?: VisitProofRecord } {
  const ref = params.consumptionReference.trim();
  const partner = params.partnerLabel.trim();
  if (!partner || !ref) {
    return {
      ok: false,
      message:
        'Consumo Verificado exige confirmação do estabelecimento e referência adicional (comanda, nota ou registro PDV).',
    };
  }

  const proofs = readJson<VisitProofRecord[]>(KEYS.VISIT_PROOFS, []);
  const target = proofs.find((p) => p.id === params.visitProofId);
  if (!target) {
    return { ok: false, message: 'Prova de visita não encontrada para atualizar consumo.' };
  }

  const updated: VisitProofRecord = {
    ...target,
    presence_level: 'VERIFIED_CONSUMPTION',
    evidence_method: params.evidenceType,
    consumption_verified_at: new Date().toISOString(),
    consumption_reference: ref,
    partner_confirmed_by: partner,
  };

  writeJson(
    KEYS.VISIT_PROOFS,
    proofs.map((p) => (p.id === target.id ? updated : p))
  );

  appendAuditEvent({
    event_type: 'CONSUMPTION_VERIFIED_BY_PARTNER',
    restaurant_id: target.restaurant_id,
    reservation_id: target.reservation_id,
    visit_proof_id: target.id,
    actor_role: 'PARTNER',
    message: `Consumo Verificado confirmado por ${partner} (Ref.: ${ref}).`,
  });

  return {
    ok: true,
    message: 'Consumo Verificado registrado com evidência adicional!',
    proof: updated,
  };
}

export function recordFeeDisputeAuditEvent(params: {
  restaurantId: string;
  reservationId: string;
  visitProofId?: string;
  reason: string;
}): void {
  appendAuditEvent({
    event_type: 'FEE_DISPUTED',
    restaurant_id: params.restaurantId,
    reservation_id: params.reservationId,
    visit_proof_id: params.visitProofId,
    actor_role: 'PARTNER',
    message: `Parceiro contestou evento de remuneração: "${params.reason.trim()}"`,
  });
}

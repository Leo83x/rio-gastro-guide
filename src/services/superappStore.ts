import type {
  ClubOffer,
  GroupDrop,
  GroupVoteSession,
  NotificationItem,
  PointTransaction,
  ReservationRequest,
  UserPreferences,
} from '../types/experience';
import {
  DIRECT_PAYMENT_NOTICE,
  type VisitProofRecord,
} from '../types/verification';
import { generateUUID } from '../utils/slug';
import { accruePartnerFeeFromCheckin } from './partnerCommercialStore';
import {
  appendLedgerTransaction,
  getPointsBalance,
  getPointTransactions,
  POINTS_STORAGE_KEY,
} from './pointsLedger';
import {
  convertReferralOnVerifiedCheckin,
  getIncomingReferralCode,
  reverseReferralForBooking,
} from './referralStore';
import {
  confirmPostConsumptionVerification,
  getVisitProofs,
  reconcileContingencyCheckin,
  validateReservationDynamicCheckin,
} from './visitProofStore';

export { appendLedgerTransaction, getPointsBalance, getPointTransactions };

const KEYS = {
  PREFS: 'rio_gastro_prefs_v1',
  POINTS: POINTS_STORAGE_KEY,
  RESERVATIONS: 'rio_gastro_reservations_v1',
  NOTIFICATIONS: 'rio_gastro_notifications_v1',
  GROUP_VOTES: 'rio_gastro_group_votes_v1',
  DROPS: 'rio_gastro_drops_v1',
  QR_USED_NONCES: 'rio_gastro_qr_nonces_v1',
};

const DEFAULT_PREFERENCES: UserPreferences = {
  favorite_macro_categories: [],
  favorite_neighborhoods: [],
  preferred_moments: [],
  budget_tier: '$$',
  lgpd_consents: {
    location: false,
    personalization: false,
    whatsapp: false,
    notifications: true,
    calendar: false,
  },
};

export function getUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(KEYS.PREFS);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      lgpd_consents: {
        ...DEFAULT_PREFERENCES.lgpd_consents,
        ...(parsed.lgpd_consents || {}),
      },
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  localStorage.setItem(KEYS.PREFS, JSON.stringify(prefs));
}

export function hasValidatedCheckinForVenue(experienceId: string): boolean {
  if (getVisitProofs({ restaurantId: experienceId }).length > 0) {
    return true;
  }
  return getPointTransactions().some(
    (tx) =>
      tx.origin === 'checkin_qr' &&
      tx.experience_id === experienceId &&
      tx.validation_status !== 'REVERSED'
  );
}

function appendCheckinPoints(
  experienceId: string,
  experienceName: string,
  qrCodeToken: string
): PointTransaction | undefined {
  const today = new Date().toISOString().slice(0, 10);
  const txs = getPointTransactions();
  const alreadyCreditedToday = txs.some(
    (tx) =>
      tx.origin === 'checkin_qr' &&
      tx.experience_id === experienceId &&
      tx.created_at.slice(0, 10) === today &&
      tx.validation_status !== 'REVERSED'
  );
  if (alreadyCreditedToday) return undefined;

  const tx = appendLedgerTransaction({
    type: 'CREDIT',
    amount: 50,
    origin: 'checkin_qr',
    description: `Visita validada por QR dinâmico em ${experienceName}`,
    experience_id: experienceId,
    experience_name: experienceName,
    qr_nonce: qrCodeToken,
    validation_status: 'RELEASED',
  });

  const usedRaw = localStorage.getItem(KEYS.QR_USED_NONCES);
  const usedNonces: string[] = usedRaw ? (JSON.parse(usedRaw) as string[]) : [];
  if (!usedNonces.includes(qrCodeToken)) {
    localStorage.setItem(KEYS.QR_USED_NONCES, JSON.stringify([...usedNonces, qrCodeToken]));
  }
  return tx;
}

/**
 * Fluxo oficial de check-in dinâmico atrelado a uma reserva específica.
 * Atualiza estado da reserva, registra Prova de Visita, apura taxa fixa B2B sem percentual sobre consumo
 * e converte indicações vinculadas somente após validação real da visita.
 */
export function completeReservationCheckin(params: {
  reservationId: string;
  scannedCodeOrPin: string;
  actorContext?: 'USER' | 'PARTNER';
  hasGeolocationEvidence?: boolean;
}): {
  ok: boolean;
  message: string;
  proof?: VisitProofRecord;
  reservation?: ReservationRequest;
  transaction?: PointTransaction;
} {
  const all = getReservations();
  const target = all.find((r) => r.id === params.reservationId);
  if (!target) {
    return { ok: false, message: 'Reserva não encontrada para validação de check-in.' };
  }

  const res = validateReservationDynamicCheckin({
    reservation: target,
    scannedCodeOrPin: params.scannedCodeOrPin,
    actorContext: params.actorContext || 'USER',
    hasGeolocationEvidence: params.hasGeolocationEvidence,
  });

  if (!res.ok || !res.proof) {
    return { ok: false, message: res.message };
  }

  const nextStage =
    res.proof.presence_level === 'VERIFIED_VISIT' ? 'VERIFIED_VISIT' : 'CHECKED_IN';

  const updatedReservation: ReservationRequest = {
    ...target,
    status: 'CONFIRMED',
    stage: nextStage,
    visit_proof_id: res.proof.id,
    visit_proof_level: res.proof.presence_level,
  };

  localStorage.setItem(
    KEYS.RESERVATIONS,
    JSON.stringify(all.map((r) => (r.id === updatedReservation.id ? updatedReservation : r)))
  );

  accruePartnerFeeFromCheckin({
    reservation: updatedReservation,
    visitProof: res.proof,
  });

  const tx = appendCheckinPoints(
    updatedReservation.experience_id,
    updatedReservation.experience_name,
    res.proof.qr_code_used || params.scannedCodeOrPin.trim().toUpperCase()
  );

  const referralConversion = convertReferralOnVerifiedCheckin({
    reservation: updatedReservation,
    visitProof: res.proof,
  });

  addNotification({
    channel: 'internal',
    type: 'reward',
    title: `Check-in validado em ${updatedReservation.experience_name}`,
    message:
      (tx
        ? `+50 Rio Points creditados! Visita registrada (${nextStage}).`
        : `Sua presença foi validada corretamente antes do consumo.`) +
      (referralConversion.converted
        ? ` Indicação convertida (+${referralConversion.pointsCredited} RP).`
        : ''),
  });

  return {
    ok: true,
    message: tx
      ? `${res.message} +50 Rio Points creditados!`
      : res.message,
    proof: res.proof,
    reservation: updatedReservation,
    transaction: tx,
  };
}

/**
 * Wrapper retrocompatível para validação de QR no aplicativo.
 * Requer vínculo a reserva elegível ou token dinâmico temporário oficial do estabelecimento (bloqueia código demo estático).
 */
export function validateAndCreditQRCheckin(
  experienceId: string,
  experienceName: string,
  qrCodeToken: string,
  options?: {
    reservationId?: string;
    actorContext?: 'USER' | 'PARTNER';
    hasGeolocationEvidence?: boolean;
  }
): { ok: boolean; message: string; transaction?: PointTransaction } {
  const trimmed = qrCodeToken.trim().toUpperCase();

  if (options?.reservationId) {
    const res = completeReservationCheckin({
      reservationId: options.reservationId,
      scannedCodeOrPin: trimmed,
      actorContext: options.actorContext,
      hasGeolocationEvidence: options.hasGeolocationEvidence,
    });
    return {
      ok: res.ok,
      message: res.message,
      transaction: res.transaction,
    };
  }

  // Busca reserva ativa do usuário neste estabelecimento para vincular o check-in oficial
  const matchingReservation = getReservations().find(
    (r) =>
      r.experience_id === experienceId &&
      r.status !== 'CANCELLED' &&
      r.stage !== 'CANCELLED' &&
      r.stage !== 'NO_SHOW' &&
      r.stage !== 'ENDED_WITHOUT_GOAL' &&
      r.stage !== 'VERIFIED_VISIT' &&
      r.stage !== 'VERIFIED_CONSUMPTION'
  );

  if (!matchingReservation) {
    return {
      ok: false,
      message:
        'Para validar o check-in com segurança, solicite ou selecione sua reserva ativa neste estabelecimento.',
    };
  }

  const res = completeReservationCheckin({
    reservationId: matchingReservation.id,
    scannedCodeOrPin: trimmed,
    actorContext: options?.actorContext,
    hasGeolocationEvidence: options?.hasGeolocationEvidence,
  });

  return {
    ok: res.ok,
    message: res.message || `Check-in em ${experienceName} processado.`,
    transaction: res.transaction,
  };
}

export function creditVerifiedReview(
  experienceId: string,
  experienceName: string
): { ok: boolean; message: string } {
  if (!hasValidatedCheckinForVenue(experienceId)) {
    return {
      ok: false,
      message: 'Avaliação Verificada só pode ser liberada após um check-in validado via QR Code.',
    };
  }

  const txs = getPointTransactions();
  const alreadyReviewed = txs.some(
    (tx) => tx.origin === 'verified_review' && tx.experience_id === experienceId
  );
  if (alreadyReviewed) {
    return { ok: false, message: 'Você já recebeu os pontos de avaliação verificada para este local.' };
  }

  appendLedgerTransaction({
    type: 'CREDIT',
    amount: 30,
    origin: 'verified_review',
    description: `Avaliação Verificada publicada para ${experienceName}`,
    experience_id: experienceId,
    experience_name: experienceName,
    validation_status: 'RELEASED',
  });
  return { ok: true, message: '+30 RP creditados pela Avaliação Verificada!' };
}

export function redeemReward(rewardTitle: string, cost: number): { ok: boolean; message: string } {
  const balance = getPointsBalance();
  if (balance < cost) {
    return { ok: false, message: `Saldo insuficiente (${balance} RP disponíveis, necessário ${cost} RP).` };
  }
  appendLedgerTransaction({
    type: 'REDEEM',
    amount: cost,
    origin: 'reward_redeem',
    description: `Resgate: ${rewardTitle}`,
    validation_status: 'RELEASED',
  });
  return { ok: true, message: `Recompensa "${rewardTitle}" resgatada com sucesso!` };
}

// --- Reservations ---
export function getReservations(): ReservationRequest[] {
  try {
    const raw = localStorage.getItem(KEYS.RESERVATIONS);
    return raw ? (JSON.parse(raw) as ReservationRequest[]) : [];
  } catch {
    return [];
  }
}

export function createReservationRequest(
  payload: Omit<ReservationRequest, 'id' | 'status' | 'created_at'>
): ReservationRequest {
  const stage = payload.stage || 'REQUESTED';
  const incomingRef = payload.referral_code_used || getIncomingReferralCode() || undefined;
  const req: ReservationRequest = {
    ...payload,
    id: generateUUID(),
    status: stage === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING_CONFIRMATION',
    stage,
    modality: payload.modality || 'TRADITIONAL_BOOKING',
    payment_instruction: payload.payment_instruction || DIRECT_PAYMENT_NOTICE,
    attribution_origin: payload.attribution_origin || 'catalog',
    referral_code_used: incomingRef,
    snapshot_terms: payload.snapshot_terms || {
      title: payload.offering_title || `Reserva em ${payload.experience_name}`,
      price_summary: DIRECT_PAYMENT_NOTICE,
    },
    created_at: new Date().toISOString(),
  };
  const list = getReservations();
  localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify([req, ...list]));

  addNotification({
    channel: payload.whatsapp_reminder ? 'whatsapp' : 'internal',
    type: 'reservation',
    title: `Solicitação registrada: ${payload.experience_name}`,
    message: `${payload.date} às ${payload.time} (${payload.guests} pessoas) — Pagamento direto no local. Aguardando confirmação do estabelecimento.`,
  });

  return req;
}

export function updateReservationStage(
  reservationId: string,
  patch: Partial<ReservationRequest>
): ReservationRequest[] {
  const next = getReservations().map((r) =>
    r.id === reservationId ? { ...r, ...patch } : r
  );
  localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(next));
  return next;
}

export function cancelReservation(id: string): ReservationRequest[] {
  const next = getReservations().map((r) =>
    r.id === id
      ? {
          ...r,
          status: 'CANCELLED' as const,
          stage: 'CANCELLED' as const,
        }
      : r
  );
  localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(next));
  reverseReferralForBooking(id, 'Reserva cancelada pelo usuário ou estabelecimento');
  return next;
}

export function markReservationNoShow(id: string): ReservationRequest[] {
  const next = getReservations().map((r) =>
    r.id === id
      ? {
          ...r,
          status: 'CANCELLED' as const,
          stage: 'NO_SHOW' as const,
        }
      : r
  );
  localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(next));
  reverseReferralForBooking(id, 'Não comparecimento (No-Show) registrado pelo parceiro');
  return next;
}

export function partnerReconcileContingencyCheckin(params: {
  contingencyId: string;
  reservationId: string;
  decision: 'RECONCILED' | 'REJECTED';
  partnerLabel: string;
}): { ok: boolean; message: string; reservations: ReservationRequest[] } {
  const all = getReservations();
  const target = all.find((r) => r.id === params.reservationId);
  if (!target) {
    return {
      ok: false,
      message: 'Reserva associada não encontrada para conciliação.',
      reservations: all,
    };
  }

  const res = reconcileContingencyCheckin({
    contingencyId: params.contingencyId,
    reservation: target,
    decision: params.decision,
    partnerLabel: params.partnerLabel,
  });

  if (!res.ok) {
    return { ok: false, message: res.message, reservations: all };
  }

  if (params.decision === 'RECONCILED' && res.proof) {
    const updatedReservation: ReservationRequest = {
      ...target,
      status: 'CONFIRMED',
      stage: 'VERIFIED_VISIT',
      visit_proof_id: res.proof.id,
      visit_proof_level: 'VERIFIED_VISIT',
    };
    const nextReservations = all.map((r) =>
      r.id === updatedReservation.id ? updatedReservation : r
    );
    localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(nextReservations));

    accruePartnerFeeFromCheckin({
      reservation: updatedReservation,
      visitProof: res.proof,
    });

    appendCheckinPoints(
      updatedReservation.experience_id,
      updatedReservation.experience_name,
      `CONTINGENCY-${params.contingencyId.slice(0, 6).toUpperCase()}`
    );

    convertReferralOnVerifiedCheckin({
      reservation: updatedReservation,
      visitProof: res.proof,
    });

    addNotification({
      channel: 'internal',
      type: 'reward',
      title: `Check-in conciliado: ${updatedReservation.experience_name}`,
      message: `O estabelecimento confirmou sua chegada de contingência como Visita Verificada.`,
    });

    return { ok: true, message: res.message, reservations: nextReservations };
  }

  return { ok: true, message: res.message, reservations: all };
}

export function partnerVerifyPostConsumption(params: {
  visitProofId: string;
  partnerLabel: string;
  evidenceType: 'PARTNER_POST_CONSUMPTION' | 'POS_RECEIPT';
  consumptionReference: string;
}): { ok: boolean; message: string; reservations: ReservationRequest[] } {
  const res = confirmPostConsumptionVerification(params);
  const all = getReservations();

  if (!res.ok || !res.proof) {
    return { ok: false, message: res.message, reservations: all };
  }

  const nextReservations = res.proof.reservation_id
    ? all.map((r) =>
        r.id === res.proof?.reservation_id
          ? {
              ...r,
              stage: 'VERIFIED_CONSUMPTION' as const,
              visit_proof_level: 'VERIFIED_CONSUMPTION' as const,
            }
          : r
      )
    : all;

  if (res.proof.reservation_id) {
    localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(nextReservations));
  }

  addNotification({
    channel: 'internal',
    type: 'reward',
    title: `Consumo Verificado: ${res.proof.restaurant_name}`,
    message: `O estabelecimento confirmou sua evidência pós-consumo (Ref.: ${params.consumptionReference.trim()}).`,
  });

  return { ok: true, message: res.message, reservations: nextReservations };
}

// --- Notifications ---
export function getNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(KEYS.NOTIFICATIONS);
    return raw ? (JSON.parse(raw) as NotificationItem[]) : [];
  } catch {
    return [];
  }
}

export function addNotification(
  payload: Omit<NotificationItem, 'id' | 'read' | 'created_at'>
): NotificationItem {
  const item: NotificationItem = {
    ...payload,
    id: generateUUID(),
    read: false,
    created_at: new Date().toISOString(),
  };
  const list = getNotifications();
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([item, ...list].slice(0, 30)));
  return item;
}

export function markAllNotificationsRead(): NotificationItem[] {
  const next = getNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(next));
  return next;
}

// --- Group Voting ---
export function getGroupVoteSession(): GroupVoteSession | null {
  try {
    const raw = localStorage.getItem(KEYS.GROUP_VOTES);
    return raw ? (JSON.parse(raw) as GroupVoteSession) : null;
  } catch {
    return null;
  }
}

export function saveGroupVoteSession(session: GroupVoteSession): void {
  localStorage.setItem(KEYS.GROUP_VOTES, JSON.stringify(session));
}

// --- Demonstrative Club Offers & Group Drops (Clearly labeled DEMONSTRATIVE) ---
export const DEMONSTRATIVE_CLUB_OFFERS: ClubOffer[] = [
  {
    id: 'club-1',
    experience_id: '11111111-1111-4111-8111-000000000009',
    experience_name: 'Bráz Pizzaria',
    neighborhood: 'Jardim Botânico',
    title: '2º Chope ou Sobremesa Cortesia no Jantar',
    benefit_type: 'FREE_DESSERT',
    discount_label: 'Cortesia Membro',
    valid_window: 'Terça a Quinta · 18h30–20h30',
    estimated_savings_brl: 26,
    reliability: 'DEMONSTRATIVE',
  },
  {
    id: 'club-2',
    experience_id: '11111111-1111-4111-8111-000000000004',
    experience_name: 'CT Boucherie',
    neighborhood: 'Leblon',
    title: 'Horário Off-Peak: Condição Especial no Menu Executivo',
    benefit_type: 'OFF_PEAK',
    discount_label: 'Condição Especial',
    valid_window: 'Seg a Qui · 12h–14h e 18h–19h30',
    estimated_savings_brl: 45,
    reliability: 'DEMONSTRATIVE',
  },
  {
    id: 'club-3',
    experience_id: '11111111-1111-4111-8111-000000000010',
    experience_name: 'Confeitaria Colombo',
    neighborhood: 'Centro',
    title: '2 por 1 no Chá da Tarde Clássico',
    benefit_type: '2_FOR_1',
    discount_label: '2 por 1',
    valid_window: 'Segunda a Sexta · 15h–17h',
    estimated_savings_brl: 55,
    reliability: 'DEMONSTRATIVE',
  },
];

export function getGroupDrops(): GroupDrop[] {
  const defaults: GroupDrop[] = [
    {
      id: 'drop-1',
      experience_id: '11111111-1111-4111-8111-000000000011',
      experience_name: 'Gero Ipanema',
      neighborhood: 'Ipanema',
      title: 'Noite Italiana Especial — Menu em 3 Tempos (Demanda Agregada)',
      discount_label: 'Condição Especial',
      current_participants: 34,
      target_participants: 50,
      deadline_label: 'Janela de 48h (Demo)',
      joined: false,
      reliability: 'DEMONSTRATIVE',
    },
    {
      id: 'drop-2',
      experience_id: '11111111-1111-4111-8111-000000000006',
      experience_name: 'Bar Urca',
      neighborhood: 'Urca',
      title: 'Combo Mureta Pôr do Sol para 2 pessoas (Oferta por Demanda)',
      discount_label: 'Benefício Especial',
      current_participants: 42,
      target_participants: 50,
      deadline_label: 'Restam 8 manifestações (Demo)',
      joined: false,
      reliability: 'DEMONSTRATIVE',
    },
  ];
  try {
    const raw = localStorage.getItem(KEYS.DROPS);
    if (!raw) return defaults;
    return JSON.parse(raw) as GroupDrop[];
  } catch {
    return defaults;
  }
}

export function toggleJoinGroupDrop(dropId: string): GroupDrop[] {
  const current = getGroupDrops();
  const next = current.map((d) => {
    if (d.id !== dropId) return d;
    const joined = !d.joined;
    return {
      ...d,
      joined,
      current_participants: joined ? d.current_participants + 1 : Math.max(0, d.current_participants - 1),
    };
  });
  localStorage.setItem(KEYS.DROPS, JSON.stringify(next));
  return next;
}

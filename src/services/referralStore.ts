import type { ReservationRequest } from '../types/experience';
import type { ReferralAttribution } from '../types/growth';
import type { VisitProofRecord } from '../types/verification';
import { generateUUID } from '../utils/slug';
import { getUserProfileIdentity } from './authService';
import { appendLedgerTransaction } from './pointsLedger';
import { isValidUuid, supabase } from './supabaseClient';
import { getVisitProofForReservation } from './visitProofStore';

const KEYS = {
  MY_CODE: 'borario_my_referral_code_v1',
  INCOMING_CODE: 'borario_incoming_referral_code_v1',
  ATTRIBUTIONS: 'borario_referral_attributions_v1',
};

export const DEFAULT_REFERRAL_REWARD_POINTS = 200;

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
  localStorage.setItem(key, JSON.stringify(value));
}

export function getMyReferralCode(): string {
  try {
    const existing = localStorage.getItem(KEYS.MY_CODE);
    if (existing) return existing;
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    const code = `BR-IND-${suffix}`;
    localStorage.setItem(KEYS.MY_CODE, code);
    return code;
  } catch {
    return 'BR-IND-RIO01';
  }
}

export function getCanonicalAppBaseUrl(): string {
  if (typeof window === 'undefined') return 'https://borario.app';
  return window.location.origin;
}

export function getMyReferralLink(venueId?: string): string {
  const code = getMyReferralCode();
  const base = getCanonicalAppBaseUrl();
  if (venueId) {
    return `${base}/app?venue=${encodeURIComponent(venueId)}&ref=${encodeURIComponent(code)}`;
  }
  return `${base}/app?ref=${encodeURIComponent(code)}`;
}

export function captureReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref')?.trim().toUpperCase();
    if (!ref) return null;
    if (ref === getMyReferralCode().toUpperCase()) {
      return null; // Ignora tentativa de autoindicação via URL
    }
    localStorage.setItem(KEYS.INCOMING_CODE, ref);
    return ref;
  } catch {
    return null;
  }
}

export function getIncomingReferralCode(): string | null {
  try {
    return localStorage.getItem(KEYS.INCOMING_CODE);
  } catch {
    return null;
  }
}

export function setIncomingReferralCode(code: string): {
  ok: boolean;
  message: string;
} {
  const clean = code.trim().toUpperCase();
  if (!clean) {
    localStorage.removeItem(KEYS.INCOMING_CODE);
    return { ok: true, message: 'Código de indicação removido.' };
  }
  if (clean === getMyReferralCode().toUpperCase()) {
    return {
      ok: false,
      message:
        'Autoindicação bloqueada pelas regras antifraude: você não pode usar seu próprio código de indicação.',
    };
  }
  if (clean.length < 6) {
    return { ok: false, message: 'Informe um código de indicação válido (ex: BR-IND-...).' };
  }
  localStorage.setItem(KEYS.INCOMING_CODE, clean);
  return {
    ok: true,
    message: `Código ${clean} vinculado! Pontos para quem indicou só serão liberados após seu check-in validado no estabelecimento.`,
  };
}

export function getReferralAttributions(): ReferralAttribution[] {
  return readJson<ReferralAttribution[]>(KEYS.ATTRIBUTIONS, []);
}

export function registerReferralInvitation(params: {
  referredLabel: string;
  referredIdentifier?: string;
  bookingId?: string;
  experienceId?: string;
  experienceName?: string;
}): {
  ok: boolean;
  message: string;
  attribution?: ReferralAttribution;
  attributions: ReferralAttribution[];
} {
  const cleanLabel = params.referredLabel.trim();
  const cleanIdentifier = params.referredIdentifier?.trim().toLowerCase() || '';
  const currentList = getReferralAttributions();

  if (cleanLabel.length < 2) {
    return {
      ok: false,
      message: 'Informe o nome ou identificação da pessoa convidada.',
      attributions: currentList,
    };
  }

  const me = getUserProfileIdentity();
  const myCode = getMyReferralCode().toUpperCase();
  const myEmail = me.email?.trim().toLowerCase() || '';
  const myName = me.display_name.trim().toLowerCase();

  // Proteção antifraude contra autoindicação
  if (
    cleanLabel.toUpperCase() === myCode ||
    (cleanIdentifier &&
      (cleanIdentifier === me.id.toLowerCase() ||
        (myEmail && cleanIdentifier === myEmail) ||
        cleanIdentifier.toUpperCase() === myCode ||
        cleanIdentifier === myName)) ||
    (!cleanIdentifier && myName.length > 2 && cleanLabel.toLowerCase() === myName)
  ) {
    return {
      ok: false,
      message:
        'Autoindicação bloqueada pelas regras antifraude: você não pode indicar a si mesmo ou sua própria conta.',
      attributions: currentList,
    };
  }

  // Proteção contra duplicidade para a mesma reserva ou identificador ativo
  if (
    params.bookingId &&
    currentList.some(
      (a) => a.booking_id === params.bookingId && a.status !== 'REVERSED'
    )
  ) {
    return {
      ok: false,
      message: 'Esta reserva já possui uma indicação ativa vinculada.',
      attributions: currentList,
    };
  }

  if (
    cleanIdentifier &&
    currentList.some(
      (a) =>
        a.referred_identifier?.toLowerCase() === cleanIdentifier &&
        a.status !== 'REVERSED'
    )
  ) {
    return {
      ok: false,
      message: 'Esta pessoa já possui uma indicação ativa registrada.',
      attributions: currentList,
    };
  }

  const attribution: ReferralAttribution = {
    id: generateUUID(),
    referral_code: myCode,
    referrer_user_id: me.id,
    referred_label: cleanLabel,
    referred_identifier: cleanIdentifier || undefined,
    booking_id: params.bookingId,
    experience_id: params.experienceId,
    experience_name: params.experienceName,
    reward_points: DEFAULT_REFERRAL_REWARD_POINTS,
    status: 'PENDING_CONVERSION',
    created_at: new Date().toISOString(),
    is_demonstrative: false,
  };

  const next = [attribution, ...currentList];
  writeJson(KEYS.ATTRIBUTIONS, next);

  if (supabase && isValidUuid(me.id)) {
    void supabase
      .from('referral_attributions')
      .insert({
        id: attribution.id,
        referrer_user_id: me.id,
        referral_code: attribution.referral_code,
        referred_label: attribution.referred_label,
        referred_identifier: attribution.referred_identifier || null,
        booking_id:
          attribution.booking_id && isValidUuid(attribution.booking_id)
            ? attribution.booking_id
            : null,
        restaurant_id:
          attribution.experience_id && isValidUuid(attribution.experience_id)
            ? attribution.experience_id
            : null,
        reward_points: attribution.reward_points,
        status: 'PENDING_CONVERSION',
      })
      .then(() => undefined, () => undefined);
  }

  return {
    ok: true,
    message:
      'Convite registrado como Pendente (0 pontos no cadastro). Os +200 RP só serão liberados após reserva elegível + check-in validado no estabelecimento.',
    attribution,
    attributions: next,
  };
}

export function linkBookingToReferral(params: {
  attributionId: string;
  reservation: ReservationRequest;
}): {
  ok: boolean;
  message: string;
  converted: boolean;
  attributions: ReferralAttribution[];
} {
  const current = getReferralAttributions();
  const target = current.find((a) => a.id === params.attributionId);
  if (!target) {
    return {
      ok: false,
      message: 'Indicação não encontrada.',
      converted: false,
      attributions: current,
    };
  }
  if (target.status !== 'PENDING_CONVERSION') {
    return {
      ok: false,
      message: 'Apenas indicações pendentes podem ser vinculadas a uma reserva.',
      converted: false,
      attributions: current,
    };
  }
  if (
    params.reservation.status === 'CANCELLED' ||
    params.reservation.stage === 'CANCELLED' ||
    params.reservation.stage === 'NO_SHOW' ||
    params.reservation.stage === 'ENDED_WITHOUT_GOAL'
  ) {
    return {
      ok: false,
      message: 'Reservas canceladas ou encerradas não são elegíveis para conversão de indicação.',
      converted: false,
      attributions: current,
    };
  }
  if (
    current.some(
      (a) =>
        a.id !== target.id &&
        a.booking_id === params.reservation.id &&
        a.status !== 'REVERSED'
    )
  ) {
    return {
      ok: false,
      message: 'Outra indicação já está vinculada a esta reserva (bloqueio de duplicidade).',
      converted: false,
      attributions: current,
    };
  }

  const next = current.map((a) =>
    a.id === target.id
      ? {
          ...a,
          booking_id: params.reservation.id,
          experience_id: params.reservation.experience_id,
          experience_name: params.reservation.experience_name,
        }
      : a
  );
  writeJson(KEYS.ATTRIBUTIONS, next);

  // Se a reserva já possui check-in validado, converte de imediato
  const proof = getVisitProofForReservation(params.reservation.id);
  if (proof) {
    const conv = convertReferralOnVerifiedCheckin({
      reservation: params.reservation,
      visitProof: proof,
    });
    return {
      ok: true,
      converted: conv.converted,
      message: conv.converted
        ? `Reserva já possuía check-in validado: indicação convertida (+${conv.pointsCredited} RP)!`
        : 'Reserva vinculada à indicação.',
      attributions: getReferralAttributions(),
    };
  }

  return {
    ok: true,
    converted: false,
    message:
      'Reserva vinculada! Status permanece Pendente (0 pts) até que o check-in QR dinâmico seja validado no estabelecimento.',
    attributions: next,
  };
}

export function convertReferralOnVerifiedCheckin(params: {
  reservation: ReservationRequest;
  visitProof: VisitProofRecord;
}): {
  converted: boolean;
  pointsCredited: number;
  attribution?: ReferralAttribution;
} {
  if (
    params.reservation.status === 'CANCELLED' ||
    params.reservation.stage === 'CANCELLED' ||
    params.reservation.stage === 'NO_SHOW' ||
    params.reservation.stage === 'ENDED_WITHOUT_GOAL'
  ) {
    return { converted: false, pointsCredited: 0 };
  }

  const list = getReferralAttributions();

  // Impede conversão duplicada na mesma reserva
  const alreadyConverted = list.find(
    (a) => a.booking_id === params.reservation.id && a.status === 'CONVERTED'
  );
  if (alreadyConverted) {
    return { converted: false, pointsCredited: 0, attribution: alreadyConverted };
  }

  // Encontra atribuição pendente explicitamente vinculada à reserva
  const candidate = list.find(
    (a) =>
      a.status === 'PENDING_CONVERSION' &&
      a.booking_id === params.reservation.id
  );

  if (!candidate) {
    return { converted: false, pointsCredited: 0 };
  }

  const now = new Date().toISOString();
  const updated: ReferralAttribution = {
    ...candidate,
    booking_id: params.reservation.id,
    visit_proof_id: params.visitProof.id,
    experience_id: params.reservation.experience_id,
    experience_name: params.reservation.experience_name,
    status: 'CONVERTED',
    converted_at: now,
  };

  writeJson(
    KEYS.ATTRIBUTIONS,
    list.map((a) => (a.id === updated.id ? updated : a))
  );

  appendLedgerTransaction({
    type: 'CREDIT',
    amount: updated.reward_points,
    origin: 'referral',
    description: `Indicação convertida pós-check-in: ${updated.referred_label} em ${params.reservation.experience_name}`,
    experience_id: params.reservation.experience_id,
    experience_name: params.reservation.experience_name,
    validation_status: 'RELEASED',
  });

  return {
    converted: true,
    pointsCredited: updated.reward_points,
    attribution: updated,
  };
}

export function tryConvertAttributionWithProof(
  attributionId: string,
  reservations: ReservationRequest[]
): {
  ok: boolean;
  message: string;
  attributions: ReferralAttribution[];
} {
  const list = getReferralAttributions();
  const target = list.find((a) => a.id === attributionId);
  if (!target) {
    return { ok: false, message: 'Indicação não encontrada.', attributions: list };
  }
  if (target.status === 'CONVERTED') {
    return {
      ok: false,
      message: 'Esta indicação já foi convertida.',
      attributions: list,
    };
  }
  if (target.status === 'REVERSED') {
    return {
      ok: false,
      message: 'Esta indicação foi estornada e não pode ser convertida.',
      attributions: list,
    };
  }
  if (!target.booking_id) {
    return {
      ok: false,
      message:
        'Vincule uma reserva elegível ao convite antes de validar a conversão (zero pontos por cadastro isolado).',
      attributions: list,
    };
  }

  const res = reservations.find((r) => r.id === target.booking_id);
  const proof = getVisitProofForReservation(target.booking_id);

  if (!res || !proof) {
    return {
      ok: false,
      message:
        'Conversão bloqueada: a reserva vinculada ainda não concluiu o check-in QR dinâmico / visita validada no estabelecimento.',
      attributions: list,
    };
  }

  const conv = convertReferralOnVerifiedCheckin({
    reservation: res,
    visitProof: proof,
  });

  if (!conv.converted) {
    return {
      ok: false,
      message: 'A reserva vinculada não está elegível ou já foi convertida anteriormente.',
      attributions: getReferralAttributions(),
    };
  }

  return {
    ok: true,
    message: `Conversão validada com Prova de Visita! +${conv.pointsCredited} RP liberados.`,
    attributions: getReferralAttributions(),
  };
}

export function reverseReferralAttribution(
  attributionId: string,
  reason: string
): {
  ok: boolean;
  message: string;
  attributions: ReferralAttribution[];
} {
  const list = getReferralAttributions();
  const target = list.find((a) => a.id === attributionId);
  if (!target) {
    return { ok: false, message: 'Indicação não encontrada.', attributions: list };
  }
  if (target.status === 'REVERSED') {
    return {
      ok: false,
      message: 'Esta indicação já está estornada.',
      attributions: list,
    };
  }

  const cleanReason =
    reason.trim() || 'Cancelamento da reserva ou contestação da visita';
  const wasConverted = target.status === 'CONVERTED';
  const now = new Date().toISOString();

  const next = list.map((a) =>
    a.id === target.id
      ? {
          ...a,
          status: 'REVERSED' as const,
          reversal_reason: cleanReason,
          reversed_at: now,
        }
      : a
  );
  writeJson(KEYS.ATTRIBUTIONS, next);

  if (wasConverted) {
    appendLedgerTransaction({
      type: 'REVERSAL',
      amount: target.reward_points,
      origin: 'referral',
      description: `Estorno de indicação (${target.referred_label}): ${cleanReason}`,
      experience_id: target.experience_id,
      experience_name: target.experience_name,
      validation_status: 'RELEASED',
    });
  }

  return {
    ok: true,
    message: wasConverted
      ? `Indicação estornada e ${target.reward_points} RP debitados do saldo (${cleanReason}).`
      : `Indicação pendente cancelada sem crédito de pontos (${cleanReason}).`,
    attributions: next,
  };
}

export function reverseReferralForBooking(
  bookingId: string,
  reason: string
): boolean {
  const matching = getReferralAttributions().filter(
    (a) => a.booking_id === bookingId && a.status !== 'REVERSED'
  );
  if (matching.length === 0) return false;
  let reversedAny = false;
  for (const attr of matching) {
    const res = reverseReferralAttribution(attr.id, reason);
    if (res.ok) reversedAny = true;
  }
  return reversedAny;
}

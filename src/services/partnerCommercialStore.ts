import type { ReservationRequest } from '../types/experience';
import type {
  CommercialModality,
  PartnerCommercialPlan,
  PartnerFeeLedgerEntry,
} from '../types/partnerCommercial';
import type { VisitProofRecord } from '../types/verification';
import { generateUUID } from '../utils/slug';
import { recordFeeDisputeAuditEvent } from './visitProofStore';

const KEYS = {
  PLANS: 'borario_partner_commercial_plans_v1',
  FEE_LEDGER: 'borario_partner_fee_ledger_v1',
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
  localStorage.setItem(key, JSON.stringify(value));
}

export function getDefaultConfigurablePilotPlan(restaurantId: string): PartnerCommercialPlan {
  const now = new Date().toISOString();
  return {
    id: `plan-${restaurantId}`,
    restaurant_id: restaurantId,
    plan_name: 'Plano Piloto Configurável — Remuneração por Pessoa Atendida',
    billing_model: 'PER_ATTENDED_GUEST',
    fixed_fee_per_guest_brl: 3.0,
    fixed_fee_per_booking_brl: 0,
    monthly_subscription_brl: 0,
    requires_monthly_fee: false,
    charge_on_cancelled: false,
    charge_on_no_show: false,
    currency: 'BRL',
    policy_summary:
      'Taxa fixa configurável por contrato/plano comercial por pessoa efetivamente atendida com check-in validado. Sem percentual sobre a conta consumida e sem cobrança por cliques, visualizações ou reservas canceladas.',
    is_configurable_pilot_default: true,
    effective_from: now,
    updated_at: now,
  };
}

export function getPartnerCommercialPlan(restaurantId: string): PartnerCommercialPlan {
  const all = readJson<Record<string, PartnerCommercialPlan>>(KEYS.PLANS, {});
  return all[restaurantId] || getDefaultConfigurablePilotPlan(restaurantId);
}

export function savePartnerCommercialPlan(
  restaurantId: string,
  patch: Partial<
    Pick<
      PartnerCommercialPlan,
      | 'plan_name'
      | 'billing_model'
      | 'fixed_fee_per_guest_brl'
      | 'fixed_fee_per_booking_brl'
      | 'monthly_subscription_brl'
      | 'requires_monthly_fee'
      | 'policy_summary'
    >
  >
): PartnerCommercialPlan {
  const current = getPartnerCommercialPlan(restaurantId);
  const next: PartnerCommercialPlan = {
    ...current,
    ...patch,
    fixed_fee_per_guest_brl: Math.max(0, Number(patch.fixed_fee_per_guest_brl ?? current.fixed_fee_per_guest_brl)),
    fixed_fee_per_booking_brl: Math.max(0, Number(patch.fixed_fee_per_booking_brl ?? current.fixed_fee_per_booking_brl)),
    monthly_subscription_brl: Math.max(0, Number(patch.monthly_subscription_brl ?? current.monthly_subscription_brl)),
    charge_on_cancelled: false,
    charge_on_no_show: false,
    is_configurable_pilot_default: false,
    updated_at: new Date().toISOString(),
  };

  const all = readJson<Record<string, PartnerCommercialPlan>>(KEYS.PLANS, {});
  all[restaurantId] = next;
  writeJson(KEYS.PLANS, all);
  return next;
}

export function getPartnerFeeLedger(restaurantId?: string): PartnerFeeLedgerEntry[] {
  const entries = readJson<PartnerFeeLedgerEntry[]>(KEYS.FEE_LEDGER, []);
  if (!restaurantId) return entries;
  return entries.filter((e) => e.restaurant_id === restaurantId);
}

/**
 * Calcula e registra a remuneração fixa devida ao BoraRio somente após check-in/visita validada.
 * - Zero percentual sobre valor da conta consumida.
 * - Zero cobrança em cancelamentos, no-shows, cliques, visualizações ou manifestações de interesse.
 * - Impede duplicidade para o mesmo booking_id.
 */
export function accruePartnerFeeFromCheckin(params: {
  reservation: ReservationRequest;
  visitProof: VisitProofRecord;
  attributedFromRewardVoucherId?: string;
}): { created: boolean; entry?: PartnerFeeLedgerEntry; reason?: string } {
  const { reservation, visitProof } = params;

  if (
    reservation.status === 'CANCELLED' ||
    reservation.stage === 'CANCELLED' ||
    reservation.stage === 'NO_SHOW' ||
    reservation.stage === 'ENDED_WITHOUT_GOAL'
  ) {
    return {
      created: false,
      reason: 'Reservas canceladas, não utilizadas ou sem meta atingida nunca geram remuneração.',
    };
  }

  const ledger = readJson<PartnerFeeLedgerEntry[]>(KEYS.FEE_LEDGER, []);
  const existing = ledger.find((e) => e.booking_id === reservation.id);
  if (existing) {
    return { created: false, entry: existing, reason: 'Evento já apurado para esta reserva.' };
  }

  const plan = getPartnerCommercialPlan(reservation.experience_id);
  const attendedGuests = Math.max(1, visitProof.guests_count || reservation.guests || 1);
  const modality: CommercialModality = reservation.modality || 'TRADITIONAL_BOOKING';

  let unitFee = 0;
  let totalFee = 0;

  if (plan.billing_model === 'PER_ATTENDED_GUEST') {
    unitFee = plan.fixed_fee_per_guest_brl;
    totalFee = Number((unitFee * attendedGuests).toFixed(2));
  } else if (plan.billing_model === 'PER_COMPLETED_BOOKING') {
    unitFee = plan.fixed_fee_per_booking_brl;
    totalFee = Number(unitFee.toFixed(2));
  }

  const entry: PartnerFeeLedgerEntry = {
    id: generateUUID(),
    booking_id: reservation.id,
    visit_proof_id: visitProof.id,
    restaurant_id: reservation.experience_id,
    restaurant_name: reservation.experience_name,
    plan_id: plan.id,
    billing_model: plan.billing_model,
    modality,
    attended_guests: attendedGuests,
    unit_fee_brl: unitFee,
    total_fee_brl: totalFee,
    attribution_origin: reservation.attribution_origin || 'catalog',
    fee_source_type: 'ATTENDED_BOOKING',
    attributed_from_reward_voucher_id: params.attributedFromRewardVoucherId,
    status: 'ACCRUED',
    event_timestamp: visitProof.presence_verified_at,
    is_demonstrative: visitProof.is_demonstrative,
  };

  writeJson(KEYS.FEE_LEDGER, [entry, ...ledger]);
  return { created: true, entry };
}

export function disputePartnerFeeEntry(entryId: string, reason: string): PartnerFeeLedgerEntry[] {
  const cleanReason = reason.trim();
  if (!cleanReason) return getPartnerFeeLedger();

  const ledger = readJson<PartnerFeeLedgerEntry[]>(KEYS.FEE_LEDGER, []);
  let disputedEntry: PartnerFeeLedgerEntry | undefined;

  const next = ledger.map((entry) => {
    if (entry.id !== entryId) return entry;
    disputedEntry = {
      ...entry,
      status: 'DISPUTED',
      dispute_reason: cleanReason,
    };
    return disputedEntry;
  });

  writeJson(KEYS.FEE_LEDGER, next);

  if (disputedEntry) {
    recordFeeDisputeAuditEvent({
      restaurantId: disputedEntry.restaurant_id,
      reservationId: disputedEntry.booking_id,
      visitProofId: disputedEntry.visit_proof_id,
      reason: cleanReason,
    });
  }

  return next;
}

export function waivePartnerFeeEntry(entryId: string, reason?: string): PartnerFeeLedgerEntry[] {
  const next = readJson<PartnerFeeLedgerEntry[]>(KEYS.FEE_LEDGER, []).map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          status: 'WAIVED' as const,
          dispute_reason: reason?.trim() || entry.dispute_reason,
        }
      : entry
  );
  writeJson(KEYS.FEE_LEDGER, next);
  return next;
}

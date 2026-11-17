import type { ReservationRequest } from '../types/experience';
import type {
  CommercialModality,
  PartnerCommercialPlan,
  PartnerFeeLedgerEntry,
  PartnerMonthlyInvoice,
} from '../types/partnerCommercial';
import type { VisitProofRecord } from '../types/verification';
import { generateUUID } from '../utils/slug';
import { recordFeeDisputeAuditEvent } from './visitProofStore';

const KEYS = {
  PLANS: 'borario_partner_commercial_plans_v1',
  FEE_LEDGER: 'borario_partner_fee_ledger_v1',
  INVOICES: 'borario_partner_monthly_invoices_v1',
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
  const now = new Date();
  const validUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `plan-${restaurantId}`,
    restaurant_id: restaurantId,
    plan_name: 'Plano Parceiro Fundador — Remuneração por Presença Individual Validada',
    billing_model: 'PER_ATTENDED_GUEST',
    fixed_fee_per_guest_brl: 10.0, // Tarifa padrão
    fixed_fee_per_booking_brl: 0,
    monthly_subscription_brl: 0,
    requires_monthly_fee: false,
    charge_on_cancelled: false,
    charge_on_no_show: false,
    currency: 'BRL',
    policy_summary:
      'Condição Especial de Lançamento: R$ 5,00 por pessoa com check-in individual validado (50% OFF nos primeiros 30 dias de adesão). Após o término da promoção, vigora a tarifa padrão de R$ 10,00 por pessoa atendida. Zero mensalidade obrigatória, zero percentual sobre a conta e zero cobrança em cancelamentos ou no-shows.',
    is_configurable_pilot_default: true,
    launch_promo_active: true,
    launch_promo_fee_per_guest_brl: 5.0,
    launch_promo_valid_until: validUntil,
    effective_from: now.toISOString(),
    updated_at: now.toISOString(),
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
      | 'launch_promo_active'
      | 'launch_promo_fee_per_guest_brl'
      | 'launch_promo_valid_until'
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
    launch_promo_fee_per_guest_brl: Math.max(0, Number(patch.launch_promo_fee_per_guest_brl ?? current.launch_promo_fee_per_guest_brl ?? 5.0)),
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
 * - Tarifa Padrão: R$ 10,00 por check-in individual validado.
 * - Condição Especial de Lançamento: R$ 5,00 por check-in individual validado (50% OFF).
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

  const isPromoActive =
    Boolean(plan.launch_promo_active) &&
    (!plan.launch_promo_valid_until || new Date() <= new Date(plan.launch_promo_valid_until));

  let unitFee = 0;
  let totalFee = 0;

  if (plan.billing_model === 'PER_ATTENDED_GUEST') {
    unitFee = isPromoActive
      ? (plan.launch_promo_fee_per_guest_brl ?? 5.0)
      : (plan.fixed_fee_per_guest_brl ?? 10.0);
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
    is_launch_promo_applied: isPromoActive,
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

/**
 * Retorna as faturas mensais consolidadas do parceiro.
 * Inicializa com:
 * 1. Fatura aberta do mês corrente (Novembro/2026), calculando os check-ins acumulados
 * 2. Exemplo de fechamento anterior quitado para conferência de histórico.
 */
export function getPartnerMonthlyInvoices(restaurantId: string): PartnerMonthlyInvoice[] {
  const all = readJson<Record<string, PartnerMonthlyInvoice[]>>(KEYS.INVOICES, {});
  if (all[restaurantId] && all[restaurantId].length > 0) {
    return all[restaurantId];
  }

  // Inicializa faturas padrão demonstrativas alinhadas à regra de lançamento:
  // Fatura atual em aberto: 50 check-ins x R$ 5,00 = R$ 250,00 (conforme o modelo oficial)
  const plan = getPartnerCommercialPlan(restaurantId);
  const ledger = getPartnerFeeLedger(restaurantId);
  const validCheckinsCount = ledger.filter((e) => e.status !== 'WAIVED').length || 50;
  const unitFee = plan.launch_promo_active ? 5.0 : 10.0;
  const totalAttendedGuests =
    ledger.reduce((acc, e) => (e.status !== 'WAIVED' ? acc + e.attended_guests : acc), 0) || 50;
  const subtotal = totalAttendedGuests * 10.0;
  const totalBrl = totalAttendedGuests * unitFee;
  const discountBrl = subtotal - totalBrl;

  const currentInvoice: PartnerMonthlyInvoice = {
    id: `inv-${restaurantId}-2026-11`,
    restaurant_id: restaurantId,
    period_month_year: '11/2026',
    period_label: 'Novembro de 2026 · Mês de Lançamento',
    status: 'OPEN',
    valid_checkins_count: validCheckinsCount,
    total_attended_guests: totalAttendedGuests,
    effective_fee_per_guest_brl: unitFee,
    subtotal_brl: subtotal,
    discount_brl: discountBrl,
    total_brl: totalBrl,
    is_launch_promo: plan.launch_promo_active,
    pix_copy_paste_key: `00020126580014br.gov.bcb.pix0136borario-financeiro-${restaurantId.slice(0, 8)}520400005303986540${totalBrl.toFixed(2)}5802BR5915BoraRio Gastronomia6009Rio de Janeiro62070503***6304`,
    bank_slip_barcode:
      '23793.38128 60000.123456 78000.987654 1 95400000' +
      String(Math.round(totalBrl * 100)).padStart(6, '0'),
    due_date: '2026-12-05',
  };

  const previousInvoice: PartnerMonthlyInvoice = {
    id: `inv-${restaurantId}-2026-10`,
    restaurant_id: restaurantId,
    period_month_year: '10/2026',
    period_label: 'Outubro de 2026 · Período Piloto',
    status: 'PAID',
    valid_checkins_count: 24,
    total_attended_guests: 24,
    effective_fee_per_guest_brl: 5.0,
    subtotal_brl: 240.0,
    discount_brl: 120.0,
    total_brl: 120.0,
    is_launch_promo: true,
    paid_at: '2026-11-04T14:32:00Z',
    payment_method: 'PIX',
    due_date: '2026-11-05',
  };

  const initialList = [currentInvoice, previousInvoice];
  all[restaurantId] = initialList;
  writeJson(KEYS.INVOICES, all);
  return initialList;
}

export function payPartnerInvoice(
  restaurantId: string,
  invoiceId: string,
  paymentMethod: 'PIX' | 'BOLETO'
): { ok: boolean; message: string; invoice?: PartnerMonthlyInvoice } {
  const all = readJson<Record<string, PartnerMonthlyInvoice[]>>(KEYS.INVOICES, {});
  const list = all[restaurantId] || getPartnerMonthlyInvoices(restaurantId);
  const targetIndex = list.findIndex((inv) => inv.id === invoiceId);

  if (targetIndex === -1) {
    return { ok: false, message: 'Fatura não encontrada.' };
  }

  const updatedInvoice: PartnerMonthlyInvoice = {
    ...list[targetIndex],
    status: 'PAID',
    paid_at: new Date().toISOString(),
    payment_method: paymentMethod,
  };

  list[targetIndex] = updatedInvoice;
  all[restaurantId] = list;
  writeJson(KEYS.INVOICES, all);

  return {
    ok: true,
    message: `Fatura de R$ ${updatedInvoice.total_brl.toFixed(2)} liquidada com sucesso via ${paymentMethod === 'PIX' ? 'PIX Instantâneo' : 'Boleto Bancário'}. Comprovante emitido!`,
    invoice: updatedInvoice,
  };
}

import type { ReservationRequest } from '../types/experience';
import type {
  CommercialModality,
  PartnerAcquisitionCreditEntry,
  PartnerCommercialPlan,
  PartnerFeeLedgerEntry,
  PartnerMonthlyInvoice,
  PartnerSponsoredCampaign,
  SponsoredCampaignStatus,
} from '../types/partnerCommercial';
import type { VisitProofRecord } from '../types/verification';
import { generateUUID } from '../utils/slug';
import { recordFeeDisputeAuditEvent } from './visitProofStore';

const KEYS = {
  PLANS: 'borario_partner_commercial_plans_v1',
  FEE_LEDGER: 'borario_partner_fee_ledger_v1',
  INVOICES: 'borario_partner_monthly_invoices_v1',
  SPONSORED_CAMPAIGNS: 'borario_partner_sponsored_campaigns_v1',
  ACQUISITION_CREDIT_LEDGER: 'borario_partner_acq_credit_ledger_v1',
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
    plan_name: 'Plano Parceiro Fundador — Remuneração por Participante Elegível Validado',
    billing_model: 'PER_ATTENDED_GUEST',
    fixed_fee_per_guest_brl: 10.0, // Tarifa padrão
    fixed_fee_per_booking_brl: 0,
    monthly_subscription_brl: 0,
    requires_monthly_fee: false,
    charge_on_cancelled: false,
    charge_on_no_show: false,
    currency: 'BRL',
    policy_summary:
      'Regra Oficial BoraRio: R$ 5,00 na condição especial de lançamento (50% OFF) e R$ 10,00 na tarifa padrão por participante elegível, individualmente validado no check-in presencial e atribuído ao BoraRio. Acompanhantes sem adesão/check-in individual não geram cobrança automática. Zero mensalidade, zero comissão sobre a conta e zero cobrança em cancelamentos ou no-shows.',
    is_configurable_pilot_default: true,
    launch_promo_active: true,
    launch_promo_fee_per_guest_brl: 5.0,
    launch_promo_valid_until: validUntil,
    max_billable_guests_per_booking: null,
    onboarding_mode: 'SELF_SERVE',
    onboarding_stage: 'PUBLISHED',
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
      | 'max_billable_guests_per_booking'
      | 'onboarding_mode'
      | 'onboarding_stage'
      | 'responsible_name'
      | 'responsible_role'
    >
  >
): PartnerCommercialPlan {
  const current = getPartnerCommercialPlan(restaurantId);
  const next: PartnerCommercialPlan = {
    ...current,
    ...patch,
    fixed_fee_per_guest_brl: Math.max(
      0,
      Number(patch.fixed_fee_per_guest_brl ?? current.fixed_fee_per_guest_brl)
    ),
    fixed_fee_per_booking_brl: Math.max(
      0,
      Number(patch.fixed_fee_per_booking_brl ?? current.fixed_fee_per_booking_brl)
    ),
    monthly_subscription_brl: Math.max(
      0,
      Number(patch.monthly_subscription_brl ?? current.monthly_subscription_brl)
    ),
    launch_promo_fee_per_guest_brl: Math.max(
      0,
      Number(patch.launch_promo_fee_per_guest_brl ?? current.launch_promo_fee_per_guest_brl ?? 5.0)
    ),
    max_billable_guests_per_booking:
      patch.max_billable_guests_per_booking !== undefined
        ? patch.max_billable_guests_per_booking && patch.max_billable_guests_per_booking > 0
          ? Math.round(patch.max_billable_guests_per_booking)
          : null
        : current.max_billable_guests_per_booking ?? null,
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

// ============================================================================
// CAMPANHAS PATROCINADAS & CRÉDITO COMERCIAL DE AQUISIÇÃO
// ============================================================================

export function getPartnerSponsoredCampaigns(restaurantId?: string): PartnerSponsoredCampaign[] {
  const all = readJson<PartnerSponsoredCampaign[]>(KEYS.SPONSORED_CAMPAIGNS, []);
  // Verifica expiração automática de créditos vencidos
  const nowIso = new Date().toISOString();
  let changed = false;
  const creditLedger = readJson<PartnerAcquisitionCreditEntry[]>(KEYS.ACQUISITION_CREDIT_LEDGER, []);

  const updated = all.map((camp) => {
    if (
      camp.status === 'ACTIVE' &&
      camp.remaining_acquisition_credit_brl > 0 &&
      camp.credits_expire_at < nowIso
    ) {
      changed = true;
      const expiredAmount = camp.remaining_acquisition_credit_brl;
      creditLedger.unshift({
        id: generateUUID(),
        campaign_id: camp.id,
        restaurant_id: camp.restaurant_id,
        entry_type: 'CREDIT_EXPIRED',
        amount_brl: expiredAmount,
        balance_after_brl: 0,
        description: `Expiração contratual de saldo remanescente da campanha "${camp.campaign_name}"`,
        created_at: nowIso,
      });
      return {
        ...camp,
        status: 'EXPIRED' as const,
        remaining_acquisition_credit_brl: 0,
        updated_at: nowIso,
      };
    }
    return camp;
  });

  if (changed) {
    writeJson(KEYS.SPONSORED_CAMPAIGNS, updated);
    writeJson(KEYS.ACQUISITION_CREDIT_LEDGER, creditLedger);
  }

  if (!restaurantId) return updated;
  return updated.filter((c) => c.restaurant_id === restaurantId);
}

export function getPartnerAcquisitionCreditLedger(
  restaurantId?: string
): PartnerAcquisitionCreditEntry[] {
  const list = readJson<PartnerAcquisitionCreditEntry[]>(KEYS.ACQUISITION_CREDIT_LEDGER, []);
  if (!restaurantId) return list;
  return list.filter((e) => e.restaurant_id === restaurantId);
}

export function getPartnerAcquisitionCreditSummary(restaurantId: string): {
  totalInitialCreditBrl: number;
  totalUsedCreditBrl: number;
  totalRemainingCreditBrl: number;
  totalInvestmentBrl: number;
  totalNetAdRevenueBrl: number;
  activeCampaignsCount: number;
} {
  const campaigns = getPartnerSponsoredCampaigns(restaurantId);
  return campaigns.reduce(
    (acc, c) => {
      acc.totalInitialCreditBrl = Number(
        (acc.totalInitialCreditBrl + c.initial_acquisition_credit_brl).toFixed(2)
      );
      acc.totalUsedCreditBrl = Number(
        (acc.totalUsedCreditBrl + c.used_acquisition_credit_brl).toFixed(2)
      );
      if (c.status === 'ACTIVE') {
        acc.totalRemainingCreditBrl = Number(
          (acc.totalRemainingCreditBrl + c.remaining_acquisition_credit_brl).toFixed(2)
        );
        acc.activeCampaignsCount += 1;
      }
      acc.totalInvestmentBrl = Number((acc.totalInvestmentBrl + c.investment_brl).toFixed(2));
      acc.totalNetAdRevenueBrl = Number(
        (acc.totalNetAdRevenueBrl + c.net_ad_revenue_brl).toFixed(2)
      );
      return acc;
    },
    {
      totalInitialCreditBrl: 0,
      totalUsedCreditBrl: 0,
      totalRemainingCreditBrl: 0,
      totalInvestmentBrl: 0,
      totalNetAdRevenueBrl: 0,
      activeCampaignsCount: 0,
    }
  );
}

export function createPartnerSponsoredCampaign(params: {
  restaurantId: string;
  restaurantName: string;
  offeringId: string;
  offeringTitle: string;
  campaignName?: string;
  investmentBrl: number;
  creditConversionPct?: number; // Padrão configurável: 50%
  durationDays?: number;
  targetNeighborhoods?: string[];
  targetCategories?: string[];
}): {
  ok: boolean;
  message: string;
  campaign?: PartnerSponsoredCampaign;
  campaigns: PartnerSponsoredCampaign[];
} {
  const investment = Math.max(0, Number(params.investmentBrl));
  if (investment < 50) {
    return {
      ok: false,
      message: 'O investimento mínimo para campanha patrocinada com crédito de aquisição é R$ 50,00.',
      campaigns: getPartnerSponsoredCampaigns(params.restaurantId),
    };
  }
  if (!params.offeringId) {
    return {
      ok: false,
      message: 'Selecione uma oferta já existente para impulsionar.',
      campaigns: getPartnerSponsoredCampaigns(params.restaurantId),
    };
  }

  const conversionPct = Math.min(100, Math.max(0, Number(params.creditConversionPct ?? 50)));
  const initialCredit = Number(((investment * conversionPct) / 100).toFixed(2));
  const netAdRevenue = Number((investment - initialCredit).toFixed(2));
  const durationDays = Math.max(1, Math.round(params.durationDays ?? 14));
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationDays * 86400 * 1000).toISOString();
  const creditsExpireAt = new Date(now.getTime() + Math.max(30, durationDays) * 86400 * 1000).toISOString();

  const campaign: PartnerSponsoredCampaign = {
    id: generateUUID(),
    restaurant_id: params.restaurantId,
    restaurant_name: params.restaurantName,
    offering_id: params.offeringId,
    offering_title: params.offeringTitle,
    campaign_name:
      params.campaignName?.trim() || `Impulsionamento · ${params.offeringTitle}`,
    status: 'ACTIVE',
    investment_brl: investment,
    credit_conversion_pct: conversionPct,
    initial_acquisition_credit_brl: initialCredit,
    used_acquisition_credit_brl: 0,
    remaining_acquisition_credit_brl: initialCredit,
    net_ad_revenue_brl: netAdRevenue,
    target_neighborhoods: params.targetNeighborhoods || [],
    target_categories: params.targetCategories || [],
    duration_days: durationDays,
    impressions_count: 140,
    clicks_count: 28,
    attributed_adhesions_count: 0,
    attributed_billable_visits_count: 0,
    starts_at: now.toISOString(),
    ends_at: endsAt,
    credits_expire_at: creditsExpireAt,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  const all = getPartnerSponsoredCampaigns();
  const next = [campaign, ...all];
  writeJson(KEYS.SPONSORED_CAMPAIGNS, next);

  if (initialCredit > 0) {
    const creditLedger = readJson<PartnerAcquisitionCreditEntry[]>(
      KEYS.ACQUISITION_CREDIT_LEDGER,
      []
    );
    creditLedger.unshift({
      id: generateUUID(),
      campaign_id: campaign.id,
      restaurant_id: params.restaurantId,
      entry_type: 'CREDIT_GRANTED',
      amount_brl: initialCredit,
      balance_after_brl: initialCredit,
      description: `Crédito comercial de aquisição (${conversionPct}% de R$ ${investment.toFixed(2)}) liberado para abater visitas faturáveis`,
      created_at: now.toISOString(),
    });
    writeJson(KEYS.ACQUISITION_CREDIT_LEDGER, creditLedger);
  }

  return {
    ok: true,
    message: `Campanha publicada! R$ ${initialCredit.toFixed(2)} em Crédito de Aquisição liberados automaticamente para abater seus próximos check-ins verificados.`,
    campaign,
    campaigns: next.filter((c) => c.restaurant_id === params.restaurantId),
  };
}

export function setPartnerSponsoredCampaignStatus(
  campaignId: string,
  status: SponsoredCampaignStatus
): PartnerSponsoredCampaign[] {
  const all = getPartnerSponsoredCampaigns();
  const next = all.map((c) =>
    c.id === campaignId ? { ...c, status, updated_at: new Date().toISOString() } : c
  );
  writeJson(KEYS.SPONSORED_CAMPAIGNS, next);
  return next;
}

/**
 * Calcula e registra a remuneração fixa devida ao BoraRio somente após check-in/visita validada
 * de CADA PARTICIPANTE ELEGÍVEL INDIVIDUALMENTE (1 pessoa por slot validado).
 *
 * Regras estruturais:
 * - Unidade faturável: Participante elegível atendido, com presença validada no BoraRio (slot 1..N).
 * - Uma reserva para 4 pessoas NÃO gera 4 cobranças automáticas quando apenas 1 pessoa faz check-in.
 * - Cada participante só pode gerar 1 cobrança por visita: chave única (booking_id, participant_slot).
 * - Acompanhantes não cadastrados ou que não validaram presença não geram cobrança.
 * - Respeita teto comercial opcional por reserva (`max_billable_guests_per_booking`) caso parametrizado.
 * - Abate automaticamente eventual saldo de Crédito Comercial de Aquisição de campanha patrocinada ativa.
 */
export function accruePartnerFeeFromCheckin(params: {
  reservation: ReservationRequest;
  visitProof: VisitProofRecord;
  participantSlot?: number;
  participantLabel?: string;
  attributedFromRewardVoucherId?: string;
}): { created: boolean; entry?: PartnerFeeLedgerEntry; reason?: string } {
  const { reservation, visitProof } = params;
  const slot = Math.max(1, Math.round(params.participantSlot ?? visitProof.participant_slot ?? 1));

  if (
    reservation.status === 'CANCELLED' ||
    reservation.stage === 'CANCELLED' ||
    reservation.stage === 'NO_SHOW' ||
    reservation.stage === 'ENDED_WITHOUT_GOAL'
  ) {
    return {
      created: false,
      reason: 'Reservas canceladas, não utilizadas ou encerradas nunca geram remuneração.',
    };
  }

  const ledger = readJson<PartnerFeeLedgerEntry[]>(KEYS.FEE_LEDGER, []);

  // Proteção anti-duplicidade individual por (booking_id, participant_slot)
  const existingForSlot = ledger.find(
    (e) => e.booking_id === reservation.id && (e.participant_slot ?? 1) === slot
  );
  if (existingForSlot) {
    return {
      created: false,
      entry: existingForSlot,
      reason: `Visita faturável já apurada para o participante #${slot} desta reserva (bloqueio de duplicidade).`,
    };
  }

  const plan = getPartnerCommercialPlan(reservation.experience_id);
  const modality: CommercialModality = reservation.modality || 'TRADITIONAL_BOOKING';

  // Verifica teto comercial opcional por reserva (ex: proteger grupos grandes se configurado no plano)
  const existingBillableSlotsForBooking = ledger.filter(
    (e) => e.booking_id === reservation.id && e.status !== 'WAIVED' && e.total_fee_brl > 0
  ).length;

  const isCappedByBookingLimit =
    plan.max_billable_guests_per_booking != null &&
    plan.max_billable_guests_per_booking > 0 &&
    existingBillableSlotsForBooking >= plan.max_billable_guests_per_booking;

  // Para PER_COMPLETED_BOOKING, apenas o 1º participante gera a taxa da reserva
  const isCompletedBookingModelAlreadyCharged =
    plan.billing_model === 'PER_COMPLETED_BOOKING' && existingBillableSlotsForBooking >= 1;

  const isPromoActive =
    Boolean(plan.launch_promo_active) &&
    (!plan.launch_promo_valid_until || new Date() <= new Date(plan.launch_promo_valid_until));

  // Cada validação de check-in corresponde a exatamente 1 participante elegível atendido
  const attendedGuests = 1;
  let unitFee = 0;
  let grossFee = 0;

  if (isCappedByBookingLimit || isCompletedBookingModelAlreadyCharged) {
    unitFee = 0;
    grossFee = 0;
  } else if (plan.billing_model === 'PER_ATTENDED_GUEST') {
    unitFee = isPromoActive
      ? (plan.launch_promo_fee_per_guest_brl ?? 5.0)
      : (plan.fixed_fee_per_guest_brl ?? 10.0);
    grossFee = Number((unitFee * attendedGuests).toFixed(2));
  } else if (plan.billing_model === 'PER_COMPLETED_BOOKING') {
    unitFee = plan.fixed_fee_per_booking_brl;
    grossFee = Number(unitFee.toFixed(2));
  }

  // Verifica se há Crédito de Aquisição ativo de Campanha Patrocinada para abater automaticamente
  let creditAbated = 0;
  let appliedCampaignId: string | undefined;

  if (grossFee > 0) {
    const allCampaigns = getPartnerSponsoredCampaigns();
    const nowIso = new Date().toISOString();
    // Prioriza campanha vinculada à oferta da reserva, ou qualquer campanha ativa do estabelecimento com saldo
    const candidateCampaign =
      allCampaigns.find(
        (c) =>
          c.restaurant_id === reservation.experience_id &&
          c.status === 'ACTIVE' &&
          c.remaining_acquisition_credit_brl > 0 &&
          c.credits_expire_at >= nowIso &&
          reservation.offering_id &&
          c.offering_id === reservation.offering_id
      ) ||
      allCampaigns.find(
        (c) =>
          c.restaurant_id === reservation.experience_id &&
          c.status === 'ACTIVE' &&
          c.remaining_acquisition_credit_brl > 0 &&
          c.credits_expire_at >= nowIso
      );

    if (candidateCampaign) {
      creditAbated = Math.min(grossFee, candidateCampaign.remaining_acquisition_credit_brl);
      creditAbated = Number(creditAbated.toFixed(2));
      appliedCampaignId = candidateCampaign.id;

      const nextRemaining = Number(
        (candidateCampaign.remaining_acquisition_credit_brl - creditAbated).toFixed(2)
      );
      const nextUsed = Number(
        (candidateCampaign.used_acquisition_credit_brl + creditAbated).toFixed(2)
      );

      const updatedCampaigns = allCampaigns.map((c) =>
        c.id === candidateCampaign.id
          ? {
              ...c,
              remaining_acquisition_credit_brl: nextRemaining,
              used_acquisition_credit_brl: nextUsed,
              attributed_billable_visits_count: c.attributed_billable_visits_count + 1,
              status: nextRemaining === 0 ? ('COMPLETED' as const) : c.status,
              updated_at: nowIso,
            }
          : c
      );
      writeJson(KEYS.SPONSORED_CAMPAIGNS, updatedCampaigns);

      const creditLedger = readJson<PartnerAcquisitionCreditEntry[]>(
        KEYS.ACQUISITION_CREDIT_LEDGER,
        []
      );
      creditLedger.unshift({
        id: generateUUID(),
        campaign_id: candidateCampaign.id,
        restaurant_id: reservation.experience_id,
        entry_type: 'ABATED_ON_CHECKIN',
        amount_brl: creditAbated,
        balance_after_brl: nextRemaining,
        booking_id: reservation.id,
        participant_slot: slot,
        visit_proof_id: visitProof.id,
        description: `Abatimento automático de R$ ${creditAbated.toFixed(2)} em visita verificada (Participante #${slot} · Reserva #${reservation.id.slice(0, 6).toUpperCase()})`,
        created_at: nowIso,
      });
      writeJson(KEYS.ACQUISITION_CREDIT_LEDGER, creditLedger);
    }
  }

  const netFee = Number(Math.max(0, grossFee - creditAbated).toFixed(2));

  const entry: PartnerFeeLedgerEntry = {
    id: generateUUID(),
    booking_id: reservation.id,
    visit_proof_id: visitProof.id,
    restaurant_id: reservation.experience_id,
    restaurant_name: reservation.experience_name,
    plan_id: plan.id,
    billing_model: plan.billing_model,
    modality,
    participant_slot: slot,
    participant_id: visitProof.user_id,
    participant_label:
      params.participantLabel ||
      visitProof.participant_label ||
      (slot === 1 ? 'Titular da Reserva' : `Participante #${slot}`),
    attended_guests: attendedGuests,
    unit_fee_brl: unitFee,
    gross_fee_brl: grossFee,
    credit_abated_brl: creditAbated,
    net_fee_brl: netFee,
    total_fee_brl: netFee,
    sponsored_campaign_id: appliedCampaignId,
    is_launch_promo_applied: isPromoActive,
    attribution_origin: reservation.attribution_origin || 'catalog',
    fee_source_type: 'ATTENDED_BOOKING',
    attributed_from_reward_voucher_id: params.attributedFromRewardVoucherId,
    status: isCappedByBookingLimit ? 'WAIVED' : 'ACCRUED',
    dispute_reason: isCappedByBookingLimit
      ? `Isento automaticamente pelo teto comercial de ${plan.max_billable_guests_per_booking} participantes faturáveis por reserva.`
      : undefined,
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
 */
export function getPartnerMonthlyInvoices(restaurantId: string): PartnerMonthlyInvoice[] {
  const all = readJson<Record<string, PartnerMonthlyInvoice[]>>(KEYS.INVOICES, {});
  if (all[restaurantId] && all[restaurantId].length > 0) {
    return all[restaurantId];
  }

  const plan = getPartnerCommercialPlan(restaurantId);
  const ledger = getPartnerFeeLedger(restaurantId);
  const validCheckinsCount = ledger.filter((e) => e.status !== 'WAIVED').length || 50;
  const unitFee = plan.launch_promo_active ? 5.0 : 10.0;
  const totalAttendedGuests =
    ledger.reduce((acc, e) => (e.status !== 'WAIVED' ? acc + e.attended_guests : acc), 0) || 50;
  const creditsAbated = ledger.reduce(
    (acc, e) => (e.status !== 'WAIVED' ? acc + (e.credit_abated_brl || 0) : acc),
    0
  );
  const subtotal = totalAttendedGuests * 10.0;
  const grossAfterPromo = totalAttendedGuests * unitFee;
  const totalBrl = Math.max(0, Number((grossAfterPromo - creditsAbated).toFixed(2)));
  const discountBrl = subtotal - grossAfterPromo;

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
    credits_abated_brl: creditsAbated,
    total_brl: totalBrl,
    is_launch_promo: plan.launch_promo_active,
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
    credits_abated_brl: 0,
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

export function attachGatewayCheckoutToInvoice(
  restaurantId: string,
  invoiceId: string,
  checkout: {
    provider: 'PAGARME' | 'STRIPE';
    method: 'PIX' | 'BOLETO' | 'CARD';
    order_id: string;
    charge_id?: string;
    pix_copy_paste_key?: string;
    pix_qr_code_url?: string;
    bank_slip_barcode?: string;
    boleto_pdf_url?: string;
    checkout_url?: string;
    expires_at?: string;
  }
): PartnerMonthlyInvoice | undefined {
  const all = readJson<Record<string, PartnerMonthlyInvoice[]>>(KEYS.INVOICES, {});
  const list = all[restaurantId] || getPartnerMonthlyInvoices(restaurantId);
  const targetIndex = list.findIndex((inv) => inv.id === invoiceId);
  if (targetIndex === -1) return undefined;

  const updatedInvoice: PartnerMonthlyInvoice = {
    ...list[targetIndex],
    payment_method: checkout.method,
    gateway_provider: checkout.provider,
    gateway_order_id: checkout.order_id,
    gateway_charge_id: checkout.charge_id,
    pix_copy_paste_key: checkout.pix_copy_paste_key,
    gateway_pix_qr_code_url: checkout.pix_qr_code_url,
    bank_slip_barcode: checkout.bank_slip_barcode,
    gateway_boleto_pdf_url: checkout.boleto_pdf_url,
    gateway_checkout_url: checkout.checkout_url,
    gateway_expires_at: checkout.expires_at,
  };

  list[targetIndex] = updatedInvoice;
  all[restaurantId] = list;
  writeJson(KEYS.INVOICES, all);
  return updatedInvoice;
}

export function confirmGatewayInvoicePayment(
  restaurantId: string,
  invoiceId: string,
  params: {
    paymentMethod: 'PIX' | 'BOLETO' | 'CARD';
    provider?: 'PAGARME' | 'STRIPE';
    orderId?: string;
    paidAt?: string;
  }
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
    paid_at: params.paidAt || new Date().toISOString(),
    payment_method: params.paymentMethod,
    gateway_provider: params.provider || list[targetIndex].gateway_provider,
    gateway_order_id: params.orderId || list[targetIndex].gateway_order_id,
  };

  list[targetIndex] = updatedInvoice;
  all[restaurantId] = list;
  writeJson(KEYS.INVOICES, all);

  return {
    ok: true,
    message: `Pagamento de R$ ${updatedInvoice.total_brl.toFixed(2).replace('.', ',')} confirmado pelo gateway!`,
    invoice: updatedInvoice,
  };
}

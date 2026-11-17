export type RewardSegment =
  | 'Gastronomia'
  | 'Bares & Noite'
  | 'Passeios & Turismo'
  | 'Hospedagem'
  | 'Bem-estar'
  | 'Cultura & Entretenimento';

export type RewardType =
  | 'SOBREMESA'
  | 'ENTRADA'
  | 'BEBIDA_NAO_ALCOOLICA'
  | 'PASSEIO'
  | 'UPGRADE_HOTEL'
  | 'SERVICO_BEM_ESTAR'
  | 'INGRESSO'
  | 'EXPERIENCIA';

/**
 * Constantes oficiais do Motor Central da Economia Rio Points
 */
export const RP_PER_BRL = 100; // 100 RP = R$ 1,00
export const POINTS_PER_CHECKIN = 250; // 250 RP por check-in individual validado (R$ 2,50 de poder de troca)
export const REWARD_MIN_POINTS = 500; // 500 RP (R$ 5,00)
export const REWARD_MAX_POINTS = 2500; // 2.500 RP (R$ 25,00)
export const REWARD_EXPIRATION_MONTHS = 12; // 12 meses de validade

export type PartnerRewardStatus = 'AVAILABLE' | 'PAUSED' | 'CLOSED' | 'EXHAUSTED';

/**
 * 6 estados oficiais do ciclo de recompensas / vouchers no BoraRio.
 */
export type RewardVoucherStatus =
  | 'AVAILABLE'
  | 'REDEEMED'
  | 'ISSUED'
  | 'USED'
  | 'EXPIRED'
  | 'CANCELLED';

/**
 * 6 estados operacionais distintos da jornada do usuário (sem confusão entre etapas).
 */
export type OperationalJourneyState =
  | 'Reserva confirmada'
  | 'Check-in realizado'
  | 'Visita verificada'
  | 'Consumo verificado'
  | 'Recompensa resgatada'
  | 'Recompensa utilizada';

export interface PartnerReward {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  neighborhood: string;
  segment_category: RewardSegment | string;
  reward_type: RewardType;
  title: string;
  description: string;
  eligible_item: string;
  points_cost: number;
  /** Preço de referência de mercado do item (R$) — 100 RP = R$ 1,00 */
  reference_price_brl?: number;
  /** Custo estimado direto do parceiro para produzir/entregar o benefício (R$) */
  estimated_cost_brl?: number;
  /** Consumo mínimo exigido no local (R$ 0 ou undefined se sem consumo mínimo) */
  min_consumption_brl?: number;
  quantity_total: number;
  quantity_available: number;
  max_per_user: number;
  valid_days_hours: string;
  rules_summary: string;
  restrictions: string;
  voucher_validity_days: number;
  expires_at?: string;
  status: PartnerRewardStatus;
  /** Garantia estrutural permanente: 0% de comissão sobre resgates em Rio Points */
  commission_rate: 0;
  /** Garantia estrutural permanente: R$ 0,00 de taxa por resgate */
  redemption_fee_brl: 0;
  is_demonstrative: boolean;
  created_at: string;
  updated_at: string;
}

export interface RewardVoucherSnapshotRules {
  title: string;
  restaurant_name: string;
  neighborhood: string;
  eligible_item: string;
  segment_category: string;
  reference_price_brl?: number;
  estimated_cost_brl?: number;
  min_consumption_brl?: number;
  valid_days_hours: string;
  rules_summary: string;
  restrictions: string;
  commission_rate: 0;
  redemption_fee_brl: 0;
}

export interface RewardVoucher {
  id: string;
  reward_id: string;
  restaurant_id: string;
  restaurant_name: string;
  user_id: string;
  voucher_code: string;
  status: RewardVoucherStatus;
  points_spent: number;
  issued_at: string;
  expires_at: string;
  redeemed_at: string;
  used_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  cancellation_refund_tx_id?: string;
  validated_by_label?: string;
  /** Garantia estrutural: R$ 0,00 de comissão cobrada do parceiro pelo voucher */
  commission_charged_brl: 0;
  snapshot_rules: RewardVoucherSnapshotRules;
  is_demonstrative: boolean;
}

export type PointRuleScope = 'DEFAULT' | 'CATEGORY' | 'PARTNER' | 'CAMPAIGN';

export interface PointEarningRule {
  id: string;
  rule_code: string;
  scope_type: PointRuleScope;
  category_filter?: string;
  restaurant_id?: string;
  points_amount: number;
  max_credits_per_user_day: number;
  max_credits_per_user_venue_day: number;
  max_credits_per_user_venue_month: number;
  require_verified_checkin: true;
  active: boolean;
  notes: string;
  updated_at: string;
}

export interface WalletSummary {
  available_balance: number;
  total_accumulated: number;
  total_spent: number;
  pending_points: number;
  total_refunded: number;
  total_reversals: number;
  non_monetary_notice: string;
}

export interface GroupValidatedSlot {
  slot: number;
  participant_id: string;
  participant_label: string;
  qr_code_used?: string;
  validated_at: string;
}

export interface RewardReturnAttribution {
  id: string;
  reward_voucher_id: string;
  restaurant_id: string;
  user_id: string;
  event_type: 'RETURN_VISIT' | 'SUBSEQUENT_BOOKING';
  subsequent_booking_id?: string;
  subsequent_fee_ledger_id?: string;
  indirect_fee_brl: number;
  attribution_note: string;
  created_at: string;
}

export interface PartnerLoyaltyEconomicsSummary {
  restaurant_id: string;
  registered_rewards_count: number;
  active_rewards_count: number;
  total_stock_available: number;
  points_awarded_at_venue: number;
  points_redeemed_on_venue: number;
  vouchers_issued_count: number;
  vouchers_used_count: number;
  vouchers_expired_count: number;
  vouchers_cancelled_count: number;
  return_visits_post_redemption: number;
  subsequent_bookings_post_redemption: number;
  indirect_booking_revenue_brl: number;
  total_estimated_cost_brl: number;
  total_reference_value_brl: number;
  reward_commission_brl: 0;
  reward_redemption_fee_pct: 0;
  attribution_disclaimer: string;
}

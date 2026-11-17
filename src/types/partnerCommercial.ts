/**
 * 4 modalidades comerciais independentes para estabelecimentos parceiros.
 * O estabelecimento tem total autonomia e nunca é obrigado a dar desconto nem aderir a campanhas por demanda.
 */
export type CommercialModality =
  | 'TRADITIONAL_BOOKING'
  | 'INDIVIDUAL_OFFER'
  | 'DEMAND_OFFER'
  | 'LAST_MINUTE';

export type PartnerBillingModel =
  | 'PER_ATTENDED_GUEST'
  | 'PER_COMPLETED_BOOKING'
  | 'PRO_SUBSCRIPTION';

export type PartnerRole = 'OWNER' | 'MANAGER' | 'STAFF';
export type PartnerMembershipStatus = 'PENDING' | 'APPROVED' | 'REVOKED';

export interface PartnerMembership {
  id: string;
  user_id: string;
  restaurant_id: string;
  role: PartnerRole;
  status: PartnerMembershipStatus;
  created_at: string;
}

/**
 * Condições comerciais configuráveis por contrato/plano do parceiro.
 * Valores nunca ficam fixos universalmente em código de negócio.
 */
export interface PartnerCommercialPlan {
  id: string;
  restaurant_id: string;
  plan_name: string;
  billing_model: PartnerBillingModel;
  fixed_fee_per_guest_brl: number; // Tarifa padrão: R$ 10,00
  fixed_fee_per_booking_brl: number;
  monthly_subscription_brl: number;
  requires_monthly_fee: boolean;
  charge_on_cancelled: boolean;
  charge_on_no_show: boolean;
  currency: 'BRL';
  policy_summary: string;
  is_configurable_pilot_default: boolean;
  launch_promo_active: boolean; // Ativa na adesão / fundadores
  launch_promo_fee_per_guest_brl: number; // Tarifa promocional: R$ 5,00
  launch_promo_valid_until: string; // ISO date (ex: 30 dias após adesão)
  effective_from: string;
  updated_at: string;
}

export type PartnerFeeStatus = 'ACCRUED' | 'DISPUTED' | 'WAIVED' | 'INVOICED';

export interface PartnerFeeLedgerEntry {
  id: string;
  booking_id: string;
  visit_proof_id: string;
  restaurant_id: string;
  restaurant_name: string;
  plan_id: string;
  billing_model: PartnerBillingModel;
  modality: CommercialModality;
  attended_guests: number;
  unit_fee_brl: number; // Tarifa aplicada (R$ 5,00 ou R$ 10,00 gravada no evento)
  total_fee_brl: number;
  is_launch_promo_applied: boolean;
  attribution_origin: string;
  fee_source_type?: 'ATTENDED_BOOKING';
  attributed_from_reward_voucher_id?: string;
  status: PartnerFeeStatus;
  dispute_reason?: string;
  event_timestamp: string;
  is_demonstrative: boolean;
}

export type InvoiceStatus = 'OPEN' | 'PAID' | 'OVERDUE' | 'CONTESTED';

export interface PartnerMonthlyInvoice {
  id: string;
  restaurant_id: string;
  period_month_year: string; // ex: "11/2026"
  period_label: string; // ex: "Novembro de 2026 · Mês de Lançamento"
  status: InvoiceStatus;
  valid_checkins_count: number;
  total_attended_guests: number;
  effective_fee_per_guest_brl: number; // 5.0 ou 10.0
  subtotal_brl: number;
  discount_brl: number;
  total_brl: number;
  is_launch_promo: boolean;
  pix_qr_code_payload?: string;
  pix_copy_paste_key?: string;
  bank_slip_barcode?: string;
  due_date: string;
  paid_at?: string;
  payment_method?: 'PIX' | 'BOLETO';
}

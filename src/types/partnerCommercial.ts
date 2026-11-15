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
  fixed_fee_per_guest_brl: number;
  fixed_fee_per_booking_brl: number;
  monthly_subscription_brl: number;
  requires_monthly_fee: boolean;
  charge_on_cancelled: boolean;
  charge_on_no_show: boolean;
  currency: 'BRL';
  policy_summary: string;
  is_configurable_pilot_default: boolean;
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
  unit_fee_brl: number;
  total_fee_brl: number;
  attribution_origin: string;
  status: PartnerFeeStatus;
  dispute_reason?: string;
  event_timestamp: string;
  is_demonstrative: boolean;
}

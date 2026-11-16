import type { CommercialModality } from './partnerCommercial';
import type { ReservationLifecycleStage } from './verification';

/**
 * 9 estados completos da oferta/campanha, com atenção especial ao ciclo da Reserva Inteligente por Demanda.
 */
export type PartnerOfferingStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'CAPTURING'
  | 'GOAL_REACHED'
  | 'CONFIRMED'
  | 'SOLD_OUT'
  | 'ENDED_WITHOUT_GOAL'
  | 'CANCELLED'
  | 'COMPLETED';

export interface PartnerOffering {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  neighborhood: string;
  category: string;
  price_range: string;
  modality: CommercialModality;
  status: PartnerOfferingStatus;
  title: string;
  description: string;
  benefit_summary: string;
  rules_summary: string;
  eligibility_rules: string;
  cancellation_policy: string;
  payment_instructions: string;
  has_discount: boolean;
  condition_badge: string;
  base_price_brl?: number;
  partner_condition_price_brl?: number;
  estimated_savings_brl: number;
  service_date: string;
  time_slot_label: string;
  starts_at: string;
  ends_at: string;
  capacity_total: number;
  reserved_count: number;
  min_demand_goal?: number;
  eligible_item?: string;
  offer_category?: string;
  valid_days_hours?: string;
  views_count?: number;
  partner_managed_active: boolean;
  is_demonstrative: boolean;
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DemandParticipation {
  id: string;
  offering_id: string;
  reservation_id: string;
  restaurant_id: string;
  user_id: string;
  guests: number;
  stage: ReservationLifecycleStage;
  created_at: string;
}

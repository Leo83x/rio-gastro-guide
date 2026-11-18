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
  | 'EXPIRED'
  | 'COMPLETED';

export type OfferingDistributionMode = 'INDIVIDUAL' | 'COLLECTIVE_MISSION';

export type OfferingAdhesionStage =
  | 'INTEREST'
  | 'VALID_ADHESION'
  | 'RESERVATION'
  | 'VERIFIED_VISIT'
  | 'CONFIRMED_ATTENDANCE'
  | 'CANCELLED';

export interface ProgressiveMissionTier {
  tier_level: 1 | 2 | 3;
  min_adhesions: number;
  benefit_label: string;
  benefit_description?: string;
  condition_price_brl?: number;
  estimated_savings_brl?: number;
}

export interface OfferingAdhesionRecord {
  id: string;
  offering_id: string;
  restaurant_id: string;
  user_id: string;
  user_label: string;
  reservation_id?: string;
  adhesion_stage: OfferingAdhesionStage;
  unlocked_tier_level: number;
  unlocked_benefit_label: string;
  created_at: string;
  updated_at: string;
}

export interface PartnerOffering {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  neighborhood: string;
  category: string;
  price_range: string;
  modality: CommercialModality;
  distribution_mode?: OfferingDistributionMode; // Modalidade A: INDIVIDUAL | Modalidade B: COLLECTIVE_MISSION
  status: PartnerOfferingStatus;
  title: string;
  description: string;
  benefit_summary: string;
  initial_guaranteed_benefit?: string; // Benefício inicial garantido desde a publicação (nunca cancela a oferta)
  progressive_tiers?: ProgressiveMissionTier[]; // Faixas de evolução coletiva (Faixa 1, Faixa 2, Faixa 3)
  valid_adhesions_count?: number; // Adesões válidas confirmadas (separado de meros cliques/visualizações)
  verified_visits_count?: number; // Visitas verificadas presencialmente
  is_sponsored?: boolean; // Indica se está impulsionada por campanha patrocinada ativa
  sponsored_campaign_id?: string;
  created_by_mode?: 'SELF_SERVE' | 'ASSISTED_BY_BORARIO';
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
  adhesion_stage?: OfferingAdhesionStage;
  created_at: string;
}


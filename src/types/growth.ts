export type ReferralStatus = 'PENDING_CONVERSION' | 'CONVERTED' | 'REVERSED';

export type ReferralFunnelStage =
  | 'INVITE_CREATED'
  | 'LINK_VISITED'
  | 'SIGNUP_COMPLETED'
  | 'CONTACT_VERIFIED'
  | 'FIRST_VALID_ACTION'
  | 'FIRST_VERIFIED_VISIT'
  | 'REWARD_PENDING'
  | 'REWARD_RELEASED'
  | 'REWARD_CANCELLED';

export interface ReferralEventRecord {
  id: string;
  attribution_id: string;
  event_type: ReferralFunnelStage | 'RISK_FLAGGED' | 'RECONCILED_LEGACY';
  source: string;
  actor_user_id?: string;
  idempotency_key?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ReferralAttribution {
  id: string;
  referral_code: string;
  referrer_user_id: string;
  referred_user_id?: string;
  referred_label: string;
  referred_identifier?: string;
  booking_id?: string;
  visit_proof_id?: string;
  experience_id?: string;
  experience_name?: string;
  reward_points: number;
  referrer_points?: number;
  referred_points?: number;
  status: ReferralStatus;
  current_stage?: ReferralFunnelStage;
  risk_flags?: string[];
  referral_events?: ReferralEventRecord[];
  reversal_reason?: string;
  expires_at?: string;
  created_at: string;
  converted_at?: string;
  reversed_at?: string;
  is_demonstrative: boolean;
}

export interface ReferralProgramRule {
  id?: string;
  rule_code: string;
  referrer_points: number;
  referred_points: number;
  host_table_bonus_points: number;
  max_host_bonus_slots_per_booking: number;
  first_visit_bonus_points: number;
  trigger_event: 'FIRST_VERIFIED_CHECKIN' | 'FIRST_VERIFIED_CONSUMPTION';
  max_rewards_per_user_total: number;
  max_rewards_per_user_period: number;
  period_days: number;
  validation_window_days: number;
  require_contact_verified: boolean;
  active: boolean;
  notes?: string;
  updated_at?: string;
}

export interface PartnerVipInviteConfig {
  id: string;
  restaurant_id: string;
  offering_id?: string;
  enabled: boolean;
  benefit_title: string;
  conditions_text?: string;
  max_invites_per_checkin: number;
  total_quota?: number | null;
  used_count: number;
  valid_days_after_checkin: number;
  active: boolean;
  updated_at?: string;
}

export interface VipInviteRecord {
  id: string;
  config_id: string;
  restaurant_id: string;
  issuer_user_id: string;
  source_reservation_id?: string;
  source_visit_proof_id?: string;
  invite_code: string;
  benefit_title: string;
  conditions_text?: string;
  status: 'ISSUED' | 'CLAIMED' | 'USED' | 'EXPIRED' | 'CANCELLED';
  claimed_by_user_id?: string;
  expires_at: string;
  created_at: string;
}

export type SavingsKind = 'PROVEN' | 'POTENTIAL';

export type SavingsSourceType =
  | 'RESERVATION_CHECKIN'
  | 'VERIFIED_VOUCHER'
  | 'PENDING_RESERVATION'
  | 'ACTIVE_VOUCHER';

export interface SavingsEntry {
  id: string;
  kind: SavingsKind;
  source_type: SavingsSourceType;
  reference_id: string;
  experience_id: string;
  experience_name: string;
  title: string;
  amount_brl: number;
  is_demonstrative: boolean;
  created_at: string;
}

export interface SavingsSummary {
  proven_brl: number;
  potential_brl: number;
  proven_count: number;
  potential_count: number;
  catalog_reference_brl: number;
  entries: SavingsEntry[];
}

export interface BoraJuntoPlan {
  id: string;
  title: string;
  planned_date: string;
  planned_time: string;
  guests: number;
  invited_circle_ids: string[];
  invited_circle_names: string[];
  invited_connection_names: string[];
  candidate_venue_ids: string[];
  itinerary_id?: string;
  selected_venue_id?: string;
  created_at: string;
  updated_at: string;
}

export type MissionCategory = 'VERIFICACAO' | 'DESCOBERTA' | 'COMUNIDADE' | 'ECONOMIA';

export interface MissionDefinition {
  id: string;
  category: MissionCategory;
  title: string;
  description: string;
  current: number;
  target: number;
  completed: boolean;
  reward_badge: string;
  verification_rule: string;
}

export interface MissionSummary {
  completed_count: number;
  total_count: number;
  missions: MissionDefinition[];
}

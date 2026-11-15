export type ReferralStatus = 'PENDING_CONVERSION' | 'CONVERTED' | 'REVERSED';

export interface ReferralAttribution {
  id: string;
  referral_code: string;
  referrer_user_id: string;
  referred_label: string;
  referred_identifier?: string;
  booking_id?: string;
  visit_proof_id?: string;
  experience_id?: string;
  experience_name?: string;
  reward_points: number;
  status: ReferralStatus;
  reversal_reason?: string;
  created_at: string;
  converted_at?: string;
  reversed_at?: string;
  is_demonstrative: boolean;
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

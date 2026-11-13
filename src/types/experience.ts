import type { Restaurant } from './restaurant';

export type MacroCategory =
  | 'Gastronomia'
  | 'Eventos & Shows'
  | 'Cultura & Museus'
  | 'Atrações Infantis'
  | 'Turismo & Praias'
  | 'Vida Noturna';

export type MomentMode =
  | 'all'
  | 'family'
  | 'couple'
  | 'friends'
  | 'tourist'
  | 'rainy'
  | 'budget';

export type DataReliability =
  | 'CONFIRMED_SOURCE'
  | 'ESTABLISHMENT_PROVIDED'
  | 'PLATFORM_ESTIMATE'
  | 'DEMONSTRATIVE'
  | 'UNAVAILABLE';

export interface ExperienceAttributes {
  is_covered?: boolean;
  is_free?: boolean;
  is_kid_friendly?: boolean;
  has_parking?: boolean;
  parking_avg_cost?: string;
  event_date?: string;
  event_time?: string;
  duration_minutes?: number;
  avg_ticket_brl?: number;
  live_music?: boolean;
  off_peak_window?: string;
}

export interface Experience extends Restaurant {
  macro_category?: MacroCategory;
  moment_tags?: MomentMode[];
  attributes?: ExperienceAttributes;
  data_reliability?: DataReliability;
}

export interface LGPDConsents {
  location: boolean;
  personalization: boolean;
  whatsapp: boolean;
  notifications: boolean;
  calendar: boolean;
}

export interface UserPreferences {
  favorite_macro_categories: MacroCategory[];
  favorite_neighborhoods: string[];
  preferred_moments: MomentMode[];
  budget_tier: '$' | '$$' | '$$$' | '$$$$';
  lgpd_consents: LGPDConsents;
}

export type PointTransactionType = 'CREDIT' | 'DEBIT' | 'REDEEM' | 'REVERSAL';

export interface PointTransaction {
  id: string;
  type: PointTransactionType;
  amount: number;
  origin: 'checkin_qr' | 'verified_review' | 'referral' | 'reward_redeem' | 'welcome_bonus';
  description: string;
  experience_id?: string;
  experience_name?: string;
  qr_nonce?: string;
  created_at: string;
}

export interface ReservationRequest {
  id: string;
  experience_id: string;
  experience_name: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  date: string;
  time: string;
  guests: number;
  status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED';
  whatsapp_reminder: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  channel: 'internal' | 'whatsapp' | 'calendar';
  type: 'reservation' | 'reward' | 'event' | 'offer';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface GroupVoteOption {
  experience_id: string;
  likes: number;
  dislikes: number;
}

export interface GroupVoteSession {
  id: string;
  title: string;
  options: GroupVoteOption[];
  created_at: string;
}

export interface ClubOffer {
  id: string;
  experience_id: string;
  experience_name: string;
  neighborhood: string;
  title: string;
  benefit_type: '2_FOR_1' | 'EXECUTIVE_MENU' | 'FREE_DESSERT' | 'OFF_PEAK';
  discount_label: string;
  valid_window: string;
  reliability: DataReliability;
}

export interface GroupDrop {
  id: string;
  experience_id: string;
  experience_name: string;
  neighborhood: string;
  title: string;
  discount_label: string;
  current_participants: number;
  target_participants: number;
  deadline_label: string;
  joined: boolean;
  reliability: DataReliability;
}

export type ConnectionStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED';

export type ConfiaVisibilityScope = 'ALL_CONNECTIONS' | 'SPECIFIC_CIRCLES';

export type ConfiaEndorsementOrigin = 'VERIFIED_CHECKIN' | 'PERSONAL_RECOMMENDATION';

export interface TrustCircle {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  member_ids: string[];
  created_at: string;
}

export interface TrustConnection {
  id: string;
  display_name: string;
  handle_or_code: string;
  direction: 'INCOMING' | 'OUTGOING' | 'MUTUAL';
  status: ConnectionStatus;
  circle_ids: string[];
  created_at: string;
}

export interface ConfiaRecommendation {
  id: string;
  author_id: string;
  author_name: string;
  is_self: boolean;
  venue_id: string;
  venue_name: string;
  neighborhood: string;
  category: string;
  comment: string;
  visibility_scope: ConfiaVisibilityScope;
  circle_ids: string[];
  endorsement_origin: ConfiaEndorsementOrigin;
  verified_tx_id?: string;
  created_at: string;
}

export interface ConfiaPrivacySettings {
  default_visibility: 'PRIVATE_CIRCLES_ONLY';
  allow_invites_by_code: boolean;
  require_explicit_circle_approval: boolean;
  auto_share_vault_to_feed: false;
  show_verified_visit_badge: boolean;
}

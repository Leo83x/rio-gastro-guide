import type { VisitOperationalStatus } from './verification';

export type IncidentCategory = 'CONSUMER' | 'PARTNER' | 'TECHNICAL';

export type ConsumerIncidentSubtype =
  | 'RESERVATION_NO_SHOW'
  | 'LATE_CANCELLATION'
  | 'ATTENDED_WITHOUT_CHECKIN'
  | 'EXPIRED_BENEFIT_ATTEMPT'
  | 'QR_OR_VOUCHER_REUSE_ATTEMPT'
  | 'DUPLICATE_BOOKING_OR_CHECKIN'
  | 'SELF_REFERRAL_OR_REFERRAL_FRAUD'
  | 'RECURRING_BENEFIT_ABUSE';

export type PartnerIncidentSubtype =
  | 'PARTNER_REFUSED_QR'
  | 'QR_UNAVAILABLE_OR_EXPIRED_OP'
  | 'PARTNER_REFUSED_VALID_RESERVATION'
  | 'OFFER_TERMS_MISMATCH'
  | 'BENEFIT_OR_REWARD_REFUSED'
  | 'INCORRECT_ATTENDANCE_RECORD'
  | 'FEE_AVOIDANCE_ATTEMPT'
  | 'RECURRING_PARTNER_CANCELLATIONS'
  | 'CHECKIN_POINTS_OR_FEE_MANIPULATION';

export type TechnicalIncidentSubtype =
  | 'CONNECTION_UNAVAILABLE'
  | 'QR_GENERATION_OR_READ_FAILURE'
  | 'BACKEND_COMMUNICATION_ERROR'
  | 'SYNC_ERROR'
  | 'VALIDATION_TIMEOUT'
  | 'DUPLICATE_REQUEST_RETRY';

export type IncidentSubtype =
  | ConsumerIncidentSubtype
  | PartnerIncidentSubtype
  | TechnicalIncidentSubtype;

export type CheckinProblemChoice =
  | 'PARTNER_NO_QR'
  | 'QR_NOT_WORKING'
  | 'RESERVATION_NOT_RECOGNIZED'
  | 'SERVICE_REFUSED'
  | 'BENEFIT_NOT_HONORED'
  | 'OTHER';

export type IncidentStatus =
  | 'OPEN'
  | 'WAITING_PARTNER'
  | 'WAITING_USER'
  | 'UNDER_REVIEW'
  | 'RESOLVED_USER'
  | 'RESOLVED_PARTNER'
  | 'RESOLVED_TECHNICAL'
  | 'UNFOUNDED'
  | 'CLOSED';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type IncidentActorRole = 'USER' | 'PARTNER' | 'ADMIN' | 'SYSTEM';

export interface IncidentEvidence {
  id: string;
  incident_id: string;
  submitted_by_user_id?: string | null;
  submitted_by_role: IncidentActorRole;
  evidence_type: 'TEXT_STATEMENT' | 'SCREENSHOT_URL' | 'RECEIPT_URL' | 'QR_DIAGNOSTIC' | 'GEO_SIGNAL' | 'SYSTEM_LOG';
  summary: string;
  payload_url?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface IncidentEvent {
  id: string;
  incident_id: string;
  actor_user_id?: string | null;
  actor_role: IncidentActorRole;
  event_type:
    | 'INCIDENT_OPENED'
    | 'PARTNER_RESPONDED'
    | 'USER_RESPONDED'
    | 'EVIDENCE_ADDED'
    | 'STATUS_CHANGED'
    | 'POST_VISIT_CONFIRMED'
    | 'MEASURE_APPLIED'
    | 'TECHNICAL_CLASSIFIED'
    | 'CLOSED';
  previous_status?: IncidentStatus | null;
  new_status?: IncidentStatus | null;
  justification: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface OperationalIncident {
  id: string;
  idempotency_key?: string | null;
  category: IncidentCategory;
  subtype: IncidentSubtype;
  status: IncidentStatus;
  severity: IncidentSeverity;
  user_id?: string | null;
  user_display_label?: string | null;
  restaurant_id?: string | null;
  restaurant_name?: string | null;
  reservation_id?: string | null;
  offering_id?: string | null;
  visit_proof_id?: string | null;
  visit_operational_status?: VisitOperationalStatus | null;
  title: string;
  description: string;
  possible_fraud: boolean;
  assigned_admin_id?: string | null;
  resolution_summary?: string | null;
  resolved_by_user_id?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  events?: IncidentEvent[];
  evidences?: IncidentEvidence[];
}

export type UserProgressiveMeasureLevel =
  | 'EDUCATIONAL_NOTICE'
  | 'CANCELLATION_ATTENDANCE_GUIDANCE'
  | 'TEMP_PROMO_LIMIT'
  | 'EXTRA_CONFIRMATION_REQUIRED'
  | 'TEMP_FEATURE_SUSPENSION'
  | 'ACCOUNT_SUSPENSION';

export interface UserRestrictionRecord {
  id: string;
  user_id: string;
  incident_id?: string | null;
  measure_level: UserProgressiveMeasureLevel;
  reason: string;
  active: boolean;
  starts_at: string;
  expires_at?: string | null;
  review_eligible_at?: string | null;
  issued_by_user_id?: string | null;
  created_at: string;
}

export interface UserReliabilityProfile {
  user_id: string;
  total_reservations: number;
  confirmed_attendances: number;
  timely_cancellations: number;
  confirmed_no_shows: number;
  technical_incidents: number;
  upheld_disputes: number;
  proven_infractions: number;
  active_restrictions: UserRestrictionRecord[];
  updated_at: string;
}

export type PartnerProgressiveMeasureLevel =
  | 'NOTICE_AND_GUIDANCE'
  | 'CLARIFICATION_REQUEST'
  | 'OPERATIONAL_TRAINING'
  | 'TEMPORARY_MONITORING'
  | 'OFFER_SUSPENSION'
  | 'TEMP_PARTNER_SUSPENSION'
  | 'PARTNER_DELISTING';

export interface PartnerComplianceMeasure {
  id: string;
  restaurant_id: string;
  incident_id?: string | null;
  measure_level: PartnerProgressiveMeasureLevel;
  reason: string;
  active: boolean;
  starts_at: string;
  expires_at?: string | null;
  issued_by_user_id?: string | null;
  created_at: string;
}

export interface PartnerComplianceProfile {
  restaurant_id: string;
  restaurant_name?: string;
  checkin_refusals: number;
  recurring_qr_failures: number;
  offer_complaints: number;
  valid_reservation_refusals: number;
  unhonored_benefits: number;
  attendance_divergences: number;
  confirmed_post_visits: number;
  manipulation_attempts: number;
  upheld_disputes_against_partner: number;
  monitoring_active: boolean;
  active_measures: PartnerComplianceMeasure[];
  updated_at: string;
}

export interface IntegrityOperationalMetrics {
  successfulCheckinRatePct: number;
  qrFailureRatePct: number;
  incidentsPerReservationPct: number;
  confirmedNoShowCount: number;
  partnerCheckinRefusals: number;
  avgResolutionHours: number;
  upheldDisputesPct: number;
  repeatOffenderPartners: number;
  repeatOffenderUsers: number;
  recoveredVisitsPostDispute: number;
  feeDivergenceCount: number;
  totalOpen: number;
  waitingPartner: number;
  waitingUser: number;
  underReview: number;
  resolvedCount: number;
  possibleFraudCount: number;
}

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Aberta',
  WAITING_PARTNER: 'Aguardando estabelecimento',
  WAITING_USER: 'Aguardando consumidor',
  UNDER_REVIEW: 'Em análise',
  RESOLVED_USER: 'Resolvida a favor do consumidor',
  RESOLVED_PARTNER: 'Resolvida a favor do estabelecimento',
  RESOLVED_TECHNICAL: 'Falha técnica identificada',
  UNFOUNDED: 'Não confirmada',
  CLOSED: 'Encerrada',
};

export const CHECKIN_PROBLEM_OPTIONS: Array<{
  choice: CheckinProblemChoice;
  label: string;
  category: IncidentCategory;
  subtype: IncidentSubtype;
}> = [
  {
    choice: 'PARTNER_NO_QR',
    label: 'O estabelecimento não apresentou o QR',
    category: 'PARTNER',
    subtype: 'PARTNER_REFUSED_QR',
  },
  {
    choice: 'QR_NOT_WORKING',
    label: 'O QR não funcionou',
    category: 'TECHNICAL',
    subtype: 'QR_GENERATION_OR_READ_FAILURE',
  },
  {
    choice: 'RESERVATION_NOT_RECOGNIZED',
    label: 'O estabelecimento não reconheceu minha reserva',
    category: 'PARTNER',
    subtype: 'PARTNER_REFUSED_VALID_RESERVATION',
  },
  {
    choice: 'SERVICE_REFUSED',
    label: 'O estabelecimento recusou o atendimento',
    category: 'PARTNER',
    subtype: 'PARTNER_REFUSED_VALID_RESERVATION',
  },
  {
    choice: 'BENEFIT_NOT_HONORED',
    label: 'O benefício anunciado não foi respeitado',
    category: 'PARTNER',
    subtype: 'BENEFIT_OR_REWARD_REFUSED',
  },
  {
    choice: 'OTHER',
    label: 'Outro problema',
    category: 'TECHNICAL',
    subtype: 'BACKEND_COMMUNICATION_ERROR',
  },
];

export const USER_MEASURE_LABELS: Record<UserProgressiveMeasureLevel, string> = {
  EDUCATIONAL_NOTICE: '1. Aviso educativo',
  CANCELLATION_ATTENDANCE_GUIDANCE: '2. Orientação sobre cancelamento e comparecimento',
  TEMP_PROMO_LIMIT: '3. Limitação temporária de reservas promocionais',
  EXTRA_CONFIRMATION_REQUIRED: '4. Exigência de confirmação adicional',
  TEMP_FEATURE_SUSPENSION: '5. Suspensão temporária de funcionalidades',
  ACCOUNT_SUSPENSION: '6. Suspensão da conta (grave e comprovado)',
};

export const PARTNER_MEASURE_LABELS: Record<PartnerProgressiveMeasureLevel, string> = {
  NOTICE_AND_GUIDANCE: '1. Notificação e orientação',
  CLARIFICATION_REQUEST: '2. Solicitação de esclarecimentos',
  OPERATIONAL_TRAINING: '3. Treinamento operacional',
  TEMPORARY_MONITORING: '4. Monitoramento temporário',
  OFFER_SUSPENSION: '5. Suspensão de ofertas específicas',
  TEMP_PARTNER_SUSPENSION: '6. Suspensão temporária do estabelecimento',
  PARTNER_DELISTING: '7. Descredenciamento (grave ou recorrente)',
};

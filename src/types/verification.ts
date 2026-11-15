/**
 * Estados operacionais distintos de reservas e manifestações de interesse.
 * Nunca confundir solicitação / confirmação / check-in / visita verificada / consumo verificado.
 */
export type ReservationLifecycleStage =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'VERIFIED_VISIT'
  | 'VERIFIED_CONSUMPTION'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'ENDED_WITHOUT_GOAL';

/**
 * Níveis graduais de Prova de Visita:
 * - CHECKIN_REGISTERED: presença registrada na chegada via QR dinâmico ou PIN operacional.
 * - PRESENCE_WITH_EVIDENCE: presença registrada + evidência complementar (ex.: geolocalização consentida).
 * - VERIFIED_VISIT: visita validada dentro da janela operacional e vinculada à reserva/estabelecimento.
 * - VERIFIED_CONSUMPTION: exige evidência adicional adequada pós-consumo (confirmação do parceiro, comprovante ou PDV).
 */
export type VisitProofLevel =
  | 'CHECKIN_REGISTERED'
  | 'PRESENCE_WITH_EVIDENCE'
  | 'VERIFIED_VISIT'
  | 'VERIFIED_CONSUMPTION';

export type VisitEvidenceMethod =
  | 'DYNAMIC_QR'
  | 'DYNAMIC_QR_GEO'
  | 'CONTINGENCY_PIN'
  | 'PARTNER_POST_CONSUMPTION'
  | 'POS_RECEIPT'
  | 'OFFLINE_CONTINGENCY_RECONCILED';

export interface VenueQrToken {
  id: string;
  restaurant_id: string;
  token_code: string;
  contingency_pin: string;
  issued_at: string;
  expires_at: string;
  max_uses: number;
  consumed_count: number;
  revoked: boolean;
  issued_by_label?: string;
}

export interface VisitProofRecord {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  reservation_id?: string;
  user_id: string;
  participant_slot?: number;
  participant_label?: string;
  group_booking_owner_id?: string;
  qr_token_id?: string;
  qr_code_used?: string;
  presence_level: VisitProofLevel;
  evidence_method: VisitEvidenceMethod;
  guests_count: number;
  presence_verified_at: string;
  consumption_verified_at?: string;
  consumption_reference?: string;
  partner_confirmed_by?: string;
  is_demonstrative: boolean;
  notes?: string;
}

export type CheckinAuditEventType =
  | 'QR_ISSUED'
  | 'QR_REVOKED'
  | 'CHECKIN_VALIDATED'
  | 'GROUP_PARTICIPANT_VALIDATED'
  | 'CHECKIN_REJECTED_EXPIRED'
  | 'CHECKIN_REJECTED_INVALID'
  | 'CHECKIN_REJECTED_DUPLICATE'
  | 'CHECKIN_REJECTED_SELF_APPROVAL'
  | 'OFFLINE_CONTINGENCY_QUEUED'
  | 'OFFLINE_CONTINGENCY_RECONCILED'
  | 'CONSUMPTION_VERIFIED_BY_PARTNER'
  | 'REWARD_VOUCHER_VALIDATED'
  | 'REWARD_VOUCHER_CANCELLED'
  | 'FEE_DISPUTED';

export interface CheckinAuditEvent {
  id: string;
  event_type: CheckinAuditEventType;
  restaurant_id: string;
  reservation_id?: string;
  visit_proof_id?: string;
  actor_role: 'USER' | 'PARTNER' | 'SYSTEM';
  message: string;
  created_at: string;
}

export interface OfflineContingencyCheckin {
  id: string;
  reservation_id: string;
  restaurant_id: string;
  restaurant_name: string;
  contingency_pin_entered: string;
  guests_count: number;
  queued_at: string;
  reconciliation_status: 'PENDING_PARTNER_RECONCILE' | 'RECONCILED' | 'REJECTED';
}

export const MANDATORY_CHECKIN_INSTRUCTION =
  'Ao chegar, solicite a validação do seu check-in pelo estabelecimento antes de iniciar o consumo. Assim, sua visita será registrada corretamente e você poderá acompanhar seus benefícios e recompensas.';

export const POINTS_PREVISIT_CHECKIN_NOTICE =
  'Sua visita vale pontos! Ao chegar, solicite o QR Code de check-in ao estabelecimento e registre sua presença para receber seus Rio Points.';

export const REWARDS_ZERO_COMMISSION_PARTNER_COPY =
  'Disponibilize benefícios para os usuários BoraRio e participe do nosso programa de fidelidade sem pagar comissão por resgates. Você escolhe o que oferecer, quantas unidades disponibilizar e em quais condições. O BoraRio cuida dos pontos, dos vouchers e da validação.';

export const WALLET_NON_MONETARY_NOTICE =
  'Rio Points são pontos internos de fidelidade sem valor monetário fixo, não conversíveis em dinheiro, não sacáveis e intransferíveis entre usuários.';

export const DIRECT_PAYMENT_NOTICE =
  'Pagamento efetuado diretamente ao estabelecimento pelos meios aceitos no local. O BoraRio não realiza cobrança financeira.';

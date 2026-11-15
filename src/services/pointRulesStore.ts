import type { PointTransaction } from '../types/experience';
import type { PointEarningRule } from '../types/rewards';
import { generateUUID } from '../utils/slug';

const RULES_STORAGE_KEY = 'borario_point_earning_rules_v1';
const COMPANION_LEDGER_KEY = 'borario_companion_group_credits_v1';

const DEFAULT_RULES: PointEarningRule[] = [
  {
    id: 'rule-default-checkin',
    rule_code: 'DEFAULT_CHECKIN_50',
    scope_type: 'DEFAULT',
    points_amount: 50,
    max_credits_per_user_day: 5,
    max_credits_per_user_venue_day: 1,
    max_credits_per_user_venue_month: 8,
    require_verified_checkin: true,
    active: true,
    notes:
      'Regra padrão configurável por presença individual validada via QR dinâmico. Cliques, visualizações e reservas sem comparecimento geram 0 pontos.',
    updated_at: '2026-11-15T00:00:00.000Z',
  },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getPointEarningRules(): PointEarningRule[] {
  const stored = readJson<PointEarningRule[]>(RULES_STORAGE_KEY, []);
  if (stored.length === 0) {
    writeJson(RULES_STORAGE_KEY, DEFAULT_RULES);
    return DEFAULT_RULES;
  }
  return stored;
}

export function savePointEarningRule(
  input: Omit<PointEarningRule, 'id' | 'updated_at' | 'require_verified_checkin'> & {
    id?: string;
  }
): PointEarningRule[] {
  const current = getPointEarningRules();
  const nextRule: PointEarningRule = {
    ...input,
    id: input.id || generateUUID(),
    points_amount: Math.max(0, Math.round(input.points_amount)),
    max_credits_per_user_day: Math.max(1, Math.round(input.max_credits_per_user_day)),
    max_credits_per_user_venue_day: Math.max(1, Math.round(input.max_credits_per_user_venue_day)),
    max_credits_per_user_venue_month: Math.max(1, Math.round(input.max_credits_per_user_venue_month)),
    require_verified_checkin: true,
    updated_at: new Date().toISOString(),
  };

  const exists = current.some(
    (r) => r.id === nextRule.id || r.rule_code === nextRule.rule_code
  );
  const nextList = exists
    ? current.map((r) =>
        r.id === nextRule.id || r.rule_code === nextRule.rule_code ? nextRule : r
      )
    : [nextRule, ...current];

  writeJson(RULES_STORAGE_KEY, nextList);
  return nextList;
}

export function resolveCheckinPointRule(params: {
  restaurantId: string;
  category?: string;
}): PointEarningRule {
  const activeRules = getPointEarningRules().filter((r) => r.active && r.require_verified_checkin);
  const partnerCampaign = activeRules.find(
    (r) =>
      r.scope_type === 'CAMPAIGN' &&
      (!r.restaurant_id || r.restaurant_id === params.restaurantId)
  );
  if (partnerCampaign) return partnerCampaign;

  const partnerRule = activeRules.find(
    (r) => r.scope_type === 'PARTNER' && r.restaurant_id === params.restaurantId
  );
  if (partnerRule) return partnerRule;

  if (params.category) {
    const categoryRule = activeRules.find(
      (r) =>
        r.scope_type === 'CATEGORY' &&
        r.category_filter?.toLowerCase() === params.category?.toLowerCase()
    );
    if (categoryRule) return categoryRule;
  }

  return (
    activeRules.find((r) => r.scope_type === 'DEFAULT') ||
    DEFAULT_RULES[0]
  );
}

export interface PointCreditEvaluation {
  allowed: boolean;
  creditToOwnerLedger: boolean;
  pointsAmount: number;
  rule: PointEarningRule;
  reason: string;
}

/**
 * Avalia elegibilidade e cota antifraude de crédito de pontos por check-in validado.
 * - REGRA OBRIGATÓRIA DE GRUPO (guests > 1): o titular recebe no máximo 1x a regra vigente (nunca guests * RP).
 * - Acompanhantes validam seus próprios slots individualmente (sem somar pontos ao titular).
 * - Respeita limite diário por local, limite diário global e limite mensal por local.
 */
export function evaluateCheckinPointCredit(params: {
  restaurantId: string;
  category?: string;
  participantSlot: number;
  existingTransactions: PointTransaction[];
}): PointCreditEvaluation {
  const rule = resolveCheckinPointRule({
    restaurantId: params.restaurantId,
    category: params.category,
  });

  if (!rule.active || !rule.require_verified_checkin || rule.points_amount <= 0) {
    return {
      allowed: false,
      creditToOwnerLedger: false,
      pointsAmount: 0,
      rule,
      reason: 'Nenhuma pontuação ativa configurada para esta visita.',
    };
  }

  // Acompanhantes de reserva em grupo (slot >= 2) validam presença individualmente e NÃO creditam ao titular
  if (params.participantSlot >= 2) {
    return {
      allowed: true,
      creditToOwnerLedger: false,
      pointsAmount: rule.points_amount,
      rule,
      reason: `Participante #${params.participantSlot} pontua em sua conta individual (+${rule.points_amount} RP); o titular recebe 0 RP pelos acompanhantes.`,
    };
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentMonth = now.toISOString().slice(0, 7);

  const ownerCheckinTxs = params.existingTransactions.filter(
    (tx) =>
      tx.origin === 'checkin_qr' &&
      tx.type === 'CREDIT' &&
      tx.validation_status !== 'REVERSED' &&
      (tx.participant_slot == null || tx.participant_slot === 1)
  );

  const creditsTodayThisVenue = ownerCheckinTxs.filter(
    (tx) => tx.experience_id === params.restaurantId && tx.created_at.slice(0, 10) === today
  ).length;

  if (creditsTodayThisVenue >= rule.max_credits_per_user_venue_day) {
    return {
      allowed: false,
      creditToOwnerLedger: false,
      pointsAmount: 0,
      rule,
      reason: `Limite diário por estabelecimento atingido (${rule.max_credits_per_user_venue_day} crédito/dia em ${rule.rule_code}). Presença registrada sem duplicidade de pontos.`,
    };
  }

  const creditsTodayTotal = ownerCheckinTxs.filter(
    (tx) => tx.created_at.slice(0, 10) === today
  ).length;

  if (creditsTodayTotal >= rule.max_credits_per_user_day) {
    return {
      allowed: false,
      creditToOwnerLedger: false,
      pointsAmount: 0,
      rule,
      reason: `Limite diário de pontuação atingido (${rule.max_credits_per_user_day} check-ins pontuados hoje).`,
    };
  }

  const creditsMonthThisVenue = ownerCheckinTxs.filter(
    (tx) =>
      tx.experience_id === params.restaurantId &&
      tx.created_at.slice(0, 7) === currentMonth
  ).length;

  if (creditsMonthThisVenue >= rule.max_credits_per_user_venue_month) {
    return {
      allowed: false,
      creditToOwnerLedger: false,
      pointsAmount: 0,
      rule,
      reason: `Limite mensal por estabelecimento atingido (${rule.max_credits_per_user_venue_month}/mês).`,
    };
  }

  return {
    allowed: true,
    creditToOwnerLedger: true,
    pointsAmount: rule.points_amount,
    rule,
    reason: `Regra ${rule.rule_code}: crédito individual de ${rule.points_amount} RP para 1 participante.`,
  };
}

export interface CompanionGroupCreditRecord {
  id: string;
  reservation_id: string;
  restaurant_id: string;
  participant_slot: number;
  participant_label: string;
  points_awarded_to_companion: number;
  points_awarded_to_owner: 0;
  rule_code: string;
  created_at: string;
}

export function recordCompanionSlotCredit(params: {
  reservationId: string;
  restaurantId: string;
  participantSlot: number;
  participantLabel: string;
  pointsAmount: number;
  ruleCode: string;
}): CompanionGroupCreditRecord {
  const existing = readJson<CompanionGroupCreditRecord[]>(COMPANION_LEDGER_KEY, []);
  const rec: CompanionGroupCreditRecord = {
    id: generateUUID(),
    reservation_id: params.reservationId,
    restaurant_id: params.restaurantId,
    participant_slot: params.participantSlot,
    participant_label: params.participantLabel,
    points_awarded_to_companion: params.pointsAmount,
    points_awarded_to_owner: 0,
    rule_code: params.ruleCode,
    created_at: new Date().toISOString(),
  };
  writeJson(COMPANION_LEDGER_KEY, [rec, ...existing]);
  return rec;
}

export function getCompanionGroupCredits(reservationId?: string): CompanionGroupCreditRecord[] {
  const list = readJson<CompanionGroupCreditRecord[]>(COMPANION_LEDGER_KEY, []);
  if (!reservationId) return list;
  return list.filter((c) => c.reservation_id === reservationId);
}

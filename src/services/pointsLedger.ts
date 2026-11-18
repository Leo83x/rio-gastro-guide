import type { PointTransaction } from '../types/experience';
import type { WalletSummary } from '../types/rewards';
import { WALLET_NON_MONETARY_NOTICE } from '../types/verification';
import { generateUUID } from '../utils/slug';

export const POINTS_STORAGE_KEY = 'rio_gastro_points_v1';
const REFERRAL_ATTRIBUTIONS_KEY = 'borario_referral_attributions_v1';

const STARTER_DEMO_TRANSACTIONS: PointTransaction[] = [
  {
    id: 'tx-starter-bonus-500',
    amount: 500,
    type: 'CREDIT',
    origin: 'campaign_bonus',
    description: 'Bônus de boas-vindas Bora Club (500 RP = R$ 5,00 de referência)',
    validation_status: 'RELEASED',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'tx-starter-checkin-250',
    amount: 250,
    type: 'CREDIT',
    origin: 'checkin_qr',
    description: 'Check-in presencial individual validado em Bráz Pizzaria (+250 RP)',
    experience_id: '11111111-1111-4111-8111-000000000009',
    experience_name: 'Bráz Pizzaria',
    validation_status: 'RELEASED',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

export function getPointTransactions(): PointTransaction[] {
  try {
    const raw = localStorage.getItem(POINTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(POINTS_STORAGE_KEY, JSON.stringify(STARTER_DEMO_TRANSACTIONS));
      return STARTER_DEMO_TRANSACTIONS;
    }
    const parsed = JSON.parse(raw) as PointTransaction[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(POINTS_STORAGE_KEY, JSON.stringify(STARTER_DEMO_TRANSACTIONS));
      return STARTER_DEMO_TRANSACTIONS;
    }
    return parsed;
  } catch {
    return STARTER_DEMO_TRANSACTIONS;
  }
}

export function getPointsBalance(): number {
  return getPointTransactions().reduce((acc, tx) => {
    if (tx.validation_status === 'REVERSED') return acc;
    if (tx.type === 'CREDIT' && tx.validation_status !== 'PENDING_VALIDATION') {
      return acc + tx.amount;
    }
    if (tx.type === 'DEBIT' || tx.type === 'REDEEM' || tx.type === 'REVERSAL') {
      return acc - tx.amount;
    }
    return acc;
  }, 0);
}

/**
 * Resumo completo e auditável da Carteira Rio Points.
 * - Saldo disponível: pontos liberados menos débitos/resgates/estornos.
 * - Total acumulado: pontos acumulados líquidos de estornos de fraude/cancelamento (excluindo reembolsos de vouchers).
 * - Total utilizado: pontos efetivamente gastos em resgates (líquidos de cancelamentos estornados).
 * - Pontos pendentes: lançamentos PENDING_VALIDATION + indicações aguardando check-in presencial.
 * O histórico do cliente é estritamente imutável pela UI.
 */
export function getWalletSummary(): WalletSummary {
  const txs = getPointTransactions();
  let grossEarned = 0;
  let reversals = 0;
  let grossRedeemed = 0;
  let refundedPoints = 0;
  let pendingTxPoints = 0;

  for (const tx of txs) {
    if (tx.validation_status === 'REVERSED') continue;
    if (tx.type === 'CREDIT') {
      if (tx.validation_status === 'PENDING_VALIDATION') {
        pendingTxPoints += tx.amount;
      } else if (tx.origin === 'reward_refund') {
        refundedPoints += tx.amount;
      } else {
        grossEarned += tx.amount;
      }
    } else if (tx.type === 'REDEEM' || tx.type === 'DEBIT') {
      grossRedeemed += tx.amount;
    } else if (tx.type === 'REVERSAL') {
      reversals += tx.amount;
    }
  }

  let pendingReferralPoints = 0;
  try {
    const rawRefs = localStorage.getItem(REFERRAL_ATTRIBUTIONS_KEY);
    if (rawRefs) {
      const parsed = JSON.parse(rawRefs) as Array<{ status?: string; reward_points?: number }>;
      if (Array.isArray(parsed)) {
        pendingReferralPoints = parsed
          .filter((a) => a.status === 'PENDING_CONVERSION')
          .reduce((sum, a) => sum + (a.reward_points || 0), 0);
      }
    }
  } catch {
    pendingReferralPoints = 0;
  }

  const availableBalance = getPointsBalance();
  const netAccumulated = Math.max(0, grossEarned - reversals);
  const netSpent = Math.max(0, grossRedeemed - refundedPoints);

  return {
    available_balance: availableBalance,
    total_accumulated: netAccumulated,
    total_spent: netSpent,
    pending_points: pendingTxPoints + pendingReferralPoints,
    total_refunded: refundedPoints,
    total_reversals: reversals,
    non_monetary_notice: WALLET_NON_MONETARY_NOTICE,
  };
}

export function appendLedgerTransaction(
  txInput: Omit<PointTransaction, 'id' | 'created_at'>
): PointTransaction {
  const txs = getPointTransactions();
  const tx: PointTransaction = {
    ...txInput,
    id: generateUUID(),
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(POINTS_STORAGE_KEY, JSON.stringify([tx, ...txs]));
  return tx;
}

const SERVER_LEDGER_SYNC_KEY = 'borario_points_server_synced_v1';

export function isServerAuthoritativeLedger(): boolean {
  try {
    return localStorage.getItem(SERVER_LEDGER_SYNC_KEY) === 'true';
  } catch {
    return false;
  }
}

export function replaceLedgerFromServer(serverTxs: PointTransaction[]): void {
  localStorage.setItem(POINTS_STORAGE_KEY, JSON.stringify(serverTxs));
  localStorage.setItem(SERVER_LEDGER_SYNC_KEY, 'true');
}


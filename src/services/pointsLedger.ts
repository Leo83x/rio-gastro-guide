import type { PointTransaction } from '../types/experience';
import { generateUUID } from '../utils/slug';

export const POINTS_STORAGE_KEY = 'rio_gastro_points_v1';

export function getPointTransactions(): PointTransaction[] {
  try {
    const raw = localStorage.getItem(POINTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PointTransaction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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

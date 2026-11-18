import { isReservationExpired } from './superappStore';
import type { ReservationRequest } from '../types/experience';
import type { PartnerVipInviteConfig, ReferralAttribution, VipInviteRecord } from '../types/growth';
import type { PartnerReward, WalletSummary } from '../types/rewards';

export type SmartBarStateType =
  | 'ACTIVE_RESERVATION'
  | 'VIP_INVITES_AVAILABLE'
  | 'REWARD_AVAILABLE'
  | 'REWARD_PROGRESS'
  | 'HIDDEN';

export interface SmartBarComputedState {
  primaryState: SmartBarStateType;
  activeReservations: ReservationRequest[];
  todayReservations: ReservationRequest[];
  validVipInvites: VipInviteRecord[];
  vipConfigsByVenue: Record<string, PartnerVipInviteConfig>;
  wallet: WalletSummary;
  availableRewards: PartnerReward[];
  redeemableRewards: PartnerReward[];
  nextReward: PartnerReward | null;
  pointsMissingForNext: number;
  progressPct: number;
  pendingReferralsCount: number;
}

export function getEffectiveReservationStage(r: ReservationRequest, nowMs?: number): string {
  if (r.stage === 'CANCELLED' || r.status === 'CANCELLED') return 'CANCELLED';
  if (r.stage === 'NO_SHOW') return 'NO_SHOW';
  if (r.stage === 'ENDED_WITHOUT_GOAL') return 'ENDED_WITHOUT_GOAL';
  if (
    r.stage === 'CHECKED_IN' ||
    r.stage === 'VERIFIED_VISIT' ||
    r.stage === 'VERIFIED_CONSUMPTION'
  ) {
    return r.stage;
  }
  if (r.stage === 'EXPIRED' || isReservationExpired(r)) return 'EXPIRED';
  if (nowMs && r.date) {
    const todayIso = new Date(nowMs).toISOString().slice(0, 10);
    if (r.date < todayIso) return 'EXPIRED';
  }
  return r.stage || (r.status === 'CONFIRMED' ? 'CONFIRMED' : 'REQUESTED');
}

export function computeSmartBarState(params: {
  reservations: ReservationRequest[];
  vipInvites: VipInviteRecord[];
  vipConfigsByVenue: Record<string, PartnerVipInviteConfig>;
  wallet: WalletSummary;
  rewards: PartnerReward[];
  attributions: ReferralAttribution[];
  nowMs?: number;
  todayIso?: string;
}): SmartBarComputedState {
  const nowMs = params.nowMs ?? Date.now();
  const todayIso = params.todayIso ?? new Date(nowMs).toISOString().slice(0, 10);

  const activeReservations = params.reservations.filter((r) => {
    const stage = getEffectiveReservationStage(r, nowMs);
    if (
      stage === 'CANCELLED' ||
      stage === 'NO_SHOW' ||
      stage === 'EXPIRED' ||
      stage === 'ENDED_WITHOUT_GOAL' ||
      r.status === 'CANCELLED'
    ) {
      return false;
    }
    if (isReservationExpired(r)) return false;
    return (
      stage === 'CONFIRMED' ||
      stage === 'REQUESTED' ||
      stage === 'CHECKED_IN' ||
      stage === 'VERIFIED_VISIT' ||
      stage === 'VERIFIED_CONSUMPTION'
    );
  });

  const actionableReservations = activeReservations.filter((r) => {
    const stage = getEffectiveReservationStage(r, nowMs);
    return stage === 'CONFIRMED' || stage === 'REQUESTED' || stage === 'CHECKED_IN';
  });

  const todayReservations = actionableReservations.filter((r) => r.date === todayIso);

  const validVipInvites = params.vipInvites.filter((inv) => {
    const cfg = params.vipConfigsByVenue[inv.restaurant_id];
    if (!cfg || !cfg.enabled || !cfg.active) return false;
    if (
      cfg.total_quota !== null &&
      cfg.total_quota !== undefined &&
      cfg.used_count >= cfg.total_quota
    ) {
      return false;
    }
    if (inv.status !== 'ISSUED') return false;
    if (new Date(inv.expires_at).getTime() <= nowMs) return false;
    return true;
  });

  const availableRewards = params.rewards
    .filter((rw) => rw.status === 'AVAILABLE' && rw.quantity_available > 0 && rw.points_cost > 0)
    .sort((a, b) => a.points_cost - b.points_cost);

  const releasedBalance = Math.max(0, params.wallet.available_balance);
  const redeemableRewards = availableRewards.filter((rw) => releasedBalance >= rw.points_cost);
  const nextReward = availableRewards.find((rw) => rw.points_cost > releasedBalance) || null;
  const pointsMissingForNext = nextReward ? Math.max(0, nextReward.points_cost - releasedBalance) : 0;
  const progressPct =
    nextReward && nextReward.points_cost > 0
      ? Math.min(100, Math.round((releasedBalance / nextReward.points_cost) * 100))
      : 0;

  const pendingReferralsCount = params.attributions.filter(
    (a) =>
      a.current_stage !== 'REWARD_RELEASED' &&
      a.current_stage !== 'REWARD_CANCELLED' &&
      a.status !== 'REVERSED'
  ).length;

  let primaryState: SmartBarStateType = 'HIDDEN';
  if (todayReservations.length > 0 || actionableReservations.length > 0) {
    primaryState = 'ACTIVE_RESERVATION';
  } else if (validVipInvites.length > 0) {
    primaryState = 'VIP_INVITES_AVAILABLE';
  } else if (redeemableRewards.length > 0) {
    primaryState = 'REWARD_AVAILABLE';
  } else if (releasedBalance > 0 && nextReward) {
    primaryState = 'REWARD_PROGRESS';
  }

  return {
    primaryState,
    activeReservations: actionableReservations,
    todayReservations,
    validVipInvites,
    vipConfigsByVenue: params.vipConfigsByVenue,
    wallet: params.wallet,
    availableRewards,
    redeemableRewards,
    nextReward,
    pointsMissingForNext,
    progressPct,
    pendingReferralsCount,
  };
}

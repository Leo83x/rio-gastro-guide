import type { ClubOffer, ClubRedemption } from '../types/experience';
import { generateUUID } from '../utils/slug';

const REDEMPTIONS_STORAGE_KEY = 'borario_club_redemptions_v1';

export function getClubRedemptions(): ClubRedemption[] {
  try {
    const raw = localStorage.getItem(REDEMPTIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ClubRedemption[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function redeemClubOffer(offer: ClubOffer): {
  redemption: ClubRedemption;
  all: ClubRedemption[];
} {
  const code = `BCLUB-${offer.id.slice(-3).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

  const redemption: ClubRedemption = {
    id: generateUUID(),
    offer_id: offer.id,
    experience_id: offer.experience_id,
    experience_name: offer.experience_name,
    offer_title: offer.title,
    discount_label: offer.discount_label,
    voucher_code: code,
    status: 'ACTIVE',
    is_demonstrative: offer.reliability === 'DEMONSTRATIVE',
    redeemed_at: new Date().toISOString(),
  };

  const next = [redemption, ...getClubRedemptions()];
  localStorage.setItem(REDEMPTIONS_STORAGE_KEY, JSON.stringify(next));
  return { redemption, all: next };
}

export function markClubRedemptionUsed(redemptionId: string): ClubRedemption[] {
  const next = getClubRedemptions().map((r) =>
    r.id === redemptionId ? { ...r, status: 'USED' as const } : r
  );
  localStorage.setItem(REDEMPTIONS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

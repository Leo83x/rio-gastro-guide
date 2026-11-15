import type { ClubOffer, ClubRedemption } from '../types/experience';
import { generateUUID } from '../utils/slug';
import { getVisitProofs } from './visitProofStore';

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
    estimated_savings_brl: offer.estimated_savings_brl,
    voucher_code: code,
    status: 'ACTIVE',
    validated_with_checkin: false,
    is_demonstrative: offer.reliability === 'DEMONSTRATIVE',
    redeemed_at: new Date().toISOString(),
  };

  const next = [redemption, ...getClubRedemptions()];
  localStorage.setItem(REDEMPTIONS_STORAGE_KEY, JSON.stringify(next));
  return { redemption, all: next };
}

export function markClubRedemptionUsed(redemptionId: string): {
  ok: boolean;
  message: string;
  redemptions: ClubRedemption[];
} {
  const list = getClubRedemptions();
  const target = list.find((r) => r.id === redemptionId);
  if (!target) {
    return {
      ok: false,
      message: 'Voucher não encontrado.',
      redemptions: list,
    };
  }

  // Verifica se há check-in validado real neste estabelecimento para contabilizar Economia Comprovada
  const matchingProof = getVisitProofs({ restaurantId: target.experience_id })[0];

  const next = list.map((r) =>
    r.id === redemptionId
      ? {
          ...r,
          status: 'USED' as const,
          validated_with_checkin: Boolean(matchingProof),
          visit_proof_id: matchingProof?.id,
        }
      : r
  );
  localStorage.setItem(REDEMPTIONS_STORAGE_KEY, JSON.stringify(next));

  return {
    ok: true,
    message: matchingProof
      ? 'Voucher validado com sua Prova de Visita no estabelecimento e incluído na Economia Comprovada!'
      : 'Voucher marcado como utilizado. Atenção: sem check-in QR validado neste local, ele não entra na Economia Comprovada (regra antifraude).',
    redemptions: next,
  };
}

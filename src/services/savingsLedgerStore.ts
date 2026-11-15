import type { ReservationRequest } from '../types/experience';
import type { SavingsEntry, SavingsSummary } from '../types/growth';
import { getClubRedemptions } from './clubRedemptionStore';
import { getPartnerOfferings } from './opportunityStore';
import { DEMONSTRATIVE_CLUB_OFFERS, getReservations } from './superappStore';
import { getVisitProofs } from './visitProofStore';

function getBookingSavingsBrl(
  res: ReservationRequest,
  offeringsById: Map<string, ReturnType<typeof getPartnerOfferings>[number]>
): { amountBrl: number; isDemonstrative: boolean } {
  const snap = res.snapshot_terms;
  if (snap?.estimated_savings_brl != null && snap.estimated_savings_brl > 0) {
    const off = res.offering_id ? offeringsById.get(res.offering_id) : undefined;
    return {
      amountBrl: Number(snap.estimated_savings_brl.toFixed(2)),
      isDemonstrative: Boolean(off?.is_demonstrative),
    };
  }

  if (snap?.base_price_brl != null && snap?.partner_condition_price_brl != null) {
    const diff = Math.max(0, snap.base_price_brl - snap.partner_condition_price_brl);
    const off = res.offering_id ? offeringsById.get(res.offering_id) : undefined;
    return {
      amountBrl: Number(diff.toFixed(2)),
      isDemonstrative: Boolean(off?.is_demonstrative),
    };
  }

  if (res.offering_id) {
    const off = offeringsById.get(res.offering_id);
    if (off) {
      const diff =
        off.estimated_savings_brl > 0
          ? off.estimated_savings_brl
          : off.base_price_brl != null && off.partner_condition_price_brl != null
            ? Math.max(0, off.base_price_brl - off.partner_condition_price_brl)
            : 0;
      return {
        amountBrl: Number(diff.toFixed(2)),
        isDemonstrative: off.is_demonstrative,
      };
    }
  }

  return { amountBrl: 0, isDemonstrative: false };
}

/**
 * Calcula estritamente a separação entre Economia Comprovada e Economia Potencial.
 * - Economia Comprovada: APENAS reservas ou benefícios com check-in/visita validada real.
 * - Economia Potencial: reservas ativas aguardando visita e vouchers ativos ainda não validados.
 * Nunca soma Economia Potencial dentro de Economia Comprovada.
 */
export function computeSavingsSummary(): SavingsSummary {
  const reservations = getReservations();
  const offerings = getPartnerOfferings({ includeDrafts: true });
  const offeringsById = new Map(offerings.map((o) => [o.id, o]));
  const proofs = getVisitProofs();
  const proofByReservationId = new Map(
    proofs
      .filter((p) => Boolean(p.reservation_id))
      .map((p) => [p.reservation_id as string, p])
  );
  const venueIdsWithProofs = new Set(proofs.map((p) => p.restaurant_id));

  const entries: SavingsEntry[] = [];
  let provenBrl = 0;
  let potentialBrl = 0;
  let provenCount = 0;
  let potentialCount = 0;

  for (const res of reservations) {
    const effectiveStage =
      res.stage ||
      (res.status === 'CONFIRMED'
        ? 'CONFIRMED'
        : res.status === 'CANCELLED'
          ? 'CANCELLED'
          : 'REQUESTED');

    if (
      effectiveStage === 'CANCELLED' ||
      effectiveStage === 'NO_SHOW' ||
      effectiveStage === 'ENDED_WITHOUT_GOAL'
    ) {
      continue;
    }

    const { amountBrl, isDemonstrative } = getBookingSavingsBrl(res, offeringsById);
    if (amountBrl <= 0) continue;

    const hasRealProof =
      effectiveStage === 'CHECKED_IN' ||
      effectiveStage === 'VERIFIED_VISIT' ||
      effectiveStage === 'VERIFIED_CONSUMPTION' ||
      proofByReservationId.has(res.id);

    if (hasRealProof) {
      provenBrl += amountBrl;
      provenCount += 1;
      entries.push({
        id: `sav-res-${res.id}`,
        kind: 'PROVEN',
        source_type: 'RESERVATION_CHECKIN',
        reference_id: res.id,
        experience_id: res.experience_id,
        experience_name: res.experience_name,
        title: res.offering_title || `Condição em ${res.experience_name}`,
        amount_brl: amountBrl,
        is_demonstrative: isDemonstrative,
        created_at: proofByReservationId.get(res.id)?.presence_verified_at || res.created_at,
      });
    } else {
      potentialBrl += amountBrl;
      potentialCount += 1;
      entries.push({
        id: `pot-res-${res.id}`,
        kind: 'POTENTIAL',
        source_type: 'PENDING_RESERVATION',
        reference_id: res.id,
        experience_id: res.experience_id,
        experience_name: res.experience_name,
        title: res.offering_title || `Condição em ${res.experience_name}`,
        amount_brl: amountBrl,
        is_demonstrative: isDemonstrative,
        created_at: res.created_at,
      });
    }
  }

  const redemptions = getClubRedemptions();
  for (const rec of redemptions) {
    const fallbackOffer = DEMONSTRATIVE_CLUB_OFFERS.find((o) => o.id === rec.offer_id);
    const amountBrl = Number(
      (rec.estimated_savings_brl ?? fallbackOffer?.estimated_savings_brl ?? 0).toFixed(2)
    );
    if (amountBrl <= 0) continue;

    if (
      rec.status === 'USED' &&
      (rec.validated_with_checkin || venueIdsWithProofs.has(rec.experience_id))
    ) {
      provenBrl += amountBrl;
      provenCount += 1;
      entries.push({
        id: `sav-vch-${rec.id}`,
        kind: 'PROVEN',
        source_type: 'VERIFIED_VOUCHER',
        reference_id: rec.id,
        experience_id: rec.experience_id,
        experience_name: rec.experience_name,
        title: `Voucher ${rec.voucher_code} · ${rec.offer_title}`,
        amount_brl: amountBrl,
        is_demonstrative: rec.is_demonstrative,
        created_at: rec.redeemed_at,
      });
    } else if (rec.status === 'ACTIVE') {
      potentialBrl += amountBrl;
      potentialCount += 1;
      entries.push({
        id: `pot-vch-${rec.id}`,
        kind: 'POTENTIAL',
        source_type: 'ACTIVE_VOUCHER',
        reference_id: rec.id,
        experience_id: rec.experience_id,
        experience_name: rec.experience_name,
        title: `Voucher ativo ${rec.voucher_code} · ${rec.offer_title}`,
        amount_brl: amountBrl,
        is_demonstrative: rec.is_demonstrative,
        created_at: rec.redeemed_at,
      });
    }
  }

  const catalogReferenceBrl = offerings
    .filter(
      (o) =>
        o.partner_managed_active &&
        !['DRAFT', 'ENDED_WITHOUT_GOAL', 'CANCELLED', 'COMPLETED'].includes(o.status)
    )
    .reduce((sum, o) => {
      const val =
        o.estimated_savings_brl > 0
          ? o.estimated_savings_brl
          : o.base_price_brl != null && o.partner_condition_price_brl != null
            ? Math.max(0, o.base_price_brl - o.partner_condition_price_brl)
            : 0;
      return sum + val;
    }, 0);

  return {
    proven_brl: Number(provenBrl.toFixed(2)),
    potential_brl: Number(potentialBrl.toFixed(2)),
    proven_count: provenCount,
    potential_count: potentialCount,
    catalog_reference_brl: Number(catalogReferenceBrl.toFixed(2)),
    entries,
  };
}

export function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

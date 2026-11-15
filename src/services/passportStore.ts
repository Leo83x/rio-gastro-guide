import type { PassportSummary } from '../types/experience';
import type { Restaurant } from '../types/restaurant';
import { getIntentVaultItems } from './intentVaultStore';
import { getPointTransactions } from './superappStore';
import { getVisitProofs } from './visitProofStore';

/**
 * Calcula o Passaporte Carioca exclusivamente a partir de ações reais:
 * provas de visita (QR dinâmico/contingência conciliada), avaliações verificadas
 * e itens marcados como VISITED no Cofre.
 * Nunca fabrica selos ou progresso fictício.
 */
export function computePassportSummary(catalog: Restaurant[]): PassportSummary {
  const txs = getPointTransactions();
  const visitProofs = getVisitProofs();
  const checkinTxs = txs.filter(
    (tx) => tx.origin === 'checkin_qr' && tx.validation_status !== 'REVERSED'
  );
  const reviews = txs.filter((tx) => tx.origin === 'verified_review');
  const vaultVisited = getIntentVaultItems().filter((item) => item.status === 'VISITED');

  // Deduplica provas de visita oficiais com eventuais registros legados de checkin_qr
  const coveredTokens = new Set<string>(
    visitProofs.map((p) => p.qr_code_used).filter((tok): tok is string => Boolean(tok))
  );
  const coveredVenueDays = new Set<string>(
    visitProofs.map((p) => `${p.restaurant_id}::${p.presence_verified_at.slice(0, 10)}`)
  );
  const legacyCheckinsOnly = checkinTxs.filter((tx) => {
    if (tx.qr_nonce && coveredTokens.has(tx.qr_nonce)) return false;
    const dayKey = `${tx.experience_id || ''}::${tx.created_at.slice(0, 10)}`;
    if (tx.experience_id && coveredVenueDays.has(dayKey)) return false;
    return true;
  });

  const verifiedCheckinsCount = visitProofs.length + legacyCheckinsOnly.length;
  const verifiedConsumptionsCount = visitProofs.filter(
    (p) => p.presence_level === 'VERIFIED_CONSUMPTION'
  ).length;

  const neighborhoods = new Set<string>();

  for (const proof of visitProofs) {
    const venue = catalog.find((r) => r.id === proof.restaurant_id);
    if (venue?.neighborhood) neighborhoods.add(venue.neighborhood);
  }
  for (const tx of legacyCheckinsOnly) {
    if (tx.experience_id) {
      const venue = catalog.find((r) => r.id === tx.experience_id);
      if (venue?.neighborhood) neighborhoods.add(venue.neighborhood);
    }
  }
  for (const item of vaultVisited) {
    if (item.neighborhood_tag?.trim()) {
      neighborhoods.add(item.neighborhood_tag.trim());
    }
  }

  const totalVisits = verifiedCheckinsCount + vaultVisited.length;
  const uniqueNeighborhoods = Array.from(neighborhoods);

  const level_label =
    verifiedCheckinsCount >= 10
      ? 'Embaixador Carioca'
      : verifiedCheckinsCount >= 4
        ? 'Explorador do Rio'
        : totalVisits >= 1
          ? 'Roteirista Iniciante'
          : 'Passaporte Aberto';

  const milestones = [
    {
      id: 'ms-first-checkin',
      title: 'Primeiro Check-in QR',
      description: 'Valide sua primeira visita presencial via QR Code dinâmico no local.',
      unlocked: verifiedCheckinsCount >= 1,
      current: Math.min(1, verifiedCheckinsCount),
      target: 1,
    },
    {
      id: 'ms-3-neighborhoods',
      title: 'Circuito de 3 Bairros',
      description: 'Visite experiências validadas em pelo menos 3 bairros diferentes do Rio.',
      unlocked: uniqueNeighborhoods.length >= 3,
      current: Math.min(3, uniqueNeighborhoods.length),
      target: 3,
    },
    {
      id: 'ms-verified-critic',
      title: 'Curadoria Verificada',
      description: 'Publique uma avaliação verificada após check-in validado.',
      unlocked: reviews.length >= 1,
      current: Math.min(1, reviews.length),
      target: 1,
    },
    {
      id: 'ms-intent-action',
      title: 'Intenção Realizada',
      description: 'Transforme 2 desejos guardados no Cofre em visitas realizadas.',
      unlocked: vaultVisited.length >= 2,
      current: Math.min(2, vaultVisited.length),
      target: 2,
    },
  ];

  return {
    verified_checkins_count: verifiedCheckinsCount,
    verified_consumptions_count: verifiedConsumptionsCount,
    verified_reviews_count: reviews.length,
    vault_visited_count: vaultVisited.length,
    unique_neighborhoods: uniqueNeighborhoods,
    level_label,
    milestones,
  };
}

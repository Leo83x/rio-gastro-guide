import type { PassportSummary } from '../types/experience';
import type { Restaurant } from '../types/restaurant';
import { getIntentVaultItems } from './intentVaultStore';
import { getPointTransactions } from './superappStore';

/**
 * Calcula o Passaporte Carioca exclusivamente a partir de ações reais:
 * check-ins QR validados, avaliações verificadas e itens marcados como VISITED no Cofre.
 * Nunca fabrica selos ou progresso fictício.
 */
export function computePassportSummary(catalog: Restaurant[]): PassportSummary {
  const txs = getPointTransactions();
  const checkins = txs.filter((tx) => tx.origin === 'checkin_qr');
  const reviews = txs.filter((tx) => tx.origin === 'verified_review');
  const vaultVisited = getIntentVaultItems().filter((item) => item.status === 'VISITED');

  const neighborhoods = new Set<string>();

  for (const tx of checkins) {
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

  const totalVisits = checkins.length + vaultVisited.length;
  const uniqueNeighborhoods = Array.from(neighborhoods);

  const level_label =
    checkins.length >= 10
      ? 'Embaixador Carioca'
      : checkins.length >= 4
        ? 'Explorador do Rio'
        : totalVisits >= 1
          ? 'Roteirista Iniciante'
          : 'Passaporte Aberto';

  const milestones = [
    {
      id: 'ms-first-checkin',
      title: 'Primeiro Check-in QR',
      description: 'Valide sua primeira visita presencial via QR Code na mesa.',
      unlocked: checkins.length >= 1,
      current: Math.min(1, checkins.length),
      target: 1,
    },
    {
      id: 'ms-3-neighborhoods',
      title: 'Circuito de 3 Bairros',
      description: 'Visite experiências em pelo menos 3 bairros diferentes do Rio.',
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
    verified_checkins_count: checkins.length,
    verified_reviews_count: reviews.length,
    vault_visited_count: vaultVisited.length,
    unique_neighborhoods: uniqueNeighborhoods,
    level_label,
    milestones,
  };
}

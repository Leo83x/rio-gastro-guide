import type { UserPreferences } from '../types/experience';
import type { Restaurant } from '../types/restaurant';

export function calculateMatchScore(item: Restaurant, prefs: UserPreferences): number | null {
  if (!prefs.lgpd_consents.personalization) return null;

  const configuredCriteria =
    prefs.favorite_macro_categories.length +
    prefs.favorite_neighborhoods.length +
    prefs.preferred_moments.length;
  if (configuredCriteria < 2) return null;

  let score = 46;
  const macro = item.macro_category || 'Gastronomia';
  if (prefs.favorite_macro_categories.includes(macro)) score += 22;
  if (prefs.favorite_neighborhoods.includes(item.neighborhood)) score += 20;
  if (item.price_range === prefs.budget_tier) score += 7;
  if (item.moment_tags?.some((tag) => prefs.preferred_moments.includes(tag))) {
    score += 4;
  }
  return Math.min(99, score);
}

/**
 * Motivo curto e transparente exibido no bloco "Selecionado para você" da Home.
 * Nunca exibe razão baseada em perfil se o consentimento de personalização estiver desligado.
 */
export function getMatchReasonLabel(params: {
  item: Restaurant;
  prefs: UserPreferences;
  inVault?: boolean;
  confiaCount?: number;
}): string {
  const { item, prefs, inVault, confiaCount = 0 } = params;

  if (confiaCount > 0) {
    return confiaCount === 1
      ? 'Recomendado na sua Rede Confia'
      : `${confiaCount} pessoas da Rede Confia recomendam`;
  }
  if (inVault) {
    return 'Salvo no seu Cofre de Intenções';
  }

  if (prefs.lgpd_consents.personalization) {
    const macro = item.macro_category || 'Gastronomia';
    const matchesNb = prefs.favorite_neighborhoods.includes(item.neighborhood);
    const matchesCat = prefs.favorite_macro_categories.includes(macro);

    if (matchesNb && matchesCat) {
      return `Seu estilo em ${item.neighborhood} · ${macro}`;
    }
    if (matchesNb) {
      return `No seu radar em ${item.neighborhood}`;
    }
    if (matchesCat) {
      return `Alinhado ao seu interesse em ${macro}`;
    }
    if (item.price_range === prefs.budget_tier) {
      return `Na sua faixa de orçamento (${prefs.budget_tier})`;
    }
  }

  return `${item.neighborhood} · ${item.category}`;
}

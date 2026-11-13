import type { ConfiaRecommendation } from '../types/confia';
import type { ItinerarySourceOrigin } from '../types/experience';
import type { IntentVaultItem } from '../types/intention';
import type { Restaurant } from '../types/restaurant';
import { getVisibleConfiaRecommendations } from './confiaStore';
import { fetchRioWeatherLive, type RioWeatherSnapshot } from './integrations/registry';
import { getIntentVaultItems } from './intentVaultStore';
import { DEMONSTRATIVE_CLUB_OFFERS } from './superappStore';

export interface BoraIaMatch {
  venue: Restaurant;
  sourceOrigin: ItinerarySourceOrigin;
  reasonTag: string;
}

export interface BoraIaResponse {
  answer: string;
  matches: BoraIaMatch[];
  weather?: RioWeatherSnapshot;
  usedSources: ItinerarySourceOrigin[];
}

export async function queryBoraIa(
  rawQuery: string,
  catalog: Restaurant[],
  options: {
    includeVault?: boolean;
    includeConfia?: boolean;
    includeClub?: boolean;
  } = { includeVault: true, includeConfia: true, includeClub: true }
): Promise<BoraIaResponse> {
  const q = rawQuery.trim().toLowerCase();
  const weather = await fetchRioWeatherLive().catch(() => undefined);

  const vaultItems: IntentVaultItem[] = options.includeVault
    ? getIntentVaultItems().filter((i) => i.status === 'SAVED' || i.status === 'PLANNED')
    : [];
  const confiaPosts: ConfiaRecommendation[] = options.includeConfia
    ? getVisibleConfiaRecommendations()
    : [];
  const clubVenueIds = new Set(
    options.includeClub ? DEMONSTRATIVE_CLUB_OFFERS.map((o) => o.experience_id) : []
  );

  const usedSources = new Set<ItinerarySourceOrigin>(['catalog']);
  const scored = catalog.map((item) => {
    let score = 0;
    let sourceOrigin: ItinerarySourceOrigin = 'catalog';
    let reasonTag = 'Catálogo BoraRio';

    const hay = `${item.name} ${item.category} ${item.macro_category || ''} ${item.neighborhood} ${item.description}`.toLowerCase();

    const neighborhoods = [
      'botafogo',
      'ipanema',
      'leblon',
      'copacabana',
      'centro',
      'santa teresa',
      'urca',
      'lapa',
      'barra',
      'jardim botânico',
      'flamengo',
    ];
    for (const nb of neighborhoods) {
      if (q.includes(nb) && item.neighborhood.toLowerCase().includes(nb)) {
        score += 6;
      }
    }

    if (
      (q.includes('crianç') || q.includes('famíl') || q.includes('filh')) &&
      (item.attributes?.is_kid_friendly || item.macro_category === 'Atrações Infantis')
    ) {
      score += 5;
    }
    if (
      (q.includes('música') || q.includes('show') || q.includes('samba') || q.includes('noite')) &&
      (item.attributes?.live_music ||
        item.macro_category === 'Eventos & Shows' ||
        item.macro_category === 'Vida Noturna')
    ) {
      score += 5;
    }
    if (
      (q.includes('casal') || q.includes('jantar') || q.includes('român')) &&
      (item.moment_tags?.includes('couple') || item.price_range === '$$$' || item.price_range === '$$$$')
    ) {
      score += 4;
    }
    if (
      (q.includes('chuva') || q.includes('coberto') || weather?.isRaining) &&
      item.attributes?.is_covered !== false
    ) {
      score += 2;
    }
    if (
      (q.includes('250') || q.includes('barat') || q.includes('econôm') || q.includes('gratuit')) &&
      ((item.attributes?.avg_ticket_brl ?? 150) <= 250 || item.attributes?.is_free)
    ) {
      score += 3;
    }

    const words = q.split(/\s+/).filter((w) => w.length > 3);
    for (const w of words) {
      if (hay.includes(w)) score += 2;
    }

    // Prioriza explicitamente se estiver no Cofre de Intenções do usuário
    const inVault = vaultItems.find(
      (v) =>
        v.linked_venue_id === item.id ||
        (v.neighborhood_tag &&
          v.neighborhood_tag.toLowerCase() === item.neighborhood.toLowerCase() &&
          q.includes(item.neighborhood.toLowerCase()))
    );
    if (inVault) {
      score += 4;
      sourceOrigin = 'cofre';
      reasonTag = `Salvo no seu Cofre (${inVault.title})`;
      usedSources.add('cofre');
    }

    // Prioriza se recomendado por alguém aceito na Rede Confia
    const inConfia = confiaPosts.find((p) => p.venue_id === item.id);
    if (inConfia) {
      score += 5;
      sourceOrigin = 'confia';
      reasonTag =
        inConfia.endorsement_origin === 'VERIFIED_CHECKIN'
          ? `Rede Confia · Visita Verificada (${inConfia.author_name})`
          : `Rede Confia · Indicação de ${inConfia.author_name}`;
      usedSources.add('confia');
    }

    if (sourceOrigin === 'catalog' && clubVenueIds.has(item.id)) {
      score += 2;
      sourceOrigin = 'club';
      reasonTag = 'Benefício Bora Club (Demo)';
      usedSources.add('club');
    }

    return { venue: item, score, sourceOrigin, reasonTag };
  });

  const topMatches = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ venue, sourceOrigin, reasonTag }) => ({ venue, sourceOrigin, reasonTag }));

  const rainHint =
    weather?.source === 'open-meteo-live' && weather.isRaining
      ? ' Considerei o clima de chuva atual no Rio priorizando locais cobertos.'
      : '';

  const answer =
    topMatches.length > 0
      ? `Encontrei ${topMatches.length} sugestões alinhadas à sua intenção direto no catálogo real do BoraRio${
          usedSources.has('cofre') ? ' e no seu Cofre de Intenções' : ''
        }${usedSources.has('confia') ? ' com indicações da sua Rede Confia' : ''}.${rainHint}`
      : 'Não encontrei correspondência exata no catálogo atual. Tente informar um bairro (ex: Botafogo, Ipanema, Centro), orçamento ou momento!';

  return {
    answer,
    matches: topMatches,
    weather,
    usedSources: Array.from(usedSources),
  };
}

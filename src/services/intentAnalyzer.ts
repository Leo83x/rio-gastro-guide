import type { IntentAnalysisResult } from '../types/intention';
import type { Restaurant } from '../types/restaurant';
import { slugify } from '../utils/slug';
import { sanitizeHttpUrl } from './intentVaultStore';

const RIO_NEIGHBORHOODS = [
  'Leblon',
  'Ipanema',
  'Botafogo',
  'Copacabana',
  'Santa Teresa',
  'Jardim Botânico',
  'Urca',
  'Barra da Tijuca',
  'Centro',
  'Lapa',
  'Flamengo',
  'Tijuca',
];

function getAiProxyEndpoint(): string | null {
  const custom = import.meta.env.VITE_BORARIO_AI_PROXY_URL as string | undefined;
  if (custom?.trim()) return custom.trim();
  const supaUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (supaUrl?.trim()) return `${supaUrl.replace(/\/+$/, '')}/functions/v1/analyze-intent`;
  return null;
}

/**
 * Analisa link colado pelo usuário.
 * Nunca fabrica leitura por IA quando o proxy backend não está conectado:
 * verifica domínio e correspondência literal segura com bairros/locais do catálogo,
 * sinalizando NEEDS_CONFIRMATION ou UNIDENTIFIED com transparência.
 */
export async function analyzeIntentUrl(
  rawUrl: string,
  catalog: Restaurant[]
): Promise<IntentAnalysisResult> {
  const safeUrl = sanitizeHttpUrl(rawUrl);
  if (!safeUrl) {
    return {
      processing_status: 'ERROR',
      processing_message:
        'URL inválida. Use um endereço como instagram.com/... ou link iniciado com https://.',
    };
  }

  const parsed = new URL(safeUrl);
  const domain = parsed.hostname.replace(/^www\./, '').toLowerCase();
  const endpoint = getAiProxyEndpoint();

  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'url', url: safeUrl }),
      });
      if (res.ok) {
        const data = (await res.json()) as IntentAnalysisResult;
        return { ...data, source_domain: domain };
      }
    } catch {
      // Cai graciosamente para avaliação local inteligente
    }
  }

  const pathParts = parsed.pathname.split('/').filter(Boolean);
  const isInstagram = domain.includes('instagram.com') || domain.includes('instagr.am');
  const isTikTok = domain.includes('tiktok.com');

  // Match inteligente: verifica se no texto original colado ou na URL consta o nome/slug/instagram de algum local do catálogo
  const rawLower = (rawUrl || '').toLowerCase();
  const urlLower = safeUrl.toLowerCase();
  const matchedVenueFromContext = catalog.find((venue) => {
    const vName = venue.name.toLowerCase().trim();
    const vSlug = venue.slug.toLowerCase().trim();
    const vInsta = (venue.instagram || '').replace(/^@/, '').toLowerCase().trim();
    if (vName.length >= 4 && (rawLower.includes(vName) || urlLower.includes(vName))) return true;
    if (vSlug.length >= 4 && (rawLower.includes(vSlug) || urlLower.includes(vSlug))) return true;
    if (vInsta.length >= 3 && (rawLower.includes(vInsta) || urlLower.includes(vInsta))) return true;
    return false;
  });

  if (matchedVenueFromContext) {
    return {
      processing_status: 'COMPLETED',
      processing_message: `Local identificado com sucesso: ${matchedVenueFromContext.name} (${matchedVenueFromContext.neighborhood})! Suas vantagens do Bora Club estão ativadas.`,
      suggested_title: matchedVenueFromContext.name,
      suggested_neighborhood: matchedVenueFromContext.neighborhood,
      suggested_category: matchedVenueFromContext.macro_category || 'Gastronomia',
      suggested_venue_id: matchedVenueFromContext.id,
      suggested_venue_name: matchedVenueFromContext.name,
      suggested_notes: `Salvo via link (${safeUrl})`,
      source_domain: domain,
    };
  }

  // Caso 1: Instagram
  if (isInstagram) {
    let candidateHandle: string | null = null;
    if (pathParts.length > 0) {
      const first = pathParts[0].toLowerCase();
      if (!['p', 'reel', 'reels', 'tv', 'stories', 'explore', 'direct', 'accounts', 'share'].includes(first)) {
        candidateHandle = first;
      } else if (first === 'stories' && pathParts[1]) {
        candidateHandle = pathParts[1].toLowerCase();
      }
    }

    if (candidateHandle) {
      const cleanHandle = candidateHandle.replace(/^@/, '');
      const matched = catalog.find((venue) => {
        const vInsta = (venue.instagram || '').replace(/^@/, '').toLowerCase().trim();
        const vSlug = venue.slug.toLowerCase();
        const vName = slugify(venue.name);
        return (
          (vInsta && (vInsta === cleanHandle || cleanHandle.includes(vInsta) || vInsta.includes(cleanHandle))) ||
          (cleanHandle.length >= 4 && (vSlug.includes(cleanHandle) || cleanHandle.includes(vSlug))) ||
          (cleanHandle.length >= 4 && (vName.includes(cleanHandle) || cleanHandle.includes(vName)))
        );
      });

      if (matched) {
        return {
          processing_status: 'COMPLETED',
          processing_message: `Local identificado com sucesso: ${matched.name} (${matched.neighborhood})! Suas vantagens do Bora Club estão ativadas.`,
          suggested_title: matched.name,
          suggested_neighborhood: matched.neighborhood,
          suggested_category: matched.macro_category || 'Gastronomia',
          suggested_venue_id: matched.id,
          suggested_venue_name: matched.name,
          suggested_notes: `Perfil @${candidateHandle} verificado no Instagram.`,
          source_domain: domain,
        };
      }

      const formattedTitle = candidateHandle
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        processing_status: 'COMPLETED',
        processing_message: `Perfil @${candidateHandle} do Instagram capturado com sucesso! Dica: selecione o estabelecimento parceiro abaixo para ativar seus pontos:`,
        suggested_title: formattedTitle,
        suggested_category: 'Gastronomia',
        suggested_notes: `Salvo a partir de @${candidateHandle} (${safeUrl})`,
        source_domain: domain,
      };
    }

    return {
      processing_status: 'COMPLETED',
      processing_message: 'Link do Instagram capturado e pronto para salvar! Selecione ou busque o restaurante carioca abaixo para vincular seus pontos:',
      suggested_title: 'Experiência no Instagram',
      suggested_category: 'Gastronomia',
      suggested_notes: `Salvo via Instagram (${safeUrl})`,
      source_domain: domain,
    };
  }

  // Caso 2: URL de outro domínio ou genérica
  const normalizedUrl = slugify(decodeURIComponent(`${parsed.pathname} ${parsed.search}`));
  const isShortener =
    domain === 'bit.ly' || domain === 't.co' || domain === 'tinyurl.com' || domain === 'lnkd.in';

  if (isShortener || (!parsed.pathname || parsed.pathname === '/')) {
    return {
      processing_status: 'UNIDENTIFIED',
      processing_message:
        'Link registrado! Dê um título ao seu desejo ou selecione um restaurante parceiro abaixo.',
      suggested_title: 'Novo Desejo',
      suggested_category: 'Gastronomia',
      source_domain: domain,
    };
  }

  const matchedVenue = catalog.find(
    (venue) =>
      venue.slug.length > 4 &&
      (normalizedUrl.includes(venue.slug) ||
        normalizedUrl.includes(slugify(venue.name)))
  );

  const matchedNeighborhood = RIO_NEIGHBORHOODS.find((nb) =>
    normalizedUrl.includes(slugify(nb))
  );

  if (matchedVenue) {
    return {
      processing_status: 'NEEDS_CONFIRMATION',
      processing_message: `Correspondência encontrada no catálogo: ${matchedVenue.name} (${matchedVenue.neighborhood})! Suas vantagens do Bora Club estão disponíveis.`,
      suggested_title: matchedVenue.name,
      suggested_neighborhood: matchedVenue.neighborhood,
      suggested_category: matchedVenue.macro_category || 'Gastronomia',
      suggested_venue_id: matchedVenue.id,
      suggested_venue_name: matchedVenue.name,
      source_domain: domain,
    };
  }

  return {
    processing_status: 'NEEDS_CONFIRMATION',
    processing_message: `Link de ${domain} guardado! Selecione ou digite o nome do local para ativar benefícios:`,
    suggested_title: isTikTok ? 'Desejo do TikTok' : 'Novo Desejo',
    suggested_neighborhood: matchedNeighborhood,
    suggested_category: 'Gastronomia',
    source_domain: domain,
  };
}

/**
 * Analisa print/imagem enviado pelo usuário.
 * Regra obrigatória: NUNCA simular OCR ou inventar nome de restaurante.
 * Se não houver endpoint OCR conectado, retorna UNAVAILABLE explicitamente
 * e orienta o preenchimento assistido.
 */
export async function analyzeIntentScreenshot(
  strippedDataUrl: string,
  mimeType: string
): Promise<IntentAnalysisResult> {
  const endpoint = getAiProxyEndpoint();
  if (!endpoint) {
    return {
      processing_status: 'UNAVAILABLE',
      processing_message:
        'Leitura automática de prints por IA/OCR indisponível neste ambiente. Seu print foi tratado sem metadados EXIF e você pode nomear o local manualmente abaixo.',
    };
  }

  try {
    const base64 = strippedDataUrl.split(',')[1] || '';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'screenshot',
        imageBase64: base64,
        mimeType,
      }),
    });

    if (!res.ok) {
      return {
        processing_status: 'UNAVAILABLE',
        processing_message: `Serviço de visão/OCR retornou HTTP ${res.status}. Confirme os dados manualmente para salvar.`,
      };
    }

    return (await res.json()) as IntentAnalysisResult;
  } catch {
    return {
      processing_status: 'UNAVAILABLE',
      processing_message:
        'Não foi possível conectar ao servidor de OCR agora. Complete o título e bairro manualmente para salvar no Cofre.',
    };
  }
}

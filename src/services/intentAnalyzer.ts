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
        'URL inválida. Use um endereço completo iniciado com https:// ou http://.',
    };
  }

  const parsed = new URL(safeUrl);
  const domain = parsed.hostname.replace(/^www\./, '');
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
      // Cai graciosamente para avaliação transparente local sem erro bloqueante
    }
  }

  const normalizedUrl = slugify(decodeURIComponent(`${parsed.pathname} ${parsed.search}`));
  const isShortener =
    domain === 'bit.ly' || domain === 't.co' || domain === 'tinyurl.com' || domain === 'lnkd.in';

  if (isShortener || (!parsed.pathname || parsed.pathname === '/')) {
    return {
      processing_status: 'UNIDENTIFIED',
      processing_message:
        'Não foi possível identificar o local automaticamente a partir deste link encurtado ou genérico. Dê um título e confirme abaixo.',
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
      processing_message: `Possível correspondência encontrada no catálogo (${matchedVenue.name}). Confirme ou ajuste antes de guardar.`,
      suggested_title: matchedVenue.name,
      suggested_neighborhood: matchedVenue.neighborhood,
      suggested_category: matchedVenue.macro_category || 'Gastronomia',
      suggested_venue_id: matchedVenue.id,
      source_domain: domain,
    };
  }

  return {
    processing_status: 'NEEDS_CONFIRMATION',
    processing_message: `Link de ${domain} validado. Sem leitor automático remoto ativo neste ambiente — preencha ou confirme o nome do desejo abaixo.`,
    suggested_neighborhood: matchedNeighborhood,
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

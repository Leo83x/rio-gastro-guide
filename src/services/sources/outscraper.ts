import type { ExperienceAttributes, MacroCategory, MomentMode } from '../../types/experience';
import type { OperationalStatus, PriceRange, Restaurant, RestaurantCategory } from '../../types/restaurant';
import { normalizeCategory, normalizePriceRange, slugify } from '../../utils/slug';
import { evaluateRestaurantValidation } from '../validator';

export type OutscraperQueryType = 'restaurant' | 'bar' | 'cafe' | 'tourism' | 'culture' | 'all';

export interface OutscraperPhotoItem {
  photo_id?: string;
  photo_url?: string;
  photo_url_big?: string;
  photo_date?: string;
  photo_upload_date?: string;
}

export interface OutscraperPlaceRecord {
  name?: string;
  title?: string;
  place_id?: string;
  google_id?: string;
  cid?: string;
  query?: string;
  site?: string;
  website?: string;
  type?: string;
  subtypes?: string | string[];
  category?: string;
  phone?: string;
  full_address?: string;
  address?: string;
  borough?: string;
  county?: string;
  street?: string;
  city?: string;
  postal_code?: string;
  state?: string;
  latitude?: number | string;
  longitude?: number | string;
  rating?: number | string;
  reviews?: number | string;
  range?: string;
  working_hours?: Record<string, string | string[]> | string;
  working_hours_old_format?: string;
  business_status?: string;
  description?: string;
  about?: Record<string, unknown> | string;
  photo?: string;
  photos_count?: number;
  photos_data?: OutscraperPhotoItem[] | string;
  location_link?: string;
  menu_link?: string;
  reservation_links?: string | string[];
  verified?: boolean;
}

interface OutscraperApiEnvelope<T = OutscraperPlaceRecord> {
  id?: string;
  status?: 'Success' | 'Pending' | 'Error' | string;
  data?: T[] | T[][];
  results_location?: string;
  error?: string;
  message?: string;
}

export interface OutscraperFetchOptions {
  query?: string;
  neighborhood: string;
  queryType: OutscraperQueryType;
  limit?: number;
  photosLimit?: number;
  enrichPhotos?: boolean;
  apiKey?: string;
  proxyUrl?: string;
}

const KNOWN_RIO_NEIGHBORHOODS: Array<[string, string]> = [
  ['botafogo', 'Botafogo'],
  ['ipanema', 'Ipanema'],
  ['leblon', 'Leblon'],
  ['copacabana', 'Copacabana'],
  ['barra da tijuca', 'Barra da Tijuca'],
  ['santa teresa', 'Santa Teresa'],
  ['jardim botanico', 'Jardim Botânico'],
  ['gavea', 'Gávea'],
  ['grajau', 'Grajaú'],
  ['humaita', 'Humaitá'],
  ['laranjeiras', 'Laranjeiras'],
  ['flamengo', 'Flamengo'],
  ['tijuca', 'Tijuca'],
  ['urca', 'Urca'],
  ['lapa', 'Lapa'],
  ['centro', 'Centro'],
  ['sao conrado', 'São Conrado'],
  ['recreio', 'Recreio dos Bandeirantes'],
  ['lagoa', 'Lagoa'],
  ['gloria', 'Glória'],
  ['catete', 'Catete'],
  ['cosme velho', 'Cosme Velho'],
  ['leme', 'Leme'],
  ['arpoador', 'Arpoador'],
  ['maracana', 'Maracanã'],
  ['porto maravilha', 'Centro'],
  ['saude', 'Saúde'],
  ['santo cristo', 'Santo Cristo'],
  ['vila isabel', 'Vila Isabel'],
  ['meier', 'Méier'],
];

const WEEKDAY_PT: Record<string, string> = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
  segunda: 'Seg',
  terca: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
  sabado: 'Sáb',
  domingo: 'Dom',
};

function stripAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizeRioNeighborhood(
  rawNeighborhood?: string,
  address?: string,
  fallback = 'Rio de Janeiro'
): string {
  const candidates = [rawNeighborhood || '', address || ''];
  for (const cand of candidates) {
    const clean = stripAccents(cand);
    if (!clean) continue;
    for (const [needle, canonical] of KNOWN_RIO_NEIGHBORHOODS) {
      if (clean.includes(needle)) return canonical;
    }
  }
  if (rawNeighborhood && rawNeighborhood.trim().length > 1) {
    return rawNeighborhood.trim();
  }
  return fallback || 'Rio de Janeiro';
}

export function mapOutscraperPriceRange(raw?: string | number): {
  priceRange: PriceRange;
  avgTicketBrl?: number;
} {
  if (raw === undefined || raw === null || raw === '') {
    return { priceRange: '$$' };
  }
  const str = String(raw).trim();

  // BRL price hints returned by Google Maps Brazil (e.g. "R$ 40-60", "R$ 100-200", "R$ 200+")
  if (/r\$|brl|\d{2,}/i.test(str) && !/^\$+$/.test(str)) {
    const nums = (str.match(/\d+(?:[.,]\d+)?/g) || [])
      .map((n) => parseFloat(n.replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length > 0) {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const avgTicketBrl = Math.round(avg);
      if (avg <= 45) return { priceRange: '$', avgTicketBrl };
      if (avg <= 100) return { priceRange: '$$', avgTicketBrl };
      if (avg <= 180) return { priceRange: '$$$', avgTicketBrl };
      return { priceRange: '$$$$', avgTicketBrl };
    }
  }

  const priceRange = normalizePriceRange(str);
  const avgByRange: Record<PriceRange, number> = {
    $: 40,
    $$: 85,
    $$$: 150,
    $$$$: 260,
  };
  return { priceRange, avgTicketBrl: avgByRange[priceRange] };
}

export function formatOutscraperWorkingHours(raw: unknown): string | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed && trimmed !== '{}' ? trimmed : undefined;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length === 0) return undefined;
    const parts: string[] = [];
    for (const [day, val] of entries) {
      const shortDay = WEEKDAY_PT[stripAccents(day).replace(/[^a-z]/g, '')] || day.slice(0, 3);
      const timeStr = Array.isArray(val) ? val.join(', ') : String(val ?? '').trim();
      if (timeStr) {
        parts.push(`${shortDay}: ${timeStr}`);
      }
    }
    return parts.length > 0 ? parts.slice(0, 4).join(' · ') + (parts.length > 4 ? ' ...' : '') : undefined;
  }
  return undefined;
}

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  return t.startsWith('https://') || t.startsWith('http://');
}

export function extractOutscraperPhotos(
  place: Pick<OutscraperPlaceRecord, 'photo' | 'photos_data'>,
  maxPhotos = 6
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const pushUrl = (candidate: unknown) => {
    if (!isValidHttpUrl(candidate)) return;
    const trimmed = candidate.trim();
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      urls.push(trimmed);
    }
  };

  if (Array.isArray(place.photos_data)) {
    for (const item of place.photos_data) {
      if (item && typeof item === 'object') {
        pushUrl(item.photo_url_big || item.photo_url);
      }
    }
  } else if (typeof place.photos_data === 'string' && place.photos_data.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(place.photos_data) as OutscraperPhotoItem[];
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          pushUrl(item?.photo_url_big || item?.photo_url);
        }
      }
    } catch {
      // ignore malformed JSON string
    }
  }

  pushUrl(place.photo);

  return urls.slice(0, Math.max(1, maxPhotos));
}

function flattenEnvelopeData(data?: OutscraperPlaceRecord[] | OutscraperPlaceRecord[][]): OutscraperPlaceRecord[] {
  if (!Array.isArray(data)) return [];
  const flattened: OutscraperPlaceRecord[] = [];
  for (const item of data) {
    if (Array.isArray(item)) {
      flattened.push(...item);
    } else if (item && typeof item === 'object') {
      flattened.push(item);
    }
  }
  return flattened;
}

function inferMacroCategory(place: OutscraperPlaceRecord, category: RestaurantCategory): MacroCategory {
  const text = stripAccents(
    [
      place.category || '',
      place.type || '',
      Array.isArray(place.subtypes) ? place.subtypes.join(' ') : place.subtypes || '',
    ].join(' ')
  );

  if (
    text.includes('museu') ||
    text.includes('museum') ||
    text.includes('cultural') ||
    text.includes('teatro') ||
    text.includes('galer')
  ) {
    return 'Cultura & Museus';
  }
  if (text.includes('casa noturna') || text.includes('night club') || text.includes('balada')) {
    return 'Vida Noturna';
  }
  if (text.includes('praia') || text.includes('beach') || text.includes('turis') || text.includes('mirante')) {
    return 'Turismo & Praias';
  }
  if (text.includes('parque infantil') || text.includes('kids') || text.includes('brinquedoteca')) {
    return 'Atrações Infantis';
  }
  if (text.includes('show') || text.includes('evento') || text.includes('casa de espetaculo')) {
    return 'Eventos & Shows';
  }
  if (category === 'Boteco Carioca' && (text.includes('pub') || text.includes('club'))) {
    return 'Vida Noturna';
  }
  return 'Gastronomia';
}

function inferMomentTagsAndAttributes(
  place: OutscraperPlaceRecord,
  category: RestaurantCategory,
  priceRange: PriceRange,
  avgTicketBrl?: number
): { momentTags: MomentMode[]; attributes: ExperienceAttributes } {
  const aboutText = stripAccents(
    typeof place.about === 'string' ? place.about : place.about ? JSON.stringify(place.about) : ''
  );
  const fullText = stripAccents(
    [place.type || '', place.category || '', place.description || '', aboutText].join(' ')
  );

  const moments = new Set<MomentMode>();
  const isKidFriendly =
    fullText.includes('crianca') ||
    fullText.includes('kids') ||
    fullText.includes('familia') ||
    fullText.includes('cadeirao');
  const isRomantic =
    fullText.includes('romantic') ||
    category === 'Bistrô' ||
    category === 'Contemporâneo' ||
    category === 'Italiano';
  const hasOutdoor = fullText.includes('ao ar livre') || fullText.includes('outdoor');
  const hasLiveMusic = fullText.includes('musica ao vivo') || fullText.includes('live music');
  const isCovered = !fullText.includes('apenas ao ar livre') && (category !== 'Boteco Carioca' || fullText.includes('interno') || fullText.includes('salon'));

  if (isKidFriendly || category === 'Pizzaria' || category === 'Hamburgueria') moments.add('family');
  if (isRomantic) moments.add('couple');
  if (category === 'Boteco Carioca' || category === 'Churrascaria' || fullText.includes('grupos')) moments.add('friends');
  if (fullText.includes('turist') || category === 'Brasileiro' || category === 'Frutos do Mar') moments.add('tourist');
  if (isCovered) moments.add('rainy');
  if (priceRange === '$') moments.add('budget');
  if (moments.size === 0) moments.add('all');

  const attributes: ExperienceAttributes = {
    is_covered: isCovered,
    is_kid_friendly: isKidFriendly || undefined,
    live_music: hasLiveMusic || undefined,
    has_parking: fullText.includes('estacionamento') || fullText.includes('parking') || undefined,
    avg_ticket_brl: avgTicketBrl,
    off_peak_window: hasOutdoor ? 'Almoço ou fim de tarde' : undefined,
  };

  return {
    momentTags: Array.from(moments),
    attributes,
  };
}

function buildEditorialDescription(
  place: OutscraperPlaceRecord,
  neighborhood: string,
  category: RestaurantCategory
): string {
  const rawDesc = typeof place.description === 'string' ? place.description.trim() : '';
  if (rawDesc.length >= 15) return rawDesc;

  const subtypeLabel = Array.isArray(place.subtypes)
    ? place.subtypes.slice(0, 2).join(', ')
    : place.type || place.category || category;

  return `${place.name} em ${neighborhood}, Rio de Janeiro (${subtypeLabel}). Dados importados via Google Maps / Outscraper para publicação piloto aguardando reivindicação e confirmação direta pelo estabelecimento.`;
}

function mapBusinessStatus(status?: string): OperationalStatus {
  const up = (status || '').toUpperCase();
  if (up === 'OPERATIONAL') return 'OPERACIONAL';
  if (up.includes('CLOSED')) return 'FECHADO';
  return 'DESCONHECIDO';
}

export function buildOutscraperQuery(neighborhood: string, queryType: OutscraperQueryType): string {
  const loc =
    neighborhood && neighborhood.toLowerCase() !== 'todo o rio'
      ? `${neighborhood}, Rio de Janeiro, Brazil`
      : 'Rio de Janeiro, Brazil';

  switch (queryType) {
    case 'bar':
      return `bares e botecos em ${loc}`;
    case 'cafe':
      return `cafeterias em ${loc}`;
    case 'tourism':
      return `pontos turísticos e praias em ${loc}`;
    case 'culture':
      return `museus e centros culturais em ${loc}`;
    case 'all':
      return `restaurantes, bares e experiências em ${loc}`;
    case 'restaurant':
    default:
      return `restaurantes em ${loc}`;
  }
}

function getProxyBaseUrl(overrideUrl?: string): string {
  if (overrideUrl && overrideUrl.trim()) return overrideUrl.trim().replace(/\/+$/, '');
  const envProxy = import.meta.env.VITE_BORARIO_OUTSCRAPER_PROXY_URL as string | undefined;
  if (envProxy && envProxy.trim()) return envProxy.trim().replace(/\/+$/, '');
  return '/api/outscraper';
}

async function outscraperGetRequest(
  proxyBase: string,
  subPath: string,
  params: URLSearchParams,
  apiKey?: string,
  onProgress?: (step: string) => void
): Promise<OutscraperApiEnvelope> {
  const queryString = params.toString();
  const url = `${proxyBase}/${subPath.replace(/^\/+/, '')}${queryString ? `?${queryString}` : ''}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (apiKey && apiKey.trim()) {
    headers['X-API-KEY'] = apiKey.trim();
  }

  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  let parsed: OutscraperApiEnvelope & { error?: string; errorMessage?: string; message?: string };
  try {
    parsed = JSON.parse(text) as OutscraperApiEnvelope & {
      error?: string;
      errorMessage?: string;
      message?: string;
    };
  } catch {
    parsed = {};
  }

  if (!res.ok) {
    const detail = parsed.error || parsed.errorMessage || parsed.message || text.slice(0, 140);
    if (res.status === 401) {
      throw new Error(
        `Chave Outscraper inválida ou ausente (HTTP 401). Informe seu token X-API-KEY no campo acima.${detail ? ` (${detail})` : ''}`
      );
    }
    if (res.status === 402) {
      throw new Error(
        `Saldo ou plano Outscraper insuficiente para esta consulta (HTTP 402).${detail ? ` (${detail})` : ''}`
      );
    }
    if (res.status === 422) {
      throw new Error(
        `Parâmetros de busca inválidos para Outscraper (HTTP 422).${detail ? ` (${detail})` : ''}`
      );
    }
    throw new Error(`Outscraper API retornou HTTP ${res.status}.${detail ? ` (${detail})` : ''}`);
  }

  // Handle asynchronous job polling via GET /requests/{requestId} if HTTP 202 or Pending
  if ((res.status === 202 || parsed.status === 'Pending') && parsed.id) {
    const requestId = parsed.id;
    for (let attempt = 1; attempt <= 12; attempt++) {
      onProgress?.(`Processando lote na Outscraper API (${attempt}/12)...`);
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(`${proxyBase}/requests/${encodeURIComponent(requestId)}`, {
        method: 'GET',
        headers,
      });
      if (!pollRes.ok) {
        if (attempt === 12) {
          throw new Error(`Timeout ao aguardar resultado da requisição Outscraper (${requestId}).`);
        }
        continue;
      }
      const pollData = (await pollRes.json()) as OutscraperApiEnvelope;
      if (pollData.status === 'Success') return pollData;
      if (pollData.status === 'Error') {
        throw new Error(pollData.error || pollData.message || 'Erro no processamento assíncrono Outscraper.');
      }
    }
    throw new Error('A requisição Outscraper demorou além do esperado. Tente reduzir o limite por busca.');
  }

  return parsed;
}

export function normalizeOutscraperPlaces(
  places: OutscraperPlaceRecord[],
  fallbackNeighborhood = 'Rio de Janeiro',
  photosLimit = 5
): Array<Omit<Restaurant, 'id'>> {
  const seenExternalIds = new Set<string>();
  const normalized: Array<Omit<Restaurant, 'id'>> = [];

  for (const place of places) {
    const name = (place.name || place.title || '').trim();
    if (!name) continue;

    const rawAddress = (place.full_address || place.address || '').trim();
    const neighborhood = normalizeRioNeighborhood(place.borough || place.county, rawAddress, fallbackNeighborhood);
    const address =
      rawAddress ||
      [place.street, neighborhood, place.city || 'Rio de Janeiro'].filter(Boolean).join(', ');

    const extSuffix = place.place_id || place.google_id || place.cid || slugify(`${name}-${neighborhood}`);
    const externalId = `outscraper-${extSuffix}`;
    if (seenExternalIds.has(externalId)) continue;
    seenExternalIds.add(externalId);

    const categoryRaw = [
      place.category || '',
      place.type || '',
      Array.isArray(place.subtypes) ? place.subtypes.join(' ') : place.subtypes || '',
    ].join(' ');
    const category = normalizeCategory(categoryRaw, 'Brasileiro');

    const lat = typeof place.latitude === 'number' ? place.latitude : parseFloat(String(place.latitude ?? ''));
    const lng = typeof place.longitude === 'number' ? place.longitude : parseFloat(String(place.longitude ?? ''));
    const latitude = Number.isFinite(lat) ? lat : -22.9519;
    const longitude = Number.isFinite(lng) ? lng : -43.2105;

    const rawRating = typeof place.rating === 'number' ? place.rating : parseFloat(String(place.rating ?? ''));
    const hasRating = Number.isFinite(rawRating) && rawRating > 0;
    const rating = hasRating ? Math.min(5, Math.max(1, rawRating)) : 0;

    const rawReviews =
      typeof place.reviews === 'number'
        ? place.reviews
        : parseInt(String(place.reviews ?? '').replace(/\D/g, ''), 10);
    const reviewsCount = Number.isFinite(rawReviews) && rawReviews > 0 ? rawReviews : 0;

    const { priceRange, avgTicketBrl } = mapOutscraperPriceRange(place.range);
    const phone = place.phone ? String(place.phone).trim() : undefined;
    const rawSite = (place.site || place.website || '').trim();
    const website = rawSite && rawSite.startsWith('http') ? rawSite : undefined;

    const gallery = extractOutscraperPhotos(place, photosLimit);
    const coverImage = gallery[0] || '';
    const hasRealPhoto = gallery.length > 0;

    const opStatus = mapBusinessStatus(place.business_status);
    const isClosed =
      (place.business_status || '').toUpperCase().includes('CLOSED_PERMANENTLY') ||
      (place.business_status || '').toUpperCase().includes('CLOSED_TEMPORARILY');

    const validation = evaluateRestaurantValidation({
      data_source: 'outscraper_api',
      operational_status: opStatus,
      address,
      phone,
      website,
      latitude,
      longitude,
      explicit_closed: isClosed,
    });

    const macroCategory = inferMacroCategory(place, category);
    const { momentTags, attributes } = inferMomentTagsAndAttributes(place, category, priceRange, avgTicketBrl);

    normalized.push({
      external_id: externalId,
      name,
      slug: slugify(`${name}-${neighborhood}`),
      category,
      neighborhood,
      address,
      latitude,
      longitude,
      description: buildEditorialDescription(place, neighborhood, category),
      cover_image: coverImage,
      gallery,
      rating,
      reviews_count: reviewsCount,
      price_range: priceRange,
      phone,
      whatsapp: phone ? phone.replace(/\D/g, '') : undefined,
      website,
      opening_hours:
        formatOutscraperWorkingHours(place.working_hours) ||
        formatOutscraperWorkingHours(place.working_hours_old_format),
      is_claimed: false,
      is_featured: false,
      data_source: 'outscraper_api',
      // Política definida pelo projeto: fotos reais coletadas via Outscraper podem ser publicadas
      // imediatamente enquanto ocorre a etapa de contato e confirmação de cadastro com o local.
      is_redistribution_authorized: true,
      validation_status: validation.validation_status,
      operational_status: validation.operational_status,
      confidence_level: hasRealPhoto && hasRating ? 'ALTA' : validation.confidence_level,
      last_verified_at: validation.last_verified_at,
      rating_source: hasRating ? 'authorized_source' : 'none',
      image_origin: hasRealPhoto ? 'commercial_licensed' : 'none',
      image_license: hasRealPhoto
        ? 'Outscraper Google Maps Photos API (publicação piloto pré-confirmação do estabelecimento)'
        : 'Sem fotografia retornada pela fonte',
      has_real_photo: hasRealPhoto,
      macro_category: macroCategory,
      moment_tags: momentTags,
      attributes,
      data_reliability: 'CONFIRMED_SOURCE',
    });
  }

  return normalized;
}

/**
 * Integração oficial com Outscraper API (https://app.outscraper.cloud/api-docs):
 * 1. GET /google-maps-search -> busca estabelecimentos reais do Rio de Janeiro
 * 2. GET /google-maps-photos -> enriquece com fotos reais (photo_url_big || photo_url) quando photosLimit > 1
 * 3. Normaliza para publicação imediata no catálogo com fotos reais (sem placeholder quando há foto real)
 */
export async function fetchFromOutscraper(
  options: OutscraperFetchOptions,
  onProgress?: (step: string) => void
): Promise<Array<Omit<Restaurant, 'id'>>> {
  const limit = Math.min(40, Math.max(1, options.limit ?? 10));
  const photosLimit = Math.min(8, Math.max(1, options.photosLimit ?? 3));
  const enrichPhotos = options.enrichPhotos !== false;
  const proxyBase = getProxyBaseUrl(options.proxyUrl);
  const query =
    options.query && options.query.trim()
      ? options.query.trim()
      : buildOutscraperQuery(options.neighborhood, options.queryType);

  onProgress?.(`Consultando Outscraper (/google-maps-search): "${query}"...`);

  const searchParams = new URLSearchParams({
    query,
    limit: String(limit),
    language: 'pt',
    region: 'BR',
    dropDuplicates: 'true',
    async: 'false',
  });

  const searchEnvelope = await outscraperGetRequest(
    proxyBase,
    'google-maps-search',
    searchParams,
    options.apiKey,
    onProgress
  );

  const rawPlaces = flattenEnvelopeData(searchEnvelope.data).filter(
    (p) => (p.name || p.title || '').trim().length > 0
  );

  if (rawPlaces.length === 0) {
    return [];
  }

  // Enrich with Google Maps Photos API to fetch high-res real photos & multiple gallery photos
  const shouldFetchPhotosApi =
    enrichPhotos &&
    (photosLimit > 1 || rawPlaces.some((p) => !isValidHttpUrl(p.photo)));

  if (shouldFetchPhotosApi) {
    onProgress?.(
      `Buscando fotos reais de alta resolução para ${rawPlaces.length} estabelecimentos (/google-maps-photos)...`
    );

    const chunkSize = 8;
    const photosByPlaceId = new Map<string, OutscraperPhotoItem[]>();
    const photosByName = new Map<string, OutscraperPhotoItem[]>();

    for (let i = 0; i < rawPlaces.length; i += chunkSize) {
      const chunk = rawPlaces.slice(i, i + chunkSize);
      const photoParams = new URLSearchParams({
        photosLimit: String(photosLimit),
        limit: '1',
        language: 'pt',
        region: 'BR',
        async: 'false',
      });

      chunk.forEach((p) => {
        const q =
          p.place_id ||
          p.google_id ||
          `${(p.name || p.title || '').trim()}, ${p.borough || options.neighborhood}, Rio de Janeiro`;
        photoParams.append('query', q);
      });

      try {
        const photosEnvelope = await outscraperGetRequest(
          proxyBase,
          'google-maps-photos',
          photoParams,
          options.apiKey,
          onProgress
        );
        const photoPlaces = flattenEnvelopeData(photosEnvelope.data);
        for (const pp of photoPlaces) {
          if (!Array.isArray(pp.photos_data) || pp.photos_data.length === 0) continue;
          if (pp.place_id) photosByPlaceId.set(pp.place_id, pp.photos_data);
          if (pp.google_id) photosByPlaceId.set(pp.google_id, pp.photos_data);
          const cleanName = stripAccents(pp.name || pp.title || '');
          if (cleanName) photosByName.set(cleanName, pp.photos_data);
        }
      } catch (err) {
        // Maintain graceful resilience: keep base cover `place.photo` even if Photos API quota fails on a chunk
        console.warn('Outscraper /google-maps-photos enrichment partial warning:', err);
      }
    }

    for (const place of rawPlaces) {
      const byId =
        (place.place_id && photosByPlaceId.get(place.place_id)) ||
        (place.google_id && photosByPlaceId.get(place.google_id));
      const byName = photosByName.get(stripAccents(place.name || place.title || ''));
      const foundPhotos = byId || byName;
      if (foundPhotos && foundPhotos.length > 0) {
        place.photos_data = foundPhotos;
      }
    }
  }

  onProgress?.('Normalizando dados e fotos reais para revisão em lote...');
  return normalizeOutscraperPlaces(rawPlaces, options.neighborhood, photosLimit);
}

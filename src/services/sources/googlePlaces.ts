import type { OperationalStatus, Restaurant, RestaurantCategory } from '../../types/restaurant';
import { normalizeCategory, normalizePriceRange, slugify } from '../../utils/slug';
import { RIO_NEIGHBORHOODS_BBOX } from '../overpass';
import { evaluateRestaurantValidation } from '../validator';

interface GooglePlaceResult {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  nationalPhoneNumber?: string;
  websiteUri?: string;
  primaryType?: string;
  types?: string[];
}

function mapGooglePrice(level?: string): '$' | '$$' | '$$$' | '$$$$' {
  switch (level) {
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$';
    case 'PRICE_LEVEL_MODERATE':
      return '$$';
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$';
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$';
    default:
      return normalizePriceRange(level);
  }
}

function mapGoogleCategory(primaryType?: string, types?: string[]): RestaurantCategory {
  const joined = [primaryType || '', ...(types || [])].join(' ');
  return normalizeCategory(joined, 'Brasileiro');
}

function mapBusinessStatus(status?: string): OperationalStatus {
  if (status === 'OPERATIONAL') return 'OPERACIONAL';
  if (status === 'CLOSED_PERMANENTLY' || status === 'CLOSED_TEMPORARILY') return 'FECHADO';
  return 'DESCONHECIDO';
}

/**
 * Consulta a Google Places API (New) oficial usando a chave fornecida pelo usuário.
 * Respeita integralmente os Termos de Uso:
 * - Sem scraping.
 * - Não armazena nem redistribui fotos hospedadas pelo Google.
 * - Não marca automaticamente como CONFIRMADO apenas pelo status OPERATIONAL.
 */
export async function fetchFromGooglePlacesOfficial(
  neighborhoodName: string,
  queryType: string,
  apiKey: string,
  onProgress?: (step: string) => void
): Promise<Omit<Restaurant, 'id'>[]> {
  if (!apiKey.trim()) {
    throw new Error('Informe uma chave válida da Google Places API oficial.');
  }

  const target = RIO_NEIGHBORHOODS_BBOX.find((n) => n.name === neighborhoodName);
  const center = target?.center ?? [-22.9519, -43.2105];

  const typeLabel =
    queryType === 'bar' ? 'bares e botecos' : queryType === 'cafe' ? 'cafeterias' : 'restaurantes';
  const textQuery = `${typeLabel} em ${neighborhoodName}, Rio de Janeiro`;

  onProgress?.(`Consultando Google Places API oficial para ${neighborhoodName}...`);

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey.trim(),
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.businessStatus',
        'places.nationalPhoneNumber',
        'places.websiteUri',
        'places.primaryType',
        'places.types',
      ].join(','),
    },
    body: JSON.stringify({
      textQuery,
      languageCode: 'pt-BR',
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: center[0], longitude: center[1] },
          radius: 2000.0,
        },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(
      `Google Places API retornou HTTP ${res.status}. Verifique sua chave e permissões.${
        errText ? ` (${errText.slice(0, 140)})` : ''
      }`
    );
  }

  const data = (await res.json()) as { places?: GooglePlaceResult[] };
  const places = data.places || [];

  onProgress?.('Aplicando regras de validação, procedência e licenciamento...');

  return places
    .filter((p) => p.displayName?.text)
    .map((p) => {
      const name = (p.displayName?.text || '').trim();
      const address = p.formattedAddress || `${neighborhoodName}, Rio de Janeiro - RJ`;
      const category = mapGoogleCategory(p.primaryType, p.types);
      const opStatus = mapBusinessStatus(p.businessStatus);

      const validation = evaluateRestaurantValidation({
        data_source: 'google_places_api',
        operational_status: opStatus,
        address,
        phone: p.nationalPhoneNumber,
        website: p.websiteUri,
        latitude: p.location?.latitude,
        longitude: p.location?.longitude,
        explicit_closed: p.businessStatus === 'CLOSED_PERMANENTLY',
      });

      return {
        external_id: `gplaces-${p.id}`,
        name,
        slug: slugify(`${name}-${neighborhoodName}`),
        category,
        neighborhood: neighborhoodName,
        address,
        latitude: p.location?.latitude ?? center[0],
        longitude: p.location?.longitude ?? center[1],
        description: `Estabelecimento identificado via Google Places API em ${neighborhoodName}. Aguardando confirmação editorial e fotografia oficial autorizada.`,
        cover_image: '',
        gallery: [],
        rating: typeof p.rating === 'number' ? p.rating : 0,
        reviews_count: typeof p.userRatingCount === 'number' ? p.userRatingCount : 0,
        price_range: mapGooglePrice(p.priceLevel),
        phone: p.nationalPhoneNumber,
        whatsapp: p.nationalPhoneNumber ? p.nationalPhoneNumber.replace(/\D/g, '') : undefined,
        website: p.websiteUri,
        is_claimed: false,
        is_featured: false,
        data_source: 'google_places_api',
        // Por padrão, exige autorização explícita antes de publicar/redistribuir em lote
        is_redistribution_authorized: false,
        validation_status: validation.validation_status,
        operational_status: validation.operational_status,
        confidence_level: validation.confidence_level,
        last_verified_at: validation.last_verified_at,
        rating_source: typeof p.rating === 'number' ? 'authorized_source' : 'none',
        image_origin: 'none',
        image_license: 'Sem fotografia armazenada (conformidade Google Places)',
        has_real_photo: false,
      };
    });
}

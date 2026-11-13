import Papa from 'papaparse';
import type { Restaurant } from '../types/restaurant';
import { normalizeCategory, slugify } from '../utils/slug';
import {
  extractOutscraperPhotos,
  formatOutscraperWorkingHours,
  mapOutscraperPriceRange,
  normalizeRioNeighborhood,
  type OutscraperPhotoItem,
} from './sources/outscraper';

export type RawRow = Record<string, unknown>;

export interface ColumnMapping {
  external_id: string;
  name: string;
  category: string;
  neighborhood: string;
  address: string;
  latitude: string;
  longitude: string;
  description: string;
  cover_image: string;
  rating: string;
  reviews_count: string;
  price_range: string;
  phone: string;
  website: string;
  opening_hours: string;
}

const KNOWN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  external_id: ['external_id', 'place_id', 'placeId', 'cid', 'osm_id', 'id', 'google_id'],
  name: ['name', 'title', 'nome', 'estabelecimento', 'business_name', 'place_name'],
  category: ['category', 'categoryName', 'categories', 'cuisine', 'tipo', 'culinaria', 'type', 'subtypes'],
  neighborhood: ['neighborhood', 'bairro', 'district', 'suburb', 'borough', 'county'],
  address: ['address', 'full_address', 'street', 'endereco', 'formatted_address', 'location'],
  latitude: ['latitude', 'lat', 'y'],
  longitude: ['longitude', 'lng', 'lon', 'long', 'x'],
  description: ['description', 'descricao', 'about', 'summary', 'editorial'],
  cover_image: [
    'cover_image',
    'main_image',
    'imageUrl',
    'image',
    'photo',
    'thumbnail',
    'featured_image',
    'photo_url_big',
    'photo_url',
  ],
  rating: ['rating', 'totalScore', 'stars', 'nota', 'score'],
  reviews_count: ['reviews_count', 'reviewsCount', 'reviews', 'avaliacoes', 'user_ratings_total'],
  price_range: ['price_range', 'range', 'price', 'priceLevel', 'preco', 'faixa_preco'],
  phone: ['phone', 'phoneNumber', 'telefone', 'whatsapp', 'nationalPhoneNumber'],
  website: ['website', 'url', 'site', 'domain'],
  opening_hours: ['opening_hours', 'hours', 'working_hours', 'working_hours_old_format', 'horario'],
};

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const lowerMap = new Map<string, string>();
  headers.forEach((h) => lowerMap.set(h.toLowerCase().trim(), h));

  const mapping = {} as ColumnMapping;

  (Object.keys(KNOWN_ALIASES) as Array<keyof ColumnMapping>).forEach((field) => {
    const aliases = KNOWN_ALIASES[field];
    let found = '';
    for (const alias of aliases) {
      const exact = lowerMap.get(alias.toLowerCase());
      if (exact) {
        found = exact;
        break;
      }
    }
    if (!found) {
      for (const h of headers) {
        const hl = h.toLowerCase();
        if (aliases.some((a) => hl.includes(a.toLowerCase()))) {
          found = h;
          break;
        }
      }
    }
    mapping[field] = found;
  });

  return mapping;
}

export async function parseUploadedFile(file: File): Promise<{ headers: string[]; rows: RawRow[] }> {
  const text = await file.text();
  const isJSON = file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{');

  if (isJSON) {
    const parsed = JSON.parse(text) as unknown;
    let rows: RawRow[] = [];
    if (Array.isArray(parsed)) {
      rows = Array.isArray(parsed[0]) ? (parsed.flat() as RawRow[]) : (parsed as RawRow[]);
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const candidate = obj.data || obj.items || obj.results || obj.restaurants;
      if (Array.isArray(candidate)) {
        rows = Array.isArray(candidate[0])
          ? (candidate.flat() as RawRow[])
          : (candidate as RawRow[]);
      }
    }
    const headerSet = new Set<string>();
    rows.slice(0, 20).forEach((r) => Object.keys(r || {}).forEach((k) => headerSet.add(k)));
    return { headers: Array.from(headerSet), rows };
  }

  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        resolve({ headers, rows: results.data || [] });
      },
      error: (err: Error) => reject(err),
    });
  });
}

function collectRowGallery(row: RawRow, coverCandidate: string): string[] {
  const seen = new Set<string>();
  const addUrl = (val: unknown) => {
    if (typeof val !== 'string') return;
    const t = val.trim();
    if (t.startsWith('http://') || t.startsWith('https://')) {
      seen.add(t);
    }
  };

  addUrl(coverCandidate);

  const outscraperGallery = extractOutscraperPhotos({
    photo: typeof row.photo === 'string' ? row.photo : undefined,
    photos_data: row.photos_data as OutscraperPhotoItem[] | string | undefined,
  });
  outscraperGallery.forEach(addUrl);

  const rawGallery = row.gallery;
  if (Array.isArray(rawGallery)) {
    rawGallery.forEach(addUrl);
  } else if (typeof rawGallery === 'string' && rawGallery.trim()) {
    const parts = rawGallery.trim().startsWith('[')
      ? (() => {
          try {
            const p = JSON.parse(rawGallery) as unknown;
            return Array.isArray(p) ? p : [];
          } catch {
            return rawGallery.split('|');
          }
        })()
      : rawGallery.split('|');
    parts.forEach(addUrl);
  }

  return Array.from(seen);
}

export function mapRowsToRestaurants(
  rows: RawRow[],
  mapping: ColumnMapping
): Array<Omit<Restaurant, 'id'>> {
  const results: Array<Omit<Restaurant, 'id'>> = [];

  rows.forEach((row, index) => {
    const getVal = (key: keyof ColumnMapping): string => {
      const col = mapping[key];
      if (!col) return '';
      const raw = row[col];
      if (raw === null || raw === undefined) return '';
      if (Array.isArray(raw)) return raw.join(', ');
      if (typeof raw === 'object') return JSON.stringify(raw);
      return String(raw).trim();
    };

    const name = getVal('name');
    if (!name) return;

    const address = getVal('address') || 'Rio de Janeiro - RJ';
    const neighborhood = normalizeRioNeighborhood(getVal('neighborhood'), address);
    const category = normalizeCategory(getVal('category'), 'Contemporâneo');

    const rawLat = parseFloat(getVal('latitude').replace(',', '.'));
    const rawLng = parseFloat(getVal('longitude').replace(',', '.'));
    const latitude = Number.isFinite(rawLat) ? rawLat : -22.9519 + (index % 5) * 0.005;
    const longitude = Number.isFinite(rawLng) ? rawLng : -43.2105 + (index % 5) * 0.005;

    const rawRating = parseFloat(getVal('rating').replace(',', '.'));
    const hasRating = Number.isFinite(rawRating) && rawRating > 0;
    const rating = hasRating ? Math.min(5, Math.max(1, rawRating)) : 0;

    const rawReviews = parseInt(getVal('reviews_count').replace(/\D/g, ''), 10);
    const reviews_count = Number.isFinite(rawReviews) ? rawReviews : 0;

    const coverCandidate = getVal('cover_image');
    const gallery = collectRowGallery(row, coverCandidate);
    const hasRealPhoto = gallery.length > 0;
    const cover_image = hasRealPhoto ? gallery[0] : '';

    const rawDesc = getVal('description');
    const description =
      rawDesc && rawDesc.length > 20
        ? rawDesc
        : `Destaque de culinária ${category.toLowerCase()} em ${neighborhood}, reunindo sabor autêntico, ambiente acolhedor e experiência gastronômica carioca.`;

    const phone = getVal('phone') || undefined;
    const externalId = getVal('external_id') || slugify(`import-${name}-${neighborhood}`);

    const rawHoursVal = mapping.opening_hours ? row[mapping.opening_hours] : undefined;
    const opening_hours =
      formatOutscraperWorkingHours(rawHoursVal) ||
      formatOutscraperWorkingHours(row.working_hours_old_format);

    const { priceRange } = mapOutscraperPriceRange(getVal('price_range'));

    const rawBusinessStatus = String(
      row['business_status'] ?? row['businessStatus'] ?? row['status'] ?? ''
    ).toUpperCase();
    const isClosed =
      rawBusinessStatus.includes('CLOSED_PERMANENTLY') ||
      rawBusinessStatus.includes('CLOSED_TEMPORARILY') ||
      rawBusinessStatus.includes('FECHADO');

    const isOutscraperExport = Boolean(
      row['place_id'] || row['google_id'] || row['photos_data'] || row['location_link']
    );

    results.push({
      external_id: isOutscraperExport && !externalId.startsWith('outscraper-')
        ? `outscraper-${externalId}`
        : externalId,
      name,
      slug: slugify(`${name}-${neighborhood}`),
      category,
      neighborhood,
      address,
      latitude,
      longitude,
      description,
      cover_image,
      gallery,
      rating,
      reviews_count,
      price_range: priceRange,
      phone,
      whatsapp: phone ? phone.replace(/\D/g, '') : undefined,
      website: getVal('website') || undefined,
      opening_hours,
      is_claimed: false,
      is_featured: false,
      data_source: isOutscraperExport ? 'outscraper_api' : 'csv_import',
      is_redistribution_authorized: true,
      validation_status: isClosed ? 'FECHADO/INVÁLIDO' : 'PENDENTE',
      operational_status: isClosed
        ? 'FECHADO'
        : rawBusinessStatus.includes('OPERATIONAL')
          ? 'OPERACIONAL'
          : 'DESCONHECIDO',
      confidence_level: hasRealPhoto && hasRating ? 'ALTA' : 'MÉDIA',
      last_verified_at: new Date().toISOString(),
      rating_source: hasRating ? 'authorized_source' : 'none',
      image_origin: hasRealPhoto ? 'commercial_licensed' : 'none',
      image_license: hasRealPhoto
        ? isOutscraperExport
          ? 'Outscraper Google Maps Photos API (publicação piloto pré-confirmação do estabelecimento)'
          : 'Importado via planilha (aguardando confirmação do estabelecimento)'
        : 'Sem fotografia oficial disponível',
      has_real_photo: hasRealPhoto,
    });
  });

  return results;
}

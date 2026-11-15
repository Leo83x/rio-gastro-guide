import Papa from 'papaparse';
import type {
  NightlifeEventDraft,
  NightlifeSourcePlatform,
  NightlifeSubArea,
} from '../../types/nightlife';
import type { Restaurant } from '../../types/restaurant';
import {
  buildOriginalEditorialSummary,
  buildStartEndIsoRio,
  getRioTodayIso,
  matchPermanentVenueId,
  normalizeAvailabilityStatus,
  normalizeTimeHHmm,
} from './nightlifeDedup';
import { isTemporaryGoogleImageUrl } from '../venueMedia';

export type NightlifeRawRow = Record<string, unknown>;

export interface NightlifeColumnMapping {
  external_key: string;
  title: string;
  sub_area: string;
  music_genres: string;
  venue_name: string;
  neighborhood: string;
  address: string;
  event_date: string;
  start_time: string;
  end_time: string;
  price_min_brl: string;
  price_display_label: string;
  is_free: string;
  ticket_url: string;
  cover_image: string;
  source_platform: string;
  short_summary: string;
  lineup: string;
  age_rating: string;
  availability_status: string;
}

const NIGHTLIFE_ALIASES: Record<keyof NightlifeColumnMapping, string[]> = {
  external_key: ['external_key', 'external_id', 'event_id', 'id', 'codigo', 'sku'],
  title: ['title', 'nome_evento', 'evento', 'name', 'nome', 'titulo', 'event_name'],
  sub_area: ['sub_area', 'subarea', 'categoria_noite', 'category', 'categoria', 'tipo'],
  music_genres: ['music_genres', 'generos', 'genero', 'genres', 'tags', 'ritmo'],
  venue_name: ['venue_name', 'local', 'casa', 'venue', 'estabelecimento', 'place'],
  neighborhood: ['neighborhood', 'bairro', 'regiao', 'district'],
  address: ['address', 'endereco', 'full_address', 'rua', 'logradouro'],
  event_date: ['event_date', 'data', 'date', 'start_date', 'dia'],
  start_time: ['start_time', 'horario', 'hora', 'hora_inicio', 'time', 'abertura'],
  end_time: ['end_time', 'hora_fim', 'termino', 'fim'],
  price_min_brl: ['price_min_brl', 'preco', 'price', 'valor', 'min_price', 'ingresso_valor'],
  price_display_label: ['price_display_label', 'faixa_preco', 'price_label'],
  is_free: ['is_free', 'gratuito', 'gratis', 'free', 'entrada_franca'],
  ticket_url: ['ticket_url', 'link_ingresso', 'url_ingresso', 'link', 'url', 'sympla_url'],
  cover_image: ['cover_image', 'imagem', 'foto', 'image', 'poster', 'banner'],
  source_platform: ['source_platform', 'fonte', 'origem', 'platform', 'source'],
  short_summary: ['short_summary', 'resumo', 'descricao', 'description', 'summary'],
  lineup: ['lineup', 'atracoes', 'artistas', 'djs', 'artists'],
  age_rating: ['age_rating', 'classificacao', 'idade'],
  availability_status: ['availability_status', 'disponibilidade', 'status_ingresso', 'status'],
};

export function detectNightlifeColumnMapping(headers: string[]): NightlifeColumnMapping {
  const lowerMap = new Map<string, string>();
  headers.forEach((h) => lowerMap.set(h.toLowerCase().trim(), h));

  const mapping = {} as NightlifeColumnMapping;
  (Object.keys(NIGHTLIFE_ALIASES) as Array<keyof NightlifeColumnMapping>).forEach((field) => {
    const aliases = NIGHTLIFE_ALIASES[field];
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

export async function parseNightlifeFile(
  file: File
): Promise<{ headers: string[]; rows: NightlifeRawRow[] }> {
  const text = await file.text();
  return parseNightlifeTextContent(
    text,
    file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('[') || text.trim().startsWith('{')
      ? 'json'
      : 'csv'
  );
}

export async function parseNightlifeTextContent(
  text: string,
  format: 'csv' | 'json'
): Promise<{ headers: string[]; rows: NightlifeRawRow[] }> {
  if (format === 'json') {
    const parsed = JSON.parse(text) as unknown;
    let rows: NightlifeRawRow[] = [];
    if (Array.isArray(parsed)) {
      rows = Array.isArray(parsed[0])
        ? (parsed.flat() as NightlifeRawRow[])
        : (parsed as NightlifeRawRow[]);
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const candidate = obj.data || obj.items || obj.events || obj.drafts || obj.results;
      if (Array.isArray(candidate)) {
        rows = Array.isArray(candidate[0])
          ? (candidate.flat() as NightlifeRawRow[])
          : (candidate as NightlifeRawRow[]);
      }
    }
    const headerSet = new Set<string>();
    rows.slice(0, 30).forEach((r) => Object.keys(r || {}).forEach((k) => headerSet.add(k)));
    return { headers: Array.from(headerSet), rows };
  }

  return new Promise((resolve, reject) => {
    Papa.parse<NightlifeRawRow>(text, {
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

function inferSubArea(rawSubArea: string, combinedText: string): NightlifeSubArea {
  const upper = rawSubArea.trim().toUpperCase();
  if (
    upper === 'SAMBA_PAGODE' ||
    upper === 'FESTAS_BALADAS' ||
    upper === 'SHOWS' ||
    upper === 'ROOFTOPS_EXPERIENCIAS'
  ) {
    return upper;
  }
  const lower = `${rawSubArea} ${combinedText}`.toLowerCase();
  if (lower.includes('samba') || lower.includes('pagode') || lower.includes('roda')) {
    return 'SAMBA_PAGODE';
  }
  if (
    lower.includes('rooftop') ||
    lower.includes('sunset') ||
    lower.includes('terraço') ||
    lower.includes('vinil') ||
    lower.includes('jazz')
  ) {
    return 'ROOFTOPS_EXPERIENCIAS';
  }
  if (
    lower.includes('show') ||
    lower.includes('turnê') ||
    lower.includes('festival') ||
    lower.includes('acústico') ||
    lower.includes('ao vivo')
  ) {
    return 'SHOWS';
  }
  return 'FESTAS_BALADAS';
}

function parseEventDateIso(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return getRioTodayIso();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);

  const brMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return getRioTodayIso();
}

function normalizePlatform(raw: string): NightlifeSourcePlatform {
  const upper = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  const valid: NightlifeSourcePlatform[] = [
    'SYMPLA',
    'INGRESSE',
    'SHOTGUN',
    'EVENTBRITE',
    'EVENTIM',
    'TICKETMASTER',
    'TICKET360',
    'TA_SENDO',
    'RIO_NA_NOITE',
    'AGENDA_RIO',
    'PARTNER_PORTAL',
    'CSV_JSON',
    'MANUAL_ADMIN',
  ];
  const matched = valid.find((p) => p === upper);
  if (matched) return matched;
  const lower = raw.toLowerCase();
  if (lower.includes('sympla')) return 'SYMPLA';
  if (lower.includes('ingresse')) return 'INGRESSE';
  if (lower.includes('shotgun')) return 'SHOTGUN';
  if (lower.includes('eventbrite')) return 'EVENTBRITE';
  if (lower.includes('eventim')) return 'EVENTIM';
  if (lower.includes('ticketmaster')) return 'TICKETMASTER';
  if (lower.includes('ticket360')) return 'TICKET360';
  if (lower.includes('sendo')) return 'TA_SENDO';
  if (lower.includes('rio na noite')) return 'RIO_NA_NOITE';
  if (lower.includes('agenda rio')) return 'AGENDA_RIO';
  return 'CSV_JSON';
}

function sanitizeNightlifeImageCandidate(urlRaw: string): string {
  const trimmed = urlRaw.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('https://')) return '';
  if (isTemporaryGoogleImageUrl(trimmed)) return '';
  if (trimmed.includes('oaiusercontent.com') || trimmed.includes('openai.com')) return '';
  return trimmed;
}

function sanitizeTicketUrl(urlRaw: string): string | undefined {
  const trimmed = urlRaw.trim();
  if (!trimmed) return undefined;
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString();
  } catch {
    // invalid url
  }
  return undefined;
}

function splitListField(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x || '').trim()).filter(Boolean);
  }
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(/[|,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function mapRowsToNightlifeDrafts(
  rows: NightlifeRawRow[],
  mapping: NightlifeColumnMapping,
  permanentVenues: Restaurant[] = []
): NightlifeEventDraft[] {
  const out: NightlifeEventDraft[] = [];

  rows.forEach((row, idx) => {
    const getStr = (key: keyof NightlifeColumnMapping): string => {
      const col = mapping[key];
      if (!col) return '';
      const raw = row[col];
      if (raw === null || raw === undefined) return '';
      if (Array.isArray(raw)) return raw.join(' | ');
      return String(raw).trim();
    };

    const title = getStr('title');
    if (!title) return;

    const venueName = getStr('venue_name') || 'Local a confirmar';
    const neighborhood = getStr('neighborhood') || 'Rio de Janeiro';
    const address = getStr('address') || `${neighborhood}, Rio de Janeiro - RJ`;
    const eventDate = parseEventDateIso(getStr('event_date'));
    const startTime = normalizeTimeHHmm(getStr('start_time'), '22:00');
    const endTimeRaw = getStr('end_time');
    const endTime = endTimeRaw ? normalizeTimeHHmm(endTimeRaw, '') : undefined;
    const { startsAtIso, endsAtIso } = buildStartEndIsoRio(eventDate, startTime, endTime);

    const rawDesc = getStr('short_summary');
    const subArea = inferSubArea(getStr('sub_area'), `${title} ${rawDesc} ${venueName}`);

    const isFreeFlag = /^(true|1|sim|s|yes|gratuito|gratis|grátis)$/i.test(getStr('is_free'));
    const rawPriceStr = getStr('price_min_brl').replace(',', '.').replace(/[^\d.]/g, '');
    const priceNum = rawPriceStr ? parseFloat(rawPriceStr) : NaN;
    const isFree = isFreeFlag || priceNum === 0;
    const priceMin = Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined;

    const priceDisplayLabel =
      getStr('price_display_label') ||
      (isFree
        ? 'Entrada gratuita'
        : priceMin
          ? `A partir de R$ ${priceMin.toFixed(0)}`
          : 'Consultar valores na fonte oficial');

    const sourcePlatform = normalizePlatform(getStr('source_platform'));
    const ticketUrl = sanitizeTicketUrl(getStr('ticket_url'));
    const coverImage = sanitizeNightlifeImageCandidate(getStr('cover_image'));
    const matchedVenue = matchPermanentVenueId(venueName, neighborhood, permanentVenues);

    const extKey =
      getStr('external_key') ||
      `csv:${eventDate}:${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}:${idx}`;

    const musicGenres = splitListField(
      mapping.music_genres ? row[mapping.music_genres] : undefined
    );
    const lineup = splitListField(mapping.lineup ? row[mapping.lineup] : undefined);

    out.push({
      external_key: extKey,
      source_platform: sourcePlatform,
      source_url: ticketUrl,
      title,
      short_summary: buildOriginalEditorialSummary(rawDesc, venueName, neighborhood, subArea),
      sub_area: subArea,
      music_genres:
        musicGenres.length > 0
          ? musicGenres
          : subArea === 'SAMBA_PAGODE'
            ? ['Samba', 'Pagode']
            : subArea === 'ROOFTOPS_EXPERIENCIAS'
              ? ['Lounge', 'Sunset']
              : subArea === 'SHOWS'
                ? ['Show ao vivo']
                : ['Festa', 'DJ Set'],
      moment_tags: ['friends', 'couple'],
      age_rating: getStr('age_rating') || '18+',
      venue_id: matchedVenue?.id,
      venue_name: matchedVenue?.name || venueName,
      neighborhood: matchedVenue?.neighborhood || neighborhood,
      address: matchedVenue?.address || address,
      latitude: matchedVenue?.latitude,
      longitude: matchedVenue?.longitude,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      is_free: isFree,
      price_min_brl: priceMin,
      price_display_label: priceDisplayLabel,
      ticket_url: ticketUrl,
      availability_status: normalizeAvailabilityStatus(getStr('availability_status'), isFree),
      lineup,
      cover_image: coverImage,
      image_origin: coverImage ? 'PRODUCER_AUTHORIZED' : 'NONE',
      image_license_note: coverImage
        ? 'URL fornecida em planilha autorizada — validar direitos antes da publicação.'
        : 'Sem arte anexada; utilizar fallback editorial ou upload autorizado.',
      curation_status: 'PENDENTE',
      is_featured: false,
      is_demonstrative: false,
    });
  });

  return out;
}

export function downloadNightlifeCsvTemplate(): void {
  const headers = [
    'external_key',
    'title',
    'sub_area',
    'music_genres',
    'venue_name',
    'neighborhood',
    'address',
    'event_date',
    'start_time',
    'end_time',
    'price_min_brl',
    'is_free',
    'availability_status',
    'ticket_url',
    'source_platform',
    'lineup',
    'short_summary',
    'cover_image',
  ];
  const sampleRow = [
    'modelo-exemplo-01',
    'Nome do Evento ou Roda',
    'SAMBA_PAGODE',
    'Samba|Pagode',
    'Nome da Casa ou Espaco',
    'Lapa',
    'Rua da Lapa, 100 - Lapa, Rio de Janeiro',
    getRioTodayIso(),
    '21:00',
    '03:00',
    '40',
    'false',
    'DISPONIVEL',
    'https://www.sympla.com.br/',
    'SYMPLA',
    'Atracao 1|Atracao 2',
    'Resumo editorial curto e objetivo do evento.',
    '',
  ];
  const csv = [headers.join(','), sampleRow.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')].join(
    '\n'
  );
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `borario-noite-modelo-${getRioTodayIso()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

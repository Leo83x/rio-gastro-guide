import type {
  NightlifeAvailabilityStatus,
  NightlifeCompletenessCheck,
  NightlifeDateFilter,
  NightlifeEvent,
  NightlifeEventDraft,
  NightlifeSubArea,
} from '../../types/nightlife';
import type { Restaurant } from '../../types/restaurant';
import { getRioTodayIso, inferVenueAndNeighborhood } from './nightlifeVenues';

export {
  getRioTodayIso,
  inferDraftFromUrlSlug,
  inferVenueAndNeighborhood,
  KNOWN_RIO_VENUES,
  type InferredVenueResult,
  type KnownRioVenue,
} from './nightlifeVenues';

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return getRioTodayIso();
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function getDayOfWeekRio(isoDate: string): number {
  const parsed = new Date(`${isoDate}T12:00:00-03:00`);
  if (Number.isNaN(parsed.getTime())) return -1;
  return parsed.getUTCDay();
}

export function getNextWeekdayIso(targetDow: number, baseDate: Date = new Date()): string {
  const today = getRioTodayIso(baseDate);
  const currentDow = getDayOfWeekRio(today);
  if (currentDow === -1) return today;
  const delta = (targetDow - currentDow + 7) % 7;
  return addDaysToIsoDate(today, delta);
}

export function formatEventDateBadgePt(isoDate: string, baseDate: Date = new Date()): string {
  const today = getRioTodayIso(baseDate);
  const tomorrow = addDaysToIsoDate(today, 1);
  const [y, m, d] = isoDate.split('-');
  const shortDate = d && m ? `${d}/${m}` : isoDate;

  if (isoDate === today) return `Hoje · ${shortDate}`;
  if (isoDate === tomorrow) return `Amanhã · ${shortDate}`;

  if (y && m && d) {
    try {
      const dt = new Date(`${isoDate}T12:00:00-03:00`);
      const weekday = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'short',
      })
        .format(dt)
        .replace('.', '');
      const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
      return `${cap}, ${shortDate}`;
    } catch {
      // keep shortDate
    }
  }
  return shortDate;
}

export function normalizeTimeHHmm(raw?: string, fallback = '22:00'): string {
  if (!raw) return fallback;
  const trimmed = raw.trim();
  const m = trimmed.match(/(\d{1,2})\s*[:hH]?\s*(\d{2})?/);
  if (!m) return fallback;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = m[2] ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function buildStartEndIsoRio(
  eventDate: string,
  startTime: string,
  endTime?: string
): { startsAtIso: string; endsAtIso: string } {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate) ? eventDate : getRioTodayIso();
  const cleanStart = normalizeTimeHHmm(startTime, '22:00');
  const startDt = new Date(`${cleanDate}T${cleanStart}:00-03:00`);

  if (Number.isNaN(startDt.getTime())) {
    const now = new Date();
    return {
      startsAtIso: now.toISOString(),
      endsAtIso: new Date(now.getTime() + 6 * 3600 * 1000).toISOString(),
    };
  }

  let endDt: Date;
  if (endTime && endTime.trim()) {
    const cleanEnd = normalizeTimeHHmm(endTime, '');
    if (cleanEnd) {
      let endDateCandidate = cleanDate;
      const [sh, sm] = cleanStart.split(':').map(Number);
      const [eh, em] = cleanEnd.split(':').map(Number);
      if (eh < sh || (eh === sh && em <= sm)) {
        endDateCandidate = addDaysToIsoDate(cleanDate, 1);
      }
      endDt = new Date(`${endDateCandidate}T${cleanEnd}:00-03:00`);
    } else {
      endDt = new Date(startDt.getTime() + 6 * 3600 * 1000);
    }
  } else {
    // Eventos noturnos padrão têm janela mínima de 6h a partir do início
    endDt = new Date(startDt.getTime() + 6 * 3600 * 1000);
  }

  if (Number.isNaN(endDt.getTime()) || endDt.getTime() <= startDt.getTime()) {
    endDt = new Date(startDt.getTime() + 6 * 3600 * 1000);
  }

  return {
    startsAtIso: startDt.toISOString(),
    endsAtIso: endDt.toISOString(),
  };
}

export function decodeHtmlEntities(raw?: string): string {
  if (!raw) return '';
  let s = String(raw);
  // Numeric decimal entities: &#8220; &#8221; &#8211; etc.
  s = s.replace(/&#(\d+);/g, (_, dec) => {
    try {
      const code = parseInt(dec, 10);
      return String.fromCharCode(code);
    } catch {
      return '';
    }
  });
  // Numeric hex entities: &#x201C; etc.
  s = s.replace(/&#x([0-9a-fA-F]+);/gi, (_, hex) => {
    try {
      const code = parseInt(hex, 16);
      return String.fromCharCode(code);
    } catch {
      return '';
    }
  });
  // Common named HTML entities
  s = s
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&#039;/gi, "'")
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rsquo;/gi, '’')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&hellip;/gi, '…')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ');
  return s.trim();
}

export function cleanEventTitle(raw?: string): string {
  if (!raw) return '';
  return decodeHtmlEntities(raw).replace(/\s+/g, ' ').trim();
}

export function normalizeTextForDedup(raw: string): string {
  const decoded = decodeHtmlEntities(raw);
  return decoded
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(lote\s*\d+|\d+\s*[ºo]?\s*lote|sympla|ingresse|shotgun|eventbrite|ingressos?|ao vivo|edicao|edition|rio de janeiro|rj)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeEventTitleForDedup(title: string): string {
  return normalizeTextForDedup(title);
}

export function computeNightlifeDedupHash(input: {
  title: string;
  venue_name: string;
  event_date: string;
}): string {
  const t = normalizeEventTitleForDedup(input.title) || 'evento';
  const v = normalizeTextForDedup(input.venue_name) || 'local';
  const d = (input.event_date || '').trim() || 'sem-data';
  return `${t}::${v}::${d}`;
}

function tokenJaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter((w) => w.length >= 2));
  const tokensB = new Set(b.split(' ').filter((w) => w.length >= 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function cleanUrlForDedup(u?: string): string {
  if (!u) return '';
  try {
    const parsed = new URL(u);
    // remove search params and hash
    return `${parsed.origin}${parsed.pathname}`.toLowerCase().replace(/\/+$/, '');
  } catch {
    return u.split('?')[0].toLowerCase().replace(/\/+$/, '').trim();
  }
}

export interface DuplicateMatchResult {
  existing: NightlifeEvent;
  matchReason: 'external_key' | 'source_id' | 'source_url' | 'dedup_hash' | 'same_date_title' | 'fuzzy_venue_date';
}

export function findDuplicateNightlifeEvent(
  candidate: Pick<
    NightlifeEventDraft,
    'external_key' | 'source_platform' | 'source_external_id' | 'title' | 'venue_name' | 'event_date'
  > & { source_url?: string; ticket_url?: string },
  existingList: NightlifeEvent[]
): DuplicateMatchResult | null {
  const candTitleClean = cleanEventTitle(candidate.title);
  const candTitleNorm = normalizeEventTitleForDedup(candTitleClean);
  const candVenueNorm = normalizeTextForDedup(candidate.venue_name);
  const candUrl = cleanUrlForDedup(candidate.ticket_url || candidate.source_url);
  const candidateHash = computeNightlifeDedupHash({
    title: candTitleClean,
    venue_name: candidate.venue_name,
    event_date: candidate.event_date,
  });

  for (const item of existingList) {
    // 1. Exact external key match
    if (candidate.external_key && item.external_key === candidate.external_key) {
      return { existing: item, matchReason: 'external_key' };
    }

    // 2. Exact source external ID match
    if (
      candidate.source_external_id &&
      item.source_external_id &&
      candidate.source_platform === item.source_platform &&
      candidate.source_external_id === item.source_external_id
    ) {
      return { existing: item, matchReason: 'source_id' };
    }

    // 3. Exact Ticket or Source URL match (e.g. same Sympla/Ingresse/Riotur link)
    if (candUrl) {
      const itemUrl = cleanUrlForDedup(item.ticket_url || item.source_url);
      if (itemUrl && (itemUrl === candUrl || (item.alternate_ticket_urls && item.alternate_ticket_urls.some((a) => cleanUrlForDedup(a.ticket_url) === candUrl)))) {
        return { existing: item, matchReason: 'source_url' };
      }
    }

    // 4. Exact Dedup Hash match
    const itemTitleClean = cleanEventTitle(item.title);
    const itemHash = item.dedup_hash || computeNightlifeDedupHash({
      title: itemTitleClean,
      venue_name: item.venue_name,
      event_date: item.event_date,
    });
    if (itemHash === candidateHash) {
      return { existing: item, matchReason: 'dedup_hash' };
    }

    // 5. Date-based match: on the same date in Rio, identical or highly similar event titles
    if (item.event_date && candidate.event_date && item.event_date === candidate.event_date) {
      const itemTitleNorm = normalizeEventTitleForDedup(itemTitleClean);

      // Exact title match on the same date is always the same event
      if (candTitleNorm && itemTitleNorm && candTitleNorm === itemTitleNorm) {
        return { existing: item, matchReason: 'same_date_title' };
      }

      // High token similarity (>= 0.70) on the same date
      const similarity = tokenJaccardSimilarity(candTitleNorm, itemTitleNorm);
      if (similarity >= 0.70) {
        return { existing: item, matchReason: 'same_date_title' };
      }

      // Medium similarity (>= 0.55) when venue is confirmed to match
      const itemVenueNorm = normalizeTextForDedup(item.venue_name);
      const sameVenue =
        candVenueNorm === itemVenueNorm ||
        (candVenueNorm.length >= 4 &&
          itemVenueNorm.length >= 4 &&
          (candVenueNorm.includes(itemVenueNorm) || itemVenueNorm.includes(candVenueNorm)));

      if (sameVenue && similarity >= 0.55) {
        return { existing: item, matchReason: 'fuzzy_venue_date' };
      }
    }
  }

  return null;
}

export function deduplicateEventsList(list: NightlifeEvent[]): NightlifeEvent[] {
  const deduped: NightlifeEvent[] = [];
  for (const item of list) {
    const cleanedItem: NightlifeEvent = {
      ...item,
      title: cleanEventTitle(item.title),
      short_summary: decodeHtmlEntities(item.short_summary),
      venue_name: decodeHtmlEntities(item.venue_name),
      neighborhood: decodeHtmlEntities(item.neighborhood),
      address: decodeHtmlEntities(item.address),
    };

    const match = findDuplicateNightlifeEvent(cleanedItem, deduped);
    if (!match) {
      deduped.push(cleanedItem);
    } else {
      // Merge best fields into existing
      const existingIdx = deduped.findIndex((e) => e.id === match.existing.id);
      if (existingIdx !== -1) {
        const existing = deduped[existingIdx];
        const mergedAlt = [...(existing.alternate_ticket_urls || [])];
        if (
          cleanedItem.ticket_url &&
          cleanedItem.ticket_url !== existing.ticket_url &&
          !mergedAlt.some((a) => a.ticket_url === cleanedItem.ticket_url)
        ) {
          mergedAlt.push({
            source_platform: cleanedItem.source_platform,
            ticket_url: cleanedItem.ticket_url,
            price_label: cleanedItem.price_display_label,
            last_seen_at: cleanedItem.last_verified_at || new Date().toISOString(),
          });
        }
        // If the duplicate has a better photo or is published, prefer it
        deduped[existingIdx] = {
          ...existing,
          curation_status: existing.curation_status === 'PUBLICADO' || cleanedItem.curation_status === 'PUBLICADO'
            ? 'PUBLICADO'
            : existing.curation_status,
          cover_image: existing.cover_image || cleanedItem.cover_image,
          ticket_url: existing.ticket_url || cleanedItem.ticket_url,
          alternate_ticket_urls: mergedAlt,
        };
      }
    }
  }
  return deduped;
}

export function buildOriginalEditorialSummary(
  rawDescription: string,
  venueName: string,
  neighborhood: string,
  subArea: NightlifeSubArea
): string {
  const cleaned = rawDescription
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 18) {
    const areaHint =
      subArea === 'SAMBA_PAGODE'
        ? 'Roda de samba e pagode'
        : subArea === 'SHOWS'
          ? 'Apresentação musical ao vivo'
          : subArea === 'ROOFTOPS_EXPERIENCIAS'
            ? 'Experiência noturna e sunset'
            : 'Noite e pista programada';
    return `${areaHint} em ${venueName} (${neighborhood}). Confira horários, atrações e condições de entrada na fonte oficial.`;
  }

  const sentences = cleaned.split(/(?<=[.!?])\s+/);
  const first = sentences[0] || cleaned;
  return first.length > 185 ? `${first.slice(0, 182).trim()}...` : first;
}



export function checkNightlifeCompleteness(
  item: Pick<
    NightlifeEventDraft,
    | 'title'
    | 'event_date'
    | 'start_time'
    | 'venue_name'
    | 'neighborhood'
    | 'is_free'
    | 'availability_status'
    | 'ticket_url'
    | 'image_origin'
    | 'cover_image'
  >
): NightlifeCompletenessCheck {
  const missing: string[] = [];
  const warnings: string[] = [];
  let inferredVenue: { venue_name: string; neighborhood: string } | undefined;

  if (!item.title || item.title.trim().length < 3) {
    missing.push('Título do evento (mínimo 3 caracteres)');
  }
  if (!item.event_date || !/^\d{4}-\d{2}-\d{2}$/.test(item.event_date.trim())) {
    missing.push('Data válida do evento (AAAA-MM-DD)');
  }
  if (!item.start_time || !/^\d{1,2}:\d{2}/.test(item.start_time.trim())) {
    missing.push('Horário de início (HH:mm)');
  }
  if (
    !item.venue_name ||
    item.venue_name.trim().length < 2 ||
    item.venue_name.trim().toLowerCase() === 'local a confirmar'
  ) {
    const inf = inferVenueAndNeighborhood(item.title);
    if (inf) {
      inferredVenue = {
        venue_name: inf.venue_name,
        neighborhood: inf.neighborhood,
      };
      warnings.push(`Local sugerido do título: ${inf.venue_name} (${inf.neighborhood}).`);
    } else {
      missing.push('Local / Casa do evento');
    }
  }
  if (!item.neighborhood || item.neighborhood.trim().length < 2) {
    if (inferredVenue?.neighborhood) {
      // Handled by inferred venue
    } else {
      missing.push('Bairro no Rio');
    }
  }

  const hasEntryChannel =
    Boolean(item.is_free) ||
    item.availability_status === 'GRATUITO' ||
    item.availability_status === 'PORTA' ||
    item.availability_status === 'LISTA_AMIGA' ||
    Boolean(item.ticket_url && /^https?:\/\//i.test(item.ticket_url.trim()));

  if (!hasEntryChannel) {
    missing.push('Link oficial de ingresso ou marcação de Entrada Gratuita / Lista / Porta');
  }

  if (!item.cover_image?.trim() && item.image_origin === 'NONE') {
    warnings.push(
      'Sem imagem oficial anexada — será exibido card visual da subárea até inclusão de arte autorizada.'
    );
  } else if (item.image_origin === 'ILLUSTRATIVE_CATEGORY_FALLBACK') {
    warnings.push('Usando visual editorial da subárea.');
  }

  return {
    complete: missing.length === 0,
    missing_fields: missing,
    warnings,
    inferred_venue: inferredVenue,
  };
}

export function matchPermanentVenueId(
  venueName: string,
  neighborhood: string,
  permanentVenues: Restaurant[]
): Restaurant | null {
  if (!venueName || permanentVenues.length === 0) return null;
  const vNorm = normalizeTextForDedup(venueName);
  const nNorm = normalizeTextForDedup(neighborhood);
  if (!vNorm || vNorm.length < 3) return null;

  for (const venue of permanentVenues) {
    const rNorm = normalizeTextForDedup(venue.name);
    if (!rNorm) continue;
    if (rNorm === vNorm) return venue;
    if (rNorm.length >= 5 && (rNorm.includes(vNorm) || vNorm.includes(rNorm))) {
      const rnNorm = normalizeTextForDedup(venue.neighborhood);
      if (!nNorm || nNorm === 'rio de janeiro' || rnNorm === nNorm) {
        return venue;
      }
    }
  }
  return null;
}

export function isEventVisiblePublicly(
  ev: Pick<NightlifeEvent, 'curation_status' | 'ends_at' | 'event_date'>,
  nowDate: Date = new Date()
): boolean {
  if (ev.curation_status !== 'PUBLICADO') return false;
  const todayRio = getRioTodayIso(nowDate);
  if (ev.event_date && ev.event_date < todayRio) return false;
  const endsMs = new Date(ev.ends_at).getTime();
  if (Number.isNaN(endsMs)) return false;
  return endsMs >= nowDate.getTime();
}

export function matchesDateFilter(
  ev: Pick<NightlifeEvent, 'event_date' | 'is_free' | 'availability_status'>,
  filter: NightlifeDateFilter,
  baseDate: Date = new Date()
): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'FREE') {
    return Boolean(ev.is_free || ev.availability_status === 'GRATUITO');
  }
  const today = getRioTodayIso(baseDate);
  if (filter === 'TODAY') return ev.event_date === today;
  if (filter === 'TOMORROW') return ev.event_date === addDaysToIsoDate(today, 1);
  if (filter === 'FRIDAY') return ev.event_date === getNextWeekdayIso(5, baseDate);
  if (filter === 'SATURDAY') return ev.event_date === getNextWeekdayIso(6, baseDate);
  if (filter === 'SUNDAY') return ev.event_date === getNextWeekdayIso(0, baseDate);
  return true;
}

export function normalizeAvailabilityStatus(raw?: string, isFree = false): NightlifeAvailabilityStatus {
  if (isFree) return 'GRATUITO';
  const v = (raw || '').trim().toUpperCase();
  if (v === 'ULTIMOS_INGRESSOS' || v.includes('ULTIMO')) return 'ULTIMOS_INGRESSOS';
  if (v === 'ESGOTADO' || v.includes('SOLD') || v.includes('ESGOT')) return 'ESGOTADO';
  if (v === 'LISTA_AMIGA' || v.includes('LISTA')) return 'LISTA_AMIGA';
  if (v === 'PORTA' || v.includes('BILHETERIA') || v.includes('NA HORA')) return 'PORTA';
  if (v === 'GRATUITO' || v.includes('GRAT')) return 'GRATUITO';
  return 'DISPONIVEL';
}

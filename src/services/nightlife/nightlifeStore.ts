import type {
  AlternateTicketLink,
  NightlifeAvailabilityStatus,
  NightlifeCompletenessCheck,
  NightlifeCurationStatus,
  NightlifeEvent,
  NightlifeEventDraft,
  NightlifeIngestionRun,
  NightlifeSourcePlatform,
} from '../../types/nightlife';
import type { Restaurant } from '../../types/restaurant';
import { generateUUID, slugify } from '../../utils/slug';
import { supabase } from '../supabaseClient';
import { isTemporaryGoogleImageUrl } from '../venueMedia';
import {
  buildOriginalEditorialSummary,
  buildStartEndIsoRio,
  checkNightlifeCompleteness,
  cleanEventTitle,
  computeNightlifeDedupHash,
  decodeHtmlEntities,
  deduplicateEventsList,
  findDuplicateNightlifeEvent,
  getRioTodayIso,
  inferDraftFromUrlSlug,
  inferVenueAndNeighborhood,
  isEventVisiblePublicly,
  matchPermanentVenueId,
  normalizeTimeHHmm,
} from './nightlifeDedup';

import { buildStarterCuratedNightlifeEvents } from './defaultNightlifeEvents';

export const NIGHTLIFE_EVENTS_STORAGE_KEY = 'borario_nightlife_events_v1';
export const NIGHTLIFE_RUNS_STORAGE_KEY = 'borario_nightlife_runs_v1';
const SESSION_SYMPLA_TOKEN_KEY = 'borario_session_sympla_token';
const SESSION_INGRESSE_KEY = 'borario_session_ingresse_key';

function sanitizeStoredCoverUrl(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (isTemporaryGoogleImageUrl(trimmed)) return '';
  if (trimmed.includes('oaiusercontent.com') || trimmed.includes('openai.com')) return '';
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('data:image/')) return '';
  return trimmed;
}

export function readLocalNightlifeEvents(): NightlifeEvent[] {
  try {
    const raw = localStorage.getItem(NIGHTLIFE_EVENTS_STORAGE_KEY);
    if (!raw) {
      const seeded = buildStarterCuratedNightlifeEvents();
      writeLocalNightlifeEvents(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as NightlifeEvent[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = buildStarterCuratedNightlifeEvents();
      writeLocalNightlifeEvents(seeded);
      return seeded;
    }
    return deduplicateEventsList(parsed);
  } catch {
    return buildStarterCuratedNightlifeEvents();
  }
}

function writeLocalNightlifeEvents(events: NightlifeEvent[]): void {
  localStorage.setItem(NIGHTLIFE_EVENTS_STORAGE_KEY, JSON.stringify(events));
}

export function readLocalIngestionRuns(): NightlifeIngestionRun[] {
  try {
    const raw = localStorage.getItem(NIGHTLIFE_RUNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NightlifeIngestionRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalIngestionRuns(runs: NightlifeIngestionRun[]): void {
  localStorage.setItem(NIGHTLIFE_RUNS_STORAGE_KEY, JSON.stringify(runs.slice(0, 40)));
}

export function getSessionNightlifeCredentials(): {
  symplaToken: string;
  ingresseKey: string;
} {
  try {
    return {
      symplaToken: sessionStorage.getItem(SESSION_SYMPLA_TOKEN_KEY) || '',
      ingresseKey: sessionStorage.getItem(SESSION_INGRESSE_KEY) || '',
    };
  } catch {
    return { symplaToken: '', ingresseKey: '' };
  }
}

export function saveSessionNightlifeCredentials(symplaToken: string, ingresseKey: string): void {
  try {
    if (symplaToken.trim()) {
      sessionStorage.setItem(SESSION_SYMPLA_TOKEN_KEY, symplaToken.trim());
    } else {
      sessionStorage.removeItem(SESSION_SYMPLA_TOKEN_KEY);
    }
    if (ingresseKey.trim()) {
      sessionStorage.setItem(SESSION_INGRESSE_KEY, ingresseKey.trim());
    } else {
      sessionStorage.removeItem(SESSION_INGRESSE_KEY);
    }
  } catch {
    // ignore sessionStorage failure
  }
}

function sweepEventsArray(
  events: NightlifeEvent[],
  nowMs: number = Date.now()
): { events: NightlifeEvent[]; promotedCount: number; expiredCount: number; changed: boolean } {
  let promotedCount = 0;
  let expiredCount = 0;
  let changed = false;
  const nowIso = new Date(nowMs).toISOString();

  const next = events.map((ev) => {
    const todayRio = getRioTodayIso(new Date(nowMs));
    const isPastDate = Boolean(ev.event_date && ev.event_date < todayRio);
    const endsMs = new Date(ev.ends_at).getTime();
    const isPastEnd = (!Number.isNaN(endsMs) && endsMs < nowMs) || isPastDate;

    if (
      isPastEnd &&
      (ev.curation_status === 'PUBLICADO' ||
        ev.curation_status === 'PROGRAMADO' ||
        ev.curation_status === 'PENDENTE')
    ) {
      expiredCount++;
      changed = true;
      return {
        ...ev,
        curation_status: 'EXPIRADO' as const,
        is_featured: false,
        updated_at: nowIso,
      };
    }

    if (ev.curation_status === 'PROGRAMADO' && ev.scheduled_publish_at) {
      const schedMs = new Date(ev.scheduled_publish_at).getTime();
      if (!Number.isNaN(schedMs) && schedMs <= nowMs) {
        const comp = checkNightlifeCompleteness(ev);
        if (comp.complete) {
          promotedCount++;
          changed = true;
          return {
            ...ev,
            curation_status: 'PUBLICADO' as const,
            approved_at: ev.approved_at || nowIso,
            updated_at: nowIso,
          };
        }
      }
    }

    return ev;
  });

  return { events: next, promotedCount, expiredCount, changed };
}

export async function runNightlifeLifecycleSweep(): Promise<{
  events: NightlifeEvent[];
  promotedCount: number;
  expiredCount: number;
}> {
  const local = readLocalNightlifeEvents();
  const swept = sweepEventsArray(local);
  if (swept.changed) {
    writeLocalNightlifeEvents(swept.events);
  }
  return {
    events: swept.events,
    promotedCount: swept.promotedCount,
    expiredCount: swept.expiredCount,
  };
}

export async function getAllNightlifeEvents(options: { runSweep?: boolean } = { runSweep: true }): Promise<NightlifeEvent[]> {
  if (options.runSweep !== false) {
    await runNightlifeLifecycleSweep();
  }

  let items = readLocalNightlifeEvents();

  // 1. Prioritize Server API (bypasses RLS with SUPABASE_SERVICE_ROLE_KEY)
  try {
    const res = await fetch('/api/nightlife?__action=admin-list', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const payload = (await res.json()) as {
        ok?: boolean;
        events?: NightlifeEvent[];
        storage?: string;
      };
      if (payload?.ok && Array.isArray(payload.events) && payload.events.length > 0) {
        const sweptRemote = sweepEventsArray(payload.events);
        items = deduplicateEventsList([...sweptRemote.events, ...items]);
        writeLocalNightlifeEvents(items);
        return [...items].sort((a, b) => {
          if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
          return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
        });
      }
    }
  } catch {
    // fallback seamlessly to direct client Supabase or localStorage
  }

  // 2. Direct client Supabase fallback
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('nightlife_events')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('starts_at', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const sweptRemote = sweepEventsArray(data as NightlifeEvent[]);
        items = deduplicateEventsList([...sweptRemote.events, ...items]);
        writeLocalNightlifeEvents(items);
      }
    } catch {
      // keep local fallback seamlessly
    }
  }

  const hasRooftops = items.some(
    (ev) => ev.sub_area === 'ROOFTOPS_EXPERIENCIAS' && ev.curation_status === 'PUBLICADO'
  );
  if (!hasRooftops) {
    items = deduplicateEventsList([...items, ...buildStarterCuratedNightlifeEvents()]);
  }

  items = deduplicateEventsList(items);
  writeLocalNightlifeEvents(items);
  return [...items].sort((a, b) => {
    if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
  });
}

export async function clearAllNightlifeEvents(): Promise<void> {
  writeLocalNightlifeEvents([]);
  writeLocalIngestionRuns([]);

  // 1. Delete on Serverless Supabase
  try {
    await fetch('/api/nightlife?__action=admin-mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear-all' }),
    });
  } catch {
    // fallback
  }

  // 2. Client supabase delete fallback
  if (supabase) {
    try {
      await supabase
        .from('nightlife_events')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    } catch {
      // ignore remote delete failure
    }
  }
}

export async function getPublishedNightlifeEvents(): Promise<NightlifeEvent[]> {
  const all = await getAllNightlifeEvents({ runSweep: true });
  const now = new Date();
  return all.filter((ev) => isEventVisiblePublicly(ev, now));
}

export async function getIngestionRuns(): Promise<NightlifeIngestionRun[]> {
  // 1. Try server runs
  try {
    const res = await fetch('/api/nightlife?__action=admin-mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-runs' }),
    });
    if (res.ok) {
      const payload = (await res.json()) as { ok?: boolean; runs?: NightlifeIngestionRun[] };
      if (payload?.ok && Array.isArray(payload.runs) && payload.runs.length > 0) {
        return payload.runs;
      }
    }
  } catch {
    // fallback
  }

  // 2. Client Supabase fallback
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('nightlife_ingestion_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      if (!error && Array.isArray(data) && data.length > 0) {
        return data as NightlifeIngestionRun[];
      }
    } catch {
      // fallback local
    }
  }
  return readLocalIngestionRuns();
}

async function appendIngestionRun(runInput: Omit<NightlifeIngestionRun, 'id' | 'created_at'>): Promise<NightlifeIngestionRun> {
  const run: NightlifeIngestionRun = {
    ...runInput,
    id: generateUUID(),
    created_at: new Date().toISOString(),
  };

  // 1. Serverless service role insert
  try {
    await fetch('/api/nightlife?__action=admin-mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'append-run', run }),
    });
  } catch {
    // fallback
  }

  // 2. Client supabase insert fallback
  if (supabase) {
    try {
      await supabase.from('nightlife_ingestion_runs').insert(run);
    } catch {
      // ignore if anonymous RLS blocks insert
    }
  }

  const runs = [run, ...readLocalIngestionRuns()];
  writeLocalIngestionRuns(runs);
  return run;
}

function hydrateDraftToEvent(
  draft: NightlifeEventDraft,
  permanentVenues: Restaurant[] = [],
  forcedStatus?: NightlifeCurationStatus
): NightlifeEvent {
  const nowIso = new Date().toISOString();
  const cleanTitle = draft.title.trim();
  const matchedVenue =
    !draft.venue_id && permanentVenues.length > 0
      ? matchPermanentVenueId(draft.venue_name, draft.neighborhood, permanentVenues)
      : null;

  const venueName = (matchedVenue?.name || draft.venue_name || 'Local a confirmar').trim();
  const neighborhood = (matchedVenue?.neighborhood || draft.neighborhood || 'Rio de Janeiro').trim();
  const address = (matchedVenue?.address || draft.address || `${neighborhood}, Rio de Janeiro - RJ`).trim();
  const startTime = normalizeTimeHHmm(draft.start_time, '22:00');
  const endTime = draft.end_time ? normalizeTimeHHmm(draft.end_time, '') : undefined;
  const { startsAtIso, endsAtIso } = buildStartEndIsoRio(draft.event_date, startTime, endTime);

  const safeCover = sanitizeStoredCoverUrl(draft.cover_image);
  const imageOrigin = safeCover
    ? draft.image_origin === 'NONE'
      ? 'PRODUCER_AUTHORIZED'
      : draft.image_origin
    : draft.image_origin === 'ILLUSTRATIVE_CATEGORY_FALLBACK'
      ? 'ILLUSTRATIVE_CATEGORY_FALLBACK'
      : 'NONE';

  const status: NightlifeCurationStatus = forcedStatus ?? draft.curation_status ?? 'PENDENTE';
  const summary =
    draft.short_summary?.trim() ||
    buildOriginalEditorialSummary('', venueName, neighborhood, draft.sub_area);

  return {
    ...draft,
    id: draft.id || generateUUID(),
    external_key:
      draft.external_key?.trim() ||
      `${draft.source_platform.toLowerCase()}:${draft.event_date}:${slugify(cleanTitle).slice(0, 28)}:${Date.now().toString(36)}`,
    dedup_hash: computeNightlifeDedupHash({
      title: cleanTitle,
      venue_name: venueName,
      event_date: draft.event_date,
    }),
    slug: slugify(`${cleanTitle}-${draft.event_date}-${neighborhood}`) || `evento-${Date.now()}`,
    title: cleanTitle,
    short_summary: summary,
    venue_id: draft.venue_id || matchedVenue?.id,
    venue_name: venueName,
    neighborhood,
    address,
    latitude: draft.latitude ?? matchedVenue?.latitude,
    longitude: draft.longitude ?? matchedVenue?.longitude,
    start_time: startTime,
    end_time: endTime,
    starts_at: draft.starts_at || startsAtIso,
    ends_at: draft.ends_at || endsAtIso,
    cover_image: safeCover,
    image_origin: imageOrigin,
    curation_status: status,
    last_verified_at: nowIso,
    is_featured: Boolean(draft.is_featured),
    is_demonstrative: false,
    music_genres: Array.isArray(draft.music_genres) ? draft.music_genres : [],
    moment_tags: Array.isArray(draft.moment_tags) && draft.moment_tags.length > 0 ? draft.moment_tags : ['friends'],
    lineup: Array.isArray(draft.lineup) ? draft.lineup : [],
    alternate_ticket_urls: Array.isArray(draft.alternate_ticket_urls)
      ? draft.alternate_ticket_urls
      : [],
    created_at: nowIso,
    updated_at: nowIso,
  };
}

async function persistUpsertEvents(eventsToSave: NightlifeEvent[]): Promise<void> {
  if (eventsToSave.length === 0) return;

  // 1. Send to serverless API with SUPABASE_SERVICE_ROLE_KEY bypass
  try {
    const res = await fetch('/api/nightlife?__action=admin-mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert-events',
        events: eventsToSave,
      }),
    });
    if (res.ok) {
      return;
    }
  } catch {
    // server endpoint unreachable, fallback to client-side supabase
  }

  // 2. Client supabase fallback
  if (supabase) {
    try {
      await supabase
        .from('nightlife_events')
        .upsert(eventsToSave, { onConflict: 'external_key' });
    } catch {
      // keep local store synced seamlessly
    }
  }
}

export async function ingestNightlifeBatch(params: {
  drafts: NightlifeEventDraft[];
  sourceCode: string;
  sourcePlatform: NightlifeSourcePlatform;
  triggerType?: 'MANUAL' | 'CRON' | 'PARTNER_SUBMIT';
  permanentVenues?: Restaurant[];
  allowDirectPublishIfComplete?: boolean;
}): Promise<{
  insertedPending: number;
  dedupedUpdated: number;
  total: number;
  run: NightlifeIngestionRun;
  events: NightlifeEvent[];
}> {
  const existing = readLocalNightlifeEvents();
  const working = [...existing];
  const touched: NightlifeEvent[] = [];

  let insertedPending = 0;
  let dedupedUpdated = 0;
  const nowIso = new Date().toISOString();

  const todayRio = getRioTodayIso();

  for (const draft of params.drafts) {
    if (!draft.title?.trim()) continue;

    draft.title = cleanEventTitle(draft.title);
    draft.short_summary = decodeHtmlEntities(draft.short_summary);
    draft.venue_name = decodeHtmlEntities(draft.venue_name);
    draft.neighborhood = decodeHtmlEntities(draft.neighborhood);
    draft.address = decodeHtmlEntities(draft.address);

    // Discard past events - strictly future/current only
    if (draft.event_date && draft.event_date < todayRio) {
      continue;
    }

    // Auto-infer venue and neighborhood if missing or unconfirmed
    if (
      !draft.venue_name ||
      draft.venue_name.trim().length < 2 ||
      draft.venue_name.trim().toLowerCase() === 'local a confirmar'
    ) {
      const inf = inferVenueAndNeighborhood(
        draft.title,
        draft.short_summary,
        draft.source_url
      );
      if (inf) {
        draft.venue_name = inf.venue_name;
        if (!draft.neighborhood || draft.neighborhood === 'Rio de Janeiro') {
          draft.neighborhood = inf.neighborhood;
        }
      }
    }

    const dupMatch = findDuplicateNightlifeEvent(draft, working);

    if (dupMatch) {
      const idx = working.findIndex((e) => e.id === dupMatch.existing.id);
      if (idx !== -1) {
        const cur = working[idx];
        const altLinks: AlternateTicketLink[] = [...(cur.alternate_ticket_urls || [])];
        if (
          draft.ticket_url &&
          draft.ticket_url !== cur.ticket_url &&
          !altLinks.some((a) => a.ticket_url === draft.ticket_url)
        ) {
          altLinks.push({
            source_platform: draft.source_platform,
            ticket_url: draft.ticket_url,
            price_label: draft.price_display_label,
            last_seen_at: nowIso,
          });
        }

        const safeIncomingCover = sanitizeStoredCoverUrl(draft.cover_image);
        const updatedRecord: NightlifeEvent = {
          ...cur,
          alternate_ticket_urls: altLinks,
          last_verified_at: nowIso,
          availability_status: draft.availability_status || cur.availability_status,
          cover_image: cur.cover_image || safeIncomingCover,
          image_origin:
            cur.cover_image || !safeIncomingCover ? cur.image_origin : draft.image_origin,
          updated_at: nowIso,
        };
        working[idx] = updatedRecord;
        touched.push(updatedRecord);
        dedupedUpdated++;
      }
      continue;
    }

    // Regra obrigatória: captura externa / envio de parceiro SEMPRE entra em PENDENTE.
    // Somente MANUAL_ADMIN explicitamente autorizado e completo pode publicar direto.
    let status: NightlifeCurationStatus = 'PENDENTE';
    if (
      params.allowDirectPublishIfComplete &&
      draft.source_platform === 'MANUAL_ADMIN' &&
      draft.curation_status === 'PUBLICADO' &&
      checkNightlifeCompleteness(draft).complete
    ) {
      status = 'PUBLICADO';
    }

    const created = hydrateDraftToEvent(draft, params.permanentVenues || [], status);
    if (status === 'PUBLICADO') {
      created.approved_at = nowIso;
      created.approved_by_label = 'Admin BoraRio';
    }

    working.unshift(created);
    touched.push(created);
    insertedPending++;
  }

  writeLocalNightlifeEvents(working);
  await persistUpsertEvents(touched);

  const run = await appendIngestionRun({
    source_code: params.sourceCode,
    source_platform: params.sourcePlatform,
    trigger_type: params.triggerType || 'MANUAL',
    fetched_count: params.drafts.length,
    queued_pending_count: insertedPending,
    deduped_count: dedupedUpdated,
    updated_count: dedupedUpdated,
    expired_count: 0,
    error_count: 0,
    summary: `${params.drafts.length} lido(s): ${insertedPending} novo(s) na fila PENDENTE, ${dedupedUpdated} deduplicado(s)/mesclado(s).`,
  });

  return {
    insertedPending,
    dedupedUpdated,
    total: working.length,
    run,
    events: working,
  };
}

export async function approveAndPublishNightlifeEvent(
  id: string,
  patch: Partial<NightlifeEvent> = {},
  reviewerLabel = 'Curadoria BoraRio'
): Promise<
  | { ok: true; event: NightlifeEvent }
  | { ok: false; error: string; completeness: NightlifeCompletenessCheck }
> {
  const existing = readLocalNightlifeEvents();
  const idx = existing.findIndex((e) => e.id === id);
  if (idx === -1) {
    return {
      ok: false,
      error: 'Evento não encontrado na base de curadoria.',
      completeness: { complete: false, missing_fields: ['Registro não encontrado'], warnings: [] },
    };
  }

  const prev = existing[idx];
  const mergedDate = patch.event_date || prev.event_date;
  const mergedStart = patch.start_time ? normalizeTimeHHmm(patch.start_time, prev.start_time) : prev.start_time;
  const mergedEnd = patch.end_time !== undefined ? patch.end_time : prev.end_time;
  const { startsAtIso, endsAtIso } = buildStartEndIsoRio(mergedDate, mergedStart, mergedEnd);
  const nowIso = new Date().toISOString();

  const candidate: NightlifeEvent = {
    ...prev,
    ...patch,
    event_date: mergedDate,
    start_time: mergedStart,
    end_time: mergedEnd,
    starts_at: patch.starts_at || startsAtIso,
    ends_at: patch.ends_at || endsAtIso,
    cover_image:
      patch.cover_image !== undefined
        ? sanitizeStoredCoverUrl(patch.cover_image)
        : prev.cover_image,
    updated_at: nowIso,
  };

  if (!candidate.cover_image && candidate.image_origin === 'NONE') {
    candidate.image_origin = 'ILLUSTRATIVE_CATEGORY_FALLBACK';
    candidate.image_license_note =
      candidate.image_license_note || 'Identidade visual editorial da subárea no BoraRio.';
  }

  const todayRio = getRioTodayIso();
  if (candidate.event_date && candidate.event_date < todayRio) {
    return {
      ok: false,
      error: 'Não é possível publicar eventos com data passada. O BoraRio apresenta apenas eventos futuros ou de hoje.',
      completeness: { complete: false, missing_fields: ['Data do evento já expirada'], warnings: [] },
    };
  }

  // Auto-infer venue and neighborhood if missing or 'Local a confirmar'
  if (
    !candidate.venue_name ||
    candidate.venue_name.trim().length < 2 ||
    candidate.venue_name.trim().toLowerCase() === 'local a confirmar'
  ) {
    const inf = inferVenueAndNeighborhood(
      candidate.title,
      candidate.short_summary,
      candidate.source_url
    );
    if (inf) {
      candidate.venue_name = inf.venue_name;
      if (!candidate.neighborhood || candidate.neighborhood === 'Rio de Janeiro') {
        candidate.neighborhood = inf.neighborhood;
      }
      candidate.address =
        candidate.address && !candidate.address.includes('Local a confirmar')
          ? candidate.address
          : `${inf.venue_name}, ${inf.neighborhood}, Rio de Janeiro - RJ`;
    }
  }

  let completeness = checkNightlifeCompleteness(candidate);
  if (!completeness.complete && completeness.inferred_venue) {
    candidate.venue_name = completeness.inferred_venue.venue_name;
    if (!candidate.neighborhood || candidate.neighborhood === 'Rio de Janeiro') {
      candidate.neighborhood = completeness.inferred_venue.neighborhood;
    }
    completeness = checkNightlifeCompleteness(candidate);
  }

  if (!completeness.complete) {
    return {
      ok: false,
      error: `Publicação bloqueada — campos obrigatórios pendentes: ${completeness.missing_fields.join('; ')}.`,
      completeness,
    };
  }

  const published: NightlifeEvent = {
    ...candidate,
    dedup_hash: computeNightlifeDedupHash(candidate),
    slug: slugify(`${candidate.title}-${candidate.event_date}-${candidate.neighborhood}`),
    curation_status: 'PUBLICADO',
    approved_at: prev.approved_at || nowIso,
    approved_by_label: reviewerLabel,
    rejection_reason: undefined,
    last_verified_at: nowIso,
  };

  existing[idx] = published;
  writeLocalNightlifeEvents(existing);
  await persistUpsertEvents([published]);
  return { ok: true, event: published };
}

export async function scheduleNightlifeEvent(
  id: string,
  scheduledPublishIso: string,
  patch: Partial<NightlifeEvent> = {},
  reviewerLabel = 'Curadoria BoraRio'
): Promise<
  | { ok: true; event: NightlifeEvent }
  | { ok: false; error: string; completeness: NightlifeCompletenessCheck }
> {
  const existing = readLocalNightlifeEvents();
  const idx = existing.findIndex((e) => e.id === id);
  if (idx === -1) {
    return {
      ok: false,
      error: 'Evento não encontrado.',
      completeness: { complete: false, missing_fields: ['Registro não encontrado'], warnings: [] },
    };
  }

  const prev = existing[idx];
  const merged: NightlifeEvent = {
    ...prev,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  const completeness = checkNightlifeCompleteness(merged);
  if (!completeness.complete) {
    return {
      ok: false,
      error: `Agendamento bloqueado — campos obrigatórios pendentes: ${completeness.missing_fields.join('; ')}.`,
      completeness,
    };
  }

  const schedDate = new Date(scheduledPublishIso);
  if (Number.isNaN(schedDate.getTime())) {
    return {
      ok: false,
      error: 'Data/hora programada de publicação inválida.',
      completeness,
    };
  }

  const shouldPublishNow = schedDate.getTime() <= Date.now();
  const updated: NightlifeEvent = {
    ...merged,
    curation_status: shouldPublishNow ? 'PUBLICADO' : 'PROGRAMADO',
    scheduled_publish_at: schedDate.toISOString(),
    approved_by_label: reviewerLabel,
    approved_at: shouldPublishNow ? new Date().toISOString() : merged.approved_at,
  };

  existing[idx] = updated;
  writeLocalNightlifeEvents(existing);
  await persistUpsertEvents([updated]);
  return { ok: true, event: updated };
}

export async function updateNightlifeEvent(
  id: string,
  patch: Partial<NightlifeEvent>
): Promise<{ ok: true; event: NightlifeEvent } | { ok: false; error: string }> {
  const existing = readLocalNightlifeEvents();
  const idx = existing.findIndex((e) => e.id === id);
  if (idx === -1) return { ok: false, error: 'Evento não encontrado.' };

  const prev = existing[idx];
  const nextDate = patch.event_date || prev.event_date;
  const nextStart = patch.start_time ? normalizeTimeHHmm(patch.start_time, prev.start_time) : prev.start_time;
  const nextEnd = patch.end_time !== undefined ? patch.end_time : prev.end_time;
  const { startsAtIso, endsAtIso } = buildStartEndIsoRio(nextDate, nextStart, nextEnd);

  const next: NightlifeEvent = {
    ...prev,
    ...patch,
    event_date: nextDate,
    start_time: nextStart,
    end_time: nextEnd,
    starts_at: patch.starts_at || startsAtIso,
    ends_at: patch.ends_at || endsAtIso,
    cover_image:
      patch.cover_image !== undefined ? sanitizeStoredCoverUrl(patch.cover_image) : prev.cover_image,
    updated_at: new Date().toISOString(),
  };

  next.dedup_hash = computeNightlifeDedupHash(next);
  next.slug = slugify(`${next.title}-${next.event_date}-${next.neighborhood}`);

  existing[idx] = next;
  writeLocalNightlifeEvents(existing);
  await persistUpsertEvents([next]);
  return { ok: true, event: next };
}

export async function rejectNightlifeEvent(id: string, reason: string): Promise<void> {
  await updateNightlifeEvent(id, {
    curation_status: 'REJEITADO',
    rejection_reason: reason.trim() || 'Rejeitado na revisão curatorial.',
    is_featured: false,
  });
}

export async function cancelNightlifeEvent(id: string, reason?: string): Promise<void> {
  await updateNightlifeEvent(id, {
    curation_status: 'CANCELADO',
    rejection_reason: reason?.trim() || 'Cancelado pela curadoria / produção.',
    is_featured: false,
  });
}

export async function setNightlifeAvailability(
  id: string,
  availability: NightlifeAvailabilityStatus
): Promise<void> {
  await updateNightlifeEvent(id, {
    availability_status: availability,
    last_verified_at: new Date().toISOString(),
  });
}

export async function toggleFeaturedNightlifeEvent(id: string): Promise<void> {
  const existing = readLocalNightlifeEvents();
  const target = existing.find((e) => e.id === id);
  if (!target) return;
  await updateNightlifeEvent(id, { is_featured: !target.is_featured });
}

export async function deleteNightlifeEvent(id: string): Promise<void> {
  const next = readLocalNightlifeEvents().filter((e) => e.id !== id);
  writeLocalNightlifeEvents(next);

  // 1. Delete on Serverless Supabase
  try {
    await fetch('/api/nightlife?__action=admin-mutate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-event', id }),
    });
  } catch {
    // fallback
  }

  // 2. Client supabase delete fallback
  if (supabase) {
    try {
      await supabase.from('nightlife_events').delete().eq('id', id);
    } catch {
      // ignore remote error if unauthenticated
    }
  }
}

export async function runManualRadarSweepAndLog(): Promise<{
  promotedCount: number;
  expiredCount: number;
  run: NightlifeIngestionRun;
}> {
  const { promotedCount, expiredCount, events } = await runNightlifeLifecycleSweep();
  const run = await appendIngestionRun({
    source_code: 'radar_lifecycle',
    source_platform: 'MANUAL_ADMIN',
    trigger_type: 'CRON',
    fetched_count: events.length,
    queued_pending_count: 0,
    deduped_count: 0,
    updated_count: promotedCount,
    expired_count: expiredCount,
    error_count: 0,
    summary: `Varredura temporal concluída: ${promotedCount} programado(s) publicado(s) e ${expiredCount} encerrado(s) movido(s) para EXPIRADO.`,
  });
  return { promotedCount, expiredCount, run };
}

export async function submitPartnerNightlifeEvent(
  input: {
    title: string;
    sub_area: NightlifeEventDraft['sub_area'];
    music_genres: string[];
    event_date: string;
    start_time: string;
    end_time?: string;
    is_free: boolean;
    price_min_brl?: number;
    ticket_url?: string;
    lineup: string[];
    short_summary: string;
    cover_image?: string;
    age_rating?: string;
  },
  venue: Restaurant
): Promise<{
  ok: boolean;
  message: string;
  deduped?: boolean;
}> {
  const { startsAtIso, endsAtIso } = buildStartEndIsoRio(
    input.event_date,
    input.start_time,
    input.end_time
  );
  const safeCover = sanitizeStoredCoverUrl(input.cover_image);

  const draft: NightlifeEventDraft = {
    external_key: `partner:${venue.id}:${input.event_date}:${slugify(input.title).slice(0, 24)}`,
    source_platform: 'PARTNER_PORTAL',
    title: input.title.trim(),
    short_summary:
      input.short_summary.trim() ||
      buildOriginalEditorialSummary('', venue.name, venue.neighborhood, input.sub_area),
    sub_area: input.sub_area,
    music_genres: input.music_genres.length > 0 ? input.music_genres : ['Ao Vivo'],
    moment_tags: ['friends', 'couple'],
    age_rating: input.age_rating || '18+',
    venue_id: venue.id,
    venue_name: venue.name,
    neighborhood: venue.neighborhood,
    address: venue.address,
    latitude: venue.latitude,
    longitude: venue.longitude,
    event_date: input.event_date,
    start_time: normalizeTimeHHmm(input.start_time, '21:00'),
    end_time: input.end_time ? normalizeTimeHHmm(input.end_time, '') : undefined,
    starts_at: startsAtIso,
    ends_at: endsAtIso,
    is_free: input.is_free,
    price_min_brl: input.is_free ? 0 : input.price_min_brl,
    price_display_label: input.is_free
      ? 'Entrada gratuita'
      : input.price_min_brl
        ? `A partir de R$ ${input.price_min_brl.toFixed(0)}`
        : 'Entrada / Couvert no local',
    ticket_url: input.ticket_url?.trim() || undefined,
    availability_status: input.is_free
      ? 'GRATUITO'
      : input.ticket_url?.trim()
        ? 'DISPONIVEL'
        : 'PORTA',
    lineup: input.lineup,
    cover_image: safeCover,
    image_origin: safeCover ? 'PARTNER_AUTHORIZED' : 'ILLUSTRATIVE_CATEGORY_FALLBACK',
    image_license_note: safeCover
      ? `Imagem enviada diretamente pelo estabelecimento parceiro (${venue.name}).`
      : 'Sem flyer enviado — visual editorial da subárea.',
    curation_status: 'PENDENTE',
    is_featured: false,
    is_demonstrative: false,
  };

  const res = await ingestNightlifeBatch({
    drafts: [draft],
    sourceCode: 'partner_portal',
    sourcePlatform: 'PARTNER_PORTAL',
    triggerType: 'PARTNER_SUBMIT',
    permanentVenues: [venue],
  });

  if (res.dedupedUpdated > 0) {
    return {
      ok: true,
      deduped: true,
      message:
        'Evento semelhante já existia nesta casa e data — dados e link atualizados sem duplicação na agenda!',
    };
  }

  return {
    ok: true,
    deduped: false,
    message:
      'Evento enviado com sucesso! Ele entrou na fila PENDENTE de curadoria do BoraRio antes da publicação na Home.',
  };
}

export async function extractNightlifeFromUrl(url: string): Promise<{
  ok: boolean;
  blockedByProtection?: boolean;
  platform?: NightlifeSourcePlatform;
  draft?: NightlifeEventDraft;
  error?: string;
}> {
  try {
    const res = await fetch('/api/nightlife?__action=parse-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim() }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      blocked_by_protection?: boolean;
      platform?: NightlifeSourcePlatform;
      draft?: NightlifeEventDraft;
      error?: string;
    };

    if (!res.ok || !data.draft) {
      const slugFallback = inferDraftFromUrlSlug(url);
      if (slugFallback && slugFallback.title) {
        const recoveredDraft: NightlifeEventDraft = {
          external_key: `url:recovered:${Buffer.from(url).toString('base64').slice(0, 24)}`,
          source_platform: data.platform || 'SYMPLA',
          source_url: url,
          title: slugFallback.title,
          short_summary:
            slugFallback.short_summary ||
            `Ingressos e programação oficial para ${slugFallback.title}.`,
          sub_area: 'SHOWS',
          music_genres: ['Ao Vivo'],
          moment_tags: ['friends', 'couple'],
          age_rating: '18+',
          venue_name: slugFallback.venue_name || 'Local a confirmar',
          neighborhood: slugFallback.neighborhood || 'Rio de Janeiro',
          address: `${slugFallback.venue_name || 'Local'}, ${slugFallback.neighborhood || 'Rio de Janeiro'}, Rio de Janeiro - RJ`,
          event_date: slugFallback.event_date || getRioTodayIso(),
          start_time: slugFallback.start_time || '20:00',
          starts_at: `${slugFallback.event_date || getRioTodayIso()}T20:00:00-03:00`,
          ends_at: `${slugFallback.event_date || getRioTodayIso()}T23:59:00-03:00`,
          is_free: false,
          price_display_label: 'Consultar lotes na fonte oficial',
          ticket_url: url,
          availability_status: 'DISPONIVEL',
          lineup: [],
          cover_image: '',
          image_origin: 'ILLUSTRATIVE_CATEGORY_FALLBACK',
          image_license_note: 'Visual editorial da subárea (extraído por metadados de URL).',
          is_featured: false,
          is_demonstrative: false,
        };
        return {
          ok: true,
          platform: data.platform || 'SYMPLA',
          draft: recoveredDraft,
        };
      }

      return {
        ok: false,
        blockedByProtection: Boolean(data.blocked_by_protection),
        platform: data.platform,
        error: data.error || `Servidor retornou HTTP ${res.status}.`,
      };
    }

    return {
      ok: true,
      platform: data.platform,
      draft: data.draft,
    };
  } catch (err) {
    const slugFallback = inferDraftFromUrlSlug(url);
    if (slugFallback && slugFallback.title) {
      const recoveredDraft: NightlifeEventDraft = {
        external_key: `url:recovered:${Buffer.from(url).toString('base64').slice(0, 24)}`,
        source_platform: 'SYMPLA',
        source_url: url,
        title: slugFallback.title,
        short_summary:
          slugFallback.short_summary ||
          `Ingressos e programação oficial para ${slugFallback.title}.`,
        sub_area: 'SHOWS',
        music_genres: ['Ao Vivo'],
        moment_tags: ['friends', 'couple'],
        age_rating: '18+',
        venue_name: slugFallback.venue_name || 'Local a confirmar',
        neighborhood: slugFallback.neighborhood || 'Rio de Janeiro',
        address: `${slugFallback.venue_name || 'Local'}, ${slugFallback.neighborhood || 'Rio de Janeiro'}, Rio de Janeiro - RJ`,
        event_date: slugFallback.event_date || getRioTodayIso(),
        start_time: slugFallback.start_time || '20:00',
        starts_at: `${slugFallback.event_date || getRioTodayIso()}T20:00:00-03:00`,
        ends_at: `${slugFallback.event_date || getRioTodayIso()}T23:59:00-03:00`,
        is_free: false,
        price_display_label: 'Consultar lotes na fonte oficial',
        ticket_url: url,
        availability_status: 'DISPONIVEL',
        lineup: [],
        cover_image: '',
        image_origin: 'ILLUSTRATIVE_CATEGORY_FALLBACK',
        image_license_note: 'Visual editorial da subárea (extraído por metadados de URL).',
        is_featured: false,
        is_demonstrative: false,
      };
      return {
        ok: true,
        platform: 'SYMPLA',
        draft: recoveredDraft,
      };
    }

    return {
      ok: false,
      error: `Falha ao chamar /api/nightlife (parse-url): ${
        err instanceof Error ? err.message : 'erro de rede'
      }`,
    };
  }
}

export async function syncSymplaNightlifeEvents(
  symplaToken?: string,
  city = 'Rio de Janeiro'
): Promise<{
  ok: boolean;
  drafts: NightlifeEventDraft[];
  rawCount: number;
  note?: string;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    if (symplaToken?.trim()) {
      headers['x-sympla-token'] = symplaToken.trim();
    }
    const res = await fetch(
      `/api/nightlife?__action=fetch-sympla&city=${encodeURIComponent(city)}`,
      { method: 'GET', headers }
    );
    const data = (await res.json()) as {
      ok?: boolean;
      raw_count?: number;
      drafts?: NightlifeEventDraft[];
      producer_scope_note?: string;
      error?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        drafts: [],
        rawCount: 0,
        error: data.error || `Sympla API HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      drafts: Array.isArray(data.drafts) ? data.drafts : [],
      rawCount: data.raw_count ?? 0,
      note: data.producer_scope_note,
    };
  } catch (err) {
    return {
      ok: false,
      drafts: [],
      rawCount: 0,
      error: `Erro ao sincronizar Sympla: ${err instanceof Error ? err.message : 'rede'}`,
    };
  }
}

export async function syncIngresseNightlifeEvents(
  ingresseKey?: string,
  city = 'Rio de Janeiro'
): Promise<{
  ok: boolean;
  drafts: NightlifeEventDraft[];
  rawCount: number;
  error?: string;
}> {
  try {
    const headers: Record<string, string> = {};
    if (ingresseKey?.trim()) {
      headers['x-ingresse-key'] = ingresseKey.trim();
    }
    const res = await fetch(
      `/api/nightlife?__action=fetch-ingresse&city=${encodeURIComponent(city)}`,
      { method: 'GET', headers }
    );
    const data = (await res.json()) as {
      ok?: boolean;
      raw_count?: number;
      drafts?: NightlifeEventDraft[];
      error?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        drafts: [],
        rawCount: 0,
        error: data.error || `Ingresse API HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      drafts: Array.isArray(data.drafts) ? data.drafts : [],
      rawCount: data.raw_count ?? 0,
    };
  } catch (err) {
    return {
      ok: false,
      drafts: [],
      rawCount: 0,
      error: `Erro ao sincronizar Ingresse: ${err instanceof Error ? err.message : 'rede'}`,
    };
  }
}

export async function syncRioturNightlifeEvents(params?: {
  mes?: number;
  ano?: number;
  syncMonths?: number;
  weekendOnly?: boolean;
}): Promise<{
  ok: boolean;
  rawCount: number;
  drafts: NightlifeEventDraft[];
  error?: string;
}> {
  try {
    const query = new URLSearchParams();
    if (params?.mes) query.set('mes', String(params.mes));
    if (params?.ano) query.set('ano', String(params.ano));
    if (params?.syncMonths) query.set('sync_months', String(params.syncMonths));
    if (params?.weekendOnly) query.set('weekend_only', 'true');

    const res = await fetch(`/api/nightlife?__action=fetch-riotur&${query.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const payload = (await res.json()) as {
      ok?: boolean;
      raw_count?: number;
      drafts?: NightlifeEventDraft[];
      error?: string;
    };

    if (!res.ok || !payload?.ok) {
      return {
        ok: false,
        rawCount: 0,
        drafts: [],
        error: payload?.error || `Falha ao sincronizar agenda da Riotur (HTTP ${res.status}).`,
      };
    }

    return {
      ok: true,
      rawCount: payload.raw_count || 0,
      drafts: Array.isArray(payload.drafts) ? payload.drafts : [],
    };
  } catch (err) {
    return {
      ok: false,
      rawCount: 0,
      drafts: [],
      error: `Erro de conexão ao sincronizar com Riotur: ${err instanceof Error ? err.message : 'falha de rede'}`,
    };
  }
}

export async function extractNightlifeFromUrls(urls: string[]): Promise<{
  ok: boolean;
  totalRequested: number;
  successCount: number;
  drafts: NightlifeEventDraft[];
  errors: Array<{ url: string; error: string }>;
  error?: string;
}> {
  try {
    const res = await fetch('/api/nightlife?__action=parse-urls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ urls }),
    });

    const payload = (await res.json()) as {
      ok?: boolean;
      total_requested?: number;
      success_count?: number;
      drafts?: NightlifeEventDraft[];
      errors?: Array<{ url: string; error: string }>;
      error?: string;
    };

    if (!res.ok || !payload?.ok) {
      return {
        ok: false,
        totalRequested: urls.length,
        successCount: 0,
        drafts: [],
        errors: [],
        error: payload?.error || `Falha na extração do lote de URLs (HTTP ${res.status}).`,
      };
    }

    return {
      ok: true,
      totalRequested: payload.total_requested || urls.length,
      successCount: payload.success_count || 0,
      drafts: Array.isArray(payload.drafts) ? payload.drafts : [],
      errors: Array.isArray(payload.errors) ? payload.errors : [],
    };
  } catch (err) {
    return {
      ok: false,
      totalRequested: urls.length,
      successCount: 0,
      drafts: [],
      errors: [],
      error: `Erro de conexão ao processar lote: ${err instanceof Error ? err.message : 'falha de rede'}`,
    };
  }
}

export async function getNightlifeCloudStatus(): Promise<{
  configured: boolean;
  storage: 'supabase' | 'local_only' | 'error';
  message: string;
}> {
  try {
    const res = await fetch('/api/nightlife?__action=admin-list', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = (await res.json()) as { ok?: boolean; storage?: string; message?: string };
      if (data.storage === 'supabase') {
        return {
          configured: true,
          storage: 'supabase',
          message: 'Conectado à nuvem Supabase (Sincronização Global ativa).',
        };
      }
      return {
        configured: false,
        storage: 'local_only',
        message: data.message || 'Armazenamento local ativo. Configure SUPABASE_SERVICE_ROLE_KEY na Vercel.',
      };
    }
  } catch {
    // network error
  }
  return {
    configured: false,
    storage: 'local_only',
    message: 'Servidor inacessível no momento (operando em cache local).',
  };
}

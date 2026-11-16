import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  NightlifeAvailabilityStatus,
  NightlifeEvent,
  NightlifeEventDraft,
  NightlifeIngestionRun,
  NightlifeSourcePlatform,
  NightlifeSubArea,
} from '../src/types/nightlife.ts';

const ALLOWED_TICKETING_HOSTS = [
  'sympla.com.br',
  'www.sympla.com.br',
  'bileto.sympla.com.br',
  'ingresse.com',
  'www.ingresse.com',
  'shotgun.live',
  'www.shotgun.live',
  'eventbrite.com',
  'www.eventbrite.com',
  'eventbrite.com.br',
  'www.eventbrite.com.br',
  'eventim.com.br',
  'www.eventim.com.br',
  'ticketmaster.com.br',
  'www.ticketmaster.com.br',
  'ticket360.com.br',
  'www.ticket360.com.br',
  'circovoador.com.br',
  'www.circovoador.com.br',
  'rioscenarium.com.br',
  'www.rioscenarium.com.br',
  'agendario.com',
  'www.agendario.com',
  'tasendo.com.br',
  'www.tasendo.com.br',
  'riotur.rio',
  'www.riotur.rio',
  'riotur.prefeitura.rio',
  'visitrio.com.br',
  'www.visitrio.com.br',
];

const ALLOWED_IMAGE_CDN_HOSTS = [
  ...ALLOWED_TICKETING_HOSTS,
  'images.sympla.com.br',
  'cdn.sympla.com.br',
  'cdn.ingresse.com',
  'images.ingresse.com',
  's3.amazonaws.com',
  'shotgun-media.s3.amazonaws.com',
  'img.evbuc.com',
  'riotur.rio',
  'www.riotur.rio',
  'visitrio.com.br',
];

const MAX_HTML_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function isAllowedHost(hostname: string, allowlist: string[]): boolean {
  const h = hostname.toLowerCase();
  return allowlist.some((allowed) => h === allowed || h.endsWith(`.${allowed}`));
}

function validateSafeHttpsUrl(raw: string, allowlist: string[]): URL | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'https:') return null;
    if (parsed.port || parsed.username || parsed.password) return null;
    // Block literal IPs / localhost
    if (
      parsed.hostname === 'localhost' ||
      /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname) ||
      parsed.hostname.includes(':')
    ) {
      return null;
    }
    if (!isAllowedHost(parsed.hostname, allowlist)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function detectPlatformFromHost(hostname: string): NightlifeSourcePlatform {
  const h = hostname.toLowerCase();
  if (h.includes('sympla')) return 'SYMPLA';
  if (h.includes('ingresse')) return 'INGRESSE';
  if (h.includes('shotgun')) return 'SHOTGUN';
  if (h.includes('eventbrite')) return 'EVENTBRITE';
  if (h.includes('eventim')) return 'EVENTIM';
  if (h.includes('ticketmaster')) return 'TICKETMASTER';
  if (h.includes('ticket360')) return 'TICKET360';
  if (h.includes('tasendo')) return 'TA_SENDO';
  if (h.includes('agendario')) return 'AGENDA_RIO';
  if (h.includes('riotur')) return 'RIOTUR';
  if (h.includes('visitrio')) return 'VISIT_RIO';
  return 'MANUAL_ADMIN';
}

function inferSubAreaAndGenres(text: string): {
  subArea: NightlifeSubArea;
  genres: string[];
} {
  const lower = text.toLowerCase();
  const genres: string[] = [];
  if (lower.includes('samba')) genres.push('Samba');
  if (lower.includes('pagode')) genres.push('Pagode');
  if (lower.includes('funk')) genres.push('Funk');
  if (lower.includes('eletrôn') || lower.includes('eletron') || lower.includes('techno') || lower.includes('house'))
    genres.push('Eletrônico');
  if (lower.includes('jazz')) genres.push('Jazz');
  if (lower.includes('mpb')) genres.push('MPB');
  if (lower.includes('rock')) genres.push('Rock');
  if (lower.includes('rap') || lower.includes('trap') || lower.includes('hip hop')) genres.push('Rap');
  if (lower.includes('forró') || lower.includes('forro')) genres.push('Forró');
  if (lower.includes('afrobeat')) genres.push('Afrobeat');

  if (lower.includes('samba') || lower.includes('pagode') || lower.includes('roda de')) {
    return {
      subArea: 'SAMBA_PAGODE',
      genres: genres.length ? genres : ['Samba', 'Pagode'],
    };
  }
  if (lower.includes('rooftop') || lower.includes('sunset') || lower.includes('terraço') || lower.includes('jazz')) {
    return {
      subArea: 'ROOFTOPS_EXPERIENCIAS',
      genres: genres.length ? genres : ['Lounge', 'Sunset'],
    };
  }
  if (
    lower.includes('show') ||
    lower.includes('turnê') ||
    lower.includes('concert') ||
    lower.includes('ao vivo') ||
    lower.includes('circo voador') ||
    lower.includes('fundição') ||
    lower.includes('festival')
  ) {
    return {
      subArea: 'SHOWS',
      genres: genres.length ? genres : ['MPB', 'Ao Vivo'],
    };
  }
  return {
    subArea: 'FESTAS_BALADAS',
    genres: genres.length ? genres : ['Festa', 'DJ Set'],
  };
}

const KNOWN_NEIGHBORHOODS = [
  'Lapa',
  'Centro',
  'Botafogo',
  'Copacabana',
  'Ipanema',
  'Leblon',
  'Santa Teresa',
  'Gávea',
  'Jardim Botânico',
  'Urca',
  'Flamengo',
  'Glória',
  'Lagoa',
  'Barra da Tijuca',
  'Recreio',
  'São Conrado',
  'Santo Cristo',
  'Saúde',
  'Gamboa',
  'Tijuca',
  'Madureira',
  'Laranjeiras',
  'Humaitá',
  'Arpoador',
  'Leme',
];

function extractNeighborhood(rawText: string): string {
  const lower = rawText.toLowerCase();
  for (const b of KNOWN_NEIGHBORHOODS) {
    if (lower.includes(b.toLowerCase())) return b;
  }
  if (lower.includes('pedra do sal')) return 'Saúde';
  if (lower.includes('porto maravilha') || lower.includes('cais')) return 'Santo Cristo';
  if (lower.includes('marina da glória') || lower.includes('mam')) return 'Glória';
  return 'Rio de Janeiro';
}

function summarizeCleanly(rawDesc: string, venueName: string, neighborhood: string): string {
  const stripped = rawDesc
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) {
    return `Programação noturna em ${venueName} (${neighborhood}). Confira horários e condições na fonte oficial.`;
  }
  const firstSentence = stripped.split(/(?<=[.!?])\s+/)[0] || stripped;
  return firstSentence.length > 180 ? `${firstSentence.slice(0, 177).trim()}...` : firstSentence;
}

function extractMetaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re1 = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
    'i'
  );
  const match = html.match(re1) || html.match(re2);
  return match?.[1]?.trim() || '';
}

function parseIsoToRioParts(rawDate?: string): {
  eventDate: string;
  startTime: string;
  startsAtIso: string;
  endsAtIso: string;
} {
  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() + 1);
  fallbackDate.setHours(22, 0, 0, 0);

  let parsed = rawDate ? new Date(rawDate) : fallbackDate;
  if (Number.isNaN(parsed.getTime())) {
    parsed = fallbackDate;
  }

  let eventDate = parsed.toISOString().slice(0, 10);
  let startTime = '22:00';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(parsed);
    const map = new Map(parts.map((p) => [p.type, p.value]));
    const y = map.get('year');
    const m = map.get('month');
    const d = map.get('day');
    const h = map.get('hour');
    const min = map.get('minute');
    if (y && m && d) eventDate = `${y}-${m}-${d}`;
    if (h && min) startTime = `${h === '24' ? '00' : h}:${min}`;
  } catch {
    // keep ISO fallback
  }

  const endParsed = new Date(parsed.getTime() + 6 * 3600 * 1000);
  return {
    eventDate,
    startTime,
    startsAtIso: parsed.toISOString(),
    endsAtIso: endParsed.toISOString(),
  };
}

function parseJsonLdEvents(html: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const rawJson = match[1]?.trim();
    if (!rawJson) continue;
    try {
      const parsed = JSON.parse(rawJson) as unknown;
      const nodes = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { '@graph'?: unknown[] })['@graph'])
          ? (parsed as { '@graph': unknown[] })['@graph']
          : [parsed];
      for (const node of nodes) {
        if (!node || typeof node !== 'object') continue;
        const typeVal = String((node as Record<string, unknown>)['@type'] || '');
        if (/Event/i.test(typeVal)) {
          out.push(node as Record<string, unknown>);
        }
      }
    } catch {
      // ignore invalid JSON-LD blocks
    }
  }
  return out;
}

function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function handleAdminList(): Promise<Response> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return jsonResponse(200, {
      ok: true,
      events: [],
      storage: 'local_only',
      message: 'SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL não configuradas no servidor Vercel.',
    });
  }
  try {
    const { data, error } = await supabase
      .from('nightlife_events')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('starts_at', { ascending: true });

    if (error) {
      return jsonResponse(500, {
        ok: false,
        error: error.message,
        storage: 'error',
      });
    }

    return jsonResponse(200, {
      ok: true,
      events: data || [],
      count: (data || []).length,
      storage: 'supabase',
    });
  } catch (err) {
    return jsonResponse(502, {
      ok: false,
      error: err instanceof Error ? err.message : 'Falha ao consultar banco Supabase.',
    });
  }
}

async function handleGetPublished(): Promise<Response> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return jsonResponse(200, { ok: true, events: [], storage: 'local_only' });
  }
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('nightlife_events')
      .select('*')
      .in('curation_status', ['PUBLICADO', 'PROGRAMADO'])
      .gte('ends_at', nowIso)
      .order('is_featured', { ascending: false })
      .order('starts_at', { ascending: true });

    if (error) {
      return jsonResponse(500, { ok: false, error: error.message });
    }
    return jsonResponse(200, { ok: true, events: data || [], storage: 'supabase' });
  } catch (err) {
    return jsonResponse(502, {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro ao obter eventos publicados.',
    });
  }
}

async function handleAdminMutate(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Método POST obrigatório para mutações.' });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return jsonResponse(503, {
      ok: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_URL não configuradas no servidor Vercel. Operação persistida apenas no navegador.',
      storage: 'local_only',
    });
  }

  try {
    const body = (await request.json()) as {
      action?: string;
      events?: NightlifeEvent[];
      id?: string;
      run?: NightlifeIngestionRun;
    };

    const mutationAction = body?.action;

    if (mutationAction === 'upsert-events') {
      const events = Array.isArray(body?.events) ? body.events : [];
      if (events.length === 0) {
        return jsonResponse(200, { ok: true, count: 0, storage: 'supabase' });
      }

      // Supabase upsert in batches of 50
      const chunkSize = 50;
      let insertedCount = 0;
      for (let i = 0; i < events.length; i += chunkSize) {
        const chunk = events.slice(i, i + chunkSize);
        const { error } = await supabase
          .from('nightlife_events')
          .upsert(chunk, { onConflict: 'external_key' });
        if (error) {
          return jsonResponse(500, { ok: false, error: error.message, chunk_index: i });
        }
        insertedCount += chunk.length;
      }

      return jsonResponse(200, {
        ok: true,
        count: insertedCount,
        storage: 'supabase',
      });
    }

    if (mutationAction === 'delete-event') {
      const id = body?.id;
      if (!id) {
        return jsonResponse(400, { ok: false, error: 'ID do evento é obrigatório.' });
      }
      const { error } = await supabase
        .from('nightlife_events')
        .delete()
        .eq('id', id);

      if (error) {
        return jsonResponse(500, { ok: false, error: error.message });
      }
      return jsonResponse(200, { ok: true, id, storage: 'supabase' });
    }

    if (mutationAction === 'clear-all') {
      const { error } = await supabase
        .from('nightlife_events')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        return jsonResponse(500, { ok: false, error: error.message });
      }
      return jsonResponse(200, { ok: true, storage: 'supabase' });
    }

    if (mutationAction === 'append-run') {
      const run = body?.run;
      if (!run) {
        return jsonResponse(400, { ok: false, error: 'Dados da run de ingestão são obrigatórios.' });
      }
      const { error } = await supabase
        .from('nightlife_ingestion_runs')
        .insert(run);

      if (error) {
        return jsonResponse(200, { ok: true, warning: error.message, storage: 'partial' });
      }
      return jsonResponse(200, { ok: true, run, storage: 'supabase' });
    }

    if (mutationAction === 'get-runs') {
      const { data, error } = await supabase
        .from('nightlife_ingestion_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        return jsonResponse(200, { ok: true, runs: [] });
      }
      return jsonResponse(200, { ok: true, runs: data || [], storage: 'supabase' });
    }

    return jsonResponse(400, {
      ok: false,
      error: `Ação de mutação '${mutationAction}' não reconhecida.`,
    });
  } catch (err) {
    return jsonResponse(500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Erro interno ao processar mutação administrativa.',
    });
  }
}

interface ParseUrlResult {
  ok: boolean;
  status?: number;
  platform?: NightlifeSourcePlatform;
  has_structured_jsonld?: boolean;
  draft?: NightlifeEventDraft;
  error?: string;
  blocked_by_protection?: boolean;
  code?: string;
  source_url?: string;
}

async function handleParseUrlCore(targetRaw: string): Promise<ParseUrlResult> {
  const safeUrl = validateSafeHttpsUrl(targetRaw, ALLOWED_TICKETING_HOSTS);
  if (!safeUrl) {
    return {
      ok: false,
      status: 400,
      error:
        'URL não autorizada ou inválida. Use links HTTPS de plataformas de eventos permitidas (Sympla, Ingresse, Shotgun, Eventbrite, Eventim, Ticketmaster, Riotur ou casas parceiras).',
    };
  }

  const platform = detectPlatformFromHost(safeUrl.hostname);

  try {
    const res = await fetch(safeUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'BoraRioNightlifeCurator/1.0 (+https://borario-beta.vercel.app)',
      },
    });

    if (res.url && !validateSafeHttpsUrl(res.url, ALLOWED_TICKETING_HOSTS)) {
      return { ok: false, status: 403, error: 'Redirecionamento externo fora da allowlist de eventos.' };
    }

    const htmlText = (await res.text()).slice(0, MAX_HTML_BYTES);
    const lowerHtml = htmlText.toLowerCase();

    if (
      res.status === 403 ||
      res.status === 429 ||
      lowerHtml.includes('cf-turnstile') ||
      lowerHtml.includes('g-recaptcha') ||
      lowerHtml.includes('verify you are human') ||
      lowerHtml.includes('attention required! | cloudflare')
    ) {
      return {
        ok: false,
        status: 422,
        blocked_by_protection: true,
        code: 'EXTRACTION_BLOCKED_MANUAL_REQUIRED',
        platform,
        source_url: safeUrl.toString(),
        error:
          'Esta página possui proteção anti-bot/CAPTCHA ativa. O BoraRio nunca burla proteções externas — preencha os campos do evento manualmente na fila de curadoria.',
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status >= 400 ? res.status : 502,
        error: `A origem retornou HTTP ${res.status}.`,
      };
    }

    const jsonLdEvents = parseJsonLdEvents(htmlText);
    const ev = jsonLdEvents[0];

    const ogTitle = extractMetaContent(htmlText, 'og:title');
    const titleTagMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const rawTitle = String(ev?.name || ogTitle || titleTagMatch?.[1] || '').trim();

    if (!rawTitle) {
      return {
        ok: false,
        status: 422,
        code: 'INCOMPLETE_METADATA',
        error: 'Não foi possível localizar título estruturado (JSON-LD/OpenGraph) nesta página.',
      };
    }

    const rawDesc = String(
      ev?.description || extractMetaContent(htmlText, 'og:description') || ''
    );
    const locationObj = (ev?.location && typeof ev.location === 'object'
      ? ev.location
      : {}) as Record<string, unknown>;
    const addrObj = (locationObj.address && typeof locationObj.address === 'object'
      ? locationObj.address
      : {}) as Record<string, unknown>;

    const venueName = String(locationObj.name || 'Local a confirmar').trim();
    const rawAddress = [
      addrObj.streetAddress,
      addrObj.addressLocality,
      addrObj.addressRegion,
    ]
      .filter(Boolean)
      .join(', ');
    const neighborhood = extractNeighborhood(`${rawAddress} ${rawTitle} ${venueName} ${rawDesc}`);

    const startDateRaw = String(
      ev?.startDate || extractMetaContent(htmlText, 'event:start_time') || ''
    );
    const { eventDate, startTime, startsAtIso, endsAtIso } = parseIsoToRioParts(startDateRaw);

    const offersRaw = Array.isArray(ev?.offers)
      ? (ev?.offers[0] as Record<string, unknown>)
      : ((ev?.offers || {}) as Record<string, unknown>);
    const rawPriceNum = Number(offersRaw?.price ?? offersRaw?.lowPrice ?? NaN);
    const isFree =
      ev?.isAccessibleForFree === true || (Number.isFinite(rawPriceNum) && rawPriceNum === 0);
    const priceMin = Number.isFinite(rawPriceNum) && rawPriceNum > 0 ? rawPriceNum : undefined;

    const availability: NightlifeAvailabilityStatus = isFree
      ? 'GRATUITO'
      : String(offersRaw?.availability || '').includes('SoldOut')
        ? 'ESGOTADO'
        : 'DISPONIVEL';

    const { subArea, genres } = inferSubAreaAndGenres(`${rawTitle} ${rawDesc}`);
    const imageCandidate = Array.isArray(ev?.image)
      ? String(ev.image[0] || '')
      : String(ev?.image || extractMetaContent(htmlText, 'og:image') || '');

    const draft: NightlifeEventDraft = {
      external_key: `url:${platform.toLowerCase()}:${Buffer.from(safeUrl.pathname).toString('base64').slice(0, 24)}`,
      source_platform: platform,
      source_url: safeUrl.toString(),
      title: rawTitle.replace(/\s*[-|]\s*(Sympla|Ingresse|Shotgun|Eventbrite).*$/i, '').trim(),
      short_summary: summarizeCleanly(rawDesc, venueName, neighborhood),
      sub_area: subArea,
      music_genres: genres,
      moment_tags: ['friends', 'couple'],
      age_rating: '18+',
      venue_name: venueName,
      neighborhood,
      address: rawAddress || `${neighborhood}, Rio de Janeiro - RJ`,
      event_date: eventDate,
      start_time: startTime,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      is_free: isFree,
      price_min_brl: priceMin,
      price_display_label: isFree
        ? 'Entrada gratuita'
        : priceMin
          ? `A partir de R$ ${priceMin.toFixed(0)}`
          : 'Consultar lotes na fonte oficial',
      ticket_url: safeUrl.toString(),
      availability_status: availability,
      lineup: [],
      cover_image: imageCandidate,
      image_origin: imageCandidate ? 'PRODUCER_AUTHORIZED' : 'NONE',
      image_license_note: imageCandidate
        ? `Imagem extraída via OpenGraph oficial da fonte (${platform}) — validar direitos antes da publicação.`
        : 'Sem imagem oficial detectada; selecione foto autorizada ou fallback editorial.',
      is_featured: false,
      is_demonstrative: false,
    };

    return {
      ok: true,
      status: 200,
      platform,
      has_structured_jsonld: Boolean(ev),
      draft,
    };
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: `Falha ao ler URL do evento: ${err instanceof Error ? err.message : 'erro de rede'}`,
    };
  }
}

async function handleParseUrl(targetRaw: string): Promise<Response> {
  const result = await handleParseUrlCore(targetRaw);
  return jsonResponse(result.status || (result.ok ? 200 : 400), result);
}

async function handleParseUrls(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Método POST obrigatório para parse-urls.' });
  }
  try {
    const body = (await request.json()) as { urls?: string[] };
    const rawUrls = Array.isArray(body?.urls) ? body.urls : [];
    const cleanUrls = rawUrls
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter((u) => u.startsWith('http'))
      .slice(0, 30);

    if (cleanUrls.length === 0) {
      return jsonResponse(400, {
        error: 'Nenhuma URL válida fornecida. Envie um array com até 30 links de eventos.',
      });
    }

    const drafts: NightlifeEventDraft[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    // Process concurrently in chunks of 4
    const concurrency = 4;
    for (let i = 0; i < cleanUrls.length; i += concurrency) {
      const chunk = cleanUrls.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (url) => {
          try {
            const res = await handleParseUrlCore(url);
            if (res.ok && res.draft) {
              drafts.push(res.draft);
            } else {
              errors.push({ url, error: res.error || 'Falha na extração de metadados da URL.' });
            }
          } catch (err) {
            errors.push({
              url,
              error: err instanceof Error ? err.message : 'Erro ao processar página remota.',
            });
          }
        })
      );
    }

    return jsonResponse(200, {
      ok: true,
      total_requested: cleanUrls.length,
      success_count: drafts.length,
      error_count: errors.length,
      drafts,
      errors,
    });
  } catch (err) {
    return jsonResponse(400, {
      error: `Formato de requisição inválido: ${err instanceof Error ? err.message : 'JSON inválido'}`,
    });
  }
}

function parseRioturContent(conteudoHtml: string): {
  venue: string;
  address: string;
  schedule: string;
  startTime: string;
  ticketUrl: string;
  isFree: boolean;
  plainText: string;
} {
  const decoded = (conteudoHtml || '')
    .replace(/&#8211;/g, '-')
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#038;/g, '&');

  let ticketUrl = '';
  const linkMatch = decoded.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (linkMatch && linkMatch[1]?.startsWith('http')) {
    ticketUrl = linkMatch[1].trim();
  }

  let venue = '';
  const localMatch =
    decoded.match(/<strong>\s*Local:?\s*<\/strong>\s*:?\s*([^<]+)/i) ||
    decoded.match(/Local:?\s*<\/strong>\s*:?\s*([^<]+)/i) ||
    decoded.match(/Local:\s*([^<\n\r]+)/i);
  if (localMatch) {
    venue = localMatch[1].replace(/^[–\-:\s]+/, '').trim();
  }

  let address = '';
  const enderecoMatch =
    decoded.match(/<strong>\s*Endere[cç]o:?\s*<\/strong>\s*:?\s*([^<]+)/i) ||
    decoded.match(/Endere[cç]o:\s*([^<\n\r]+)/i);
  if (enderecoMatch) {
    address = enderecoMatch[1].replace(/^[–\-:\s]+/, '').trim();
  }

  let schedule = '';
  const horarioMatch =
    decoded.match(/<strong>\s*Hor[aá]rios?:?\s*<\/strong>\s*:?\s*([^<]+)/i) ||
    decoded.match(/Hor[aá]rios?:\s*([^<\n\r]+)/i);
  if (horarioMatch) {
    schedule = horarioMatch[1].replace(/^[–\-:\s]+/, '').trim();
  }

  let startTime = '20:00';
  const timeMatch = schedule.match(/(\d{1,2})h(?:(\d{2}))?/i) || schedule.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = String(timeMatch[1]).padStart(2, '0');
    const mins = timeMatch[2] ? String(timeMatch[2]).padStart(2, '0') : '00';
    startTime = `${hours}:${mins}`;
  }

  const isFree = /gratuito|entrada franca|gr[aá]tis|free/i.test(decoded);
  const plainText = decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return { venue, address, schedule, startTime, ticketUrl, isFree, plainText };
}

function buildStartEndIsoRioLocal(
  eventDate: string,
  startTime: string,
  endTime?: string
): { startsAtIso: string; endsAtIso: string } {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate)
    ? eventDate
    : new Date().toISOString().slice(0, 10);
  const cleanStart = /^\d{2}:\d{2}$/.test(startTime) ? startTime : '20:00';
  const startsAt = new Date(`${cleanDate}T${cleanStart}:00-03:00`);
  const safeStart = Number.isNaN(startsAt.getTime()) ? new Date() : startsAt;

  let safeEnd: Date;
  if (endTime && /^\d{2}:\d{2}$/.test(endTime)) {
    const candidateEnd = new Date(`${cleanDate}T${endTime}:00-03:00`);
    if (!Number.isNaN(candidateEnd.getTime())) {
      safeEnd = candidateEnd <= safeStart
        ? new Date(candidateEnd.getTime() + 24 * 3600 * 1000)
        : candidateEnd;
    } else {
      safeEnd = new Date(safeStart.getTime() + 6 * 3600 * 1000);
    }
  } else {
    safeEnd = new Date(safeStart.getTime() + 6 * 3600 * 1000);
  }

  return {
    startsAtIso: safeStart.toISOString(),
    endsAtIso: safeEnd.toISOString(),
  };
}

interface RioturRawItem {
  id?: number | string;
  titulo?: string;
  conteudo?: string;
  data_inicio?: string;
  data_fim?: string;
  thumbnail?: string;
}

async function handleFetchRiotur(request: Request, reqUrl: URL): Promise<Response> {
  let mesParam = reqUrl.searchParams.get('mes') || '';
  let anoParam = reqUrl.searchParams.get('ano') || '';
  let syncMonthsCount = Math.min(3, Math.max(1, parseInt(reqUrl.searchParams.get('sync_months') || '2', 10)));

  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as { mes?: string | number; ano?: string | number; sync_months?: number };
      if (body.mes) mesParam = String(body.mes);
      if (body.ano) anoParam = String(body.ano);
      if (body.sync_months) syncMonthsCount = Math.min(3, Math.max(1, body.sync_months));
    } catch {
      // ignore empty body
    }
  }

  const now = new Date();
  const baseMonth = mesParam ? parseInt(mesParam, 10) : now.getMonth() + 1;
  const baseYear = anoParam ? parseInt(anoParam, 10) : now.getFullYear();

  try {
    // 1. Fetch agenda page to obtain fresh session nonce
    const pageRes = await fetch('https://riotur.rio/agenda/', {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!pageRes.ok) {
      return jsonResponse(502, {
        error: `Falha ao acessar https://riotur.rio/agenda/ (HTTP ${pageRes.status}).`,
      });
    }

    const pageHtml = await pageRes.text();
    const nonceMatch =
      pageHtml.match(/action:\s*['"]buscar_eventos['"],[\s\S]*?nonce:\s*['"]([a-zA-Z0-9]+)['"]/i) ||
      pageHtml.match(/nonce:\s*['"]([a-zA-Z0-9]+)['"]/i);

    const nonce = nonceMatch ? nonceMatch[1] : '';
    if (!nonce) {
      return jsonResponse(502, {
        error: 'Não foi possível extrair o token de sessão (nonce) da agenda da Riotur.',
      });
    }

    // 2. Fetch events across requested months
    const rawEventsMap = new Map<string, RioturRawItem>();

    for (let mOffset = 0; mOffset < syncMonthsCount; mOffset++) {
      let targetMonth = baseMonth + mOffset;
      let targetYear = baseYear;
      while (targetMonth > 12) {
        targetMonth -= 12;
        targetYear += 1;
      }

      const postBody = new URLSearchParams({
        action: 'buscar_eventos',
        mes: String(targetMonth),
        ano: String(targetYear),
        nonce,
      });

      const ajaxRes = await fetch('https://riotur.rio/wp-admin/admin-ajax.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: postBody.toString(),
        signal: AbortSignal.timeout(15000),
      });

      if (!ajaxRes.ok) continue;

      const ajaxJson = (await ajaxRes.json()) as {
        success?: boolean;
        data?: Record<string, RioturRawItem[] | RioturRawItem>;
      };

      if (ajaxJson?.success && ajaxJson?.data && typeof ajaxJson.data === 'object') {
        for (const dateKey of Object.keys(ajaxJson.data)) {
          const val = ajaxJson.data[dateKey];
          const items = Array.isArray(val) ? val : [val];
          for (const it of items) {
            if (!it || !it.titulo) continue;
            if (it.titulo.toLowerCase().includes('evento teste')) continue;
            const uniqueKey = it.id
              ? `id:${it.id}`
              : `${it.titulo.trim().toLowerCase()}:${it.data_inicio || dateKey}`;
            if (!rawEventsMap.has(uniqueKey)) {
              rawEventsMap.set(uniqueKey, { ...it, data_inicio: it.data_inicio || dateKey });
            }
          }
        }
      }
    }

    const uniqueRaw = Array.from(rawEventsMap.values());

    // 3. Map into NightlifeEventDraft
    const drafts: NightlifeEventDraft[] = uniqueRaw.map((it) => {
      const title = String(it.titulo || '').trim();
      const content = String(it.conteudo || '');
      const parsed = parseRioturContent(content);

      const venueName = (parsed.venue || 'Local no Rio de Janeiro').trim();
      const address = (parsed.address || `${venueName}, Rio de Janeiro - RJ`).trim();
      const neighborhood = extractNeighborhood(`${address} ${venueName} ${title}`);
      const rawDate = String(it.data_inicio || '').trim();
      const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : new Date().toISOString().slice(0, 10);

      const startTime = parsed.startTime || '20:00';
      const { startsAtIso, endsAtIso } = buildStartEndIsoRioLocal(eventDate, startTime);
      const { subArea, genres } = inferSubAreaAndGenres(`${title} ${parsed.plainText}`);
      const thumbnail = it.thumbnail && it.thumbnail.startsWith('http') ? it.thumbnail.trim() : '';

      const isFree = parsed.isFree;
      const priceLabel = isFree
        ? 'Entrada Franca'
        : parsed.ticketUrl
          ? 'Consultar ingressos'
          : 'Consultar no local';

      return {
        external_key: `riotur:${it.id || title}`,
        source_platform: 'RIOTUR' as const,
        source_external_id: it.id ? String(it.id) : undefined,
        source_url: parsed.ticketUrl || 'https://riotur.rio/agenda/',
        title,
        short_summary: summarizeCleanly(parsed.plainText, venueName, neighborhood),
        sub_area: subArea,
        music_genres: genres,
        moment_tags: ['friends', 'culture'],
        age_rating: /infantil|crian[cç]a/i.test(`${title} ${parsed.plainText}`) ? 'Livre' : '18+',
        venue_name: venueName,
        neighborhood,
        address,
        event_date: eventDate,
        start_time: startTime,
        starts_at: startsAtIso,
        ends_at: endsAtIso,
        is_free: isFree,
        price_display_label: priceLabel,
        ticket_url: parsed.ticketUrl || undefined,
        availability_status: isFree ? ('GRATUITO' as const) : ('DISPONIVEL' as const),
        lineup: [],
        cover_image: thumbnail,
        image_origin: thumbnail ? ('PRESS_KIT_LICENSED' as const) : ('NONE' as const),
        image_license_note: thumbnail
          ? 'Divulgação oficial da Riotur / Prefeitura da Cidade do Rio de Janeiro.'
          : 'Sem arte oficial retornada.',
        is_featured: false,
        is_demonstrative: false,
      };
    });

    return jsonResponse(200, {
      ok: true,
      months_synced: syncMonthsCount,
      base_month: baseMonth,
      base_year: baseYear,
      raw_count: uniqueRaw.length,
      drafts_count: drafts.length,
      drafts,
    });
  } catch (err) {
    return jsonResponse(502, {
      ok: false,
      error: `Falha ao sincronizar com agenda oficial da Riotur: ${err instanceof Error ? err.message : 'erro de rede'}`,
    });
  }
}

interface SymplaApiEvent {
  id?: string | number;
  name?: string;
  start_date?: string;
  end_date?: string;
  detail?: string;
  private_event?: number | boolean;
  published?: number | boolean;
  cancelled?: number | boolean;
  image?: string;
  url?: string;
  address?: {
    name?: string;
    address?: string;
    address_num?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
  };
  host?: { name?: string };
}

function normalizeSymplaRecords(
  items: SymplaApiEvent[],
  cityFilter: string
): NightlifeEventDraft[] {
  const drafts: NightlifeEventDraft[] = [];
  const cityLower = cityFilter.trim().toLowerCase();

  for (const item of items) {
    if (!item || !item.name || item.cancelled) continue;
    const itemCity = (item.address?.city || '').toLowerCase();
    const itemState = (item.address?.state || '').toLowerCase();
    if (
      cityLower &&
      itemCity &&
      !itemCity.includes(cityLower) &&
      itemState &&
      itemState !== 'rj'
    ) {
      continue;
    }

    const venueName = (item.address?.name || item.host?.name || 'Local no Rio').trim();
    const rawNeighborhood = item.address?.neighborhood || '';
    const address = [
      item.address?.address,
      item.address?.address_num,
      rawNeighborhood,
      item.address?.city,
    ]
      .filter(Boolean)
      .join(', ');
    const neighborhood =
      rawNeighborhood.trim() || extractNeighborhood(`${address} ${item.name} ${item.detail || ''}`);
    const { eventDate, startTime, startsAtIso, endsAtIso } = parseIsoToRioParts(item.start_date);
    const { subArea, genres } = inferSubAreaAndGenres(`${item.name} ${item.detail || ''}`);

    drafts.push({
      external_key: `sympla:${item.id}`,
      source_platform: 'SYMPLA',
      source_external_id: item.id ? String(item.id) : undefined,
      source_url: item.url,
      title: item.name.trim(),
      short_summary: summarizeCleanly(item.detail || '', venueName, neighborhood),
      sub_area: subArea,
      music_genres: genres,
      moment_tags: ['friends', 'couple'],
      age_rating: '18+',
      venue_name: venueName,
      neighborhood,
      address: address || `${neighborhood}, Rio de Janeiro - RJ`,
      event_date: eventDate,
      start_time: startTime,
      starts_at: startsAtIso,
      ends_at: item.end_date ? parseIsoToRioParts(item.end_date).startsAtIso : endsAtIso,
      is_free: false,
      price_display_label: 'Consultar lotes na Sympla',
      ticket_url: item.url,
      availability_status: 'DISPONIVEL',
      lineup: [],
      cover_image: item.image || '',
      image_origin: item.image ? 'PRODUCER_AUTHORIZED' : 'NONE',
      image_license_note: item.image
        ? 'Arte oficial do evento via API Sympla do produtor (validar antes de publicar).'
        : 'Sem arte na resposta API.',
      is_featured: false,
      is_demonstrative: false,
    });
  }

  return drafts;
}

async function handleFetchSympla(request: Request, reqUrl: URL): Promise<Response> {
  const token = (
    request.headers.get('x-sympla-token') ||
    request.headers.get('s_token') ||
    process.env.SYMPLA_API_TOKEN ||
    ''
  ).trim();

  if (!token) {
    return jsonResponse(401, {
      error:
        'Token da Sympla (SYMPLA_API_TOKEN / header s_token) não configurado. Informe no painel Admin ou adicione SYMPLA_API_TOKEN nas variáveis de ambiente da Vercel.',
    });
  }

  const cityFilter = reqUrl.searchParams.get('city') ?? 'Rio de Janeiro';
  const candidates = [
    'https://api.sympla.com.br/public/v1.6.0/events?page_size=50&published=true',
    'https://api.sympla.com.br/public/v3/events?page_size=50&published=true',
  ];

  let lastStatus = 502;
  let lastErrorText = '';

  for (const endpoint of candidates) {
    try {
      const upstream = await fetch(endpoint, {
        method: 'GET',
        signal: AbortSignal.timeout(15000),
        headers: {
          s_token: token,
          Accept: 'application/json',
        },
      });

      lastStatus = upstream.status;
      if (!upstream.ok) {
        lastErrorText = await upstream.text().catch(() => '');
        if (upstream.status === 404 || upstream.status === 410) {
          continue;
        }
        return jsonResponse(upstream.status, {
          error: `Sympla API retornou HTTP ${upstream.status}${
            upstream.status === 401 || upstream.status === 403
              ? ' (verifique a validade do token s_token).'
              : ''
          }`,
          details: lastErrorText.slice(0, 300),
        });
      }

      const payload = (await upstream.json()) as {
        data?: SymplaApiEvent[];
        pagination?: { total_page?: number; page?: number; quantity?: number };
      };
      const rawEvents = Array.isArray(payload?.data) ? payload.data : [];
      const drafts = normalizeSymplaRecords(rawEvents, cityFilter);

      return jsonResponse(200, {
        ok: true,
        endpoint_used: endpoint,
        raw_count: rawEvents.length,
        filtered_rio_count: drafts.length,
        producer_scope_note:
          'A API oficial Sympla (s_token) lista eventos vinculados ao produtor autenticado (conforme developers.sympla.com.br/api-doc). Para eventos públicos de outros produtores, utilize Importação por URL ou Lote CSV/JSON.',
        drafts,
      });
    } catch (err) {
      lastErrorText = err instanceof Error ? err.message : 'erro de rede';
    }
  }

  return jsonResponse(lastStatus, {
    error: `Não foi possível consultar a API da Sympla (${lastErrorText || lastStatus}).`,
  });
}

async function handleFetchIngresse(request: Request, reqUrl: URL): Promise<Response> {
  const apiKey = (
    request.headers.get('x-ingresse-key') ||
    process.env.INGRESSE_API_KEY ||
    ''
  ).trim();

  if (!apiKey) {
    return jsonResponse(401, {
      error:
        'Chave da Ingresse (INGRESSE_API_KEY) não configurada. Para eventos individuais públicos da Ingresse, use a aba Importação por URL.',
    });
  }

  const city = reqUrl.searchParams.get('city') ?? 'Rio de Janeiro';
  try {
    const endpoint = `https://api.ingresse.com/event?apikey=${encodeURIComponent(apiKey)}&city=${encodeURIComponent(city)}`;
    const upstream = await fetch(endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
    });

    if (!upstream.ok) {
      return jsonResponse(upstream.status, {
        error: `Ingresse API retornou HTTP ${upstream.status}. Verifique credenciais ou utilize Importação por URL.`,
      });
    }

    const payload = (await upstream.json()) as {
      responseData?: { data?: Array<Record<string, unknown>> };
      data?: Array<Record<string, unknown>>;
    };
    const items = Array.isArray(payload?.responseData?.data)
      ? payload.responseData.data
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    const drafts: NightlifeEventDraft[] = items
      .filter((it) => Boolean(it?.title || it?.name))
      .map((it) => {
        const title = String(it.title || it.name || '').trim();
        const venueObj = (it.venue && typeof it.venue === 'object' ? it.venue : {}) as Record<
          string,
          unknown
        >;
        const venueName = String(venueObj.name || 'Local no Rio').trim();
        const neighborhood = extractNeighborhood(
          `${venueObj.street || ''} ${venueObj.neighborhood || ''} ${title}`
        );
        const rawDate = Array.isArray(it.sessions)
          ? String((it.sessions[0] as Record<string, unknown>)?.dateTime || '')
          : String(it.date || '');
        const { eventDate, startTime, startsAtIso, endsAtIso } = parseIsoToRioParts(rawDate);
        const { subArea, genres } = inferSubAreaAndGenres(`${title} ${it.description || ''}`);
        const poster = String(it.poster || it.image || '');
        const link = String(it.link || '');

        return {
          external_key: `ingresse:${it.id || title}`,
          source_platform: 'INGRESSE',
          source_external_id: it.id ? String(it.id) : undefined,
          source_url: link || undefined,
          title,
          short_summary: summarizeCleanly(String(it.description || ''), venueName, neighborhood),
          sub_area: subArea,
          music_genres: genres,
          moment_tags: ['friends', 'couple'],
          age_rating: '18+',
          venue_name: venueName,
          neighborhood,
          address: String(venueObj.street || `${neighborhood}, Rio de Janeiro - RJ`),
          event_date: eventDate,
          start_time: startTime,
          starts_at: startsAtIso,
          ends_at: endsAtIso,
          is_free: false,
          price_display_label: 'Consultar lotes na Ingresse',
          ticket_url: link || undefined,
          availability_status: 'DISPONIVEL',
          lineup: [],
          cover_image: poster,
          image_origin: poster ? 'PRODUCER_AUTHORIZED' : 'NONE',
          image_license_note: poster
            ? 'Arte fornecida via API Ingresse (validar direitos antes da publicação).'
            : 'Sem arte oficial retornada.',
          is_featured: false,
          is_demonstrative: false,
        };
      });

    return jsonResponse(200, {
      ok: true,
      raw_count: items.length,
      drafts,
    });
  } catch (err) {
    return jsonResponse(502, {
      error: `Falha ao conectar com API Ingresse: ${err instanceof Error ? err.message : 'erro de rede'}`,
    });
  }
}

async function handleMirrorImage(rawUrl: string): Promise<Response> {
  const safeUrl = validateSafeHttpsUrl(rawUrl, ALLOWED_IMAGE_CDN_HOSTS);
  if (!safeUrl) {
    return jsonResponse(403, {
      error: 'URL de mídia fora da allowlist de plataformas autorizadas.',
    });
  }
  try {
    const upstream = await fetch(safeUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
      headers: { Accept: 'image/webp,image/avif,image/*,*/*;q=0.8' },
    });
    if (upstream.url && !validateSafeHttpsUrl(upstream.url, ALLOWED_IMAGE_CDN_HOSTS)) {
      return jsonResponse(403, { error: 'Redirecionamento de imagem não autorizado.' });
    }
    if (!upstream.ok) {
      return jsonResponse(upstream.status, { error: `Origem retornou HTTP ${upstream.status}.` });
    }
    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return jsonResponse(415, { error: 'Recurso remoto não é imagem válida.' });
    }
    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) {
      return jsonResponse(413, { error: 'Imagem vazia ou excede 8 MB.' });
    }
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType.split(';')[0].trim(),
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return jsonResponse(502, {
      error: `Falha ao espelhar imagem: ${err instanceof Error ? err.message : 'erro'}`,
    });
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { Allow: 'GET, POST, OPTIONS' },
  });
}

async function routeRequest(request: Request): Promise<Response> {
  const reqUrl = new URL(request.url);
  const queryAction = (reqUrl.searchParams.get('__action') || reqUrl.searchParams.get('action') || '').trim();
  const pathAction = reqUrl.pathname.replace(/^\/api\/nightlife\/?/, '').replace(/^\/+/, '');
  const action = queryAction || pathAction;

  if (action === 'admin-list') {
    return handleAdminList();
  }

  if (action === 'admin-mutate') {
    return handleAdminMutate(request);
  }

  if (action === 'get-published') {
    return handleGetPublished();
  }

  if (action === 'parse-urls') {
    return handleParseUrls(request);
  }

  if (action === 'fetch-riotur') {
    return handleFetchRiotur(request, reqUrl);
  }

  if (action === 'parse-url') {
    let target = reqUrl.searchParams.get('url') || '';
    if (!target && request.method === 'POST') {
      try {
        const body = (await request.json()) as { url?: string };
        target = body?.url || '';
      } catch {
        // ignore invalid body
      }
    }
    return handleParseUrl(target);
  }

  if (action === 'fetch-sympla') {
    return handleFetchSympla(request, reqUrl);
  }

  if (action === 'fetch-ingresse') {
    return handleFetchIngresse(request, reqUrl);
  }

  if (action === 'mirror-image') {
    return handleMirrorImage(reqUrl.searchParams.get('url') || '');
  }

  return jsonResponse(404, {
    error:
      'Ação nightlife inválida (permitidas: admin-list, admin-mutate, get-published, parse-urls, fetch-riotur, parse-url, fetch-sympla, fetch-ingresse, mirror-image).',
  });
}

export async function GET(request: Request): Promise<Response> {
  return routeRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return routeRequest(request);
}

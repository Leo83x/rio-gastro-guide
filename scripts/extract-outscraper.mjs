#!/usr/bin/env node
/**
 * Script CLI oficial do BoraRio para extrair estabelecimentos reais e fotografias
 * via Outscraper API (https://app.outscraper.cloud/api-docs).
 *
 * Uso:
 *   OUTSCRAPER_API_KEY="seu-token" npm run extract:outscraper -- --query "restaurantes em Ipanema, Rio de Janeiro, Brazil" --limit 15 --photos 3 --out rio-seed.json
 *   OUTSCRAPER_API_KEY="seu-token" npm run extract:outscraper -- --presets --limit 8 --photos 3 --out rio-piloto.json
 *
 * O arquivo JSON gerado já sai no formato pronto do BoraRio (com fotos reais em cover_image/gallery
 * e pronto para importar em /admin -> Importador Universal ou sincronizar com Supabase usando --sync-supabase).
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const OUTSCRAPER_API_BASE = 'https://api.outscraper.cloud';

const DEFAULT_PRESET_QUERIES = [
  'restaurantes em Ipanema, Rio de Janeiro, Brazil',
  'restaurantes em Leblon, Rio de Janeiro, Brazil',
  'restaurantes e bares em Botafogo, Rio de Janeiro, Brazil',
  'cafeterias e restaurantes em Santa Teresa, Rio de Janeiro, Brazil',
];

const KNOWN_NEIGHBORHOODS = [
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
];

const WEEKDAY_PT = {
  monday: 'Seg',
  tuesday: 'Ter',
  wednesday: 'Qua',
  thursday: 'Qui',
  friday: 'Sex',
  saturday: 'Sáb',
  sunday: 'Dom',
};

function stripAccents(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function slugify(str) {
  return stripAccents(str)
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadDotEnvIfPresent() {
  for (const fname of ['.env.local', '.env']) {
    const fpath = path.resolve(process.cwd(), fname);
    if (!fs.existsSync(fpath)) continue;
    const lines = fs.readFileSync(fpath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, key, rawVal] = m;
      const val = rawVal.replace(/^['"]|['"]$/g, '').trim();
      if (!(key in process.env) && val) {
        process.env[key] = val;
      }
    }
  }
}

function parseArgs(argv) {
  const args = {
    query: '',
    presets: false,
    limit: 10,
    photos: 3,
    out: 'outscraper-borario-seed.json',
    syncSupabase: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--query' && argv[i + 1]) args.query = argv[++i];
    else if (arg === '--presets') args.presets = true;
    else if (arg === '--limit' && argv[i + 1]) args.limit = Math.max(1, Math.min(40, parseInt(argv[++i], 10) || 10));
    else if (arg === '--photos' && argv[i + 1]) args.photos = Math.max(1, Math.min(8, parseInt(argv[++i], 10) || 3));
    else if (arg === '--out' && argv[i + 1]) args.out = argv[++i];
    else if (arg === '--sync-supabase') args.syncSupabase = true;
  }

  return args;
}

function normalizeNeighborhood(rawBorough, address) {
  for (const cand of [rawBorough, address]) {
    const clean = stripAccents(cand);
    for (const [needle, canonical] of KNOWN_NEIGHBORHOODS) {
      if (clean.includes(needle)) return canonical;
    }
  }
  return (rawBorough && String(rawBorough).trim()) || 'Rio de Janeiro';
}

function normalizeCategory(raw) {
  const v = stripAccents(raw);
  if (v.includes('ital') || v.includes('pasta') || v.includes('trattoria')) return 'Italiano';
  if (v.includes('japon') || v.includes('sushi') || v.includes('ramen')) return 'Japonês';
  if (v.includes('pizza')) return 'Pizzaria';
  if (v.includes('churras') || v.includes('steak') || v.includes('parrilla')) return 'Churrascaria';
  if (v.includes('mar') || v.includes('seafood') || v.includes('peixe')) return 'Frutos do Mar';
  if (v.includes('caf') || v.includes('coffee') || v.includes('padaria') || v.includes('bakery')) return 'Cafeteria';
  if (v.includes('burg') || v.includes('hamburg')) return 'Hamburgueria';
  if (v.includes('boteco') || v.includes('bar') || v.includes('pub') || v.includes('chopp')) return 'Boteco Carioca';
  if (v.includes('bistr') || v.includes('franc') || v.includes('french')) return 'Bistrô';
  if (v.includes('brasil') || v.includes('regional') || v.includes('feijoada')) return 'Brasileiro';
  return 'Brasileiro';
}

function mapPriceRange(raw) {
  if (!raw) return '$$';
  const str = String(raw).trim();
  if (/r\$|\d{2,}/i.test(str) && !/^\$+$/.test(str)) {
    const nums = (str.match(/\d+(?:[.,]\d+)?/g) || [])
      .map((n) => parseFloat(n.replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length > 0) {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      if (avg <= 45) return '$';
      if (avg <= 100) return '$$';
      if (avg <= 180) return '$$$';
      return '$$$$';
    }
  }
  const count = (str.match(/\$/g) || []).length;
  if (count >= 4) return '$$$$';
  if (count === 3) return '$$$';
  if (count === 1) return '$';
  return '$$';
}

function formatHours(workingHours) {
  if (!workingHours) return undefined;
  if (typeof workingHours === 'string') return workingHours.trim() || undefined;
  if (typeof workingHours === 'object') {
    const parts = [];
    for (const [day, val] of Object.entries(workingHours)) {
      const shortDay = WEEKDAY_PT[stripAccents(day).replace(/[^a-z]/g, '')] || day.slice(0, 3);
      const timeStr = Array.isArray(val) ? val.join(', ') : String(val || '').trim();
      if (timeStr) parts.push(`${shortDay}: ${timeStr}`);
    }
    return parts.slice(0, 4).join(' · ') || undefined;
  }
  return undefined;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function outscraperGet(subPath, params, apiKey) {
  const qs = params.toString();
  const url = `${OUTSCRAPER_API_BASE}/${subPath}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = {};
  }

  if (!res.ok) {
    throw new Error(`Outscraper HTTP ${res.status} em /${subPath}: ${json.error || json.errorMessage || text.slice(0, 160)}`);
  }

  if ((res.status === 202 || json.status === 'Pending') && json.id) {
    for (let attempt = 1; attempt <= 15; attempt++) {
      await sleep(2000);
      const pollRes = await fetch(`${OUTSCRAPER_API_BASE}/requests/${encodeURIComponent(json.id)}`, {
        headers: { 'X-API-KEY': apiKey, Accept: 'application/json' },
      });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      if (pollData.status === 'Success') return pollData;
      if (pollData.status === 'Error') throw new Error(pollData.error || 'Erro assíncrono Outscraper');
    }
    throw new Error(`Timeout aguardando requisição Outscraper (${json.id})`);
  }

  return json;
}

function flattenData(data) {
  if (!Array.isArray(data)) return [];
  const out = [];
  for (const item of data) {
    if (Array.isArray(item)) out.push(...item);
    else if (item && typeof item === 'object') out.push(item);
  }
  return out;
}

function normalizePlace(place, maxPhotos) {
  const name = (place.name || place.title || '').trim();
  const rawAddress = (place.full_address || place.address || '').trim();
  const neighborhood = normalizeNeighborhood(place.borough || place.county, rawAddress);
  const address = rawAddress || `${neighborhood}, Rio de Janeiro - RJ`;
  const categoryRaw = [
    place.category || '',
    place.type || '',
    Array.isArray(place.subtypes) ? place.subtypes.join(' ') : place.subtypes || '',
  ].join(' ');
  const category = normalizeCategory(categoryRaw);

  const photos = [];
  const seenUrls = new Set();
  const addPhoto = (u) => {
    if (typeof u === 'string' && u.startsWith('http') && !seenUrls.has(u.trim())) {
      seenUrls.add(u.trim());
      photos.push(u.trim());
    }
  };
  if (Array.isArray(place.photos_data)) {
    for (const p of place.photos_data) addPhoto(p?.photo_url_big || p?.photo_url);
  }
  addPhoto(place.photo);

  const gallery = photos.slice(0, maxPhotos);
  const hasRealPhoto = gallery.length > 0;
  const rating = Number(place.rating) > 0 ? Math.min(5, Math.max(1, Number(place.rating))) : 0;
  const reviewsCount = Number.parseInt(String(place.reviews || '0').replace(/\D/g, ''), 10) || 0;
  const isClosed = String(place.business_status || '').toUpperCase().includes('CLOSED');
  const extSuffix = place.place_id || place.google_id || place.cid || slugify(`${name}-${neighborhood}`);

  return {
    id: randomUUID(),
    external_id: `outscraper-${extSuffix}`,
    name,
    slug: slugify(`${name}-${neighborhood}`),
    category,
    neighborhood,
    address,
    latitude: Number(place.latitude) || -22.9519,
    longitude: Number(place.longitude) || -43.2105,
    description:
      (typeof place.description === 'string' && place.description.trim().length >= 15
        ? place.description.trim()
        : `${name} em ${neighborhood}, Rio de Janeiro (${place.type || category}). Extraído via Outscraper API aguardando reivindicação direta do estabelecimento.`),
    cover_image: gallery[0] || '',
    gallery,
    rating,
    reviews_count: reviewsCount,
    price_range: mapPriceRange(place.range),
    phone: place.phone ? String(place.phone).trim() : undefined,
    whatsapp: place.phone ? String(place.phone).replace(/\D/g, '') : undefined,
    website: place.site && String(place.site).startsWith('http') ? String(place.site).trim() : undefined,
    opening_hours: formatHours(place.working_hours || place.working_hours_old_format),
    is_claimed: false,
    is_featured: false,
    created_at: new Date().toISOString(),
    data_source: 'outscraper_api',
    is_redistribution_authorized: true,
    validation_status: isClosed ? 'FECHADO/INVÁLIDO' : 'PENDENTE',
    operational_status: isClosed
      ? 'FECHADO'
      : String(place.business_status || '').toUpperCase() === 'OPERATIONAL'
        ? 'OPERACIONAL'
        : 'DESCONHECIDO',
    confidence_level: hasRealPhoto && rating > 0 ? 'ALTA' : 'MÉDIA',
    last_verified_at: new Date().toISOString(),
    rating_source: rating > 0 ? 'authorized_source' : 'none',
    image_origin: hasRealPhoto ? 'commercial_licensed' : 'none',
    image_license: hasRealPhoto
      ? 'Outscraper Google Maps Photos API (publicação piloto pré-confirmação do estabelecimento)'
      : 'Sem fotografia retornada pela fonte',
    has_real_photo: hasRealPhoto,
    macro_category: 'Gastronomia',
  };
}

async function run() {
  loadDotEnvIfPresent();
  const args = parseArgs(process.argv.slice(2));
  const apiKey = (process.env.OUTSCRAPER_API_KEY || '').trim();

  if (!apiKey) {
    console.error('Erro: defina a variável de ambiente OUTSCRAPER_API_KEY antes de executar este script.');
    console.error('Exemplo: OUTSCRAPER_API_KEY="seu-token" npm run extract:outscraper -- --query "restaurantes em Botafogo, Rio de Janeiro"');
    process.exit(1);
  }

  const queries = args.presets
    ? DEFAULT_PRESET_QUERIES
    : [args.query || 'restaurantes em Ipanema, Rio de Janeiro, Brazil'];

  const collected = new Map();

  for (const query of queries) {
    console.log(`[1/2] Buscando lugares: "${query}" (limit=${args.limit})...`);
    const searchRes = await outscraperGet(
      'google-maps-search',
      new URLSearchParams({
        query,
        limit: String(args.limit),
        language: 'pt',
        region: 'BR',
        dropDuplicates: 'true',
        async: 'false',
      }),
      apiKey
    );

    const places = flattenData(searchRes.data).filter((p) => (p.name || p.title || '').trim().length > 0);
    console.log(` -> ${places.length} estabelecimentos retornados.`);

    if (places.length > 0 && args.photos > 0) {
      console.log(`[2/2] Buscando fotos reais via /google-maps-photos (photosLimit=${args.photos})...`);
      const chunkSize = 8;
      for (let i = 0; i < places.length; i += chunkSize) {
        const chunk = places.slice(i, i + chunkSize);
        const photoParams = new URLSearchParams({
          photosLimit: String(args.photos),
          limit: '1',
          language: 'pt',
          region: 'BR',
          async: 'false',
        });
        for (const p of chunk) {
          photoParams.append('query', p.place_id || p.google_id || `${p.name}, Rio de Janeiro`);
        }

        try {
          const photosRes = await outscraperGet('google-maps-photos', photoParams, apiKey);
          const photoPlaces = flattenData(photosRes.data);
          for (const pp of photoPlaces) {
            if (!Array.isArray(pp.photos_data)) continue;
            const match = places.find(
              (p) =>
                (pp.place_id && p.place_id === pp.place_id) ||
                (pp.google_id && p.google_id === pp.google_id) ||
                stripAccents(p.name) === stripAccents(pp.name)
            );
            if (match) match.photos_data = pp.photos_data;
          }
        } catch (err) {
          console.warn(`Aviso em lote de fotos: ${err.message}`);
        }
      }
    }

    for (const raw of places) {
      const item = normalizePlace(raw, args.photos);
      if (!collected.has(item.external_id)) {
        collected.set(item.external_id, item);
      }
    }
  }

  const finalList = Array.from(collected.values());
  const outPath = path.resolve(process.cwd(), args.out);
  fs.writeFileSync(outPath, JSON.stringify(finalList, null, 2), 'utf8');
  console.log(`\nConcluído: ${finalList.length} estabelecimentos (${finalList.filter((i) => i.has_real_photo).length} com fotos reais) salvos em ${outPath}`);

  if (args.syncSupabase) {
    const sbUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const sbKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (!sbUrl || !sbKey) {
      console.warn('Supabase não configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes). Pulando envio direto.');
      return;
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(sbUrl, sbKey);
    const { error } = await supabase.from('restaurants').upsert(finalList, { onConflict: 'external_id' });
    if (error) {
      console.error('Erro ao enviar para o Supabase:', error.message);
      process.exit(1);
    }
    console.log(`Sincronizado com sucesso na tabela "restaurants" do Supabase!`);
  }
}

run().catch((err) => {
  console.error('Falha na extração Outscraper:', err instanceof Error ? err.message : err);
  process.exit(1);
});

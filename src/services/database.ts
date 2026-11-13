import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { SEED_EXPERIENCES } from '../data/seedExperiences';
import type { ClaimRequest, Restaurant, StorageMode, UpsertResult } from '../types/restaurant';
import { generateUUID, slugify } from '../utils/slug';

const STORAGE_KEY_RESTAURANTS = 'rio_gastro_restaurants_v1';
const STORAGE_KEY_CLAIMS = 'rio_gastro_claims_v1';
const STORAGE_KEY_INITIALIZED = 'rio_gastro_initialized_v1';
const STORAGE_KEY_SUPERAPP_MERGED = 'rio_gastro_superapp_merged_v1';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let supabaseClient: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export const supabase: SupabaseClient | null = supabaseClient;

export function getStorageMode(): StorageMode {
  return supabaseClient ? 'supabase' : 'local';
}

function normalizeRecord(r: Restaurant): Restaurant {
  return {
    ...r,
    macro_category: r.macro_category || 'Gastronomia',
  };
}

function readLocalRestaurants(): Restaurant[] {
  try {
    const initialized = localStorage.getItem(STORAGE_KEY_INITIALIZED);
    const raw = localStorage.getItem(STORAGE_KEY_RESTAURANTS);
    if (!initialized || !raw) {
      localStorage.setItem(STORAGE_KEY_RESTAURANTS, JSON.stringify(SEED_EXPERIENCES));
      localStorage.setItem(STORAGE_KEY_INITIALIZED, '1');
      localStorage.setItem(STORAGE_KEY_SUPERAPP_MERGED, '1');
      return [...SEED_EXPERIENCES];
    }

    const parsed = (JSON.parse(raw) as Restaurant[]).map(normalizeRecord);

    // Non-destructive one-time merge of new multi-category Rio experiences
    if (!localStorage.getItem(STORAGE_KEY_SUPERAPP_MERGED) && parsed.length > 0) {
      const existingExtIds = new Set(parsed.map((p) => p.external_id));
      const toAppend = SEED_EXPERIENCES.filter((s) => !existingExtIds.has(s.external_id));
      const merged = [...parsed, ...toAppend];
      localStorage.setItem(STORAGE_KEY_RESTAURANTS, JSON.stringify(merged));
      localStorage.setItem(STORAGE_KEY_SUPERAPP_MERGED, '1');
      return merged;
    }

    return parsed;
  } catch {
    return [...SEED_EXPERIENCES];
  }
}

function writeLocalRestaurants(restaurants: Restaurant[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RESTAURANTS, JSON.stringify(restaurants));
    localStorage.setItem(STORAGE_KEY_INITIALIZED, '1');
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
        err.code === 22)
    ) {
      throw new Error(
        'Limite do armazenamento local (localStorage) atingido ao salvar fotos espelhadas. Configure o Supabase Storage (bucket "venue-media") ou publique em lotes menores.'
      );
    }
    throw err;
  }
}

function readLocalClaims(): ClaimRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CLAIMS);
    return raw ? (JSON.parse(raw) as ClaimRequest[]) : [];
  } catch {
    return [];
  }
}

function writeLocalClaims(claims: ClaimRequest[]): void {
  localStorage.setItem(STORAGE_KEY_CLAIMS, JSON.stringify(claims));
}

export async function getAllRestaurants(): Promise<Restaurant[]> {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('restaurants')
        .select('*')
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false });

      if (!error && data) {
        if (data.length === 0) {
          return readLocalRestaurants();
        }
        return data as Restaurant[];
      }
    } catch {
      // Fallback gracefully to local storage
    }
  }
  return readLocalRestaurants();
}

export async function upsertRestaurants(
  incoming: Array<Omit<Restaurant, 'id'> & { id?: string }>
): Promise<UpsertResult> {
  const normalizedIncoming: Restaurant[] = incoming.map((item) => {
    const slug = item.slug || slugify(`${item.name}-${item.neighborhood || 'rio'}`);
    return {
      ...item,
      id: item.id || generateUUID(),
      external_id: item.external_id || slug,
      slug,
      created_at: item.created_at || new Date().toISOString(),
    };
  });

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from('restaurants')
        .upsert(normalizedIncoming, { onConflict: 'external_id' });
      if (!error) {
        const all = await getAllRestaurants();
        return { inserted: normalizedIncoming.length, updated: 0, total: all.length };
      }
    } catch {
      // Fallback to local
    }
  }

  const existing = readLocalRestaurants();
  const byExternalId = new Map<string, number>();
  const bySlug = new Map<string, number>();

  existing.forEach((r, idx) => {
    if (r.external_id) byExternalId.set(r.external_id, idx);
    if (r.slug) bySlug.set(r.slug, idx);
  });

  let inserted = 0;
  let updated = 0;

  for (const item of normalizedIncoming) {
    const matchIdx =
      (item.external_id ? byExternalId.get(item.external_id) : undefined) ??
      bySlug.get(item.slug);

    if (matchIdx !== undefined) {
      const prev = existing[matchIdx];
      existing[matchIdx] = {
        ...prev,
        ...item,
        id: prev.id,
        is_claimed: prev.is_claimed || item.is_claimed,
        is_featured: prev.is_featured || item.is_featured,
      };
      updated++;
    } else {
      existing.unshift(item);
      byExternalId.set(item.external_id, 0);
      bySlug.set(item.slug, 0);
      inserted++;
    }
  }

  writeLocalRestaurants(existing);
  return { inserted, updated, total: existing.length };
}

export async function claimRestaurant(
  payload: Omit<ClaimRequest, 'id' | 'created_at'>
): Promise<ClaimRequest> {
  const claim: ClaimRequest = {
    ...payload,
    id: generateUUID(),
    created_at: new Date().toISOString(),
  };

  if (supabaseClient) {
    try {
      await supabaseClient.from('claim_requests').insert(claim);
      await supabaseClient
        .from('restaurants')
        .update({ is_claimed: true })
        .eq('id', payload.restaurant_id);
    } catch {
      // Fallback to local
    }
  }

  const claims = readLocalClaims();
  claims.unshift(claim);
  writeLocalClaims(claims);

  const restaurants = readLocalRestaurants();
  const idx = restaurants.findIndex((r) => r.id === payload.restaurant_id);
  if (idx !== -1) {
    restaurants[idx] = { ...restaurants[idx], is_claimed: true };
    writeLocalRestaurants(restaurants);
  }

  return claim;
}

export async function getClaimRequests(): Promise<ClaimRequest[]> {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('claim_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as ClaimRequest[];
    } catch {
      // Fallback
    }
  }
  return readLocalClaims();
}

export async function resetToSeed(): Promise<Restaurant[]> {
  if (supabaseClient) {
    try {
      await supabaseClient.from('restaurants').upsert(SEED_EXPERIENCES, { onConflict: 'external_id' });
    } catch {
      // ignore
    }
  }
  writeLocalRestaurants([...SEED_EXPERIENCES]);
  return [...SEED_EXPERIENCES];
}

export async function clearDatabase(): Promise<void> {
  if (supabaseClient) {
    try {
      await supabaseClient.from('restaurants').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    } catch {
      // ignore
    }
  }
  localStorage.setItem(STORAGE_KEY_RESTAURANTS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEY_INITIALIZED, '1');
}

export function exportRestaurantsAsJSON(restaurants: Restaurant[]): void {
  const blob = new Blob([JSON.stringify(restaurants, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `rio-gastro-guide-${new Date().toISOString().slice(0, 10)}.json`);
}

export function exportRestaurantsAsCSV(restaurants: Restaurant[]): void {
  const flattened = restaurants.map((r) => ({
    ...r,
    gallery: r.gallery.join('|'),
  }));
  const csv = Papa.unparse(flattened);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `rio-gastro-guide-${new Date().toISOString().slice(0, 10)}.csv`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StorageMode } from '../types/restaurant';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let singletonClient: SupabaseClient | null = null;

if (SUPABASE_URL?.trim() && SUPABASE_ANON_KEY?.trim()) {
  singletonClient = createClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

/**
 * Cliente Supabase singleton compartilhado entre Auth, Catálogo, Storage e Stores.
 * Garante que o JWT da sessão autenticada seja usado em todas as políticas RLS.
 */
export const supabase: SupabaseClient | null = singletonClient;

export function isSupabaseConfigured(): boolean {
  return Boolean(singletonClient);
}

export function getStorageMode(): StorageMode {
  return singletonClient ? 'supabase' : 'local';
}

export function isValidUuid(value?: string | null): boolean {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

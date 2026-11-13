import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { UserProfileIdentity } from '../types/experience';

const PROFILE_KEY = 'borario_profile_identity_v1';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let authSupabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  authSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(authSupabase);
}

function buildInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'BR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const DEFAULT_IDENTITY: UserProfileIdentity = {
  id: 'local-user',
  display_name: 'Explorador Carioca',
  avatar_initials: 'EC',
  home_neighborhood: 'Botafogo',
  storage_origin: 'local_device',
  updated_at: new Date().toISOString(),
};

export function getUserProfileIdentity(): UserProfileIdentity {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_IDENTITY;
    return { ...DEFAULT_IDENTITY, ...(JSON.parse(raw) as Partial<UserProfileIdentity>) };
  } catch {
    return DEFAULT_IDENTITY;
  }
}

export function saveUserProfileIdentity(
  patch: Partial<Pick<UserProfileIdentity, 'display_name' | 'home_neighborhood' | 'email'>>
): UserProfileIdentity {
  const current = getUserProfileIdentity();
  const nextName = (patch.display_name ?? current.display_name).trim() || 'Explorador Carioca';
  const next: UserProfileIdentity = {
    ...current,
    ...patch,
    display_name: nextName,
    avatar_initials: buildInitials(nextName),
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}

export async function syncSupabaseSessionIdentity(): Promise<UserProfileIdentity | null> {
  if (!authSupabase) return null;
  try {
    const { data } = await authSupabase.auth.getUser();
    if (!data.user) return null;
    const displayName =
      (data.user.user_metadata?.full_name as string | undefined) ||
      data.user.email?.split('@')[0] ||
      'Usuário BoraRio';
    const next: UserProfileIdentity = {
      ...getUserProfileIdentity(),
      id: data.user.id,
      email: data.user.email,
      display_name: displayName,
      avatar_initials: buildInitials(displayName),
      storage_origin: 'supabase_auth',
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

export async function requestMagicLinkLogin(email: string): Promise<{ ok: boolean; message: string }> {
  if (!authSupabase) {
    return {
      ok: false,
      message:
        'Supabase Auth não está configurado neste ambiente (.env). Seus dados seguem salvos localmente com segurança.',
    };
  }
  const cleanEmail = email.trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, message: 'Informe um e-mail válido.' };
  }
  try {
    const { error } = await authSupabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { emailRedirectTo: window.location.origin + '/app' },
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return {
      ok: true,
      message: `Link de acesso enviado para ${cleanEmail}. Confira sua caixa de entrada.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Falha ao iniciar autenticação.',
    };
  }
}

export async function signOutAccount(): Promise<UserProfileIdentity> {
  if (authSupabase) {
    await authSupabase.auth.signOut().catch(() => undefined);
  }
  const localReset: UserProfileIdentity = {
    ...getUserProfileIdentity(),
    id: 'local-user',
    email: undefined,
    storage_origin: 'local_device',
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(localReset));
  return localReset;
}

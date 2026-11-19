import type { UserProfileIdentity } from '../types/experience';
import { isSupabaseConfigured, isValidUuid, supabase } from './supabaseClient';

const PROFILE_KEY = 'borario_profile_identity_v1';

export function isSupabaseAuthConfigured(): boolean {
  return isSupabaseConfigured();
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

  if (supabase && next.storage_origin === 'supabase_auth' && isValidUuid(next.id)) {
    void supabase
      .from('profiles')
      .upsert(
        {
          id: next.id,
          display_name: next.display_name,
          avatar_initials: next.avatar_initials,
          home_neighborhood: next.home_neighborhood,
          updated_at: next.updated_at,
        },
        { onConflict: 'id' }
      )
      .then(() => undefined, () => undefined);
  }

  return next;
}

export async function syncSupabaseSessionIdentity(): Promise<UserProfileIdentity | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;

    const current = getUserProfileIdentity();
    const { data: cloudProfile } = await supabase
      .from('profiles')
      .select('display_name, home_neighborhood')
      .eq('id', data.user.id)
      .maybeSingle();

    const displayName =
      (cloudProfile?.display_name as string | undefined) ||
      (data.user.user_metadata?.full_name as string | undefined) ||
      data.user.email?.split('@')[0] ||
      current.display_name ||
      'Usuário BoraRio';

    const homeNeighborhood =
      (cloudProfile?.home_neighborhood as string | undefined) ||
      current.home_neighborhood ||
      'Botafogo';

    const next: UserProfileIdentity = {
      ...current,
      id: data.user.id,
      email: data.user.email,
      display_name: displayName,
      avatar_initials: buildInitials(displayName),
      home_neighborhood: homeNeighborhood,
      storage_origin: 'supabase_auth',
      updated_at: new Date().toISOString(),
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));

    if (!cloudProfile) {
      await supabase.from('profiles').upsert(
        {
          id: next.id,
          display_name: next.display_name,
          avatar_initials: next.avatar_initials,
          home_neighborhood: next.home_neighborhood,
          updated_at: next.updated_at,
        },
        { onConflict: 'id' }
      );
    }

    return next;
  } catch {
    return null;
  }
}

export function subscribeToAuthChanges(
  onIdentityUpdated: (identity: UserProfileIdentity) => void
): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      void syncSupabaseSessionIdentity().then((synced) => {
        if (synced) onIdentityUpdated(synced);
      });
    } else {
      const current = getUserProfileIdentity();
      if (current.storage_origin === 'supabase_auth') {
        const localFallback: UserProfileIdentity = {
          ...current,
          id: 'local-user',
          email: undefined,
          storage_origin: 'local_device',
          updated_at: new Date().toISOString(),
        };
        localStorage.setItem(PROFILE_KEY, JSON.stringify(localFallback));
        onIdentityUpdated(localFallback);
      }
    }
  });
  return () => data.subscription.unsubscribe();
}

export function isUserAuthenticated(identity?: UserProfileIdentity): boolean {
  const target = identity ?? getUserProfileIdentity();
  return target.storage_origin === 'supabase_auth' && isValidUuid(target.id);
}

export async function requestMagicLinkLogin(
  email: string,
  metadata?: { display_name?: string; home_neighborhood?: string }
): Promise<{ ok: boolean; message: string }> {
  if (!supabase) {
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
  const cleanName = metadata?.display_name?.trim();
  const cleanNeighborhood = metadata?.home_neighborhood?.trim();
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname + window.location.search,
        shouldCreateUser: true,
        data: {
          ...(cleanName ? { full_name: cleanName } : {}),
          ...(cleanNeighborhood ? { home_neighborhood: cleanNeighborhood } : {}),
        },
      },
    });
    if (error) {
      return { ok: false, message: error.message };
    }
    return {
      ok: true,
      message: `Enviamos um código de 6 dígitos e um link de acesso para ${cleanEmail}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Falha ao iniciar autenticação.',
    };
  }
}

export async function verifyEmailOtpLogin(
  email: string,
  token: string,
  profilePatch?: { display_name?: string; home_neighborhood?: string }
): Promise<{ ok: boolean; message: string; identity?: UserProfileIdentity }> {
  if (!supabase) {
    return { ok: false, message: 'Autenticação indisponível neste ambiente.' };
  }
  const cleanEmail = email.trim();
  const cleanToken = token.replace(/\s+/g, '').trim();
  if (!cleanEmail || !cleanToken || cleanToken.length < 6) {
    return { ok: false, message: 'Informe o código de 6 dígitos enviado para seu e-mail.' };
  }
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    });
    if (error || !data.user) {
      return { ok: false, message: error?.message || 'Código inválido ou expirado.' };
    }

    if (profilePatch?.display_name || profilePatch?.home_neighborhood) {
      const current = getUserProfileIdentity();
      saveUserProfileIdentity({
        display_name: profilePatch.display_name?.trim() || current.display_name,
        home_neighborhood: profilePatch.home_neighborhood?.trim() || current.home_neighborhood,
      });
    }

    const synced = await syncSupabaseSessionIdentity();
    if (synced && (profilePatch?.display_name?.trim() || profilePatch?.home_neighborhood?.trim())) {
      const updated = saveUserProfileIdentity({
        display_name: profilePatch.display_name?.trim() || synced.display_name,
        home_neighborhood: profilePatch.home_neighborhood?.trim() || synced.home_neighborhood,
      });
      return { ok: true, message: 'Conta confirmada com sucesso!', identity: updated };
    }

    return {
      ok: true,
      message: 'Conta confirmada com sucesso!',
      identity: synced ?? getUserProfileIdentity(),
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Falha ao validar código.',
    };
  }
}

export async function signOutAccount(): Promise<UserProfileIdentity> {
  if (supabase) {
    await supabase.auth.signOut().catch(() => undefined);
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

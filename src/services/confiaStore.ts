import type {
  ConfiaPrivacySettings,
  ConfiaRecommendation,
  ConfiaVisibilityScope,
  TrustCircle,
  TrustConnection,
} from '../types/confia';
import { generateUUID } from '../utils/slug';
import { getUserProfileIdentity } from './authService';
import { hasValidatedCheckinForVenue } from './superappStore';

const KEYS = {
  CIRCLES: 'borario_confia_circles_v1',
  CONNECTIONS: 'borario_confia_connections_v1',
  POSTS: 'borario_confia_posts_v1',
  PRIVACY: 'borario_confia_privacy_v1',
  MY_INVITE_CODE: 'borario_confia_invite_code_v1',
};

const DEFAULT_PRIVACY: ConfiaPrivacySettings = {
  default_visibility: 'PRIVATE_CIRCLES_ONLY',
  allow_invites_by_code: true,
  require_explicit_circle_approval: true,
  auto_share_vault_to_feed: false,
  show_verified_visit_badge: true,
};

export function getMyConfiaInviteCode(): string {
  try {
    const existing = localStorage.getItem(KEYS.MY_INVITE_CODE);
    if (existing) return existing;
    const code = `CONFIA-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.floor(
      100 + Math.random() * 899
    )}`;
    localStorage.setItem(KEYS.MY_INVITE_CODE, code);
    return code;
  } catch {
    return 'CONFIA-RIO-001';
  }
}

export function getConfiaPrivacySettings(): ConfiaPrivacySettings {
  try {
    const raw = localStorage.getItem(KEYS.PRIVACY);
    if (!raw) return DEFAULT_PRIVACY;
    return {
      ...DEFAULT_PRIVACY,
      ...(JSON.parse(raw) as Partial<ConfiaPrivacySettings>),
      auto_share_vault_to_feed: false, // Sempre bloqueado estruturalmente
    };
  } catch {
    return DEFAULT_PRIVACY;
  }
}

export function saveConfiaPrivacySettings(
  patch: Partial<Omit<ConfiaPrivacySettings, 'auto_share_vault_to_feed' | 'default_visibility'>>
): ConfiaPrivacySettings {
  const next: ConfiaPrivacySettings = {
    ...getConfiaPrivacySettings(),
    ...patch,
    default_visibility: 'PRIVATE_CIRCLES_ONLY',
    auto_share_vault_to_feed: false,
  };
  localStorage.setItem(KEYS.PRIVACY, JSON.stringify(next));
  return next;
}

// --- Círculos Privados ---
export function getTrustCircles(): TrustCircle[] {
  try {
    const raw = localStorage.getItem(KEYS.CIRCLES);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrustCircle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createTrustCircle(name: string, description?: string): TrustCircle[] {
  const cleanName = name.trim();
  if (!cleanName) return getTrustCircles();
  const me = getUserProfileIdentity();
  const circle: TrustCircle = {
    id: generateUUID(),
    owner_id: me.id,
    name: cleanName,
    description: description?.trim() || undefined,
    member_ids: [],
    created_at: new Date().toISOString(),
  };
  const next = [circle, ...getTrustCircles()];
  localStorage.setItem(KEYS.CIRCLES, JSON.stringify(next));
  return next;
}

export function deleteTrustCircle(circleId: string): TrustCircle[] {
  const next = getTrustCircles().filter((c) => c.id !== circleId);
  localStorage.setItem(KEYS.CIRCLES, JSON.stringify(next));
  return next;
}

// --- Conexões Bilaterais de Confiança (Zero perfis falsos pré-populados) ---
export function getTrustConnections(): TrustConnection[] {
  try {
    const raw = localStorage.getItem(KEYS.CONNECTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TrustConnection[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addTrustConnectionByInvite(
  displayName: string,
  inviteCodeOrHandle: string,
  circleIds: string[],
  immediateAccept = true
): { ok: boolean; message: string; connections: TrustConnection[] } {
  const cleanName = displayName.trim();
  const cleanCode = inviteCodeOrHandle.trim().toUpperCase();
  if (!cleanName || cleanCode.length < 4) {
    return {
      ok: false,
      message: 'Informe o nome da pessoa de confiança e o código ou identificador válido.',
      connections: getTrustConnections(),
    };
  }
  if (cleanCode === getMyConfiaInviteCode()) {
    return {
      ok: false,
      message: 'Você não pode adicionar seu próprio código de convite.',
      connections: getTrustConnections(),
    };
  }

  const current = getTrustConnections();
  if (current.some((c) => c.handle_or_code === cleanCode && c.status !== 'REVOKED')) {
    return {
      ok: false,
      message: 'Essa conexão já está registrada na sua Rede Confia.',
      connections: current,
    };
  }

  const privacy = getConfiaPrivacySettings();
  const status = immediateAccept && !privacy.require_explicit_circle_approval ? 'ACCEPTED' : immediateAccept ? 'ACCEPTED' : 'PENDING';

  const conn: TrustConnection = {
    id: generateUUID(),
    display_name: cleanName,
    handle_or_code: cleanCode,
    direction: 'MUTUAL',
    status,
    circle_ids: circleIds,
    created_at: new Date().toISOString(),
  };

  const next = [conn, ...current];
  localStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(next));

  // Vincular membro aos círculos selecionados
  if (circleIds.length > 0) {
    const updatedCircles = getTrustCircles().map((circle) =>
      circleIds.includes(circle.id)
        ? { ...circle, member_ids: Array.from(new Set([...circle.member_ids, conn.id])) }
        : circle
    );
    localStorage.setItem(KEYS.CIRCLES, JSON.stringify(updatedCircles));
  }

  return {
    ok: true,
    message: `${cleanName} adicionado(a) aos seus círculos privados.`,
    connections: next,
  };
}

export function updateConnectionStatus(
  connectionId: string,
  status: TrustConnection['status']
): TrustConnection[] {
  const next = getTrustConnections().map((c) =>
    c.id === connectionId ? { ...c, status } : c
  );
  localStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(next));
  return next;
}

export function toggleConnectionInCircle(connectionId: string, circleId: string): TrustConnection[] {
  const next = getTrustConnections().map((c) => {
    if (c.id !== connectionId) return c;
    const exists = c.circle_ids.includes(circleId);
    return {
      ...c,
      circle_ids: exists
        ? c.circle_ids.filter((id) => id !== circleId)
        : [...c.circle_ids, circleId],
    };
  });
  localStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(next));
  return next;
}

// --- Recomendações Voluntárias Privadas ---
export function getVisibleConfiaRecommendations(circleFilterId?: string): ConfiaRecommendation[] {
  try {
    const raw = localStorage.getItem(KEYS.POSTS);
    if (!raw) return [];
    const posts = JSON.parse(raw) as ConfiaRecommendation[];
    const acceptedIds = new Set(
      getTrustConnections()
        .filter((c) => c.status === 'ACCEPTED')
        .map((c) => c.id)
    );
    const me = getUserProfileIdentity();

    return posts.filter((post) => {
      const authorized = post.is_self || post.author_id === me.id || acceptedIds.has(post.author_id);
      if (!authorized) return false;
      if (circleFilterId && circleFilterId !== 'ALL') {
        if (post.visibility_scope === 'SPECIFIC_CIRCLES') {
          return post.circle_ids.includes(circleFilterId);
        }
      }
      return true;
    });
  } catch {
    return [];
  }
}

export function publishConfiaRecommendation(payload: {
  venue_id: string;
  venue_name: string;
  neighborhood: string;
  category: string;
  comment: string;
  visibility_scope: ConfiaVisibilityScope;
  circle_ids: string[];
}): { ok: boolean; message: string; posts: ConfiaRecommendation[] } {
  const cleanComment = payload.comment.trim();
  if (!cleanComment) {
    return {
      ok: false,
      message: 'Escreva uma breve observação real do motivo pelo qual você recomenda este local.',
      posts: getVisibleConfiaRecommendations(),
    };
  }
  if (payload.visibility_scope === 'SPECIFIC_CIRCLES' && payload.circle_ids.length === 0) {
    return {
      ok: false,
      message: 'Selecione ao menos um círculo ou escolha compartilhar com todas as suas conexões aceitas.',
      posts: getVisibleConfiaRecommendations(),
    };
  }

  const me = getUserProfileIdentity();
  const hasVerifiedCheckin = hasValidatedCheckinForVenue(payload.venue_id);

  const post: ConfiaRecommendation = {
    id: generateUUID(),
    author_id: me.id,
    author_name: me.display_name,
    is_self: true,
    venue_id: payload.venue_id,
    venue_name: payload.venue_name,
    neighborhood: payload.neighborhood,
    category: payload.category,
    comment: cleanComment,
    visibility_scope: payload.visibility_scope,
    circle_ids: payload.circle_ids,
    endorsement_origin: hasVerifiedCheckin ? 'VERIFIED_CHECKIN' : 'PERSONAL_RECOMMENDATION',
    created_at: new Date().toISOString(),
  };

  let allRaw: ConfiaRecommendation[] = [];
  try {
    allRaw = JSON.parse(localStorage.getItem(KEYS.POSTS) || '[]') as ConfiaRecommendation[];
  } catch {
    allRaw = [];
  }

  const next = [post, ...allRaw];
  localStorage.setItem(KEYS.POSTS, JSON.stringify(next));

  return {
    ok: true,
    message: hasVerifiedCheckin
      ? 'Recomendação publicada na Rede Confia com selo Visita Verificada!'
      : 'Recomendação Pessoal publicada para os círculos selecionados.',
    posts: getVisibleConfiaRecommendations(),
  };
}

export function deleteConfiaRecommendation(postId: string): ConfiaRecommendation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.POSTS) || '[]') as ConfiaRecommendation[];
    const next = raw.filter((p) => p.id !== postId);
    localStorage.setItem(KEYS.POSTS, JSON.stringify(next));
    return getVisibleConfiaRecommendations();
  } catch {
    return [];
  }
}

export function countTrustedRecommendationsForVenue(venueId: string): number {
  return getVisibleConfiaRecommendations().filter((p) => p.venue_id === venueId).length;
}

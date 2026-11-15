import type {
  ConfiaFeedEntryType,
  ConfiaPrivacySettings,
  ConfiaRecommendation,
  ConfiaVisibilityScope,
  TrustCircle,
  TrustConnection,
} from '../types/confia';
import type { VisitProofLevel } from '../types/verification';
import { generateUUID } from '../utils/slug';
import { getUserProfileIdentity } from './authService';
import { isValidUuid, supabase } from './supabaseClient';
import {
  hasValidatedCheckinForVenue,
} from './superappStore';
import {
  hasVerifiedConsumptionForVenue,
  hasVerifiedVisitForVenue,
} from './visitProofStore';

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

export const SUGGESTED_CIRCLE_NAMES = [
  'Amigos',
  'Família',
  'Casal',
  'Trabalho',
  'Galera',
] as const;

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
  const existing = getTrustCircles();
  if (existing.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
    return existing;
  }
  const me = getUserProfileIdentity();
  const circle: TrustCircle = {
    id: generateUUID(),
    owner_id: me.id,
    name: cleanName,
    description: description?.trim() || undefined,
    member_ids: [],
    created_at: new Date().toISOString(),
  };
  const next = [circle, ...existing];
  localStorage.setItem(KEYS.CIRCLES, JSON.stringify(next));

  if (supabase && isValidUuid(me.id)) {
    void supabase
      .from('trust_circles')
      .upsert({
        id: circle.id,
        owner_id: me.id,
        name: circle.name,
        description: circle.description || null,
        created_at: circle.created_at,
      })
      .then(() => undefined, () => undefined);
  }

  return next;
}

export function deleteTrustCircle(circleId: string): TrustCircle[] {
  const next = getTrustCircles().filter((c) => c.id !== circleId);
  localStorage.setItem(KEYS.CIRCLES, JSON.stringify(next));
  const me = getUserProfileIdentity();
  if (supabase && isValidUuid(me.id) && isValidUuid(circleId)) {
    void supabase
      .from('trust_circles')
      .delete()
      .eq('id', circleId)
      .then(() => undefined, () => undefined);
  }
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

export interface AddConnectionOptions {
  immediateAccept?: boolean;
  direction?: TrustConnection['direction'];
  peerUserId?: string;
}

export function addTrustConnectionByInvite(
  displayName: string,
  inviteCodeOrHandle: string,
  circleIds: string[],
  immediateOrOptions: boolean | AddConnectionOptions = false
): { ok: boolean; message: string; connections: TrustConnection[] } {
  const privacy = getConfiaPrivacySettings();
  if (!privacy.allow_invites_by_code) {
    return {
      ok: false,
      message:
        'Conexões por código estão desativadas nas suas configurações de privacidade.',
      connections: getTrustConnections(),
    };
  }

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

  const opts: AddConnectionOptions =
    typeof immediateOrOptions === 'boolean'
      ? { immediateAccept: immediateOrOptions }
      : immediateOrOptions;

  const direction: TrustConnection['direction'] = opts.direction || 'OUTGOING';
  // Respeita aprovação explícita do círculo: conexões recebidas ou sem aceite explícito ficam PENDING
  const canAutoAccept =
    Boolean(opts.immediateAccept) &&
    direction !== 'INCOMING' &&
    !privacy.require_explicit_circle_approval;
  const status: TrustConnection['status'] = canAutoAccept ? 'ACCEPTED' : 'PENDING';

  const conn: TrustConnection = {
    id: generateUUID(),
    peer_user_id: opts.peerUserId,
    display_name: cleanName,
    handle_or_code: cleanCode,
    direction,
    status,
    circle_ids: circleIds,
    created_at: new Date().toISOString(),
  };

  const next = [conn, ...current];
  localStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(next));

  // Vincular membro aos círculos selecionados apenas após aceite
  if (status === 'ACCEPTED' && circleIds.length > 0) {
    const updatedCircles = getTrustCircles().map((circle) =>
      circleIds.includes(circle.id)
        ? { ...circle, member_ids: Array.from(new Set([...circle.member_ids, conn.id])) }
        : circle
    );
    localStorage.setItem(KEYS.CIRCLES, JSON.stringify(updatedCircles));
  }

  const me = getUserProfileIdentity();
  if (supabase && isValidUuid(me.id)) {
    void supabase
      .from('trust_connections')
      .upsert({
        id: conn.id,
        owner_id: me.id,
        peer_user_id: conn.peer_user_id || null,
        display_name: conn.display_name,
        handle_or_code: conn.handle_or_code,
        direction: conn.direction,
        status: conn.status,
        created_at: conn.created_at,
      })
      .then(() => undefined, () => undefined);
  }

  return {
    ok: true,
    message:
      status === 'ACCEPTED'
        ? `${cleanName} adicionado(a) aos seus círculos privados.`
        : `Convite para ${cleanName} registrado como Pendente. Aprove explicitamente para liberar acesso aos círculos.`,
    connections: next,
  };
}

export function updateConnectionStatus(
  connectionId: string,
  status: TrustConnection['status']
): TrustConnection[] {
  let updatedTarget: TrustConnection | undefined;
  const next = getTrustConnections().map((c) => {
    if (c.id !== connectionId) return c;
    updatedTarget = { ...c, status };
    return updatedTarget;
  });
  localStorage.setItem(KEYS.CONNECTIONS, JSON.stringify(next));

  if (updatedTarget && status === 'ACCEPTED' && updatedTarget.circle_ids.length > 0) {
    const updatedCircles = getTrustCircles().map((circle) =>
      updatedTarget!.circle_ids.includes(circle.id)
        ? { ...circle, member_ids: Array.from(new Set([...circle.member_ids, updatedTarget!.id])) }
        : circle
    );
    localStorage.setItem(KEYS.CIRCLES, JSON.stringify(updatedCircles));
  }

  const me = getUserProfileIdentity();
  if (supabase && isValidUuid(me.id) && isValidUuid(connectionId)) {
    void supabase
      .from('trust_connections')
      .update({ status })
      .eq('id', connectionId)
      .then(() => undefined, () => undefined);
  }

  return next;
}

export function approveTrustConnection(connectionId: string): TrustConnection[] {
  return updateConnectionStatus(connectionId, 'ACCEPTED');
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

// --- Recomendações e Entradas Tipadas Privadas (9 tipos oficiais) ---
export function getVisibleConfiaRecommendations(circleFilterId?: string): ConfiaRecommendation[] {
  try {
    const raw = localStorage.getItem(KEYS.POSTS);
    if (!raw) return [];
    const posts = JSON.parse(raw) as ConfiaRecommendation[];
    const acceptedAuthorIds = new Set<string>();
    for (const conn of getTrustConnections()) {
      if (conn.status === 'ACCEPTED') {
        acceptedAuthorIds.add(conn.id);
        if (conn.peer_user_id) {
          acceptedAuthorIds.add(conn.peer_user_id);
        }
      }
    }
    const me = getUserProfileIdentity();

    return posts.filter((post) => {
      const authorized =
        post.is_self || post.author_id === me.id || acceptedAuthorIds.has(post.author_id);
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
  entry_type?: ConfiaFeedEntryType;
  metadata?: Record<string, string | number | boolean>;
}): { ok: boolean; message: string; posts: ConfiaRecommendation[] } {
  const cleanComment = payload.comment.trim();
  if (!cleanComment) {
    return {
      ok: false,
      message: 'Escreva uma breve observação real do motivo pelo qual você recomenda ou registra esta experiência.',
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
  const hasConsumption = hasVerifiedConsumptionForVenue(payload.venue_id);
  const hasVisitProof = hasVerifiedVisitForVenue(payload.venue_id) || hasValidatedCheckinForVenue(payload.venue_id);

  let visitProofLevel: VisitProofLevel | undefined;
  if (hasConsumption) {
    visitProofLevel = 'VERIFIED_CONSUMPTION';
  } else if (hasVisitProof) {
    visitProofLevel = 'VERIFIED_VISIT';
  }

  let resolvedEntryType: ConfiaFeedEntryType = payload.entry_type || 'PERSONAL_RECOMMENDATION';
  if (!payload.entry_type) {
    if (hasConsumption) resolvedEntryType = 'VERIFIED_CONSUMPTION';
    else if (hasVisitProof) resolvedEntryType = 'VERIFIED_VISIT';
  }

  // Bloqueia declarar consumo verificado ou visita verificada sem prova correspondente
  if (resolvedEntryType === 'VERIFIED_CONSUMPTION' && !hasConsumption) {
    resolvedEntryType = hasVisitProof ? 'VERIFIED_VISIT' : 'LIVED_EXPERIENCE';
  }
  if (resolvedEntryType === 'VERIFIED_VISIT' && !hasVisitProof) {
    resolvedEntryType = 'PERSONAL_RECOMMENDATION';
  }

  const post: ConfiaRecommendation = {
    id: generateUUID(),
    author_id: me.id,
    author_name: me.display_name,
    is_self: true,
    entry_type: resolvedEntryType,
    venue_id: payload.venue_id,
    venue_name: payload.venue_name,
    neighborhood: payload.neighborhood,
    category: payload.category,
    comment: cleanComment,
    visibility_scope: payload.visibility_scope,
    circle_ids: payload.circle_ids,
    endorsement_origin: hasVisitProof ? 'VERIFIED_CHECKIN' : 'PERSONAL_RECOMMENDATION',
    visit_proof_level: visitProofLevel,
    metadata: payload.metadata,
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

  if (supabase && isValidUuid(me.id) && isValidUuid(payload.venue_id)) {
    void supabase
      .from('confia_recommendations')
      .insert({
        id: post.id,
        author_id: me.id,
        venue_id: payload.venue_id,
        comment: post.comment,
        visibility_scope: post.visibility_scope,
        circle_ids: post.circle_ids,
        endorsement_origin: post.endorsement_origin,
        entry_type: post.entry_type,
        visit_proof_level: post.visit_proof_level || null,
        metadata: post.metadata || {},
        created_at: post.created_at,
      })
      .then(() => undefined, () => undefined);
  }

  return {
    ok: true,
    message:
      resolvedEntryType === 'VERIFIED_CONSUMPTION'
        ? 'Registro publicado na Rede Confia com selo Consumo Verificado!'
        : hasVisitProof
          ? 'Publicação compartilhada na Rede Confia com selo Visita Verificada!'
          : 'Publicação compartilhada com segurança nos seus círculos selecionados.',
    posts: getVisibleConfiaRecommendations(),
  };
}

export function deleteConfiaRecommendation(postId: string): ConfiaRecommendation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEYS.POSTS) || '[]') as ConfiaRecommendation[];
    const next = raw.filter((p) => p.id !== postId);
    localStorage.setItem(KEYS.POSTS, JSON.stringify(next));
    const me = getUserProfileIdentity();
    if (supabase && isValidUuid(me.id) && isValidUuid(postId)) {
      void supabase
        .from('confia_recommendations')
        .delete()
        .eq('id', postId)
        .then(() => undefined, () => undefined);
    }
    return getVisibleConfiaRecommendations();
  } catch {
    return [];
  }
}

export function countTrustedRecommendationsForVenue(venueId: string): number {
  return getVisibleConfiaRecommendations().filter((p) => p.venue_id === venueId).length;
}

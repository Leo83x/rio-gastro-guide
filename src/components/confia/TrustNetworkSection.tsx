import {
  Award,
  BadgeCheck,
  BookmarkPlus,
  CheckCircle2,
  Compass,
  HeartHandshake,
  Lock,
  MessageSquareHeart,
  ReceiptText,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  deleteConfiaRecommendation,
  getVisibleConfiaRecommendations,
  publishConfiaRecommendation,
} from '../../services/confiaStore';
import { addIntentVaultItem, hasVenueInVault } from '../../services/intentVaultStore';
import { hasValidatedCheckinForVenue } from '../../services/superappStore';
import {
  hasVerifiedConsumptionForVenue,
  hasVerifiedVisitForVenue,
} from '../../services/visitProofStore';
import type {
  ConfiaFeedEntryType,
  ConfiaRecommendation,
  ConfiaVisibilityScope,
  TrustCircle,
  TrustConnection,
} from '../../types/confia';
import type { IntentVaultItem } from '../../types/intention';
import type { Restaurant } from '../../types/restaurant';

interface TrustNetworkSectionProps {
  catalog: Restaurant[];
  circles: TrustCircle[];
  connections: TrustConnection[];
  posts: ConfiaRecommendation[];
  preselectedVenue?: Restaurant | null;
  preselectedNote?: string;
  onPostsChanged: (next: ConfiaRecommendation[]) => void;
  onVaultItemsChanged: (next: IntentVaultItem[]) => void;
  onOpenCircleManager: () => void;
  onSelectVenue: (venue: Restaurant) => void;
}

const ENTRY_TYPE_META: Record<
  ConfiaFeedEntryType,
  { label: string; shortLabel: string; hint: string }
> = {
  PERSONAL_RECOMMENDATION: {
    label: 'Recomendação Pessoal',
    shortLabel: 'Recomendação',
    hint: 'Indicação honesta de confiança para seus círculos.',
  },
  LIVED_EXPERIENCE: {
    label: 'Experiência Vivida',
    shortLabel: 'Vivida',
    hint: 'Relato real de visita ou programa recente.',
  },
  VERIFIED_VISIT: {
    label: 'Visita Verificada',
    shortLabel: 'Visita Verificada',
    hint: 'Exige check-in QR dinâmico validado no estabelecimento.',
  },
  VERIFIED_CONSUMPTION: {
    label: 'Consumo Verificado',
    shortLabel: 'Consumo Verificado',
    hint: 'Exige evidência adicional pós-consumo confirmada pelo parceiro.',
  },
  SAVED_PLACE: {
    label: 'Lugar Salvo',
    shortLabel: 'Lugar Salvo',
    hint: 'Compartilhe manualmente um lugar que está no seu radar.',
  },
  INVITE: {
    label: 'Convite',
    shortLabel: 'Convite',
    hint: 'Convide um círculo específico para um programa no Rio.',
  },
  SHARED_ITINERARY: {
    label: 'Roteiro Compartilhado',
    shortLabel: 'Roteiro',
    hint: 'Divida um roteiro montado para os amigos votarem.',
  },
  SHARED_OPPORTUNITY: {
    label: 'Oportunidade Compartilhada',
    shortLabel: 'Oportunidade',
    hint: 'Sinalize uma oferta individual, demanda ou última hora do Bora Club.',
  },
  ACHIEVEMENT: {
    label: 'Conquista',
    shortLabel: 'Conquista',
    hint: 'Compartilhe um marco real do seu Passaporte Carioca.',
  },
};

function renderProofBadge(post: ConfiaRecommendation) {
  if (post.visit_proof_level === 'VERIFIED_CONSUMPTION') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-1 text-[10px] font-bold text-purple-700 dark:text-purple-300">
        <ReceiptText className="h-3 w-3" />
        Consumo Verificado
      </span>
    );
  }
  if (post.visit_proof_level === 'VERIFIED_VISIT') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
        <BadgeCheck className="h-3 w-3" />
        Visita Verificada
      </span>
    );
  }
  if (
    post.visit_proof_level === 'CHECKIN_REGISTERED' ||
    post.visit_proof_level === 'PRESENCE_WITH_EVIDENCE'
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-bold text-sky-700 dark:text-sky-300">
        <CheckCircle2 className="h-3 w-3" />
        Check-in realizado
      </span>
    );
  }
  if (post.endorsement_origin === 'VERIFIED_CHECKIN') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
        <BadgeCheck className="h-3 w-3" />
        Visita Verificada
      </span>
    );
  }
  return null;
}

export function TrustNetworkSection({
  catalog,
  circles,
  connections,
  posts,
  preselectedVenue,
  preselectedNote,
  onPostsChanged,
  onVaultItemsChanged,
  onOpenCircleManager,
  onSelectVenue,
}: TrustNetworkSectionProps) {
  const [circleFilter, setCircleFilter] = useState<string>('ALL');
  const [entryTypeFilter, setEntryTypeFilter] = useState<ConfiaFeedEntryType | 'ALL'>('ALL');
  const [entryType, setEntryType] = useState<ConfiaFeedEntryType>('PERSONAL_RECOMMENDATION');
  const [venueId, setVenueId] = useState<string>(preselectedVenue?.id || catalog[0]?.id || '');
  const [comment, setComment] = useState<string>(preselectedNote || '');
  const [visibilityScope, setVisibilityScope] = useState<ConfiaVisibilityScope>('ALL_CONNECTIONS');
  const [targetCircleIds, setTargetCircleIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string>('');

  const acceptedConnections = connections.filter((c) => c.status === 'ACCEPTED');
  const selectedVenue = catalog.find((v) => v.id === venueId) || preselectedVenue || catalog[0];
  const selectedVenueConsumption = selectedVenue
    ? hasVerifiedConsumptionForVenue(selectedVenue.id)
    : false;
  const selectedVenueVerified = selectedVenue
    ? hasVerifiedVisitForVenue(selectedVenue.id) || hasValidatedCheckinForVenue(selectedVenue.id)
    : false;

  const scopedPosts =
    circleFilter === 'ALL' ? posts : getVisibleConfiaRecommendations(circleFilter);
  const visiblePosts =
    entryTypeFilter === 'ALL'
      ? scopedPosts
      : scopedPosts.filter(
          (p) => (p.entry_type || 'PERSONAL_RECOMMENDATION') === entryTypeFilter
        );

  const handlePublish = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedVenue) return;

    const res = publishConfiaRecommendation({
      venue_id: selectedVenue.id,
      venue_name: selectedVenue.name,
      neighborhood: selectedVenue.neighborhood,
      category: selectedVenue.category,
      comment,
      visibility_scope: visibilityScope,
      circle_ids: targetCircleIds,
      entry_type: entryType,
    });

    setFeedback(res.message);
    if (res.ok) {
      setComment('');
      onPostsChanged(res.posts);
    }
  };

  const handleSaveToMyVault = (post: ConfiaRecommendation) => {
    const next = addIntentVaultItem({
      title: post.venue_name,
      source_type: 'catalog_bookmark',
      neighborhood_tag: post.neighborhood,
      notes: `Indicado por ${post.author_name} na Rede Confia: "${post.comment}"`,
      linked_venue_id: post.venue_id,
      linked_venue_name: post.venue_name,
      status: 'SAVED',
      processing_status: 'COMPLETED',
    });
    onVaultItemsChanged(next);
  };

  return (
    <div className="space-y-6">
      {/* Circle Filter + Connections CTA */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#397B68]/25 bg-[#397B68]/8 p-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#397B68] text-white">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)]">
              Círculos privados de confiança · {acceptedConnections.length}{' '}
              {acceptedConnections.length === 1 ? 'pessoa conectada' : 'pessoas conectadas'}
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Zero comentários de desconhecidos. Visibilidade restrita às conexões explicitamente aprovadas e aos círculos autorizados.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCircleManager}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#123B56] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#102F46]"
        >
          <UserPlus className="h-3.5 w-3.5 text-[#F7931E]" />
          Gerenciar Círculos &amp; Convites
        </button>
      </div>

      {/* Circle Pills + Typed Feed Filters */}
      <div className="space-y-2">
        {circles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCircleFilter('ALL')}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                circleFilter === 'ALL'
                  ? 'border-transparent bg-[#397B68] text-white'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              Todos os círculos
            </button>
            {circles.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCircleFilter(c.id)}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  circleFilter === c.id
                    ? 'border-transparent bg-[#397B68] text-white'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                }`}
              >
                <Users className="h-3 w-3" />
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEntryTypeFilter('ALL')}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
              entryTypeFilter === 'ALL'
                ? 'border-[#123B56] bg-[#123B56] text-white'
                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            Todos os tipos
          </button>
          {(Object.keys(ENTRY_TYPE_META) as ConfiaFeedEntryType[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setEntryTypeFilter(key)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                entryTypeFilter === key
                  ? 'border-[#FF6B35] bg-[#FF6B35] text-white'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
              }`}
            >
              {ENTRY_TYPE_META[key].shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Voluntary Typed Entry Composer */}
        <form
          onSubmit={handlePublish}
          className="space-y-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
            <MessageSquareHeart className="h-4 w-4" />
            Publicação Tipada &amp; Voluntária
          </div>
          <h3 className="font-sans text-lg font-bold text-[var(--text-primary)]">
            Compartilhar nos seus círculos
          </h3>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              Tipo de registro na Rede Confia
            </label>
            <select
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as ConfiaFeedEntryType)}
              className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              {(Object.keys(ENTRY_TYPE_META) as ConfiaFeedEntryType[]).map((typeKey) => (
                <option key={typeKey} value={typeKey}>
                  {ENTRY_TYPE_META[typeKey].label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {ENTRY_TYPE_META[entryType].hint}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              Estabelecimento ou experiência
            </label>
            <select
              value={selectedVenue?.id || ''}
              onChange={(e) => setVenueId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)]"
            >
              {catalog.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} — {v.neighborhood}
                </option>
              ))}
            </select>

            <p className="mt-1.5 text-[11px]">
              {selectedVenueConsumption ? (
                <span className="inline-flex items-center gap-1 font-semibold text-purple-600 dark:text-purple-300">
                  <ReceiptText className="h-3.5 w-3.5" />
                  Prova disponível: Consumo Verificado (confirmado pelo parceiro).
                </span>
              ) : selectedVenueVerified ? (
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Prova disponível: Visita Verificada (QR validado · consumo ainda não comprovado).
                </span>
              ) : (
                <span className="text-[var(--text-secondary)]">
                  Sem prova QR neste local: publicações de Visita/Consumo Verificado são automaticamente rebaixadas para proteção antifraude.
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
              Sua percepção ou convite
            </label>
            <textarea
              rows={3}
              required
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex: Atendimento tranquilo para ir com criança no sábado, ou Convite para jantar sexta às 20h..."
              className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[#397B68] focus:outline-none"
            />
          </div>

          <div className="space-y-2 text-xs">
            <label className="block font-semibold text-[var(--text-secondary)]">
              Quem pode ver?
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisibilityScope('ALL_CONNECTIONS')}
                className={`flex-1 rounded-xl border py-2 text-[11px] font-bold ${
                  visibilityScope === 'ALL_CONNECTIONS'
                    ? 'border-[#397B68] bg-[#397B68]/15 text-[#397B68]'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)]'
                }`}
              >
                Todas as conexões
              </button>
              <button
                type="button"
                disabled={circles.length === 0}
                onClick={() => setVisibilityScope('SPECIFIC_CIRCLES')}
                className={`flex-1 rounded-xl border py-2 text-[11px] font-bold disabled:opacity-45 ${
                  visibilityScope === 'SPECIFIC_CIRCLES'
                    ? 'border-[#397B68] bg-[#397B68]/15 text-[#397B68]'
                    : 'border-[var(--border-hairline)] text-[var(--text-secondary)]'
                }`}
              >
                Círculos escolhidos
              </button>
            </div>

            {visibilityScope === 'SPECIFIC_CIRCLES' && circles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {circles.map((c) => {
                  const active = targetCircleIds.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setTargetCircleIds((prev) =>
                          active ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                        )
                      }
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        active
                          ? 'border-[#397B68] bg-[#397B68] text-white'
                          : 'border-[var(--border-hairline)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {feedback && (
            <p className="rounded-xl bg-[#397B68]/15 px-3 py-2 text-xs font-semibold text-[#397B68]">
              {feedback}
            </p>
          )}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#397B68] py-2.5 text-xs font-bold text-white hover:opacity-95"
          >
            <Send className="h-3.5 w-3.5" />
            Publicar na minha Rede Confia
          </button>
        </form>

        {/* Private Circle Feed */}
        <div className="space-y-4 lg:col-span-2">
          {visiblePosts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#397B68]/15 text-[#397B68]">
                <HeartHandshake className="h-6 w-6" />
              </div>
              <h3 className="font-sans mt-3 text-lg font-bold text-[var(--text-primary)]">
                {acceptedConnections.length === 0
                  ? 'Sua Rede Confia ainda não tem recomendações'
                  : 'Nenhum registro com estes filtros ainda'}
              </h3>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
                Aqui você vê apenas registros reais de pessoas aceitas nos seus círculos — sem avaliações anônimas ou algoritmos públicos. Crie um círculo em 1 toque, convide alguém de confiança ou publique ao lado.
              </p>
              <button
                type="button"
                onClick={onOpenCircleManager}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[#397B68]"
              >
                <UserPlus className="h-3.5 w-3.5 text-[#397B68]" />
                Criar círculo em 1 toque ou convidar amigo
              </button>
            </div>
          ) : (
            visiblePosts.map((post) => {
              const venue = catalog.find((v) => v.id === post.venue_id);
              const alreadySaved = hasVenueInVault(post.venue_id);
              const typeKey: ConfiaFeedEntryType =
                post.entry_type ||
                (post.endorsement_origin === 'VERIFIED_CHECKIN'
                  ? 'VERIFIED_VISIT'
                  : 'PERSONAL_RECOMMENDATION');
              const typeMeta = ENTRY_TYPE_META[typeKey] || ENTRY_TYPE_META.PERSONAL_RECOMMENDATION;
              const proofBadge = renderProofBadge(post);

              return (
                <article
                  key={post.id}
                  className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)]">
                        <Lock className="h-3 w-3 text-[#397B68]" />
                        {post.is_self ? `Você (${post.author_name})` : post.author_name}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full bg-[#123B56]/10 px-2.5 py-1 text-[10px] font-bold text-[#123B56] dark:bg-white/10 dark:text-white">
                        {typeKey === 'ACHIEVEMENT' ? (
                          <Award className="h-3 w-3 text-[#F7931E]" />
                        ) : typeKey === 'SHARED_ITINERARY' ? (
                          <Compass className="h-3 w-3 text-[#FF6B35]" />
                        ) : (
                          <Sparkles className="h-3 w-3 text-[#FF6B35]" />
                        )}
                        {typeMeta.label}
                      </span>

                      {proofBadge}
                    </div>

                    <span className="text-[11px] text-[var(--text-secondary)]">
                      {new Date(post.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => venue && onSelectVenue(venue)}
                      className="text-left font-sans text-lg font-bold text-[var(--text-primary)] hover:text-[#FF6B35]"
                    >
                      {post.venue_name}
                    </button>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {post.neighborhood} · {post.category}
                    </p>
                  </div>

                  <p className="mt-2.5 rounded-2xl bg-[var(--bg-canvas)] px-4 py-3 text-xs leading-relaxed text-[var(--text-primary)]">
                    “{post.comment}”
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      {venue && (
                        <button
                          type="button"
                          onClick={() => onSelectVenue(venue)}
                          className="rounded-xl border border-[var(--border-hairline)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
                        >
                          Abrir guia
                        </button>
                      )}

                      {!alreadySaved ? (
                        <button
                          type="button"
                          onClick={() => handleSaveToMyVault(post)}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#123B56] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#102F46]"
                        >
                          <BookmarkPlus className="h-3.5 w-3.5 text-[#F7931E]" />
                          Guardar no meu Cofre
                        </button>
                      ) : (
                        <span className="inline-flex items-center rounded-xl bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          Já está no seu Cofre
                        </span>
                      )}
                    </div>

                    {post.is_self && (
                      <button
                        type="button"
                        onClick={() => onPostsChanged(deleteConfiaRecommendation(post.id))}
                        className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-500"
                        title="Remover indicação"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

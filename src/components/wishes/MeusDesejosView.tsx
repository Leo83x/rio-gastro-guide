import {
  ArrowRight,
  Bookmark,
  Camera,
  Compass,
  ExternalLink,
  Gift,
  Link2,
  MapPin,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  deleteIntentVaultItem,
  setIntentVaultStatus,
} from '../../services/intentVaultStore';
import { getPartnerOfferings } from '../../services/opportunityStore';
import type { IntentStatus, IntentVaultItem } from '../../types/intention';
import type { Restaurant } from '../../types/restaurant';

interface MeusDesejosViewProps {
  catalog: Restaurant[];
  items: IntentVaultItem[];
  onItemsChanged: (next: IntentVaultItem[]) => void;
  onOpenCaptureModal: () => void;
  onPlanWithBoraIa: (promptText: string) => void;
  onSelectVenue: (venue: Restaurant) => void;
  onGoToPlanner?: () => void;
}

const SOURCE_LABELS: Record<IntentVaultItem['source_type'], { label: string; icon: typeof Link2 }> = {
  instagram_link: { label: 'Instagram', icon: Camera },
  tiktok_link: { label: 'TikTok', icon: Link2 },
  youtube_link: { label: 'YouTube', icon: Link2 },
  web_link: { label: 'Link Web', icon: ExternalLink },
  screenshot: { label: 'Print salvo', icon: Upload },
  manual_note: { label: 'Nota pessoal', icon: Bookmark },
  catalog_bookmark: { label: 'Catálogo BoraRio', icon: Compass },
};

export function MeusDesejosView({
  catalog,
  items,
  onItemsChanged,
  onOpenCaptureModal,
  onPlanWithBoraIa,
  onSelectVenue,
  onGoToPlanner,
}: MeusDesejosViewProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPPORTUNITIES' | IntentStatus>('ALL');
  const [search, setSearch] = useState('');
  const [quickLink, setQuickLink] = useState('');

  // Active offerings mapped by venue ID
  const activeOfferings = useMemo(() => {
    const list = getPartnerOfferings();
    const map = new Map<string, typeof list[number]>();
    for (const off of list) {
      if (off.status === 'PUBLISHED') {
        map.set(off.restaurant_id, off);
      }
    }
    return map;
  }, []);

  const activeCount = items.filter((i) => i.status !== 'ARCHIVED').length;
  const withOpportunityCount = items.filter((i) => {
    if (i.status === 'ARCHIVED') return false;
    return i.linked_venue_id && activeOfferings.has(i.linked_venue_id);
  }).length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === 'ALL') {
        if (item.status === 'ARCHIVED') return false;
      } else if (statusFilter === 'OPPORTUNITIES') {
        if (item.status === 'ARCHIVED') return false;
        if (!item.linked_venue_id || !activeOfferings.has(item.linked_venue_id)) return false;
      } else if (item.status !== statusFilter) {
        return false;
      }

      if (!q) return true;
      const hay = `${item.title} ${item.neighborhood_tag || ''} ${item.category_tag || ''} ${
        item.notes || ''
      } ${item.linked_venue_name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, statusFilter, search, activeOfferings]);

  const handleStatusChange = (id: string, nextStatus: IntentStatus) => {
    const next = setIntentVaultStatus(id, nextStatus);
    onItemsChanged(next);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Deseja remover este desejo da sua lista?')) {
      const next = deleteIntentVaultItem(id);
      onItemsChanged(next);
    }
  };

  const handleShareWhatsApp = (item: IntentVaultItem) => {
    const linked = item.linked_venue_id ? catalog.find((v) => v.id === item.linked_venue_id) : null;
    const venueName = linked?.name || item.title;
    const neighborhood = linked?.neighborhood || item.neighborhood_tag || 'Rio de Janeiro';
    const text = `Olha esse lugar que guardei no BoraRio: *${venueName}* em ${neighborhood}! Bora combinar de ir?`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* 1. Header Oficial: Meus Desejos */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-6 md:flex-row md:items-end">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0E2235] via-[#123B56] to-[#0077B6] px-3 py-1 text-[11px] font-bold text-white shadow-xs">
            <Bookmark className="h-3.5 w-3.5 text-[#FFB347]" />
            BoraRio · Central de Desejos
          </span>
          <h1 className="font-sans mt-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Meus Desejos
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Lugares e experiências que você quer aproveitar no Rio. Guarde, acompanhe oportunidades e transforme em planos.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenCaptureModal}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-105"
        >
          <Plus className="h-4 w-4" />
          Adicionar Desejo ou Link
        </button>
      </div>

      {/* 2. Três Pilares Conceituais (Salvar, Acompanhar Oportunidades, Transformar em Plano) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#123B56]/10 text-[#123B56] dark:bg-[#123B56]/40 dark:text-[#7FB6D9]">
              <Bookmark className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-xs font-bold text-[var(--text-primary)]">1. Salvar um lugar</h2>
              <p className="text-[11px] text-[var(--text-secondary)]">Estabelecimentos, eventos ou links.</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
            Guarde do catálogo ou cole links do Instagram e web. A IA identifica o local e organiza sua lista.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#397B68]/30 bg-[#397B68]/8 p-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#397B68] text-white">
              <Gift className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-xs font-bold text-[var(--text-primary)]">2. Acompanhar oportunidades</h2>
              <p className="text-[11px] text-[#397B68] dark:text-[#4CA188] font-semibold">
                {withOpportunityCount} com benefício ativo
              </p>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
            Manifeste interesse e receba avisos quando o parceiro disponibilizar ofertas ou horários especiais.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#0077B6]/30 bg-gradient-to-br from-[#0E2235] via-[#123B56] to-[#0077B6] p-4 text-white shadow-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-[#FFB347]">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="text-xs font-bold text-white">3. Transformar em plano</h2>
              <p className="text-[11px] text-[#F1E8D8]/80">Combine datas e amigos.</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-[#F1E8D8]/90 leading-relaxed">
            Monte roteiros individuais ou em grupo, compartilhe via WhatsApp e consulte no mapa interativo.
          </p>
          {onGoToPlanner && (
            <button
              type="button"
              onClick={onGoToPlanner}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs transition hover:bg-white/30"
            >
              Abrir Planejador de Roteiros
              <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Barra de Colar Link do Instagram / Web com IA */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 shadow-sm">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2">
            <Link2 className="h-4 w-4 shrink-0 text-[#FF6B35]" />
            <input
              type="text"
              value={quickLink}
              onChange={(e) => setQuickLink(e.target.value)}
              placeholder="Cole um link do Instagram ou da web (ex: instagram.com/p/...)"
              className="w-full bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/80 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={onOpenCaptureModal}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0E2235] via-[#123B56] to-[#0077B6] px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-110"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#FFB347]" />
            Identificar com IA
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
          * Identificação baseada no conteúdo público do link. O BoraRio conecta o estabelecimento e notifica você se surgirem ofertas reais cadastradas.
        </p>
      </div>

      {/* 4. Filtros de Status & Busca */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'ALL' as const, label: `Todos (${activeCount})` },
            { id: 'OPPORTUNITIES' as const, label: `Com Benefício Ativo (${withOpportunityCount})` },
            { id: 'SAVED' as const, label: 'Apenas Salvos' },
            { id: 'PLANNED' as const, label: 'Planejados' },
            { id: 'VISITED' as const, label: 'Já Visitados' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                statusFilter === f.id
                  ? 'bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-xs'
                  : 'border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs">
          <Search className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar desejos..."
            className="w-36 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none sm:w-48"
          />
        </div>
      </div>

      {/* 5. Lista de Desejos */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF6B35]/15 text-[#FF6B35]">
            <Bookmark className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-sans text-base font-bold text-[var(--text-primary)]">
            {search ? 'Nenhum desejo encontrado para esta busca.' : 'Sua lista de desejos está vazia.'}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-[var(--text-secondary)]">
            Navegue pelo BoraRio, explore o catálogo ou cole links do Instagram de lugares que quer conhecer no Rio.
          </p>
          <button
            type="button"
            onClick={onOpenCaptureModal}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2 text-xs font-bold text-white shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar meu primeiro desejo
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const linked = item.linked_venue_id
              ? catalog.find((v) => v.id === item.linked_venue_id)
              : null;
            const sourceMeta = SOURCE_LABELS[item.source_type] || {
              label: 'Link Web',
              icon: Link2,
            };
            const SourceIcon = sourceMeta.icon;
            const activeOffer = item.linked_venue_id ? activeOfferings.get(item.linked_venue_id) : null;

            return (
              <div
                key={item.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-xs transition hover:border-[#FF6B35]/50 hover:shadow-md"
              >
                <div>
                  {/* Top Bar: Source + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-canvas)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                      <SourceIcon className="h-3 w-3" />
                      {sourceMeta.label}
                    </span>

                    <select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item.id, e.target.value as IntentStatus)}
                      className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-primary)] focus:outline-none"
                    >
                      <option value="SAVED">Salvo</option>
                      <option value="PLANNED">Planejado</option>
                      <option value="VISITED">Visitado</option>
                      <option value="ARCHIVED">Arquivado</option>
                    </select>
                  </div>

                  {/* Title & Neighborhood */}
                  <div className="mt-3">
                    <h3
                      onClick={() => linked && onSelectVenue(linked)}
                      className={`font-sans text-base font-bold text-[var(--text-primary)] ${
                        linked ? 'cursor-pointer hover:text-[#FF6B35]' : ''
                      }`}
                    >
                      {item.title}
                    </h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                      <MapPin className="h-3 w-3 text-[#FF6B35]" />
                      {linked?.neighborhood || item.neighborhood_tag || 'Rio de Janeiro'}
                      {item.category_tag && <span>· {item.category_tag}</span>}
                    </p>
                  </div>

                  {/* Active Partner Opportunity Badge */}
                  {activeOffer && (
                    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Gift className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Benefício Disponível!</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-tight text-emerald-700/90 dark:text-emerald-300/90">
                        {activeOffer.benefit_summary || activeOffer.condition_badge}
                      </p>
                    </div>
                  )}

                  {/* User Note */}
                  {item.notes && (
                    <p className="mt-2.5 line-clamp-2 rounded-lg bg-[var(--bg-canvas)] p-2 text-xs italic text-[var(--text-secondary)]">
                      “{item.notes}”
                    </p>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(item)}
                      title="Compartilhar pelo WhatsApp"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-emerald-600"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      title="Excluir da lista"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {linked ? (
                      <button
                        type="button"
                        onClick={() => onSelectVenue(linked)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                      >
                        Ver Guia
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        const prompt = `Quero montar um roteiro incluindo ${item.title} em ${item.neighborhood_tag || 'Rio de Janeiro'}.`;
                        onPlanWithBoraIa(prompt);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:brightness-105"
                    >
                      <Sparkles className="h-3 w-3" />
                      Criar Plano
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

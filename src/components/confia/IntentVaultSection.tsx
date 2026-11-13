import {
  Archive,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  Lock,
  MapPin,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  computeIntentPatternInsights,
  deleteIntentVaultItem,
  sanitizeHttpUrl,
  setIntentVaultStatus,
} from '../../services/intentVaultStore';
import type { IntentStatus, IntentVaultItem } from '../../types/intention';
import type { Restaurant } from '../../types/restaurant';

interface IntentVaultSectionProps {
  items: IntentVaultItem[];
  catalog: Restaurant[];
  onItemsChanged: (next: IntentVaultItem[]) => void;
  onOpenCapture: () => void;
  onPlanWithBoraIa: (promptText: string) => void;
  onRecommendOnConfia: (venue: Restaurant, initialNote?: string) => void;
  onSelectVenue: (venue: Restaurant) => void;
}

const SOURCE_LABELS: Record<IntentVaultItem['source_type'], string> = {
  instagram_link: 'Instagram',
  tiktok_link: 'TikTok',
  youtube_link: 'YouTube',
  web_link: 'Link Web',
  screenshot: 'Print salvo',
  manual_note: 'Nota pessoal',
  catalog_bookmark: 'Catálogo BoraRio',
};

const STATUS_LABELS: Record<IntentStatus, string> = {
  SAVED: 'Salvo',
  PLANNED: 'Planejado',
  VISITED: 'Visitado',
  ARCHIVED: 'Arquivado',
};

export function IntentVaultSection({
  items,
  catalog,
  onItemsChanged,
  onOpenCapture,
  onPlanWithBoraIa,
  onRecommendOnConfia,
  onSelectVenue,
}: IntentVaultSectionProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | IntentStatus>('ALL');
  const [search, setSearch] = useState('');

  const insights = useMemo(() => computeIntentPatternInsights(items), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === 'ALL') {
        if (item.status === 'ARCHIVED') return false;
      } else if (item.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      const hay = `${item.title} ${item.neighborhood_tag || ''} ${item.category_tag || ''} ${
        item.notes || ''
      } ${item.linked_venue_name || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, statusFilter, search]);

  return (
    <div className="space-y-6">
      {/* Privacy Header Strip */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#123B56]/20 bg-[#123B56]/5 p-4 dark:border-white/10 dark:bg-[#0E2235] sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#123B56] text-white">
            <Lock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)]">
              Cofre estritamente privado — só você vê seus desejos guardados
            </p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Nenhum link, print ou anotação vai para sua Rede Confia automaticamente. Você decide se e quando compartilhar.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenCapture}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95"
        >
          <Plus className="h-4 w-4" />
          Adicionar link ou print
        </button>
      </div>

      {/* Transparent Pattern Insights (Only when >= 2 converging items exist) */}
      {insights.length > 0 && (
        <div className="rounded-2xl border border-[#F7931E]/35 bg-[#F7931E]/10 p-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B78114] dark:text-[#F7931E]">
            <Lightbulb className="h-4 w-4" />
            Padrões reais no seu Cofre
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((ins) => (
              <div
                key={ins.id}
                className="flex flex-col justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5 text-xs"
              >
                <div>
                  <p className="font-bold text-[var(--text-primary)]">{ins.label}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {ins.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onPlanWithBoraIa(ins.suggested_prompt)}
                  className="mt-3 inline-flex items-center gap-1 self-start rounded-lg bg-[#123B56] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#102F46]"
                >
                  <Sparkles className="h-3 w-3 text-[#F7931E]" />
                  Transformar em roteiro
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5">
          {(['ALL', 'SAVED', 'PLANNED', 'VISITED', 'ARCHIVED'] as const).map((st) => {
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'border-transparent bg-[#123B56] text-white'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {st === 'ALL' ? 'Ativos' : STATUS_LABELS[st]}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar no Cofre..."
            className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2 pl-8 pr-3 text-xs text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
          />
        </div>
      </div>

      {/* Empty State or Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 py-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FF6B35]/15 text-[#FF6B35]">
            <Bookmark className="h-6 w-6" />
          </div>
          <h3 className="font-sans mt-3 text-lg font-bold text-[var(--text-primary)]">
            {items.length === 0
              ? 'Seu Cofre de Intenções está pronto'
              : 'Nenhum item encontrado com esse filtro'}
          </h3>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[var(--text-secondary)]">
            {items.length === 0
              ? 'Em vez de perder dicas do Instagram, prints e sugestões em conversas soltas, guarde tudo aqui e transforme em planos reais com a Bora IA.'
              : 'Ajuste os filtros acima ou adicione uma nova intenção.'}
          </p>
          {items.length === 0 && (
            <button
              type="button"
              onClick={onOpenCapture}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-2.5 text-xs font-bold text-white shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Guardar meu primeiro link ou print
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const safeUrl = sanitizeHttpUrl(item.source_url);
            const linkedVenue = item.linked_venue_id
              ? catalog.find((v) => v.id === item.linked_venue_id)
              : undefined;

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-xs"
              >
                <div>
                  {item.image_preview_data_url && (
                    <div className="mb-3 overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-black/5">
                      <img
                        src={item.image_preview_data_url}
                        alt={item.title}
                        className="h-36 w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--text-primary)]">
                      {SOURCE_LABELS[item.source_type]}
                    </span>
                    <select
                      aria-label={`Status de ${item.title}`}
                      value={item.status}
                      onChange={(e) =>
                        onItemsChanged(setIntentVaultStatus(item.id, e.target.value as IntentStatus))
                      }
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold focus:outline-none ${
                        item.status === 'VISITED'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : item.status === 'PLANNED'
                            ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                            : 'bg-[#FF6B35]/15 text-[#FF6B35]'
                      }`}
                    >
                      <option value="SAVED">Salvo</option>
                      <option value="PLANNED">Planejado</option>
                      <option value="VISITED">Visitado</option>
                      <option value="ARCHIVED">Arquivado</option>
                    </select>
                  </div>

                  <h4 className="font-sans mt-2.5 text-base font-bold text-[var(--text-primary)]">
                    {item.title}
                  </h4>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    {item.neighborhood_tag && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-[#FF6B35]" />
                        {item.neighborhood_tag}
                      </span>
                    )}
                    {item.category_tag && <span>· {item.category_tag}</span>}
                  </div>

                  {item.notes && (
                    <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">
                      {item.notes}
                    </p>
                  )}

                  {linkedVenue && (
                    <button
                      type="button"
                      onClick={() => onSelectVenue(linkedVenue)}
                      className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#397B68] hover:underline"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Vinculado a {linkedVenue.name} →
                    </button>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onPlanWithBoraIa(
                          `${item.title}${item.neighborhood_tag ? ` em ${item.neighborhood_tag}` : ''}`
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg bg-[#123B56] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#102F46]"
                    >
                      <Sparkles className="h-3 w-3 text-[#F7931E]" />
                      Bora IA
                    </button>

                    {linkedVenue && (
                      <button
                        type="button"
                        onClick={() => onRecommendOnConfia(linkedVenue, item.notes)}
                        title="Compartilhar voluntariamente na Rede Confia"
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#397B68]"
                      >
                        <Share2 className="h-3 w-3 text-[#397B68]" />
                        Confia
                      </button>
                    )}

                    {safeUrl && (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Link
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {item.status !== 'ARCHIVED' && (
                      <button
                        type="button"
                        title="Arquivar"
                        onClick={() => onItemsChanged(setIntentVaultStatus(item.id, 'ARCHIVED'))}
                        className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Excluir do Cofre"
                      onClick={() => onItemsChanged(deleteIntentVaultItem(item.id))}
                      className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

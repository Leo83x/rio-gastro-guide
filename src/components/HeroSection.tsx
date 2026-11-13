import {
  Compass,
  Landmark,
  MapPin,
  Palmtree,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trees,
  Umbrella,
  Wand2,
  Wine,
  X,
} from 'lucide-react';
import type { MacroCategory, MomentMode } from '../types/experience';
import type { PriceRange, RestaurantCategory } from '../types/restaurant';

export interface FilterState {
  search: string;
  neighborhood: string;
  category: string;
  macroCategory: MacroCategory | '';
  momentMode: MomentMode;
  priceRange: PriceRange | '';
  minRating: number;
  onlyFeatured: boolean;
}

interface HeroSectionProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  availableCategories: RestaurantCategory[];
  resultCount: number;
  onOpenPersonalize: () => void;
  personalizationActive: boolean;
}

const MOMENT_MODES: Array<{ id: MomentMode; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'family', label: '👨‍👩‍👧 Família & Kids' },
  { id: 'couple', label: '💑 Modo Casal' },
  { id: 'friends', label: '🍻 Galera & Votação' },
  { id: 'tourist', label: '☀️ Turista' },
  { id: 'rainy', label: '🌧️ Modo Chuva (Locais Cobertos)' },
  { id: 'budget', label: '💸 Econômico / Gratuito' },
];

const MACRO_CATEGORIES: Array<{ label: string; value: MacroCategory | '' }> = [
  { label: 'Todas as Experiências', value: '' },
  { label: 'Gastronomia', value: 'Gastronomia' },
  { label: 'Eventos & Shows', value: 'Eventos & Shows' },
  { label: 'Cultura & Museus', value: 'Cultura & Museus' },
  { label: 'Atrações Infantis', value: 'Atrações Infantis' },
  { label: 'Turismo & Praias', value: 'Turismo & Praias' },
  { label: 'Vida Noturna', value: 'Vida Noturna' },
];

const NEIGHBORHOOD_PILLS = [
  { label: 'Todos', value: '', icon: Compass },
  { label: 'Leblon', value: 'Leblon', icon: Sparkles },
  { label: 'Ipanema', value: 'Ipanema', icon: Umbrella },
  { label: 'Botafogo', value: 'Botafogo', icon: Wine },
  { label: 'Copacabana', value: 'Copacabana', icon: Sun },
  { label: 'Santa Teresa', value: 'Santa Teresa', icon: Landmark },
  { label: 'Jardim Botânico', value: 'Jardim Botânico', icon: Trees },
  { label: 'Urca', value: 'Urca', icon: MapPin },
  { label: 'Barra da Tijuca', value: 'Barra da Tijuca', icon: Palmtree },
  { label: 'Centro', value: 'Centro', icon: Landmark },
  { label: 'Lapa', value: 'Lapa', icon: Wine },
];

const PRICE_OPTIONS: PriceRange[] = ['$', '$$', '$$$', '$$$$'];

export function HeroSection({
  filters,
  onChange,
  availableCategories,
  resultCount,
  onOpenPersonalize,
  personalizationActive,
}: HeroSectionProps) {
  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.neighborhood) ||
    Boolean(filters.category) ||
    Boolean(filters.macroCategory) ||
    filters.momentMode !== 'all' ||
    Boolean(filters.priceRange) ||
    filters.minRating > 0 ||
    filters.onlyFeatured;

  const resetFilters = () => {
    onChange({
      search: '',
      neighborhood: '',
      category: '',
      macroCategory: '',
      momentMode: 'all',
      priceRange: '',
      minRating: 0,
      onlyFeatured: false,
    });
  };

  return (
    <section className="relative border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] pb-7 pt-8 sm:pb-9 sm:pt-11">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#E05A47]">
              <MapPin className="h-3.5 w-3.5" />
              Rio de Janeiro · Superapp &amp; Concierge
            </p>
            <h1 className="font-editorial text-3xl font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl">
              Descubra o melhor do Rio para o seu momento.
            </h1>
            <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              Gastronomia, cultura, shows, praias e programas em família com procedência verificada, planejamento inteligente e vantagens exclusivas.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenPersonalize}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#E05A47]/40 bg-[#E05A47]/10 px-4 py-2.5 text-xs font-semibold text-[#E05A47] transition-all hover:bg-[#E05A47] hover:text-white md:self-auto"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Personalizar meu Perfil
            {personalizationActive && (
              <span className="rounded-full bg-[#E05A47] px-1.5 py-0.5 text-[10px] text-white">
                Ativo
              </span>
            )}
          </button>
        </div>

        {/* 1-Click Moment Modes */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {MOMENT_MODES.map((m) => {
            const active = filters.momentMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange({ ...filters, momentMode: m.id })}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? 'border-[#1C1917] bg-[#1C1917] text-white shadow-xs dark:border-[#F5F2EB] dark:bg-[#F5F2EB] dark:text-[#0F1115]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[#E05A47]/40 hover:text-[var(--text-primary)]'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Macro Categories */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {MACRO_CATEGORIES.map((mc) => {
            const active = filters.macroCategory === mc.value;
            return (
              <button
                key={mc.label}
                type="button"
                onClick={() => onChange({ ...filters, macroCategory: mc.value })}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#E05A47]/15 text-[#E05A47]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                {mc.label}
              </button>
            );
          })}
        </div>

        {/* Search & Primary Filters */}
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              id="search-restaurants"
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              placeholder="Buscar restaurante, museu, show, praia ou bairro..."
              className="w-full rounded-xl bg-transparent py-2.5 pl-10 pr-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/70 focus:outline-none"
            />
            {filters.search && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, search: '' })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="hidden h-7 w-px bg-[var(--border-hairline)] sm:block" />

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 px-3 py-2">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
              <select
                aria-label="Filtrar por subcategoria"
                value={filters.category}
                onChange={(e) => onChange({ ...filters, category: e.target.value })}
                className="bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none sm:text-sm"
              >
                <option value="">Todas as especialidades</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 p-1">
              {PRICE_OPTIONS.map((p) => {
                const active = filters.priceRange === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      onChange({ ...filters, priceRange: active ? '' : p })
                    }
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#E05A47] text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() =>
                onChange({ ...filters, minRating: filters.minRating === 4.5 ? 0 : 4.5 })
              }
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                filters.minRating === 4.5
                  ? 'border-[#D49B27] bg-[#D49B27]/15 text-[#B78114] dark:text-[#E5B342]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Star className="h-3.5 w-3.5 fill-current" />
              4.5+
            </button>

            <button
              type="button"
              onClick={() =>
                onChange({ ...filters, onlyFeatured: !filters.onlyFeatured })
              }
              className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                filters.onlyFeatured
                  ? 'border-[#E05A47] bg-[#E05A47]/15 text-[#E05A47]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-subtle)]/70 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Destaques
            </button>
          </div>
        </div>

        {/* Neighborhood Pills */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {NEIGHBORHOOD_PILLS.map((pill) => {
            const Icon = pill.icon;
            const active = filters.neighborhood === pill.value;
            return (
              <button
                key={pill.label}
                type="button"
                onClick={() => onChange({ ...filters, neighborhood: pill.value })}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'border-[#E05A47] bg-[#E05A47] text-white shadow-sm'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[#E05A47]/40 hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* Result Summary */}
        <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>
            Exibindo <strong className="text-[var(--text-primary)]">{resultCount}</strong>{' '}
            {resultCount === 1 ? 'experiência' : 'experiências'}
            {filters.neighborhood ? ` em ${filters.neighborhood}` : ' no Rio de Janeiro'}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="font-semibold text-[#E05A47] hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

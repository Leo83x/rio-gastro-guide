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
  Wine,
  X,
} from 'lucide-react';
import type { PriceRange, RestaurantCategory } from '../types/restaurant';

export interface FilterState {
  search: string;
  neighborhood: string;
  category: string;
  priceRange: PriceRange | '';
  minRating: number;
  onlyFeatured: boolean;
}

interface HeroSectionProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  availableCategories: RestaurantCategory[];
  resultCount: number;
}

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
}: HeroSectionProps) {
  const hasActiveFilters =
    Boolean(filters.search) ||
    Boolean(filters.neighborhood) ||
    Boolean(filters.category) ||
    Boolean(filters.priceRange) ||
    filters.minRating > 0 ||
    filters.onlyFeatured;

  const resetFilters = () => {
    onChange({
      search: '',
      neighborhood: '',
      category: '',
      priceRange: '',
      minRating: 0,
      onlyFeatured: false,
    });
  };

  return (
    <section className="relative border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] pb-8 pt-10 sm:pb-10 sm:pt-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#E05A47]">
            <MapPin className="h-3.5 w-3.5" />
            Rio de Janeiro · Edição Curada
          </p>
          <h1 className="font-editorial text-3xl font-bold leading-tight tracking-tight text-[var(--text-primary)] sm:text-5xl">
            Onde a alma carioca encontra a boa mesa.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
            De botecos históricos na Urca a mesas estreladas em Botafogo e Ipanema. Explore endereços selecionados bairro a bairro.
          </p>
        </div>

        {/* Search & Primary Filters */}
        <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              id="search-restaurants"
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              placeholder="Buscar por restaurante, prato, rua ou especialidade..."
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
                aria-label="Filtrar por culinária"
                value={filters.category}
                onChange={(e) => onChange({ ...filters, category: e.target.value })}
                className="bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none sm:text-sm"
              >
                <option value="">Todas as culinárias</option>
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
        <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {NEIGHBORHOOD_PILLS.map((pill) => {
            const Icon = pill.icon;
            const active = filters.neighborhood === pill.value;
            return (
              <button
                key={pill.label}
                type="button"
                onClick={() => onChange({ ...filters, neighborhood: pill.value })}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition-all sm:text-sm ${
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
            {resultCount === 1 ? 'estabelecimento' : 'estabelecimentos'}
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

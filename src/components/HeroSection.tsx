import {
  CloudRain,
  Compass,
  Heart,
  Landmark,
  MapPin,
  MoreHorizontal,
  Music,
  Palmtree,
  Plane,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Umbrella,
  Users,
  UtensilsCrossed,
  Wand2,
  Wine,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import rioHeroDay from '../assets/brand/rio-hero-day.jpg';
import rioHeroNight from '../assets/brand/rio-hero-night.jpg';
import { fetchRioWeatherLive, type RioWeatherSnapshot } from '../services/integrations/registry';
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
  isDark: boolean;
}

const PRIMARY_MOMENTS: Array<{ id: MomentMode; label: string; icon: typeof Star }> = [
  { id: 'all', label: 'Todos', icon: Star },
  { id: 'family', label: 'Família', icon: Users },
  { id: 'couple', label: 'Casal', icon: Heart },
  { id: 'friends', label: 'Galera', icon: Wine },
  { id: 'tourist', label: 'Turista', icon: Plane },
];

const EXTRA_MOMENTS: Array<{ id: MomentMode; label: string; icon: typeof CloudRain }> = [
  { id: 'rainy', label: 'Modo Chuva (Cobertos)', icon: CloudRain },
  { id: 'budget', label: 'Econômico / Gratuito', icon: Sparkles },
];

const MACRO_CATEGORIES: Array<{
  label: string;
  shortLabel: string;
  value: MacroCategory | '';
  icon: typeof Compass;
  gradient: string;
}> = [
  { label: 'Todas', shortLabel: 'Todas', value: '', icon: Compass, gradient: 'from-[#123B56] to-[#1D557A]' },
  { label: 'Gastronomia', shortLabel: 'Gastronomia', value: 'Gastronomia', icon: UtensilsCrossed, gradient: 'from-[#FF4B2B] via-[#FF6B35] to-[#F7931E]' },
  { label: 'Eventos & Shows', shortLabel: 'Eventos', value: 'Eventos & Shows', icon: Music, gradient: 'from-[#7B4CE2] to-[#562BB8]' },
  { label: 'Cultura & Museus', shortLabel: 'Cultura', value: 'Cultura & Museus', icon: Landmark, gradient: 'from-[#123B56] to-[#236B99]' },
  { label: 'Turismo & Praias', shortLabel: 'Praias', value: 'Turismo & Praias', icon: Umbrella, gradient: 'from-[#D49B27] to-[#F7931E]' },
  { label: 'Atrações Infantis', shortLabel: 'Infantil', value: 'Atrações Infantis', icon: Palmtree, gradient: 'from-[#397B68] to-[#275C4D]' },
];

const NEIGHBORHOOD_OPTIONS = [
  'Leblon',
  'Ipanema',
  'Botafogo',
  'Copacabana',
  'Santa Teresa',
  'Jardim Botânico',
  'Urca',
  'Barra da Tijuca',
  'Centro',
  'Lapa',
];

const PRICE_OPTIONS: PriceRange[] = ['$', '$$', '$$$', '$$$$'];

export function HeroSection({
  filters,
  onChange,
  availableCategories,
  resultCount,
  onOpenPersonalize,
  personalizationActive,
  isDark,
}: HeroSectionProps) {
  const [weather, setWeather] = useState<RioWeatherSnapshot | null>(null);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  useEffect(() => {
    void fetchRioWeatherLive().then(setWeather).catch(() => undefined);
  }, []);

  const activeFilterCount = [
    filters.neighborhood,
    filters.category,
    filters.priceRange,
    filters.minRating > 0 ? 'rating' : '',
    filters.momentMode === 'rainy' || filters.momentMode === 'budget' ? filters.momentMode : '',
  ].filter(Boolean).length;

  const hasAnyFilter =
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
    <section className="relative w-full overflow-x-clip">
      {/* 1. TOPO ATMOSFÉRICO LIMPO E ESPAÇADO */}
      <div className="relative overflow-hidden pb-11 pt-7 text-white sm:pb-14 sm:pt-10">
        <img
          src={isDark ? rioHeroNight : rioHeroDay}
          alt="Paisagem atmosférica do Rio de Janeiro"
          className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500"
        />

        <div
          className={`absolute inset-0 ${
            isDark
              ? 'bg-gradient-to-b from-[#06101B]/65 via-[#0A1D30]/45 to-[#07111C]'
              : 'bg-gradient-to-b from-[#0A2036]/65 via-[#123B56]/40 to-[#F8F5EF]'
          }`}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="text-2xl font-bold leading-snug tracking-tight text-white drop-shadow-sm sm:text-4xl">
                A cidade acontece.
                <br />
                Você aproveita.
              </h1>
            </div>

            {weather && (
              <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/25 bg-[#0A1E30]/55 px-3 py-1.5 text-xs font-medium text-[#F1E8D8] backdrop-blur-md sm:self-auto">
                {weather.isRaining ? (
                  <CloudRain className="h-3.5 w-3.5 text-[#FF6B35]" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-[#F7931E]" />
                )}
                <span>
                  {weather.temperatureC}°C · {weather.weatherLabel}
                </span>
              </div>
            )}
          </div>

          {/* 5 Primary Moment Pills + "..." Expand */}
          <div className="mt-7 flex w-full min-w-0 items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar sm:gap-3">
            {PRIMARY_MOMENTS.map((m) => {
              const Icon = m.icon;
              const active = filters.momentMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ ...filters, momentMode: m.id })}
                  className={`flex min-w-[70px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border px-3.5 py-2.5 text-xs font-semibold transition-all backdrop-blur-md sm:min-w-[82px] ${
                    active
                      ? 'border-transparent bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-lg shadow-[#FF4B2B]/25'
                      : 'border-white/25 bg-[#0A1E30]/55 text-white/95 hover:bg-[#0A1E30]/75'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{m.label}</span>
                </button>
              );
            })}

            <button
              type="button"
              aria-label="Mais filtros e momentos"
              onClick={() => setShowFiltersPanel((prev) => !prev)}
              className={`flex h-[58px] w-14 shrink-0 items-center justify-center rounded-2xl border backdrop-blur-md transition ${
                showFiltersPanel || activeFilterCount > 0
                  ? 'border-[#FF6B35] bg-[#FF6B35]/30 text-white'
                  : 'border-white/25 bg-[#0A1E30]/55 text-white/95 hover:bg-[#0A1E30]/75'
              }`}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. BARRA DE BUSCA LIMPA */}
      <div className="relative z-20 mx-auto -mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 p-2 shadow-lg backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2.5 px-1">
            <Search className="h-4.5 w-4.5 shrink-0 text-[var(--text-secondary)]" />

            <input
              id="search-restaurants"
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              placeholder="O que você quer viver hoje?"
              className="min-w-0 flex-1 bg-transparent py-2 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/80 focus:outline-none"
            />

            {filters.search && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, search: '' })}
                aria-label="Limpar busca"
                className="shrink-0 rounded-full p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowFiltersPanel((prev) => !prev)}
              title="Filtros (bairros, preço, modo chuva e perfil)"
              className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                showFiltersPanel || activeFilterCount > 0
                  ? 'bg-[#FF6B35]/15 text-[#FF6B35]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF4B2B] text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Expandable Clean Filter Drawer */}
          {showFiltersPanel && (
            <div className="mt-2 space-y-3 border-t border-[var(--border-hairline)] px-1.5 pb-1.5 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {EXTRA_MOMENTS.map((em) => {
                  const Icon = em.icon;
                  const active = filters.momentMode === em.id;
                  return (
                    <button
                      key={em.id}
                      type="button"
                      onClick={() =>
                        onChange({ ...filters, momentMode: active ? 'all' : em.id })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        active
                          ? 'border-transparent bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {em.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={onOpenPersonalize}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6B35]/40 bg-[#FF6B35]/10 px-3 py-1.5 text-xs font-bold text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  Personalizar Perfil {personalizationActive ? '(Ativo)' : ''}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[#FF6B35]" />
                  <select
                    aria-label="Filtrar por bairro"
                    value={filters.neighborhood}
                    onChange={(e) => onChange({ ...filters, neighborhood: e.target.value })}
                    className="bg-transparent text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">Todo o Rio (Bairros)</option>
                    {NEIGHBORHOOD_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <select
                  aria-label="Filtrar por especialidade"
                  value={filters.category}
                  onChange={(e) => onChange({ ...filters, category: e.target.value })}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="">Todas as especialidades</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <div className="flex items-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-0.5">
                  {PRICE_OPTIONS.map((p) => {
                    const active = filters.priceRange === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => onChange({ ...filters, priceRange: active ? '' : p })}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          active
                            ? 'bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white'
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
                  className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                    filters.minRating >= 4.5
                      ? 'border-[#F7931E] bg-[#F7931E]/15 text-[#B78114] dark:text-[#F7931E]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                  }`}
                >
                  <Star className="h-3.5 w-3.5 fill-current" />
                  4.5+
                </button>

                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="ml-auto text-xs font-bold text-[#FF6B35] hover:underline"
                  >
                    Limpar ({resultCount})
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. CATEGORIAS ESPACIOSAS (única faixa abaixo da busca) */}
        <div className="flex w-full min-w-0 items-center gap-4 overflow-x-auto pb-2 pt-5 no-scrollbar sm:justify-start sm:gap-7">
          {MACRO_CATEGORIES.map((mc) => {
            const Icon = mc.icon;
            const active = filters.macroCategory === mc.value;
            return (
              <button
                key={mc.label}
                type="button"
                onClick={() => onChange({ ...filters, macroCategory: mc.value })}
                className="group flex shrink-0 flex-col items-center gap-1.5"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${mc.gradient} text-white shadow-sm transition-all group-hover:scale-105 ${
                    active
                      ? 'ring-2 ring-[#FF6B35] ring-offset-2 ring-offset-[var(--bg-canvas)] scale-105 shadow-md'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={`text-xs font-semibold ${
                    active ? 'text-[#FF6B35]' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {mc.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

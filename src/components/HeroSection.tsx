import {
  CloudRain,
  Compass,
  Heart,
  Landmark,
  MapPin,
  Music,
  Palmtree,
  Plane,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trees,
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

const MOMENT_MODES: Array<{ id: MomentMode; label: string; icon: typeof Star }> = [
  { id: 'all', label: 'Todos', icon: Star },
  { id: 'family', label: 'Família', icon: Users },
  { id: 'couple', label: 'Casal', icon: Heart },
  { id: 'friends', label: 'Galera', icon: Wine },
  { id: 'tourist', label: 'Turista', icon: Plane },
  { id: 'rainy', label: 'Chuva', icon: CloudRain },
  { id: 'budget', label: 'Econômico', icon: Sparkles },
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
  { label: 'Vida Noturna', shortLabel: 'Noturna', value: 'Vida Noturna', icon: Wine, gradient: 'from-[#1E293B] to-[#0F172A]' },
];

const NEIGHBORHOOD_PILLS = [
  { label: 'Todo o Rio', value: '', icon: Compass },
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
  isDark,
}: HeroSectionProps) {
  const [weather, setWeather] = useState<RioWeatherSnapshot | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    void fetchRioWeatherLive().then(setWeather).catch(() => undefined);
  }, []);

  const [hour] = useState(() => new Date().getHours());
  const greeting =
    hour < 12 ? 'BOM DIA NO RIO!' : hour < 18 ? 'BOA TARDE NO RIO!' : 'BOA NOITE NO RIO!';

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
    <section className="relative w-full overflow-x-clip">
      {/* 1. TOPO ATMOSFÉRICO COM SAUDAÇÃO E FILTROS DE MOMENTO */}
      <div className="relative overflow-hidden pb-9 pt-4 text-white sm:pb-11 sm:pt-6">
        <img
          src={isDark ? rioHeroNight : rioHeroDay}
          alt="Paisagem atmosférica do Rio de Janeiro"
          className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500"
        />

        <div
          className={`absolute inset-0 ${
            isDark
              ? 'bg-gradient-to-b from-[#06101B]/80 via-[#0A1D30]/60 to-[#07111C]'
              : 'bg-gradient-to-b from-[#0A2036]/75 via-[#123B56]/45 to-[#F8F5EF]/95'
          }`}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-end">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#F1E8D8] drop-shadow-xs sm:text-xs">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF6B35]" />
                <span className="truncate">{greeting} · A CIDADE ACONTECE. VOCÊ APROVEITA.</span>
              </p>
              <h1 className="mt-1 text-xl font-extrabold leading-tight tracking-tight text-white drop-shadow-sm sm:text-3xl">
                O que você quer viver hoje no Rio?
              </h1>
            </div>

            <button
              type="button"
              onClick={onOpenPersonalize}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-white/30 bg-white/15 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur-md transition hover:border-transparent hover:bg-gradient-to-r hover:from-[#FF4B2B] hover:via-[#FF6B35] hover:to-[#F7931E] sm:self-auto"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Personalizar Perfil
              {personalizationActive && (
                <span className="rounded-full bg-[#397B68] px-1.5 py-0.5 text-[10px] text-white">
                  Ativo
                </span>
              )}
            </button>
          </div>

          {/* 1-Click Moment Modes */}
          <div className="mt-4 flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {MOMENT_MODES.map((m) => {
              const Icon = m.icon;
              const active = filters.momentMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ ...filters, momentMode: m.id })}
                  className={`flex min-w-[66px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border px-3 py-2 text-[11px] font-bold transition-all backdrop-blur-md sm:min-w-[74px] sm:text-xs ${
                    active
                      ? 'border-transparent bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-lg shadow-[#FF4B2B]/25'
                      : 'border-white/25 bg-[#0A1E30]/55 text-white/90 hover:bg-[#0A1E30]/75'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* CONTENT CONTAINER BELOW HERO */}
      <div className="relative z-20 mx-auto -mt-6 max-w-7xl space-y-3 px-3 sm:px-6 lg:px-8">
        {/* 2. BARRA DE BUSCA INTELIGENTE */}
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 p-1.5 shadow-xl backdrop-blur-xl sm:p-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-xs sm:h-9 sm:w-9">
              <Sparkles className="h-4 w-4" />
            </div>

            <input
              id="search-restaurants"
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              placeholder="Bora IA: O que você quer viver hoje?"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/75 focus:outline-none"
            />

            {filters.search && (
              <button
                type="button"
                onClick={() => onChange({ ...filters, search: '' })}
                aria-label="Limpar busca"
                className="shrink-0 rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              title="Filtros avançados"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition sm:h-9 sm:w-9 ${
                showAdvancedFilters || filters.category || filters.priceRange || filters.minRating > 0
                  ? 'border-[#FF6B35] bg-[#FF6B35]/10 text-[#FF6B35]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {showAdvancedFilters && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] pt-2">
              <select
                aria-label="Filtrar por subcategoria"
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
                Nota 4.5+
              </button>
            </div>
          )}
        </div>

        {/* 3. FAIXA COMPACTA DE CLIMA AO VIVO (1 linha econômica no mobile e desktop) */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs shadow-xs">
          <div className="flex min-w-0 items-center gap-2">
            {weather?.isRaining ? (
              <CloudRain className="h-4 w-4 shrink-0 text-[#FF4B2B]" />
            ) : (
              <Sun className="h-4 w-4 shrink-0 text-[#F7931E]" />
            )}
            <span className="truncate font-bold text-[var(--text-primary)]">
              {weather ? `${weather.temperatureC}°C · ${weather.weatherLabel}` : 'Clima ao vivo no Rio'}
            </span>
            <span className="hidden rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] sm:inline">
              {weather?.source === 'open-meteo-live' ? 'Open-Meteo ao vivo' : 'Estimativa local'}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                momentMode: filters.momentMode === 'rainy' ? 'all' : 'rainy',
              })
            }
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
              filters.momentMode === 'rainy'
                ? 'bg-[#123B56] text-white dark:bg-[#FF6B35]'
                : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <CloudRain className="h-3 w-3" />
            {filters.momentMode === 'rainy' ? 'Modo Chuva ativo' : 'Ver locais cobertos'}
          </button>
        </div>

        {/* 4. FILTROS DE CATEGORIA E BAIRROS */}
        <div className="space-y-2.5 pt-0.5">
          {/* Circular Macro Categories */}
          <div className="flex w-full min-w-0 items-center gap-3 overflow-x-auto pb-1 no-scrollbar sm:gap-5">
            {MACRO_CATEGORIES.map((mc) => {
              const Icon = mc.icon;
              const active = filters.macroCategory === mc.value;
              return (
                <button
                  key={mc.label}
                  type="button"
                  onClick={() => onChange({ ...filters, macroCategory: mc.value })}
                  className="group flex shrink-0 flex-col items-center gap-1"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${mc.gradient} text-white shadow-sm transition-all group-hover:scale-105 ${
                      active
                        ? 'ring-2 ring-[#FF6B35] ring-offset-2 ring-offset-[var(--bg-canvas)] scale-105 shadow-md'
                        : 'opacity-85 hover:opacity-100'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <span
                    className={`text-[11px] font-bold ${
                      active ? 'text-[#FF6B35]' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    {mc.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Neighborhood Pills */}
          <div className="flex min-w-0 items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {NEIGHBORHOOD_PILLS.map((pill) => {
                const Icon = pill.icon;
                const active = filters.neighborhood === pill.value;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => onChange({ ...filters, neighborhood: pill.value })}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${
                      active
                        ? 'border-transparent bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-xs'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[#FF6B35]/50 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {pill.label}
                  </button>
                );
              })}
            </div>

            <div className="hidden shrink-0 items-center gap-2 text-xs text-[var(--text-secondary)] sm:flex">
              <span>
                <strong className="text-[var(--text-primary)]">{resultCount}</strong> resultados
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="font-bold text-[#FF6B35] hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

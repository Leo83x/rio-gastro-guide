import {
  Car,
  CloudRain,
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
  Users,
  Wand2,
  Wine,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
}

const MOMENT_MODES: Array<{ id: MomentMode; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'family', label: '👨‍👩‍👧 Família' },
  { id: 'couple', label: '💑 Casal' },
  { id: 'friends', label: '🍻 Galera' },
  { id: 'tourist', label: '☀️ Turista' },
  { id: 'rainy', label: '🌧️ Modo Chuva' },
  { id: 'budget', label: '💸 Econômico' },
];

const MACRO_CATEGORIES: Array<{ label: string; value: MacroCategory | '' }> = [
  { label: 'Todas', value: '' },
  { label: 'Gastronomia', value: 'Gastronomia' },
  { label: 'Eventos & Shows', value: 'Eventos & Shows' },
  { label: 'Cultura & Museus', value: 'Cultura & Museus' },
  { label: 'Atrações Infantis', value: 'Atrações Infantis' },
  { label: 'Turismo & Praias', value: 'Turismo & Praias' },
  { label: 'Vida Noturna', value: 'Vida Noturna' },
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
}: HeroSectionProps) {
  const [weather, setWeather] = useState<RioWeatherSnapshot | null>(null);

  useEffect(() => {
    void fetchRioWeatherLive().then(setWeather).catch(() => undefined);
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Bom dia, Rio!' : hour < 18 ? 'Boa tarde no Rio!' : 'Boa noite no Rio!';
  const crowdInsight =
    hour >= 19 && hour <= 22
      ? 'Movimento moderado · Pico noturno'
      : hour >= 12 && hour <= 14
      ? 'Movimento alto · Horário de almoço'
      : 'Movimento leve · Ideal para sair';

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
    <section className="relative overflow-hidden border-b border-[var(--border-hairline)]">
      {/* Atmospheric BoraRio Header */}
      <div className="bg-borario-day dark:bg-borario-night pb-7 pt-6 text-white sm:pb-8 sm:pt-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#F1E8D8]">
                <MapPin className="h-3.5 w-3.5 text-[#FF765E]" />
                {greeting} · A cidade acontece. Você aproveita.
              </p>
              <h1 className="font-editorial mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
                O que você quer viver hoje no Rio?
              </h1>
            </div>

            <button
              type="button"
              onClick={onOpenPersonalize}
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-white/25 bg-white/15 px-4 py-2 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-[#FF765E] hover:border-[#FF765E] md:self-auto"
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
          <div className="mt-5 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {MOMENT_MODES.map((m) => {
              const active = filters.momentMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ ...filters, momentMode: m.id })}
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all ${
                    active
                      ? 'border-[#FF765E] bg-[#FF765E] text-white shadow-md'
                      : 'border-white/20 bg-white/10 text-[#F1E8D8] hover:bg-white/20'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {/* Natural Language Search Bar */}
          <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-[var(--bg-surface)] p-2 text-[var(--text-primary)] shadow-lg sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                id="search-restaurants"
                type="text"
                value={filters.search}
                onChange={(e) => onChange({ ...filters, search: e.target.value })}
                placeholder="O que você quer viver hoje? Ex: sushi no Leblon, museu com crianças..."
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

            <div className="flex flex-wrap items-center gap-2 px-1">
              <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                <select
                  aria-label="Filtrar por subcategoria"
                  value={filters.category}
                  onChange={(e) => onChange({ ...filters, category: e.target.value })}
                  className="bg-transparent text-xs font-medium text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="">Especialidade</option>
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-0.5">
                {PRICE_OPTIONS.map((p) => {
                  const active = filters.priceRange === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onChange({ ...filters, priceRange: active ? '' : p })}
                      className={`rounded-lg px-2 py-1 text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-[#FF765E] text-white'
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
                className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${
                  filters.minRating >= 4.5
                    ? 'border-[#D49B27] bg-[#D49B27]/15 text-[#B78114] dark:text-[#E5B342]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                }`}
              >
                <Star className="h-3.5 w-3.5 fill-current" />
                4.5+
              </button>
            </div>
          </div>

          {/* "Seu Rio, agora" Live Context Strip */}
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 backdrop-blur-sm">
              {weather?.isRaining ? (
                <CloudRain className="h-5 w-5 shrink-0 text-[#FF765E]" />
              ) : (
                <Sun className="h-5 w-5 shrink-0 text-[#F1E8D8]" />
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">
                  {weather ? `${weather.temperatureC}°C · ${weather.weatherLabel}` : '27°C · Carregando clima...'}
                </p>
                <p className="truncate text-[10px] text-[#F1E8D8]/80">
                  {weather?.source === 'open-meteo-live' ? 'Fonte: Open-Meteo ao vivo' : 'Estimativa local'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 backdrop-blur-sm">
              <Users className="h-5 w-5 shrink-0 text-[#A7E3CE]" />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{crowdInsight}</p>
                <p className="truncate text-[10px] text-[#F1E8D8]/80">Estimativa da plataforma</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2.5 backdrop-blur-sm">
              <Car className="h-5 w-5 shrink-0 text-[#FF765E]" />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">Deslocamento ~R$ 22–35</p>
                <p className="truncate text-[10px] text-[#F1E8D8]/80">Estimativa média Zona Sul/Centro</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Macro Categories & Neighborhoods Bar */}
      <div className="bg-[var(--bg-canvas)] py-3">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar">
            {MACRO_CATEGORIES.map((mc) => {
              const active = filters.macroCategory === mc.value;
              return (
                <button
                  key={mc.label}
                  type="button"
                  onClick={() => onChange({ ...filters, macroCategory: mc.value })}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                    active
                      ? 'bg-[#123B56] text-white dark:bg-[#FF765E]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {mc.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {NEIGHBORHOOD_PILLS.map((pill) => {
                const Icon = pill.icon;
                const active = filters.neighborhood === pill.value;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => onChange({ ...filters, neighborhood: pill.value })}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                      active
                        ? 'border-[#FF765E] bg-[#FF765E]/15 text-[#FF765E]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                  className="font-semibold text-[#FF765E] hover:underline"
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

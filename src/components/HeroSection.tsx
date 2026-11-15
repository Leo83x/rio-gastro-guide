import {
  Activity,
  Bookmark,
  Car,
  CloudRain,
  Compass,
  Heart,
  Info,
  Landmark,
  MapPin,
  MoreHorizontal,
  Music,
  Palmtree,
  Plane,
  Plus,
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
import type { GeoCoords } from '../utils/geo';

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
  onOpenProfile?: () => void;
  personalizationActive: boolean;
  locationConsent: boolean;
  userCoords?: GeoCoords | null;
  locationState?: 'idle' | 'requesting' | 'granted' | 'denied';
  onRequestLocation?: () => void;
  homeNeighborhood?: string;
  vaultCount: number;
  onAskBoraIa: (intentText: string) => void;
  onOpenVault: () => void;
  onOpenVaultCapture: () => void;
  externalOpenFiltersSignal?: number;
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

function getRioGreeting(): { greeting: string; hour: number } {
  try {
    const hourStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }).format(new Date());
    const hour = parseInt(hourStr, 10) || 14;
    if (hour >= 5 && hour < 12) return { greeting: 'BOM DIA NO RIO', hour };
    if (hour >= 12 && hour < 18) return { greeting: 'BOA TARDE NO RIO', hour };
    return { greeting: 'BOA NOITE NO RIO', hour };
  } catch {
    return { greeting: 'HOJE NO RIO', hour: 14 };
  }
}

function estimateDeBoaIndex(hour: number, isRaining?: boolean): {
  label: string;
  detail: string;
} {
  if (isRaining) {
    return {
      label: 'De Boa: Locais cobertos',
      detail:
        'Estimativa BoraRio baseada em chuva atual no Rio + horário: priorize espaços cobertos e museus.',
    };
  }
  if (hour >= 19 && hour <= 22) {
    return {
      label: 'De Boa: Pico noturno',
      detail:
        'Estimativa BoraRio para esta faixa horária (19h–22h). Bares e restaurantes populares costumam ter maior procura; não mede fila oficial.',
    };
  }
  if (hour >= 12 && hour <= 14) {
    return {
      label: 'De Boa: Almoço ativo',
      detail:
        'Estimativa BoraRio para o horário do almoço no Rio. Use o termômetro dentro de cada local como referência.',
    };
  }
  return {
    label: 'De Boa: Fluxo tranquilo',
    detail:
      'Estimativa BoraRio baseada em horário e clima aberto: janela favorável para circular com tranquilidade.',
  };
}

export function HeroSection({
  filters,
  onChange,
  availableCategories,
  resultCount,
  onOpenPersonalize,
  onOpenProfile,
  personalizationActive,
  locationConsent,
  userCoords = null,
  locationState = 'idle',
  onRequestLocation,
  homeNeighborhood,
  vaultCount,
  onAskBoraIa,
  onOpenVault,
  onOpenVaultCapture,
  externalOpenFiltersSignal = 0,
  isDark,
}: HeroSectionProps) {
  const [weather, setWeather] = useState<RioWeatherSnapshot | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ackExternalSignal, setAckExternalSignal] = useState(0);
  const [dismissedLocationBanner, setDismissedLocationBanner] = useState(false);
  const [activePillInfo, setActivePillInfo] = useState<'deboa' | 'mobility' | null>(null);

  useEffect(() => {
    void fetchRioWeatherLive().then(setWeather).catch(() => undefined);
  }, []);

  const showFiltersPanel = filtersOpen || externalOpenFiltersSignal > ackExternalSignal;
  const toggleFiltersPanel = () => {
    if (showFiltersPanel) {
      setFiltersOpen(false);
      setAckExternalSignal(externalOpenFiltersSignal);
    } else {
      setFiltersOpen(true);
    }
  };

  const hasLiveWeather = weather?.source === 'open-meteo-live';
  const { greeting, hour } = getRioGreeting();
  const deBoa = estimateDeBoaIndex(hour, hasLiveWeather ? weather.isRaining : undefined);

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

  const heroGlassClass = isDark
    ? 'border-white/30 bg-white/15 text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-md [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]'
    : 'border-white/32 bg-[#081A2C]/52 text-white shadow-[0_6px_18px_rgba(5,14,24,0.22)] backdrop-blur-md [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]';
  const heroGlassInteractiveClass = isDark
    ? `${heroGlassClass} hover:border-white/50 hover:bg-white/25`
    : `${heroGlassClass} hover:border-white/55 hover:bg-[#081A2C]/68`;

  return (
    <section className="relative w-full overflow-x-clip">
      {/* 1. TOPO ATMOSFÉRICO DO RIO (Proporção limpa com espaço para a paisagem e logo) */}
      <div className="relative overflow-hidden pb-12 pt-24 text-white sm:pb-14 sm:pt-28 lg:pb-16 lg:pt-30">
        <img
          src={isDark ? rioHeroNight : rioHeroDay}
          alt="Paisagem atmosférica do Rio de Janeiro"
          className="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500"
        />

        {isDark ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#06101B]/45 via-[#08192B]/25 to-[#07111C]/78"
          />
        ) : (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(8,26,44,0) 0%, rgba(8,26,44,0.32) 34%, rgba(8,26,44,0.58) 64%, rgba(7,22,38,0.84) 100%)',
              }}
            />
            {/* Bruma clara atrás do header fixo para contrastar a logo no modo dia */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-[106px] sm:h-[118px]"
              style={{
                background:
                  'linear-gradient(180deg, rgba(250,247,242,0.97) 0%, rgba(250,247,242,0.88) 48%, rgba(250,247,242,0.36) 76%, rgba(250,247,242,0) 100%)',
              }}
            />
          </>
        )}

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-[#081A2C]/62 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFB347] shadow-sm backdrop-blur-md">
                <Sparkles className="h-3 w-3" />
                {greeting}
              </p>

              <h1 className="mt-2.5 text-2xl font-extrabold leading-tight tracking-tight text-white [text-shadow:0_2px_14px_rgba(5,14,24,0.75),0_1px_3px_rgba(5,14,24,0.85)] sm:text-4xl">
                A cidade acontece.
                <br />
                Você aproveita.
              </h1>
              <p className="mt-1.5 text-xs font-semibold text-[#F1E8D8] [text-shadow:0_1px_6px_rgba(5,14,24,0.8)] sm:text-sm">
                Viva mais. Gaste melhor. Ganhe por isso.
              </p>
            </div>

            {/* Clima & Mobilidade compactos e limpos (clima apenas quando disponível) */}
            <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
              {hasLiveWeather && weather && (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${heroGlassClass}`}
                >
                  {weather.isRaining ? (
                    <CloudRain className="h-3.5 w-3.5 text-[#FF6B35]" />
                  ) : (
                    <Sun className="h-3.5 w-3.5 text-[#F7931E]" />
                  )}
                  <span>
                    {weather.temperatureC}°C · {weather.isRaining ? 'Chuva' : 'Tempo aberto'}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() =>
                  setActivePillInfo((prev) => (prev === 'deboa' ? null : 'deboa'))
                }
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${heroGlassInteractiveClass}`}
              >
                <Activity className="h-3 w-3 text-[#4CA188]" />
                <span>{deBoa.label}</span>
                <Info className="h-3 w-3 opacity-80" />
              </button>

              <button
                type="button"
                onClick={() =>
                  setActivePillInfo((prev) => (prev === 'mobility' ? null : 'mobility'))
                }
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${heroGlassInteractiveClass}`}
              >
                <Car className="h-3 w-3 text-[#FF6B35]" />
                <span>{userCoords ? 'Rotas via GPS' : 'Rotas sob demanda'}</span>
                <Info className="h-3 w-3 opacity-80" />
              </button>
            </div>
          </div>

          {activePillInfo && (
            <div
              className={`mt-3 flex items-start justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-[11px] font-medium ${heroGlassClass}`}
            >
              <p>
                {activePillInfo === 'deboa'
                  ? deBoa.detail
                  : 'O custo de Uber/99 varia conforme origem, destino e tarifa dinâmica. Ao abrir qualquer experiência, você acessa distância e atalhos reais de rota.'}
              </p>
              <button
                type="button"
                onClick={() => setActivePillInfo(null)}
                aria-label="Fechar explicação"
                className="shrink-0 text-white/80 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. BARRA DE BUSCA INTELIGENTE + BORA IA (Bastante visível e protagonista) */}
      <div className="relative z-20 mx-auto -mt-7 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 p-2 shadow-xl backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2 px-1">
            <Search className="h-4.5 w-4.5 shrink-0 text-[#FF6B35]" />

            <input
              id="search-restaurants"
              type="text"
              value={filters.search}
              onChange={(e) => onChange({ ...filters, search: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filters.search.trim().length > 3) {
                  e.preventDefault();
                  onAskBoraIa(filters.search.trim());
                }
              }}
              placeholder="O que você quer viver hoje?"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/85 focus:outline-none"
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
              onClick={() =>
                onAskBoraIa(
                  filters.search.trim() ||
                    'Quero uma boa recomendação no Rio combinando com o clima de hoje'
                )
              }
              title="Perguntar à Bora IA"
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-2.5 py-2 text-[11px] font-bold text-white shadow-xs hover:opacity-95 sm:px-3.5 sm:text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Bora IA</span>
            </button>

            <button
              type="button"
              onClick={toggleFiltersPanel}
              aria-label="Abrir filtros avançados"
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

        {/* 3. CATEGORIAS DE EXPERIÊNCIA */}
        <div className="flex w-full min-w-0 items-center gap-4 overflow-x-auto pb-1.5 pt-5 no-scrollbar sm:justify-start sm:gap-7">
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
                      ? 'scale-105 ring-2 ring-[#FF6B35] ring-offset-2 ring-offset-[var(--bg-canvas)] shadow-md'
                      : 'opacity-90 hover:opacity-100'
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

        {/* Filtros rápidos de momento abaixo das categorias (sem poluir a foto do Hero) */}
        <div className="mt-2.5 flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {PRIMARY_MOMENTS.map((m) => {
            const Icon = m.icon;
            const active = filters.momentMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onChange({ ...filters, momentMode: m.id })}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-transparent bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-xs'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[#FF6B35]/50 hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            aria-label="Mais filtros e momentos"
            onClick={toggleFiltersPanel}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              showFiltersPanel || activeFilterCount > 0
                ? 'border-[#FF6B35] bg-[#FF6B35]/12 text-[#FF6B35]'
                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
            <span>Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          </button>
        </div>

        {/* 4. ATIVAÇÃO NATURAL DE LOCALIZAÇÃO (OPCIONAL) + ATALHO COFRE */}
        <div className="mt-3 grid gap-2.5 lg:grid-cols-2">
          {!locationConsent && !dismissedLocationBanner ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#397B68]/25 bg-[#397B68]/8 px-3.5 py-2.5 text-xs">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#397B68] text-white">
                  <MapPin className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[var(--text-primary)]">Ative sua localização</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Encontre experiências, ofertas e lugares perto de você.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={locationState === 'requesting'}
                  onClick={() => onRequestLocation?.()}
                  className="rounded-xl bg-[#397B68] px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:opacity-95 disabled:opacity-60"
                >
                  {locationState === 'requesting' ? 'Obtendo...' : 'Usar localização'}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedLocationBanner(true)}
                  aria-label="Continuar sem localização"
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Agora não
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/85 px-3.5 py-2.5 text-xs shadow-xs">
              <div className="flex min-w-0 items-center gap-2">
                <MapPin className={`h-4 w-4 shrink-0 ${userCoords ? 'text-[#397B68]' : 'text-[#FF6B35]'}`} />
                <span className="truncate font-semibold text-[var(--text-primary)]">
                  {userCoords
                    ? 'Localização ativa · Ordenando experiências próximas a você'
                    : locationState === 'denied'
                      ? 'Explorando o Rio sem GPS (localização opcional)'
                      : `Área: ${homeNeighborhood || 'Rio de Janeiro'}`}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!userCoords && onRequestLocation && (
                  <button
                    type="button"
                    onClick={onRequestLocation}
                    className="rounded-lg bg-[#397B68]/12 px-2.5 py-1 text-[11px] font-bold text-[#397B68] hover:bg-[#397B68] hover:text-white dark:text-[#4CA188]"
                  >
                    Ativar localização
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenProfile?.()}
                  className="rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)] hover:border-[#123B56] hover:text-[var(--text-primary)]"
                >
                  Preferências
                </button>
              </div>
            </div>
          )}

          {/* Direct Access Bar to Cofre de Intenções */}
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/85 px-3.5 py-2.5 text-xs shadow-xs sm:flex-row sm:items-center sm:justify-between sm:gap-2">
            <button
              type="button"
              onClick={onOpenVault}
              className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-85"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#123B56] text-white">
                <Bookmark className="h-3.5 w-3.5 text-[#F7931E]" />
              </div>
              <span className="truncate font-semibold text-[var(--text-primary)]">
                {vaultCount > 0
                  ? `${vaultCount} ${vaultCount === 1 ? 'desejo salvo' : 'desejos salvos'} no Cofre`
                  : 'Cofre de Intenções: guarde links e lugares'}
              </span>
            </button>

            <div className="flex shrink-0 items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={onOpenVaultCapture}
                className="inline-flex items-center gap-1 rounded-lg bg-[#FF6B35]/15 px-2.5 py-1.5 text-[11px] font-bold text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white"
              >
                <Plus className="h-3 w-3" />
                Salvar link/print
              </button>
              <button
                type="button"
                onClick={onOpenVault}
                className="rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-primary)] hover:border-[#123B56]"
              >
                Abrir Cofre
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

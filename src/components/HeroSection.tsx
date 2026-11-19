import {
  CloudRain,
  Compass,
  Heart,
  MapPin,
  Moon,
  MoreHorizontal,
  Plane,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
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
  vaultCount?: number;
  onAskBoraIa: (intentText: string) => void;
  onOpenVault?: () => void;
  onOpenVaultCapture?: (initialUrl?: string) => void;
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

interface CorePillar {
  id: 'comer' | 'noite' | 'passeios';
  label: string;
  sub: string;
  macro: MacroCategory;
  icon: typeof UtensilsCrossed;
  gradient: string;
  scrollToId?: string;
}

const THREE_PILLARS: CorePillar[] = [
  {
    id: 'comer',
    label: 'Comer',
    sub: 'Restaurantes',
    macro: 'Gastronomia',
    icon: UtensilsCrossed,
    gradient: 'from-[#FF4B2B] via-[#FF6B35] to-[#F7931E]',
  },
  {
    id: 'noite',
    label: 'Noite',
    sub: 'Bares',
    macro: 'Vida Noturna',
    icon: Moon,
    gradient: 'from-[#0E2235] via-[#123B56] to-[#0077B6]',
    scrollToId: 'home-block-nightlife',
  },
  {
    id: 'passeios',
    label: 'Passeios',
    sub: 'Lazer',
    macro: 'Turismo & Praias',
    icon: Compass,
    gradient: 'from-[#1B4D3E] via-[#2A6F55] to-[#397B68]',
  },
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

export function HeroSection({
  filters,
  onChange,
  availableCategories,
  resultCount,
  onOpenPersonalize,
  onOpenProfile,
  personalizationActive,
  locationConsent: _locationConsent,
  userCoords = null,
  locationState = 'idle',
  onRequestLocation,
  homeNeighborhood: _homeNeighborhood,
  vaultCount: _vaultCount,
  onAskBoraIa,
  onOpenVault: _onOpenVault,
  onOpenVaultCapture,
  externalOpenFiltersSignal = 0,
  isDark,
}: HeroSectionProps) {
  const [weather, setWeather] = useState<RioWeatherSnapshot | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ackExternalSignal, setAckExternalSignal] = useState(0);

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

  const { greeting } = getRioGreeting();

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

  const heroGlassClass =
    'border-white/30 bg-white/15 text-white shadow-[0_4px_16px_rgba(0,0,0,0.12)] backdrop-blur-md [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]';

  return (
    <section className="relative w-full overflow-x-clip">
      {/* 1. TOPO ATMOSFÉRICO DO RIO (Proporção limpa com espaço para a paisagem e logo) */}
      <div className="relative overflow-hidden pb-12 pt-24 text-white sm:pb-14 sm:pt-28 lg:pb-16 lg:pt-30">
        <img
          src={isDark ? rioHeroNight : rioHeroDay}
          alt="Paisagem atmosférica do Rio de Janeiro"
          className="absolute inset-0 h-full w-full object-cover object-[80%_center] sm:object-center transition-opacity duration-500"
        />

        {isDark ? (
          <>
            {/* Gradiente vertical sutil para transição atmosférica e contraste perfeito */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#06101B]/45 via-[#06101B]/15 to-[#06101B]/85"
            />
            {/* Gradiente horizontal suave no mobile mantendo o texto nítido na área limpa do céu */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#06101B]/60 via-[#06101B]/20 to-transparent sm:from-transparent"
            />
          </>
        ) : (
          <>
            {/* Gradiente vertical natural mantendo as cores douradas vivas e transição suave */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0A1826]/40 via-transparent to-[#0A1826]/80"
            />
            {/* Gradiente horizontal suave no mobile para garantir texto branco perfeitamente nítido sobre o céu */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0A1826]/55 via-[#0A1826]/20 to-transparent sm:from-transparent"
            />
          </>
        )}

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="max-w-xs sm:max-w-md lg:max-w-xl">
              <p
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFB347] ${heroGlassClass}`}
              >
                <Sparkles className="h-3 w-3" />
                {greeting}
              </p>

              <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-white [text-shadow:0_2px_14px_rgba(5,14,24,0.85),0_1px_3px_rgba(5,14,24,0.95)] sm:text-4xl">
                O Rio tem mais<br />para você.
              </h1>
              <p className="mt-2 text-sm font-semibold text-white leading-relaxed [text-shadow:0_2px_8px_rgba(5,14,24,0.95),0_1px_2px_rgba(5,14,24,0.9)] sm:text-base max-w-lg">
                Descubra experiências, aproveite vantagens exclusivas e acumule benefícios a cada rolê.
              </p>
            </div>

            {/* Contexto ao vivo do Rio (temperatura única e limpa) */}
            <div className="flex items-center sm:justify-end">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${heroGlassClass}`}
              >
                {weather?.isRaining ? (
                  <CloudRain className="h-3.5 w-3.5 text-[#FF6B35]" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-[#F7931E]" />
                )}
                <span>
                  {weather
                    ? `${weather.temperatureC}°C · ${weather.isRaining ? 'Chuva no Rio' : 'Tempo aberto'}`
                    : 'Rio de Janeiro · 26°C'}
                </span>
              </div>
            </div>
          </div>
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
              placeholder="O que você quer fazer hoje? Gastronomia, festas, passeios..."
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

          {/* Quick link paste detection banner */}
          {(filters.search.trim().startsWith('http') ||
            filters.search.trim().includes('instagram.com') ||
            filters.search.trim().includes('tiktok.com')) && (
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-[#0E2235] via-[#123B56] to-[#0077B6] p-2.5 text-white">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="h-4 w-4 shrink-0 text-[#FFB347]" />
                <span className="truncate">Link detectado! Identificar local com IA e salvar em Meus Desejos?</span>
              </div>
              <button
                type="button"
                onClick={() => onOpenVaultCapture?.(filters.search.trim())}
                className="shrink-0 rounded-lg bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:brightness-105"
              >
                Salvar em Desejos
              </button>
            </div>
          )}

          {/* 3 Pilares Principais em 1 Linha (Comer, Noite & Eventos, Passeios) */}
          <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-[var(--border-hairline)] pt-2.5">
            {THREE_PILLARS.map((act) => {
              const Icon = act.icon;
              const active = filters.macroCategory === act.macro;
              return (
                <button
                  key={act.id}
                  type="button"
                  data-testid={`pillar-btn-${act.id}`}
                  onClick={() => {
                    const nextMacro = active ? '' : act.macro;
                    onChange({
                      ...filters,
                      macroCategory: nextMacro,
                    });
                    if (act.scrollToId && !active) {
                      const targetId = act.scrollToId;
                      setTimeout(() => {
                        document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 70);
                    }
                  }}
                  className={`group flex items-center gap-1.5 rounded-xl px-1.5 py-2 text-left transition-all sm:gap-2.5 sm:p-2.5 ${
                    active
                      ? `bg-gradient-to-r ${act.gradient} text-white shadow-md ring-1 ring-white/25`
                      : 'border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-primary)] hover:border-[#FF6B35]/50 hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 sm:h-9 sm:w-9 ${
                      active
                        ? 'bg-white/20 text-white shadow-xs'
                        : `bg-gradient-to-r ${act.gradient} text-white shadow-xs`
                    }`}
                  >
                    <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold leading-tight sm:text-sm">{act.label}</p>
                    <p
                      className={`truncate text-[10px] sm:text-[11px] ${
                        active ? 'text-white/85' : 'text-[var(--text-secondary)]'
                      }`}
                    >
                      {act.sub}
                    </p>
                  </div>
                </button>
              );
            })}
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

              {/* Localização GPS e Preferências integradas aos filtros */}
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] pt-2.5">
                {userCoords ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#397B68]/15 px-3 py-1.5 text-xs font-bold text-[#397B68] dark:text-[#4CA188]">
                    <MapPin className="h-3.5 w-3.5" />
                    GPS Ativo · Ordenando por proximidade
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onRequestLocation}
                    disabled={locationState === 'requesting'}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition disabled:opacity-50"
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#397B68]" />
                    <span>{locationState === 'requesting' ? 'Obtendo GPS...' : '📍 Ativar GPS'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenProfile?.()}
                  className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Gerenciar Preferências</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Filtros rápidos de momento (sem poluir a foto do Hero) */}
        <div className="mt-2.5 flex w-full min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar sm:gap-2">
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

        {/* Faixa contextual dinâmica para o pilar de Passeios */}
        {filters.macroCategory === 'Turismo & Praias' && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#397B68]/30 bg-[#397B68]/10 px-3.5 py-2 text-xs backdrop-blur-xs">
            <div className="flex items-center gap-2">
              {weather?.isRaining ? (
                <CloudRain className="h-4 w-4 shrink-0 text-[#397B68]" />
              ) : (
                <Sun className="h-4 w-4 shrink-0 text-[#F7931E]" />
              )}
              <span className="font-semibold text-[var(--text-primary)]">
                {weather?.isRaining
                  ? 'Modo Chuva: Priorizando passeios cobertos, museus e cultura'
                  : `Tempo aberto no Rio (${weather?.temperatureC || 27}°C) · Ideal para parques, mirantes e ar livre`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...filters, macroCategory: 'Gastronomia' })}
              className="inline-flex items-center gap-1 font-bold text-[#397B68] hover:underline dark:text-[#4CA188]"
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
              <span>Onde comer por perto deste passeio →</span>
            </button>
          </div>
        )}

        {/* Faixa contextual dinâmica para o pilar de Gastronomia */}
        {filters.macroCategory === 'Gastronomia' && availableCategories.length > 0 && (
          <div className="mt-2 flex w-full min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar">
            <span className="shrink-0 text-[11px] font-bold text-[var(--text-secondary)]">Especialidades:</span>
            {['Boteco Carioca', 'Brasileiro', 'Frutos do Mar', 'Italiano', 'Pizzaria', 'Cafeteria'].map((spec) => {
              const active = filters.category === spec;
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => onChange({ ...filters, category: active ? '' : spec })}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    active
                      ? 'border-[#FF6B35] bg-[#FF6B35] text-white shadow-xs'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[#FF6B35]/40 hover:text-[var(--text-primary)]'
                  }`}
                >
                  {spec}
                </button>
              );
            })}
          </div>
        )}

        {/* Faixa contextual dinâmica para o pilar de Noite & Eventos */}
        {filters.macroCategory === 'Vida Noturna' && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#0077B6]/30 bg-[#0077B6]/10 px-3.5 py-2 text-xs backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 shrink-0 text-[#0077B6]" />
              <span className="font-semibold text-[var(--text-primary)]">
                A Noite Carioca: festas, shows e samba dos próximos dias logo abaixo
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                document.getElementById('home-block-nightlife')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="font-bold text-[#0077B6] hover:underline"
            >
              Ver agenda noturna ↓
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

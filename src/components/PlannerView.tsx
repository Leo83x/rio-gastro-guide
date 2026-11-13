import {
  BookmarkCheck,
  Calculator,
  CalendarDays,
  Check,
  CloudRain,
  Copy,
  MapPin,
  Navigation,
  RefreshCw,
  Save,
  Sparkles,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Users,
  Utensils,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fetchRioWeatherLive, type RioWeatherSnapshot } from '../services/integrations/registry';
import { saveItinerary } from '../services/itineraryStore';
import {
  DEMONSTRATIVE_CLUB_OFFERS,
  getGroupVoteSession,
  saveGroupVoteSession,
} from '../services/superappStore';
import type { ConfiaRecommendation } from '../types/confia';
import type { GroupVoteSession, ItinerarySourceOrigin } from '../types/experience';
import type { IntentVaultItem } from '../types/intention';
import type { Restaurant } from '../types/restaurant';
import { MultiPinMap } from './MultiPinMap';

interface PlannerViewProps {
  experiences: Restaurant[];
  vaultItems: IntentVaultItem[];
  confiaPosts: ConfiaRecommendation[];
  initialPrompt?: string | null;
  onConsumeInitialPrompt?: () => void;
  onItinerarySaved?: () => void;
  onSelectExperience: (item: Restaurant) => void;
}

interface ItineraryStep {
  time: string;
  label: string;
  item: Restaurant;
  estimatedCostBrl: number;
  sourceOrigin: ItinerarySourceOrigin;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ORIGIN_BADGE: Record<ItinerarySourceOrigin, { label: string; cls: string }> = {
  catalog: { label: 'Catálogo', cls: 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]' },
  cofre: { label: 'Seu Cofre', cls: 'bg-[#FF6B35]/15 text-[#FF6B35]' },
  confia: { label: 'Rede Confia', cls: 'bg-[#397B68]/15 text-[#397B68]' },
  club: { label: 'Bora Club', cls: 'bg-[#D49B27]/15 text-[#B78114] dark:text-[#E5B342]' },
};

export function PlannerView({
  experiences,
  vaultItems,
  confiaPosts,
  initialPrompt,
  onConsumeInitialPrompt,
  onItinerarySaved,
  onSelectExperience,
}: PlannerViewProps) {
  const [prompt, setPrompt] = useState(
    'Sábado com esposa e 2 crianças, orçamento R$ 500, Zona Sul / Centro'
  );
  const [rainMode, setRainMode] = useState(false);
  const [weather, setWeather] = useState<RioWeatherSnapshot | null>(null);
  const [itinerary, setItinerary] = useState<ItineraryStep[]>([]);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Explicit Context Source Toggles
  const [useVault, setUseVault] = useState(vaultItems.length > 0);
  const [useConfia, setUseConfia] = useState(confiaPosts.length > 0);
  const [useClub, setUseClub] = useState(true);

  // Cultural City Events (migrated seamlessly from AgendaView)
  const [showCulturalAgenda, setShowCulturalAgenda] = useState(false);
  const [onlyFreeEvents, setOnlyFreeEvents] = useState(false);
  const [nearCenterOnly, setNearCenterOnly] = useState(false);

  // Group Voting
  const [voteTitle, setVoteTitle] = useState('Sexta-feira da Galera no Rio');
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    experiences.slice(0, 4).map((e) => e.id)
  );
  const [voteSession, setVoteSession] = useState<GroupVoteSession | null>(() =>
    getGroupVoteSession()
  );
  const [copiedLink, setCopiedLink] = useState(false);

  // Split Bill Calculator
  const [billTotal, setBillTotal] = useState<number>(380);
  const [tipPercent, setTipPercent] = useState<number>(10);
  const [peopleCount, setPeopleCount] = useState<number>(4);

  useEffect(() => {
    void fetchRioWeatherLive().then((w) => {
      setWeather(w);
      if (w.isRaining) setRainMode(true);
    });
  }, []);

  const buildItinerary = (forceRain: boolean, overridePrompt?: string) => {
    const activePrompt = (overridePrompt ?? prompt).toLowerCase();
    const isFamily =
      activePrompt.includes('crianç') ||
      activePrompt.includes('famíl') ||
      activePrompt.includes('filh');
    const isBudget =
      activePrompt.includes('barat') ||
      activePrompt.includes('gratuit') ||
      activePrompt.includes('econôm');

    const activeVaultVenueIds = new Set(
      useVault
        ? vaultItems
            .filter((i) => i.status === 'SAVED' || i.status === 'PLANNED')
            .map((i) => i.linked_venue_id)
            .filter((id): id is string => Boolean(id))
        : []
    );
    const activeConfiaVenueIds = new Set(useConfia ? confiaPosts.map((p) => p.venue_id) : []);
    const activeClubVenueIds = new Set(
      useClub ? DEMONSTRATIVE_CLUB_OFFERS.map((c) => c.experience_id) : []
    );

    const pool = experiences.filter((e) => {
      if (forceRain && e.attributes?.is_covered === false) return false;
      if (isBudget && (e.price_range === '$$$' || e.price_range === '$$$$')) return false;
      return true;
    });

    const sortByContext = (list: Restaurant[]): Restaurant[] =>
      [...list].sort((a, b) => {
        const boost = (item: Restaurant) => {
          let pts = 0;
          if (activePrompt.includes(item.neighborhood.toLowerCase())) pts += 10;
          if (activeConfiaVenueIds.has(item.id)) pts += 8;
          if (activeVaultVenueIds.has(item.id)) pts += 7;
          if (activeClubVenueIds.has(item.id)) pts += 3;
          if (item.is_featured) pts += 1;
          return pts;
        };
        return boost(b) - boost(a);
      });

    const prioritizedPool = sortByContext(pool);

    const pick = (predicate: (e: Restaurant) => boolean, fallbackIdx: number): Restaurant | undefined =>
      prioritizedPool.find(predicate) || experiences[fallbackIdx % experiences.length];

    const morning = pick(
      (e) =>
        (e.macro_category === 'Cultura & Museus' || e.macro_category === 'Turismo & Praias') &&
        (!forceRain || e.attributes?.is_covered !== false),
      0
    );
    const lunch = pick(
      (e) =>
        (e.macro_category || 'Gastronomia') === 'Gastronomia' &&
        (!isFamily || e.attributes?.is_kid_friendly !== false),
      1
    );
    const afternoon = pick(
      (e) =>
        e.id !== morning?.id &&
        e.id !== lunch?.id &&
        (isFamily
          ? e.macro_category === 'Atrações Infantis' || e.attributes?.is_kid_friendly === true
          : e.macro_category === 'Turismo & Praias' || e.macro_category === 'Cultura & Museus'),
      2
    );
    const sunset = pick(
      (e) =>
        e.id !== morning?.id &&
        e.id !== lunch?.id &&
        e.id !== afternoon?.id &&
        ((e.macro_category || 'Gastronomia') === 'Gastronomia' ||
          e.macro_category === 'Vida Noturna'),
      5
    );

    const resolveOrigin = (item: Restaurant): ItinerarySourceOrigin => {
      if (activeConfiaVenueIds.has(item.id)) return 'confia';
      if (activeVaultVenueIds.has(item.id)) return 'cofre';
      if (activeClubVenueIds.has(item.id)) return 'club';
      return 'catalog';
    };

    const rawSteps = [
      { time: '10:00', label: 'Manhã Cultural / Passeio', item: morning },
      { time: '12:30', label: 'Almoço Próximo', item: lunch },
      {
        time: '15:30',
        label: isFamily ? 'Lazer Infantil / Família' : 'Exploração da Tarde',
        item: afternoon,
      },
      { time: '17:30', label: 'Pôr do Sol / Happy Hour', item: sunset },
    ].filter((s): s is { time: string; label: string; item: Restaurant } => Boolean(s.item));

    setItinerary(
      rawSteps.map((s) => ({
        ...s,
        estimatedCostBrl: s.item.attributes?.avg_ticket_brl ?? 100,
        sourceOrigin: resolveOrigin(s.item),
      }))
    );
    setSavedFeedback(false);
  };

  useEffect(() => {
    if (selectedIds.length === 0 && experiences.length > 0) {
      setSelectedIds(experiences.slice(0, 4).map((e) => e.id));
    }
  }, [experiences, selectedIds.length]);

  useEffect(() => {
    if (experiences.length > 0 && itinerary.length === 0) {
      buildItinerary(rainMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiences.length]);

  useEffect(() => {
    if (initialPrompt && experiences.length > 0) {
      setPrompt(initialPrompt);
      setUseVault(true);
      buildItinerary(rainMode, initialPrompt);
      onConsumeInitialPrompt?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt, experiences.length]);

  const handleSwapStep = (stepIndex: number) => {
    const current = itinerary[stepIndex];
    if (!current || experiences.length < 2) return;
    const usedIds = new Set(itinerary.map((s) => s.item.id));
    const candidates = experiences.filter(
      (e) =>
        !usedIds.has(e.id) &&
        (!rainMode || e.attributes?.is_covered !== false) &&
        ((e.macro_category || 'Gastronomia') === (current.item.macro_category || 'Gastronomia') ||
          e.neighborhood === current.item.neighborhood)
    );
    const replacement =
      candidates[0] || experiences.find((e) => !usedIds.has(e.id)) || current.item;
    setItinerary((prev) =>
      prev.map((step, idx) =>
        idx === stepIndex
          ? {
              ...step,
              item: replacement,
              estimatedCostBrl: replacement.attributes?.avg_ticket_brl ?? 100,
              sourceOrigin: 'catalog',
            }
          : step
      )
    );
    setSavedFeedback(false);
  };

  const totalCost = itinerary.reduce((sum, s) => sum + s.estimatedCostBrl, 0);

  const handleSaveCurrentItinerary = () => {
    if (itinerary.length === 0) return;
    const sourcesUsed = Array.from(new Set(itinerary.map((s) => s.sourceOrigin)));
    saveItinerary({
      title: prompt.slice(0, 56) || 'Roteiro no Rio',
      prompt,
      rain_mode: rainMode,
      total_estimated_brl: totalCost,
      sources_used: sourcesUsed,
      steps: itinerary.map((s) => ({
        time: s.time,
        label: s.label,
        experience_id: s.item.id,
        experience_name: s.item.name,
        neighborhood: s.item.neighborhood,
        macro_category: s.item.macro_category || s.item.category,
        estimated_cost_brl: s.estimatedCostBrl,
        source_origin: s.sourceOrigin,
      })),
    });
    setSavedFeedback(true);
    onItinerarySaved?.();
  };

  const cityEvents = useMemo(() => {
    return experiences.filter((e) => {
      const isEventOrCulture =
        e.macro_category === 'Eventos & Shows' ||
        e.macro_category === 'Cultura & Museus' ||
        e.macro_category === 'Vida Noturna' ||
        e.macro_category === 'Atrações Infantis';
      if (!isEventOrCulture) return false;
      if (onlyFreeEvents && !e.attributes?.is_free) return false;
      if (nearCenterOnly) {
        const km = haversineKm(-22.92, -43.18, e.latitude, e.longitude);
        if (km > 5) return false;
      }
      return true;
    });
  }, [experiences, onlyFreeEvents, nearCenterOnly]);

  const nearbyDiningForEvent = (ev: Restaurant): Restaurant[] => {
    return experiences
      .filter((r) => (r.macro_category || 'Gastronomia') === 'Gastronomia' && r.id !== ev.id)
      .map((r) => ({
        item: r,
        dist: haversineKm(ev.latitude, ev.longitude, r.latitude, r.longitude),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2)
      .map((x) => x.item);
  };

  const createVote = () => {
    if (selectedIds.length < 2) return;
    const session: GroupVoteSession = {
      id: `vote-${Date.now()}`,
      title: voteTitle.trim() || 'Onde Vamos?',
      options: selectedIds.map((id) => ({ experience_id: id, likes: 0, dislikes: 0 })),
      created_at: new Date().toISOString(),
    };
    saveGroupVoteSession(session);
    setVoteSession(session);
  };

  const castVote = (expId: string, kind: 'like' | 'dislike') => {
    if (!voteSession) return;
    const next: GroupVoteSession = {
      ...voteSession,
      options: voteSession.options.map((o) =>
        o.experience_id === expId
          ? {
              ...o,
              likes: kind === 'like' ? o.likes + 1 : o.likes,
              dislikes: kind === 'dislike' ? o.dislikes + 1 : o.dislikes,
            }
          : o
      ),
    };
    saveGroupVoteSession(next);
    setVoteSession(next);
  };

  const totalWithTip = billTotal * (1 + tipPercent / 100);
  const perPerson = peopleCount > 0 ? totalWithTip / peopleCount : totalWithTip;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Section 1: Contextual AI Day Itinerary Generator */}
      <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#FF6B35]">
              <Sparkles className="h-3.5 w-3.5" />
              Planejador Bora IA
            </p>
            <h2 className="font-sans mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              Roteiro Inteligente do Dia
            </h2>
          </div>

          {weather && (
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-3.5 py-1.5 text-xs">
              {weather.isRaining ? (
                <CloudRain className="h-4 w-4 text-sky-500" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
              <span className="font-semibold text-[var(--text-primary)]">
                {weather.temperatureC}°C · {weather.weatherLabel}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">
                ({weather.source === 'open-meteo-live' ? 'Open-Meteo ao vivo' : 'Indisponível'})
              </span>
            </div>
          )}
        </div>

        {/* Context Sources Checkboxes */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-[var(--text-secondary)]">Fontes do roteiro:</span>
          <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-1 font-semibold text-[var(--text-primary)]">
            ✓ Catálogo BoraRio
          </span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1 font-semibold">
            <input
              type="checkbox"
              checked={useVault}
              onChange={(e) => setUseVault(e.target.checked)}
              className="accent-[#FF6B35]"
            />
            Cofre de Intenções ({vaultItems.filter((i) => i.status !== 'ARCHIVED').length})
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1 font-semibold">
            <input
              type="checkbox"
              disabled={confiaPosts.length === 0}
              checked={useConfia && confiaPosts.length > 0}
              onChange={(e) => setUseConfia(e.target.checked)}
              className="accent-[#397B68]"
            />
            Rede Confia ({confiaPosts.length})
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1 font-semibold">
            <input
              type="checkbox"
              checked={useClub}
              onChange={(e) => setUseClub(e.target.checked)}
              className="accent-[#D49B27]"
            />
            Bora Club
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Sábado com esposa e 2 crianças, orçamento R$ 500, Zona Sul/Centro"
            className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-sm text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => buildItinerary(rainMode)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-95"
          >
            <Sparkles className="h-4 w-4" />
            Gerar Roteiro
          </button>
          <button
            type="button"
            onClick={() => {
              const nextRain = !rainMode;
              setRainMode(nextRain);
              buildItinerary(nextRain);
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold transition-colors ${
              rainMode
                ? 'border-sky-500 bg-sky-500/15 text-sky-600 dark:text-sky-300'
                : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <CloudRain className="h-4 w-4" />
            {rainMode ? 'Modo Chuva Ativo' : 'Recalcular se Chover'}
          </button>
        </div>

        {/* Timeline */}
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {itinerary.map((step, idx) => {
            const originInfo = ORIGIN_BADGE[step.sourceOrigin];
            return (
              <div
                key={`${step.time}-${step.item.id}`}
                onClick={() => onSelectExperience(step.item)}
                className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 transition-all hover:border-[#FF6B35]/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="rounded-lg bg-[#FF6B35]/15 px-2 py-0.5 font-bold text-[#FF6B35]">
                      {step.time}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${originInfo.cls}`}>
                      {originInfo.label}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                    {step.label}
                  </p>
                  <h3 className="font-sans mt-1 text-lg font-bold tracking-tight text-[var(--text-primary)] group-hover:text-[#FF6B35]">
                    {step.item.name}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {step.item.neighborhood} · {step.item.macro_category || step.item.category}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[var(--border-hairline)] pt-2.5 text-[11px]">
                  <span className="font-semibold text-[var(--text-secondary)]">
                    {step.estimatedCostBrl === 0 ? 'Gratuito' : `~R$ ${step.estimatedCostBrl}`}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSwapStep(idx);
                    }}
                    className="inline-flex items-center gap-1 font-bold text-[#123B56] hover:text-[#FF6B35] dark:text-[#F1E8D8]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Trocar parada
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] pt-4 text-xs text-[var(--text-secondary)]">
          <div>
            <span>
              Custo total estimado por pessoa:{' '}
              <strong className="text-sm text-[var(--text-primary)]">
                R$ {totalCost.toLocaleString('pt-BR')}
              </strong>{' '}
              <span className="ml-1 rounded bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px]">
                Estimativa calculada pela plataforma
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {savedFeedback ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <BookmarkCheck className="h-4 w-4" />
                Salvo em Perfil › Minha Agenda
              </span>
            ) : (
              <button
                type="button"
                onClick={handleSaveCurrentItinerary}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#123B56] px-4 py-2 text-xs font-bold text-white hover:bg-[#102F46]"
              >
                <Save className="h-3.5 w-3.5 text-[#F7931E]" />
                Salvar Roteiro
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Section 2: Interactive Rio Map */}
      <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#397B68]">
              <MapPin className="h-3.5 w-3.5" />
              Mapa Interativo do Rio
            </p>
            <h2 className="font-sans mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Explore experiências geolocalizadas
            </h2>
          </div>
          <span className="text-xs text-[var(--text-secondary)]">
            OpenStreetMap &amp; Leaflet · Clique em um pino para abrir detalhes
          </span>
        </div>
        <MultiPinMap experiences={experiences} onSelectExperience={onSelectExperience} />
      </section>

      {/* Section 3: Migrated City Cultural Calendar + "Onde jantar perto" */}
      <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
              <CalendarDays className="h-4 w-4" />
              Agenda Cultural da Cidade
            </p>
            <h3 className="font-sans mt-1 text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Eventos, Museus &amp; Experiências ({cityEvents.length})
            </h3>
          </div>

          <button
            type="button"
            onClick={() => setShowCulturalAgenda((prev) => !prev)}
            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
          >
            {showCulturalAgenda ? 'Recolher programação' : 'Explorar programação & onde jantar perto'}
          </button>
        </div>

        {showCulturalAgenda && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setNearCenterOnly(!nearCenterOnly)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  nearCenterOnly
                    ? 'border-[#E05A47] bg-[#E05A47] text-white'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                Centro / Zona Sul
              </button>
              <button
                type="button"
                onClick={() => setOnlyFreeEvents(!onlyFreeEvents)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  onlyFreeEvents
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                }`}
              >
                Apenas Gratuitos
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {cityEvents.map((ev) => {
                const nearbyFood = nearbyDiningForEvent(ev);
                return (
                  <div
                    key={ev.id}
                    className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="rounded-full bg-[#FF6B35]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#FF6B35]">
                          {ev.macro_category}
                        </span>
                        <h4
                          onClick={() => onSelectExperience(ev)}
                          className="font-sans mt-1.5 cursor-pointer text-base font-bold text-[var(--text-primary)] hover:text-[#FF6B35]"
                        >
                          {ev.name}
                        </h4>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {ev.neighborhood} · {ev.opening_hours || ev.attributes?.event_date || 'Consultar horário'}
                        </p>
                      </div>
                      {ev.attributes?.is_free && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          Gratuito
                        </span>
                      )}
                    </div>

                    {nearbyFood.length > 0 && (
                      <div className="mt-3 border-t border-[var(--border-hairline)] pt-2.5">
                        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          <Utensils className="h-3 w-3 text-[#FF6B35]" />
                          Onde jantar perto:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {nearbyFood.map((food) => (
                            <button
                              key={food.id}
                              type="button"
                              onClick={() => onSelectExperience(food)}
                              className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                            >
                              {food.name} ({food.price_range})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Section 4: Group Decision ("Onde Vamos?") + Split Bill */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
            <Users className="h-4 w-4" />
            Decisão em Grupo · Onde Vamos?
          </div>
          <h3 className="font-sans mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Votação Rápida com Amigos
          </h3>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={voteTitle}
              onChange={(e) => setVoteTitle(e.target.value)}
              className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-sm text-[var(--text-primary)]"
            />
            <button
              type="button"
              onClick={createVote}
              className="rounded-xl bg-[#1C1917] px-4 py-2 text-xs font-semibold text-white hover:bg-[#E05A47] dark:bg-[#F5F2EB] dark:text-[#0F1115] dark:hover:bg-[#E05A47] dark:hover:text-white"
            >
              Gerar Enquete ({selectedIds.length} opções)
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {experiences.slice(0, 10).map((exp) => {
              const active = selectedIds.includes(exp.id);
              return (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() =>
                    setSelectedIds((prev) =>
                      active
                        ? prev.filter((id) => id !== exp.id)
                        : prev.length < 5
                          ? [...prev, exp.id]
                          : prev
                    )
                  }
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    active
                      ? 'border-[#E05A47] bg-[#E05A47]/15 text-[#E05A47]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                  }`}
                >
                  {exp.name}
                </button>
              );
            })}
          </div>

          {voteSession && (
            <div className="mt-5 space-y-2.5 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm text-[var(--text-primary)]">{voteSession.title}</strong>
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/?vote=${voteSession.id}`;
                    void navigator.clipboard?.writeText(url);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#E05A47]"
                >
                  {copiedLink ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedLink ? 'Link copiado!' : 'Copiar link para grupo'}
                </button>
              </div>

              {voteSession.options.map((opt) => {
                const exp = experiences.find((e) => e.id === opt.experience_id);
                if (!exp) return null;
                return (
                  <div
                    key={opt.experience_id}
                    className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">{exp.name}</p>
                      <p className="text-[11px] text-[var(--text-secondary)]">{exp.neighborhood}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => castVote(exp.id, 'like')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {opt.likes}
                      </button>
                      <button
                        type="button"
                        onClick={() => castVote(exp.id, 'dislike')}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/20 dark:text-red-300"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        {opt.dislikes}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Split Bill Calculator */}
        <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
            <Calculator className="h-4 w-4" />
            Dividir Conta
          </div>
          <h3 className="font-sans mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Calculadora do Rolê
          </h3>

          <div className="mt-4 space-y-3 text-xs">
            <div>
              <label className="mb-1 block font-semibold text-[var(--text-secondary)]">
                Total da Conta (R$)
              </label>
              <input
                type="number"
                min={0}
                value={billTotal}
                onChange={(e) => setBillTotal(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-[var(--text-secondary)]">
                  Serviço (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={tipPercent}
                  onChange={(e) => setTipPercent(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-[var(--text-secondary)]">
                  Pessoas
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={peopleCount}
                  onChange={(e) => setPeopleCount(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#E05A47]/25 bg-[#E05A47]/10 p-4 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Valor por pessoa
              </p>
              <p className="font-sans mt-1 text-3xl font-bold tracking-tight text-[#E05A47]">
                R$ {perPerson.toFixed(2).replace('.', ',')}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                Total com {tipPercent}%: R$ {totalWithTip.toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

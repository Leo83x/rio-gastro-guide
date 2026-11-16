import {
  ArrowRight,
  Award,
  CalendarCheck2,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  Copy,
  Crown,
  Gift,
  Heart,
  History,
  Info,
  MapPin,
  Navigation,
  QrCode,
  ReceiptText,
  Share2,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { calculateMatchScore, getMatchReasonLabel } from '../services/matchService';
import { computeMissionSummary } from '../services/missionStore';
import { getPartnerOfferings } from '../services/opportunityStore';
import { computePassportSummary } from '../services/passportStore';
import { getWalletSummary } from '../services/pointsLedger';
import { getMyReferralLink } from '../services/referralStore';
import { getPartnerRewards } from '../services/rewardMarketplaceStore';
import { computeSavingsSummary, formatBrl } from '../services/savingsLedgerStore';
import type { ConfiaRecommendation } from '../types/confia';
import type { UserPreferences } from '../types/experience';
import type { NightlifeDateFilter, NightlifeEvent, NightlifeSubArea } from '../types/nightlife';
import type { CommercialModality } from '../types/partnerCommercial';
import type { Restaurant } from '../types/restaurant';
import {
  DIRECT_PAYMENT_NOTICE,
  MANDATORY_CHECKIN_INSTRUCTION,
  POINTS_PREVISIT_CHECKIN_NOTICE,
  WALLET_NON_MONETARY_NOTICE,
} from '../types/verification';
import { formatDistanceKm, haversineKm, type GeoCoords } from '../utils/geo';
import { NightlifeSection } from './NightlifeSection';
import type { ProfileFocusTarget, ProfileSectionTab } from './ProfileWalletView';
import { SmartImage } from './SmartImage';

interface DiscoverEditorialSectionsProps {
  experiences: Restaurant[];
  nightlifeEvents: NightlifeEvent[];
  savedNightlifeKeys: Set<string>;
  preferences: UserPreferences;
  userCoords?: GeoCoords | null;
  vaultCount: number;
  vaultVenueIds: Set<string>;
  confiaConnectionsCount: number;
  confiaPosts: ConfiaRecommendation[];
  confiaCountsByVenue: Map<string, number>;
  pointsBalance: number;
  onSelectExperience: (item: Restaurant) => void;
  onFilterPermanentNightlife?: () => void;
  onSaveNightlifeToVault?: (event: NightlifeEvent) => void;
  onAskBoraIa?: (promptText: string) => void;
  onGoToAdminNightlife?: () => void;
  onRequestLocation?: () => void;
  onScrollToCatalog?: () => void;
  onGoToExploreMap: () => void;
  onGoToClub: (opts?: {
    section?: 'offerings' | 'rewards';
    modality?: CommercialModality | 'ALL';
  }) => void;
  onGoToPlanner: () => void;
  onGoToConfia: () => void;
  onGoToProfile: (opts?: { section?: ProfileSectionTab; focus?: ProfileFocusTarget }) => void;
  onOpenPersonalize: () => void;
  activeNightlifeSubArea?: NightlifeSubArea | 'ALL';
  onNightlifeSubAreaChange?: (subArea: NightlifeSubArea | 'ALL') => void;
  activeNightlifeDateFilter?: NightlifeDateFilter;
  onNightlifeDateFilterChange?: (dateFilter: NightlifeDateFilter) => void;
}

const MODALITIES_TODAY: Array<{
  id: CommercialModality;
  title: string;
  badge: string;
  description: string;
  icon: typeof CalendarCheck2;
  tone: string;
}> = [
  {
    id: 'TRADITIONAL_BOOKING',
    title: 'Reserva tradicional',
    badge: 'Sem desconto obrigatório',
    description: 'Horários e capacidade confirmados direto pelo estabelecimento.',
    icon: CalendarCheck2,
    tone: 'text-[#123B56] bg-[#123B56]/10 dark:text-[#7FB6D9] dark:bg-[#123B56]/35',
  },
  {
    id: 'INDIVIDUAL_OFFER',
    title: 'Oferta individual',
    badge: 'Uso individual',
    description: 'Cortesias, menus especiais e condições diferenciadas sem depender de grupo.',
    icon: Gift,
    tone: 'text-[#397B68] bg-[#397B68]/12 dark:text-[#4CA188]',
  },
  {
    id: 'DEMAND_OFFER',
    title: 'Reserva inteligente por demanda',
    badge: 'Validação do parceiro',
    description:
      'Manifeste interesse individual; sua reserva só confirma após o parceiro validar a condição.',
    icon: Users,
    tone: 'text-[#FF6B35] bg-[#FF6B35]/12',
  },
  {
    id: 'LAST_MINUTE',
    title: 'Oportunidade de última hora',
    badge: 'Janelas disponíveis',
    description: 'Vagas e horários remanescentes abertos pelos estabelecimentos para hoje.',
    icon: Clock3,
    tone: 'text-[#D49B27] bg-[#D49B27]/15 dark:text-[#F7931E]',
  },
];

export function DiscoverEditorialSections({
  experiences,
  nightlifeEvents,
  savedNightlifeKeys,
  preferences,
  userCoords = null,
  vaultCount: _vaultCount,
  vaultVenueIds,
  confiaConnectionsCount: _confiaConnectionsCount,
  confiaPosts: _confiaPosts,
  confiaCountsByVenue,
  pointsBalance,
  onSelectExperience,
  onFilterPermanentNightlife,
  onSaveNightlifeToVault,
  onAskBoraIa,
  onGoToAdminNightlife,
  onRequestLocation,
  onScrollToCatalog,
  onGoToExploreMap,
  onGoToClub,
  onGoToPlanner,
  onGoToConfia: _onGoToConfia,
  onGoToProfile,
  onOpenPersonalize,
  activeNightlifeSubArea,
  onNightlifeSubAreaChange,
  activeNightlifeDateFilter,
  onNightlifeDateFilterChange,
}: DiscoverEditorialSectionsProps) {
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [showPassportList, setShowPassportList] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);

  const spotlight = useMemo(
    () => experiences.find((e) => e.is_featured) || experiences[0],
    [experiences]
  );

  const hasGeoProximity = Boolean(preferences.lgpd_consents.location && userCoords);

  const nearbyEntries = useMemo(() => {
    if (!spotlight) return [];
    const candidates = experiences.filter((e) => e.id !== spotlight.id);
    if (hasGeoProximity && userCoords) {
      return candidates
        .map((item) => {
          const km = haversineKm(userCoords.lat, userCoords.lon, item.latitude, item.longitude);
          return { item, km, distLabel: formatDistanceKm(km) };
        })
        .sort((a, b) => a.km - b.km)
        .slice(0, 4);
    }
    return candidates.slice(0, 4).map((item) => ({ item, km: null, distLabel: '' }));
  }, [experiences, spotlight, hasGeoProximity, userCoords]);

  const curatedPicks = useMemo(
    () =>
      [...experiences]
        .sort((a, b) => {
          const confiaDiff =
            (confiaCountsByVenue.get(b.id) || 0) - (confiaCountsByVenue.get(a.id) || 0);
          if (confiaDiff !== 0) return confiaDiff;
          const vaultDiff = Number(vaultVenueIds.has(b.id)) - Number(vaultVenueIds.has(a.id));
          if (vaultDiff !== 0) return vaultDiff;
          return (
            (calculateMatchScore(b, preferences) ?? 0) -
            (calculateMatchScore(a, preferences) ?? 0)
          );
        })
        .slice(0, 3),
    [experiences, confiaCountsByVenue, vaultVenueIds, preferences]
  );

  const livePartnerOfferings = useMemo(() => {
    return getPartnerOfferings()
      .filter(
        (off) =>
          off.partner_managed_active &&
          !['ENDED_WITHOUT_GOAL', 'CANCELLED', 'COMPLETED', 'DRAFT', 'SOLD_OUT'].includes(off.status)
      )
      .slice(0, 4);
  }, []);

  if (experiences.length === 0 || !spotlight) return null;

  const spotlightMatch = calculateMatchScore(spotlight, preferences);
  const passport = computePassportSummary(experiences);
  const missionSummary = computeMissionSummary(experiences);
  const savings = computeSavingsSummary();
  const wallet = getWalletSummary();

  const configuredCriteriaCount =
    preferences.favorite_macro_categories.length +
    preferences.favorite_neighborhoods.length +
    preferences.preferred_moments.length;
  const isPersonalizationReady =
    preferences.lgpd_consents.personalization && configuredCriteriaCount >= 2;

  const activeOfferingsByModality = new Map<CommercialModality, number>();
  for (const off of getPartnerOfferings()) {
    if (
      off.partner_managed_active &&
      !['ENDED_WITHOUT_GOAL', 'CANCELLED', 'COMPLETED', 'DRAFT', 'SOLD_OUT'].includes(off.status)
    ) {
      activeOfferingsByModality.set(
        off.modality,
        (activeOfferingsByModality.get(off.modality) || 0) + 1
      );
    }
  }

  const availableRewards = getPartnerRewards().filter(
    (r) => r.status === 'AVAILABLE' && r.quantity_available > 0
  );
  const redeemableNowCount = availableRewards.filter(
    (r) => r.points_cost <= pointsBalance
  ).length;

  const handleCopyRef = () => {
    const link = getMyReferralLink();
    void navigator.clipboard?.writeText(link);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2500);
  };
  const handleShareWhatsAppRef = () => {
    const link = getMyReferralLink();
    const text = `Vem conhecer o BoraRio comigo! Descubra experiências, reserve e ganhe benefícios no Rio: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mb-12 space-y-11">
      {/* SEÇÃO 01 · VANTAGENS REAIS DISPONÍVEIS AGORA */}
      <section aria-labelledby="home-block-opportunities">
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35]/12 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#FF6B35]">
              <Gift className="h-3.5 w-3.5" />
              Vantagens &amp; Ofertas de Hoje
            </span>
            <h2
              id="home-block-opportunities"
              className="mt-1 font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              Vantagens reais para aproveitar agora
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Cortesias, menus especiais e vagas de última hora com condições exclusivas nos estabelecimentos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onGoToClub({ section: 'offerings', modality: 'ALL' })}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0E2235] via-[#123B56] to-[#0077B6] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:brightness-110 transition ring-1 ring-white/15"
          >
            <Crown className="h-3.5 w-3.5 text-[#FFB347]" />
            <span>Abrir Bora Club</span>
            <ArrowRight className="h-3.5 w-3.5 text-white/80" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {livePartnerOfferings.map((off) => {
            const linkedVenue = experiences.find((e) => e.id === off.restaurant_id);
            return (
              <div
                key={off.id}
                onClick={() => {
                  if (linkedVenue) {
                    onSelectExperience(linkedVenue);
                  } else {
                    onGoToClub({ section: 'offerings', modality: off.modality });
                  }
                }}
                className="group flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-[#FF6B35]/55 cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-[var(--text-secondary)]">
                      {off.restaurant_name} · {off.neighborhood}
                    </span>
                    <span className="shrink-0 rounded-full bg-[#FF6B35]/12 px-2 py-0.5 text-[10px] font-bold text-[#FF6B35]">
                      {off.condition_badge || 'Hoje'}
                    </span>
                  </div>
                  <h3 className="mt-2.5 font-sans text-sm font-bold leading-snug text-[var(--text-primary)] group-hover:text-[#FF6B35]">
                    {off.benefit_summary || off.title}
                  </h3>
                  {off.estimated_savings_brl > 0 && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      Economia: R$ {off.estimated_savings_brl}
                    </p>
                  )}
                  {off.time_slot_label && (
                    <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">
                      Janela: {off.time_slot_label} · {off.category}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--border-hairline)] pt-2.5 text-xs">
                  <span className="font-bold text-[#FF6B35] group-hover:underline">
                    Garantir vantagem →
                  </span>
                  {off.capacity_total > 0 && (
                    <span className="text-[10px] text-[var(--text-secondary)]">
                      {off.capacity_total - off.reserved_count} vagas
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
              Modalidades ativas:
            </span>
            {MODALITIES_TODAY.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => onGoToClub({ section: 'offerings', modality: mod.id })}
                className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] hover:border-[#FF6B35]/40 hover:text-[var(--text-primary)] transition"
              >
                {mod.title}
              </button>
            ))}
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <Store className="h-3.5 w-3.5 shrink-0 text-[#397B68]" />
            <span>{DIRECT_PAYMENT_NOTICE}</span>
          </p>
        </div>
      </section>

      {/* SEÇÃO 02 · A NOITE CARIOCA (Frequência, Radar & Agenda Noturna no Topo) */}
      <NightlifeSection
        events={nightlifeEvents}
        permanentVenues={experiences}
        savedEventTitlesOrUrls={savedNightlifeKeys}
        onSelectPermanentVenue={onSelectExperience}
        onFilterPermanentNightlife={onFilterPermanentNightlife}
        onSaveEventToVault={onSaveNightlifeToVault}
        onAskBoraIa={onAskBoraIa}
        onGoToAdminNightlife={onGoToAdminNightlife}
        activeSubArea={activeNightlifeSubArea}
        onSubAreaChange={onNightlifeSubAreaChange}
        activeDateFilter={activeNightlifeDateFilter}
        onDateFilterChange={onNightlifeDateFilterChange}
      />

      {/* SEÇÃO 03 · SUA PRIMEIRA MISSÃO NO BORARIO (Progressão Imediata de Benefícios) */}
      <section
        aria-labelledby="home-block-first-mission"
        className="rounded-3xl border border-[#397B68]/30 bg-gradient-to-br from-[#1B4D3E] via-[#2A6F55] to-[#397B68] p-5 text-white shadow-md sm:p-6"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FFB347]">
              <Award className="h-3.5 w-3.5" />
              Sua Primeira Missão
            </span>
            <h3
              id="home-block-first-mission"
              className="mt-2 font-sans text-lg font-bold text-white sm:text-xl"
            >
              Seu primeiro rolê vale +100 Rio Points
            </h3>
            <p className="mt-1 max-w-xl text-xs text-[#F1E8D8]/90 leading-relaxed">
              Faça sua 1ª reserva ou check-in presencial em qualquer restaurante ou evento do BoraRio e acumule pontos no Passaporte Carioca para resgatar cortesias e experiências exclusivas.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onGoToProfile({ section: 'passport' })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:brightness-105"
            >
              <Award className="h-3.5 w-3.5" />
              Ver Passaporte &amp; Missões
            </button>
          </div>
        </div>
      </section>

      {/* SEÇÃO 04 · DESTAQUE DO DIA: O QUE VALE A PENA VIVER HOJE? */}
      <section aria-labelledby="home-block-spotlight">
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="home-block-spotlight"
              className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              O que vale a pena viver hoje?
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Destaque curado da cidade para decidir com clareza e aproveitar o Rio hoje.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectExperience(spotlight)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B35] hover:underline"
          >
            Ver destaque <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div
          onClick={() => onSelectExperience(spotlight)}
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[#0E2235] shadow-md transition hover:shadow-xl"
        >
          <div className="relative h-64 w-full sm:h-80 lg:h-[340px]">
            <SmartImage
              src={spotlight.cover_image}
              alt={spotlight.name}
              name={spotlight.name}
              category={spotlight.category}
              hasRealPhoto={spotlight.has_real_photo}
              imageOrigin={spotlight.image_origin}
              hideFallbackText
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111C]/95 via-[#07111C]/35 to-transparent" />
          </div>

          <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-3 py-1 text-[11px] font-bold text-white shadow-sm">
              <Compass className="h-3.5 w-3.5" />
              Destaque de Hoje
            </span>

            {spotlightMatch !== null && spotlightMatch >= 65 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#397B68]/95 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                <Heart className="h-3 w-3 fill-current" />
                {spotlightMatch}% Match
              </span>
            )}
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end sm:p-7">
            <div className="max-w-xl">
              <h3 className="font-sans text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {spotlight.name}
              </h3>
              <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#F1E8D8]">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF6B35]" />
                <span>{spotlight.neighborhood}</span>
                <span>·</span>
                <span>{spotlight.category}</span>
                <span>·</span>
                <span>
                  {spotlight.attributes?.is_free ? 'Gratuito' : spotlight.price_range}
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectExperience(spotlight);
              }}
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:opacity-95 sm:self-auto"
            >
              Explorar experiência <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* SEÇÃO 04 · PLANEJAMENTO: MONTE SEU PRÓXIMO PROGRAMA (com degradê azul da logo) */}
      <section
        aria-labelledby="home-block-planning"
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0E2235] via-[#123B56] to-[#0077B6] p-6 text-white shadow-xl sm:p-8"
      >
        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-300/30 bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FFB347]">
              <CalendarRange className="h-3.5 w-3.5" />
              Planejamento de Experiências
            </span>
            <h2
              id="home-block-planning"
              className="font-sans text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              Monte seu próximo programa
            </h2>
            <p className="text-sm text-[#F1E8D8]/90 leading-relaxed">
              Escolha lugares, combine datas, convide amigos e compartilhe roteiros completos pela cidade com auxílio da Bora IA.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onGoToPlanner}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:brightness-105"
            >
              <CalendarRange className="h-4 w-4" />
              Criar Roteiro
            </button>

            <button
              type="button"
              onClick={onGoToExploreMap}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/20"
            >
              <MapPin className="h-4 w-4 text-[#FFB347]" />
              Ver no Mapa
            </button>
          </div>
        </div>
      </section>

      {/* SEÇÃO 05 · RETENÇÃO: CARD INDIQUE E GANHE RIO POINTS */}
      <section
        aria-labelledby="home-block-referral"
        className="rounded-3xl border border-sky-400/25 bg-gradient-to-br from-[#0E2235] via-[#123B56] to-[#0077B6] p-5 text-white shadow-md sm:p-6"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#FFB347]">
              <Share2 className="h-3 w-3" />
              Indique e Ganhe Rio Points
            </span>
            <h3
              id="home-block-referral"
              className="mt-2 font-sans text-lg font-bold text-white sm:text-xl"
            >
              Ganhe 200 Rio Points por cada primeira visita validada
            </h3>
            <p className="mt-1 max-w-xl text-xs text-[#F1E8D8]/85">
              Convide amigos para o BoraRio. Seus pontos são creditados assim que seu amigo fizer o primeiro check-in presencial validado no parceiro.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleCopyRef}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/20"
            >
              {copiedRef ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedRef ? 'Link Copiado!' : 'Copiar Link'}
            </button>

            <button
              type="button"
              onClick={handleShareWhatsAppRef}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-105"
            >
              <Share2 className="h-3.5 w-3.5" />
              WhatsApp
            </button>
          </div>
        </div>
        <p className="mt-3 text-[10px] text-white/60">
          * Benefício não conversível em dinheiro. Proteção antifraude e autoindicação ativa.
        </p>
      </section>

      {/* SEÇÃO 06 · EXPLORAÇÃO: PERTO DE VOCÊ NO RIO */}
      <section aria-labelledby="home-block-nearby">
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="home-block-nearby"
              className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              Perto de você no Rio
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {hasGeoProximity ? (
                <span className="inline-flex items-center gap-1 text-[#397B68] dark:text-[#4CA188]">
                  <Navigation className="h-3 w-3" />
                  Ordenado pela sua distância atual no Rio.
                </span>
              ) : (
                <span>
                  Destaques por bairro na cidade.{' '}
                  {onRequestLocation && (
                    <button
                      type="button"
                      onClick={onRequestLocation}
                      className="font-semibold text-[#397B68] hover:underline dark:text-[#4CA188]"
                    >
                      Ativar localização para ver distância
                    </button>
                  )}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onGoToExploreMap}
              className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)] hover:text-[#FF6B35]"
            >
              <MapPin className="h-3.5 w-3.5" />
              Mapa
            </button>
            {onScrollToCatalog && (
              <button
                type="button"
                onClick={onScrollToCatalog}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B35] hover:underline"
              >
                Ver mais <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {nearbyEntries.map(({ item, distLabel }) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectExperience(item)}
              className="group relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-left shadow-xs transition hover:-translate-y-0.5 hover:border-[#FF6B35]/60"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <SmartImage
                  src={item.cover_image}
                  alt={item.name}
                  name={item.name}
                  category={item.category}
                  hasRealPhoto={item.has_real_photo}
                  imageOrigin={item.image_origin}
                  compact
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07111C]/90 via-[#07111C]/20 to-transparent" />
                {distLabel && (
                  <span className="absolute right-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                    {distLabel}
                  </span>
                )}
                <div className="absolute bottom-2.5 left-2.5 right-2.5">
                  <p className="truncate text-xs font-bold text-white sm:text-sm">{item.name}</p>
                  <p className="truncate text-[10px] text-[#F1E8D8] sm:text-[11px]">
                    {item.neighborhood}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SEÇÃO 6: SELECIONADO PARA VOCÊ (Motivo transparente + guarda estrita contra % Match sem base) */}
      <section aria-labelledby="home-block-curated">
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="home-block-curated"
              className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              Selecionado para você
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {isPersonalizationReady
                ? 'Baseado no seu perfil, Desejos e indicações de amigos com motivo explícito.'
                : preferences.lgpd_consents.personalization
                  ? 'Escolha ao menos 2 preferências no perfil para calcular afinidade (% Match) real.'
                  : 'Curadoria transparente pelo catálogo e Desejos. Ative a personalização para receber recomendações sob medida.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPersonalize}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6B35]/35 bg-[#FF6B35]/10 px-3.5 py-1.5 text-xs font-bold text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {isPersonalizationReady ? 'Ajustar perfil' : 'Ativar personalização'}
          </button>
        </div>

        <div className="grid gap-3.5 md:grid-cols-3">
          {curatedPicks.map((item) => {
            const match = calculateMatchScore(item, preferences);
            const reason = getMatchReasonLabel({
              item,
              prefs: preferences,
              inVault: vaultVenueIds.has(item.id),
              confiaCount: confiaCountsByVenue.get(item.id) || 0,
            });
            return (
              <div
                key={item.id}
                onClick={() => onSelectExperience(item)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-xs transition hover:border-[#FF6B35]/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="truncate rounded-full bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                    {reason}
                  </span>
                  {match !== null && match >= 65 && (
                    <span className="shrink-0 rounded-full bg-[#397B68]/15 px-2.5 py-1 text-[10px] font-extrabold text-[#397B68] dark:text-[#4CA188]">
                      {match}% Match
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-subtle)]">
                    <SmartImage
                      src={item.cover_image}
                      alt={item.name}
                      name={item.name}
                      category={item.category}
                      hasRealPhoto={item.has_real_photo}
                      imageOrigin={item.image_origin}
                      compact
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-sans text-base font-bold text-[var(--text-primary)] group-hover:text-[#FF6B35]">
                      {item.name}
                    </h3>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {item.neighborhood} · {item.category}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[#FF6B35]">
                      {item.is_claimed ? 'Estabelecimento verificado · ' : ''}
                      Ver guia →
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SEÇÃO 7: BORA CLUB E RIO POINTS (3 indicadores prioritários + acesso preservado a extrato/histórico/missões) */}
      <section
        aria-labelledby="home-block-benefits"
        className="grid gap-5 lg:grid-cols-12"
      >
        {/* Painel Principal: 3 Indicadores Prioritários + Regras Não Monetárias */}
        <div className="rounded-3xl bg-borario-night p-5 text-white shadow-md sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#E5B342]">
              <Crown className="h-4 w-4" />
              Bora Club e Rio Points
            </span>
            <span className="rounded-full border border-white/15 bg-white/8 px-2.5 py-0.5 text-[10px] font-semibold text-[#F1E8D8]">
              Fidelidade · Pontos sem valor em dinheiro
            </span>
          </div>

          {/* 3 Indicadores Limpos e Prioritários */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#E5B342]/35 bg-white/8 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFB347]">
                Rio Points disponíveis
              </p>
              <h2
                id="home-block-benefits"
                className="mt-1 font-sans text-2xl font-extrabold tracking-tight text-white"
              >
                {pointsBalance.toLocaleString('pt-BR')} Rio Points
              </h2>
              <p className="mt-0.5 text-[10px] text-white/70">
                Pontos de fidelidade não sacáveis
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/8 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#8DC4EA]">
                Benefícios para resgate
              </p>
              <p className="mt-1 font-sans text-2xl font-extrabold tracking-tight text-white">
                {availableRewards.length}{' '}
                <span className="text-sm font-semibold text-white/80">
                  {availableRewards.length === 1 ? 'disponível' : 'disponíveis'}
                </span>
              </p>
              <p className="mt-0.5 text-[10px] text-white/70">
                {redeemableNowCount > 0
                  ? `${redeemableNowCount} ao alcance do seu saldo`
                  : 'Recompensas multi-segmento (0% comissão)'}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/12 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Economia Comprovada ({savings.proven_count})
              </p>
              <p className="mt-1 font-sans text-2xl font-extrabold tracking-tight text-white">
                {formatBrl(savings.proven_brl)}
              </p>
              <p className="mt-0.5 text-[10px] text-white/75">
                Validada após check-in presencial
              </p>
            </div>
          </div>

          {/* Detalhamento Secundário Expandível (Economia Potencial & Acumulado/Utilizado/Pendente) */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowWalletDetails((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/80 hover:text-white"
            >
              {showWalletDetails ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {showWalletDetails
                ? 'Ocultar detalhamento de carteira e economia potencial'
                : 'Ver detalhamento de carteira e economia potencial'}
            </button>

            {showWalletDetails && (
              <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                  <span className="block text-[9px] uppercase tracking-wider text-white/60">
                    Acumulado
                  </span>
                  <strong className="text-white">
                    {wallet.total_accumulated.toLocaleString('pt-BR')} RP
                  </strong>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                  <span className="block text-[9px] uppercase tracking-wider text-white/60">
                    Utilizado
                  </span>
                  <strong className="text-white">
                    {wallet.total_spent.toLocaleString('pt-BR')} RP
                  </strong>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                  <span className="block text-[9px] uppercase tracking-wider text-amber-200/90">
                    Pendente
                  </span>
                  <strong className="text-amber-200">
                    {wallet.pending_points.toLocaleString('pt-BR')} RP
                  </strong>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2">
                  <span className="block text-[9px] uppercase tracking-wider text-[#FFB347]">
                    Economia Potencial ({savings.potential_count})
                  </span>
                  <strong className="text-white">{formatBrl(savings.potential_brl)}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 space-y-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] text-[#F1E8D8]">
            <p className="flex items-start gap-1.5">
              <QrCode className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F7931E]" />
              <span>{POINTS_PREVISIT_CHECKIN_NOTICE}</span>
            </p>
            <p className="text-[10px] text-white/70">{WALLET_NON_MONETARY_NOTICE}</p>
          </div>

          {/* Atalhos preservados para Recompensas, Extrato, Histórico e Roteiros */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onGoToClub({ section: 'rewards' })}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95"
            >
              <Gift className="h-3.5 w-3.5" />
              Recompensas e resgates
            </button>
            <button
              type="button"
              onClick={() => onGoToProfile({ section: 'passport', focus: 'ledger' })}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              <ReceiptText className="h-3.5 w-3.5 text-[#F7931E]" />
              Extrato de pontos
            </button>
            <button
              type="button"
              onClick={() => onGoToProfile({ section: 'agenda' })}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              <History className="h-3.5 w-3.5 text-[#4CA188]" />
              Histórico de atividades
            </button>
          </div>
        </div>

        {/* Cartão Companheiro Compacto: Passaporte Carioca & Missões */}
        <div
          aria-labelledby="home-block-missions"
          className="flex flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs sm:p-6 lg:col-span-5"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#397B68]">
                <TrendingUp className="h-4 w-4" />
                Missões e descobertas
              </span>
              <span className="rounded-full bg-[#FF6B35]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#FF6B35]">
                {missionSummary.completed_count}/{missionSummary.total_count} missões
              </span>
            </div>

            <h3
              id="home-block-missions"
              className="mt-2 font-sans text-lg font-bold tracking-tight text-[var(--text-primary)]"
            >
              Passaporte Carioca · {passport.level_label}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              {passport.verified_checkins_count} check-ins validados ·{' '}
              {passport.verified_consumptions_count || 0} consumos confirmados
            </p>

            {/* Preview enxuto com próximos marcos reais */}
            <div className="mt-3.5 space-y-2">
              {missionSummary.missions
                .slice(0, showPassportList ? 6 : 3)
                .map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                      m.completed
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[var(--text-primary)]">{m.title}</p>
                      <p className="truncate text-[10px] text-[var(--text-secondary)]">
                        {m.reward_badge}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] font-bold text-[#FF6B35]">
                      {m.current}/{m.target}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3 text-xs">
            <button
              type="button"
              onClick={() => setShowPassportList((prev) => !prev)}
              className="font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              {showPassportList ? 'Mostrar resumo' : 'Ver todas as missões'}
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onGoToPlanner}
                className="font-bold text-[#123B56] hover:underline dark:text-[#8DC4EA]"
              >
                Roteiros
              </button>
              <button
                type="button"
                onClick={() => onGoToProfile({ section: 'passport', focus: 'missions' })}
                className="inline-flex items-center gap-1 font-bold text-[#397B68] hover:underline dark:text-[#4CA188]"
              >
                Passaporte completo <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SEÇÃO 8: COMO FUNCIONA O BORARIO (3 passos enxutos + modal "Entenda como funciona") */}
      <section
        aria-labelledby="home-block-how"
        className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
              <ShieldCheck className="h-4 w-4" />
              Transparência BoraRio
            </span>
            <h2
              id="home-block-how"
              className="mt-1 font-sans text-xl font-bold tracking-tight text-[var(--text-primary)]"
            >
              Como funciona o BoraRio
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowHowItWorksModal(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35] hover:text-[#FF6B35]"
          >
            <Info className="h-3.5 w-3.5 text-[#FF6B35]" />
            Entenda como funciona
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#123B56] text-xs font-extrabold text-white">
              1
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Escolha uma experiência.
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Explore reservas, ofertas individuais ou demandas sem pagamento no app.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF6B35] text-xs font-extrabold text-white">
              2
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Pague diretamente no estabelecimento.
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                O pagamento é acertado diretamente no local pelos meios aceitos pelo parceiro.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#397B68] text-xs font-extrabold text-white">
              3
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Valide sua visita com QR Code e acumule Rio Points.
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Solicite o QR Code ao chegar para pontuar e resgatar recompensas reais.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MODAL DETALHADO: ENTENDA COMO FUNCIONA */}
      {showHowItWorksModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="how-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowHowItWorksModal(false)}
              aria-label="Fechar explicação de funcionamento"
              className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            >
              <X className="h-5 w-5" />
            </button>

            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
              <ShieldCheck className="h-4 w-4" />
              Regras de Operação &amp; Transparência
            </span>
            <h3
              id="how-modal-title"
              className="mt-1 font-sans text-xl font-bold text-[var(--text-primary)]"
            >
              Como funciona o BoraRio
            </h3>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                <p className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <CalendarCheck2 className="h-4 w-4 text-[#123B56] dark:text-[#8DC4EA]" />
                  1. Solicitação com autonomia do parceiro
                </p>
                <p className="mt-1">
                  O estabelecimento define horários, capacidade, benefícios e modalidades comerciais (tradicional, oferta individual, demanda agregada ou última hora). Reservas por demanda só confirmam após validação explícita do estabelecimento.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                <p className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <Store className="h-4 w-4 text-[#FF6B35]" />
                  2. Sem cobrança nem checkout no app
                </p>
                <p className="mt-1">{DIRECT_PAYMENT_NOTICE}</p>
              </div>

              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                <p className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <QrCode className="h-4 w-4 text-[#397B68]" />
                  3. Validação presencial por QR Code dinâmico
                </p>
                <p className="mt-1">{MANDATORY_CHECKIN_INSTRUCTION}</p>
                <p className="mt-1.5 font-semibold text-[#123B56] dark:text-[#F1E8D8]">
                  {POINTS_PREVISIT_CHECKIN_NOTICE}
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                <p className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <Award className="h-4 w-4 text-[#F7931E]" />
                  4. Economia de Rio Points sem comissão por resgate
                </p>
                <p className="mt-1">{WALLET_NON_MONETARY_NOTICE}</p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowHowItWorksModal(false);
                  onGoToClub({ section: 'offerings', modality: 'ALL' });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0E2235] via-[#123B56] to-[#0077B6] px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-110 transition ring-1 ring-white/15"
              >
                <Crown className="h-3.5 w-3.5 text-[#FFB347]" />
                Explorar Bora Club
              </button>
              <button
                type="button"
                onClick={() => setShowHowItWorksModal(false)}
                className="rounded-xl border border-[var(--border-hairline)] px-4 py-2 text-xs font-bold text-[var(--text-primary)]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

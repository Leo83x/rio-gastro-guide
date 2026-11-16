import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarCheck2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  Crown,
  Gift,
  Heart,
  HeartHandshake,
  History,
  Info,
  Lock,
  MapPin,
  Navigation,
  QrCode,
  ReceiptText,
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
import { getPartnerRewards } from '../services/rewardMarketplaceStore';
import { computeSavingsSummary, formatBrl } from '../services/savingsLedgerStore';
import type { ConfiaRecommendation } from '../types/confia';
import type { UserPreferences } from '../types/experience';
import type { NightlifeEvent } from '../types/nightlife';
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
  vaultCount,
  vaultVenueIds,
  confiaConnectionsCount,
  confiaPosts,
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
  onGoToConfia,
  onGoToProfile,
  onOpenPersonalize,
}: DiscoverEditorialSectionsProps) {
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [showPassportList, setShowPassportList] = useState(false);
  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);

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

  return (
    <div className="mb-12 space-y-11">
      {/* SEÇÃO 2: O QUE VALE A PENA VIVER HOJE? (Foco visual e fotográfico) */}
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

      {/* SEÇÃO 2.5: A NOITE CARIOCA (Agenda Noturna Curada — após O que vale a pena viver hoje?) */}
      <NightlifeSection
        events={nightlifeEvents}
        permanentVenues={experiences}
        savedEventTitlesOrUrls={savedNightlifeKeys}
        onSelectPermanentVenue={onSelectExperience}
        onFilterPermanentNightlife={onFilterPermanentNightlife}
        onSaveEventToVault={onSaveNightlifeToVault}
        onAskBoraIa={onAskBoraIa}
        onGoToAdminNightlife={onGoToAdminNightlife}
      />

      {/* SEÇÃO 3: PERTO DE VOCÊ NO RIO (Grade visual compacta + proximidade opcional) */}
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

      {/* SEÇÃO 4: OPORTUNIDADES PARA APROVEITAR (4 Modalidades Comerciais) */}
      <section aria-labelledby="home-block-opportunities">
        <div className="mb-3.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2
              id="home-block-opportunities"
              className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              Encontre sua próxima oportunidade
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Reserve, descubra ofertas especiais ou aproveite horários disponíveis nos estabelecimentos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onGoToClub({ section: 'offerings', modality: 'ALL' })}
            className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35]/12 px-3.5 py-1.5 text-xs font-bold text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white"
          >
            Abrir Bora Club <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODALITIES_TODAY.map((mod) => {
            const Icon = mod.icon;
            const liveCount = activeOfferingsByModality.get(mod.id) || 0;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => onGoToClub({ section: 'offerings', modality: mod.id })}
                className="flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-[#FF6B35]/55"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${mod.tone}`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="rounded-full bg-[var(--bg-canvas)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                      {liveCount > 0 ? `${liveCount} ativa${liveCount > 1 ? 's' : ''}` : mod.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-[var(--text-primary)]">{mod.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {mod.description}
                  </p>
                </div>
                <span className="mt-3 text-[11px] font-bold text-[#FF6B35]">
                  Explorar modalidade →
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
          <Store className="h-3.5 w-3.5 shrink-0 text-[#397B68]" />
          <span>{DIRECT_PAYMENT_NOTICE}</span>
        </p>
      </section>

      {/* SEÇÃO 5: REDE CONFIA */}
      <section
        aria-labelledby="home-block-confia"
        className="rounded-3xl border border-[#397B68]/30 bg-[#397B68]/8 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#397B68] text-white">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="home-block-confia"
                className="font-sans text-lg font-bold tracking-tight text-[var(--text-primary)] sm:text-xl"
              >
                Sua cidade, suas pessoas de confiança.
              </h2>
              <p className="mt-0.5 max-w-2xl text-xs text-[var(--text-secondary)]">
                Compartilhe experiências reais, descubra recomendações de quem você conhece e monte programas em conjunto.
              </p>
              <p className="mt-1 text-[11px] font-semibold text-[#397B68] dark:text-[#4CA188]">
                {confiaConnectionsCount}{' '}
                {confiaConnectionsCount === 1 ? 'conexão aceita' : 'conexões aceitas'} ·{' '}
                {vaultCount} no seu Cofre privado
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoToConfia}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#397B68] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95"
          >
            Abrir Rede Confia <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {confiaPosts.length === 0 ? (
          <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-dashed border-[#397B68]/35 bg-[var(--bg-surface)]/90 p-4 text-xs sm:flex-row sm:items-center">
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                <Lock className="h-3.5 w-3.5 text-[#397B68]" />
                Zero recomendações anônimas ou conexões fictícias
              </p>
              <p className="text-[var(--text-secondary)]">
                Aqui você só vê dicas de quem convidou e aceitou em seus círculos, com selos de visita real e votação conjunta no BoraJunto.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToConfia}
              className="shrink-0 rounded-xl border border-[#397B68] px-3.5 py-2 font-bold text-[#397B68] transition hover:bg-[#397B68] hover:text-white"
            >
              Convidar ou recomendar
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {confiaPosts.slice(0, 3).map((post) => {
              const linkedVenue = experiences.find((v) => v.id === post.venue_id);
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => (linkedVenue ? onSelectExperience(linkedVenue) : onGoToConfia())}
                  className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-left shadow-xs transition hover:border-[#397B68]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-[var(--text-primary)]">
                      {post.is_self ? 'Você' : post.author_name}
                    </span>
                    {post.visit_proof_level === 'VERIFIED_CONSUMPTION' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                        <BadgeCheck className="h-3 w-3" />
                        Consumo Verificado
                      </span>
                    ) : post.visit_proof_level === 'VERIFIED_VISIT' ||
                      post.endorsement_origin === 'VERIFIED_CHECKIN' ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        <BadgeCheck className="h-3 w-3" />
                        {post.visit_proof_level === 'CHECKIN_REGISTERED' ||
                        post.visit_proof_level === 'PRESENCE_WITH_EVIDENCE'
                          ? 'Check-in realizado'
                          : 'Visita Verificada'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--bg-canvas)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                        Recomendação Pessoal
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate font-sans text-sm font-bold text-[var(--text-primary)]">
                    {post.venue_name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                    “{post.comment}”
                  </p>
                </button>
              );
            })}
          </div>
        )}
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
                ? 'Baseado no seu perfil, Cofre e indicações da Rede Confia com motivo explícito.'
                : preferences.lgpd_consents.personalization
                  ? 'Escolha ao menos 2 preferências no perfil para calcular afinidade (% Match) real.'
                  : 'Curadoria transparente pelo catálogo e Cofre. Ative a personalização para receber recomendações sob medida.'}
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
                className="rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2 text-xs font-bold text-white"
              >
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

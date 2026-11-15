import {
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarCheck2,
  Clock3,
  Compass,
  Crown,
  Gift,
  Heart,
  HeartHandshake,
  Lock,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import { calculateMatchScore, getMatchReasonLabel } from '../services/matchService';
import { computeMissionSummary } from '../services/missionStore';
import { computePassportSummary } from '../services/passportStore';
import { computeSavingsSummary, formatBrl } from '../services/savingsLedgerStore';
import { getPointTransactions } from '../services/superappStore';
import type { ConfiaRecommendation } from '../types/confia';
import type { UserPreferences } from '../types/experience';
import type { Restaurant } from '../types/restaurant';
import { SmartImage } from './SmartImage';

interface DiscoverEditorialSectionsProps {
  experiences: Restaurant[];
  preferences: UserPreferences;
  vaultCount: number;
  vaultVenueIds: Set<string>;
  confiaConnectionsCount: number;
  confiaPosts: ConfiaRecommendation[];
  confiaCountsByVenue: Map<string, number>;
  pointsBalance: number;
  onSelectExperience: (item: Restaurant) => void;
  onGoToExploreMap: () => void;
  onGoToClub: () => void;
  onGoToPlanner: () => void;
  onGoToConfia: () => void;
  onGoToProfile: () => void;
  onOpenPersonalize: () => void;
}

const MODALITIES_TODAY = [
  {
    id: 'TRADITIONAL_BOOKING',
    title: 'Reserva tradicional',
    badge: 'Sem desconto obrigatório',
    description: 'Horários e disponibilidade confirmados direto pelo estabelecimento.',
    icon: CalendarCheck2,
    tone: 'text-[#123B56] bg-[#123B56]/10 dark:text-[#7FB6D9] dark:bg-[#123B56]/35',
  },
  {
    id: 'INDIVIDUAL_OFFER',
    title: 'Oferta individual',
    badge: 'Uso imediato',
    description: 'Cortesias, menus especiais e condições definidas pelo parceiro sem depender de grupo.',
    icon: Gift,
    tone: 'text-[#397B68] bg-[#397B68]/12 dark:text-[#4CA188]',
  },
  {
    id: 'DEMAND_OFFER',
    title: 'Reserva inteligente por demanda',
    badge: 'Demanda agregada',
    description:
      'Manifeste interesse individual; sua reserva só confirma após o parceiro validar a condição.',
    icon: Users,
    tone: 'text-[#FF6B35] bg-[#FF6B35]/12',
  },
  {
    id: 'LAST_MINUTE',
    title: 'Oportunidade de última hora',
    badge: 'Janelas de hoje',
    description: 'Mesas e horários remanescentes abertos pelo estabelecimento para hoje.',
    icon: Clock3,
    tone: 'text-[#D49B27] bg-[#D49B27]/15 dark:text-[#F7931E]',
  },
] as const;

export function DiscoverEditorialSections({
  experiences,
  preferences,
  vaultCount,
  vaultVenueIds,
  confiaConnectionsCount,
  confiaPosts,
  confiaCountsByVenue,
  pointsBalance,
  onSelectExperience,
  onGoToExploreMap,
  onGoToClub,
  onGoToPlanner,
  onGoToConfia,
  onGoToProfile,
  onOpenPersonalize,
}: DiscoverEditorialSectionsProps) {
  if (experiences.length === 0) return null;

  const spotlight = experiences.find((e) => e.is_featured) || experiences[0];
  const nearby = experiences.filter((e) => e.id !== spotlight.id).slice(0, 4);
  const spotlightMatch = calculateMatchScore(spotlight, preferences);
  const passport = computePassportSummary(experiences);
  const missionSummary = computeMissionSummary(experiences);
  const savings = computeSavingsSummary();
  const transactions = getPointTransactions();
  const pendingPoints = transactions
    .filter((tx) => tx.type === 'CREDIT' && tx.validation_status === 'PENDING_VALIDATION')
    .reduce((acc, tx) => acc + tx.amount, 0);

  const curatedPicks = [...experiences]
    .sort((a, b) => {
      const confiaDiff = (confiaCountsByVenue.get(b.id) || 0) - (confiaCountsByVenue.get(a.id) || 0);
      if (confiaDiff !== 0) return confiaDiff;
      const vaultDiff = Number(vaultVenueIds.has(b.id)) - Number(vaultVenueIds.has(a.id));
      if (vaultDiff !== 0) return vaultDiff;
      return (calculateMatchScore(b, preferences) ?? 0) - (calculateMatchScore(a, preferences) ?? 0);
    })
    .slice(0, 3);

  return (
    <div className="mb-12 space-y-10">
      {/* BLOCO 1: O que vale a pena viver hoje? + Perto de você */}
      <section aria-labelledby="home-block-spotlight">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="home-block-spotlight"
              className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              O que vale a pena viver hoje?
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Curadoria viva da cidade para descobrir, decidir e reservar com segurança.
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
          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[#0E2235] shadow-md"
        >
          <div className="relative h-64 w-full sm:h-72">
            <SmartImage
              src={spotlight.cover_image}
              alt={spotlight.name}
              name={spotlight.name}
              category={spotlight.category}
              hasRealPhoto={spotlight.has_real_photo}
              imageOrigin={spotlight.image_origin}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07111C] via-[#07111C]/45 to-transparent" />
          </div>

          {/* Selo editorial separado de selo de Match */}
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

          <div className="absolute inset-x-0 bottom-0 flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end sm:p-6">
            <div>
              <h3 className="font-sans text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {spotlight.name}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-[#F1E8D8]">
                <MapPin className="h-3.5 w-3.5 text-[#FF6B35]" />
                {spotlight.neighborhood} · {spotlight.category}
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
              Ver e solicitar <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Subgrade Perto de você */}
        <div className="mt-5">
          <div className="mb-2.5 flex items-center justify-between">
            <div>
              <h3 className="font-sans text-base font-bold text-[var(--text-primary)]">
                Perto de você no Rio
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {preferences.lgpd_consents.location
                  ? 'Localização consentida ativa para distância e rotas.'
                  : 'Destaques curados pela cidade (ative a localização LGPD em Perfil para rotas por distância).'}
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToExploreMap}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B35] hover:underline"
            >
              Ver no mapa <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {nearby.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectExperience(item)}
                className="group relative overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-left shadow-xs transition hover:border-[#FF6B35]/60"
              >
                <div className="relative h-32 w-full overflow-hidden">
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
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07111C]/90 via-transparent to-transparent" />
                  <div className="absolute bottom-2.5 left-2.5 right-2.5">
                    <p className="truncate text-xs font-bold text-white">{item.name}</p>
                    <p className="truncate text-[10px] text-[#F1E8D8]">{item.neighborhood}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* BLOCO 2: Oportunidades de hoje (4 Modalidades Comerciais sem Gateway) */}
      <section aria-labelledby="home-block-opportunities">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="home-block-opportunities"
              className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              Oportunidades de hoje
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Condições definidas com autonomia pelos parceiros · Pagamento efetuado diretamente ao estabelecimento no local.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToClub}
            className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35]/12 px-3.5 py-1.5 text-xs font-bold text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white"
          >
            Abrir Bora Club <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODALITIES_TODAY.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={onGoToClub}
                className="flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-[#FF6B35]/50"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${mod.tone}`}>
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="rounded-full bg-[var(--bg-canvas)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                      {mod.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-[var(--text-primary)]">{mod.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {mod.description}
                  </p>
                </div>
                <span className="mt-3 text-[11px] font-bold text-[#FF6B35]">
                  Explorar disponibilidade →
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* BLOCO 3: Sua Rede Confia (somente dados reais de conexões aceitas e próprios) */}
      <section
        aria-labelledby="home-block-confia"
        className="rounded-3xl border border-[#397B68]/30 bg-[#397B68]/8 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#397B68] text-white">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="home-block-confia"
                className="font-sans text-lg font-bold tracking-tight text-[var(--text-primary)] sm:text-xl"
              >
                Sua Rede Confia
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {confiaConnectionsCount} {confiaConnectionsCount === 1 ? 'conexão aceita' : 'conexões aceitas'} ·{' '}
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
          <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-dashed border-[#397B68]/35 bg-[var(--bg-surface)]/85 p-4 text-xs sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#397B68]" />
              <p className="text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">Zero recomendações ou amigos fictícios.</strong>{' '}
                Convide pessoas de confiança ou compartilhe uma experiência vivida para acompanhar recomendações reais aqui.
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToConfia}
              className="shrink-0 rounded-xl border border-[#397B68] px-3.5 py-2 font-bold text-[#397B68] hover:bg-[#397B68] hover:text-white"
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

      {/* BLOCO 4: Selecionado para você (com motivo curto e % Match separado) */}
      <section aria-labelledby="home-block-curated">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="home-block-curated"
              className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl"
            >
              Selecionado para você
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {preferences.lgpd_consents.personalization
                ? 'Baseado no seu perfil, Cofre e indicações da Rede Confia com motivo explícito.'
                : 'Ative seu perfil LGPD para liberar o % Match personalizado sem coleta oculta.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPersonalize}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#FF6B35] hover:underline"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {preferences.lgpd_consents.personalization ? 'Ajustar perfil' : 'Ativar Match %'}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
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
                  <span className="rounded-full bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
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

      {/* BLOCO 5 & BLOCO 6: Benefícios e Recompensas + Missões e Descobertas */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* BLOCO 5: Seus benefícios e recompensas */}
        <section
          aria-labelledby="home-block-benefits"
          className="rounded-3xl bg-borario-night p-6 text-white shadow-md"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#E5B342]">
              <Crown className="h-4 w-4" />
              Seus benefícios e recompensas
            </span>
            <button
              type="button"
              onClick={onGoToProfile}
              className="text-xs font-bold text-[#F7931E] hover:underline"
            >
              Ver extrato →
            </button>
          </div>

          <h2 id="home-block-benefits" className="mt-2 font-sans text-2xl font-bold tracking-tight">
            {pointsBalance.toLocaleString('pt-BR')} Rio Points{' '}
            <span className="text-xs font-medium text-white/75">disponíveis</span>
          </h2>
          {pendingPoints > 0 && (
            <p className="mt-1 text-[11px] text-amber-200">
              + {pendingPoints} pts aguardando confirmação de visita elegível
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border border-white/15 bg-white/8 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                Economia Comprovada ({savings.proven_count})
              </p>
              <p className="mt-1 font-sans text-xl font-extrabold text-white">
                {formatBrl(savings.proven_brl)}
              </p>
              <p className="mt-0.5 text-[10px] text-white/70">
                Computada apenas após check-in validado no estabelecimento
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/8 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFB347]">
                Economia Potencial ({savings.potential_count})
              </p>
              <p className="mt-1 font-sans text-xl font-extrabold text-white">
                {formatBrl(savings.potential_brl)}
              </p>
              <p className="mt-0.5 text-[10px] text-white/70">
                Em reservas ou vouchers abertos (catálogo até {formatBrl(savings.catalog_reference_brl)})
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGoToClub}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95"
            >
              Explorar Bora Club <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onGoToPlanner}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
            >
              Criar Roteiro com Bora IA
            </button>
          </div>
        </section>

        {/* BLOCO 6: Missões e descobertas */}
        <section
          aria-labelledby="home-block-missions"
          className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#397B68]">
              <TrendingUp className="h-4 w-4" />
              Missões e descobertas
            </span>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-[#397B68]/12 px-2.5 py-0.5 text-[10px] font-bold text-[#397B68] dark:text-[#4CA188]">
                {passport.level_label}
              </span>
              <span className="rounded-full bg-[#FF6B35]/12 px-2.5 py-0.5 text-[10px] font-bold text-[#FF6B35]">
                {missionSummary.completed_count}/{missionSummary.total_count} missões
              </span>
            </div>
          </div>

          <h2
            id="home-block-missions"
            className="mt-2 font-sans text-xl font-bold tracking-tight text-[var(--text-primary)]"
          >
            Passaporte Carioca ({passport.verified_checkins_count} check-ins ·{' '}
            {passport.verified_consumptions_count || 0} consumos)
          </h2>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {passport.milestones.map((ms) => (
              <div
                key={ms.id}
                className={`rounded-2xl border p-3 text-xs ${
                  ms.unlocked
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[var(--text-primary)]">{ms.title}</strong>
                  <span className="font-mono text-[11px] font-bold text-[#FF6B35]">
                    {ms.current}/{ms.target}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{ms.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-[var(--border-hairline)] pt-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Jornadas Auditáveis
              </span>
              <button
                type="button"
                onClick={onGoToProfile}
                className="font-bold text-[#397B68] hover:underline"
              >
                Ver todas no Passaporte →
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {missionSummary.missions.slice(0, 4).map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] ${
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
        </section>
      </div>

      {/* BLOCO 7: Como funciona */}
      <section
        aria-labelledby="home-block-how"
        className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
              <ShieldCheck className="h-4 w-4" />
              Como funciona o BoraRio
            </span>
            <h2
              id="home-block-how"
              className="mt-1 font-sans text-xl font-bold tracking-tight text-[var(--text-primary)]"
            >
              Transparência do pedido até o check-in no local
            </h2>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#123B56] text-white">
              <CalendarCheck2 className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-[var(--text-primary)]">
              1. Solicite sem checkout no app
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              Escolha entre reserva tradicional, oferta individual, reserva inteligente por demanda ou oportunidade de última hora, sem cobrar cartão no BoraRio.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6B35] text-white">
              <Store className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-[var(--text-primary)]">
              2. Pague direto ao estabelecimento
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              O pagamento da sua experiência é feito diretamente no local pelos meios aceitos pelo parceiro, com condições confirmadas previamente.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#397B68] text-white">
              <QrCode className="h-4 w-4" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-[var(--text-primary)]">
              3. Valide seu QR dinâmico ao chegar
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              Antes de iniciar o consumo, solicite ao atendente a validação do check-in temporário para registrar sua visita e liberar benefícios e recompensas.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-[var(--bg-canvas)] px-4 py-3 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1.5">
            <Award className="h-4 w-4 text-[#F7931E]" />
            Cada visita verificada acumula Rio Points reais no seu Passaporte Carioca.
          </span>
        </div>
      </section>
    </div>
  );
}

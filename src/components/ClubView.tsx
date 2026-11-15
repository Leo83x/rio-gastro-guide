import {
  Award,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Clock3,
  Compass,
  Crown,
  Filter,
  Gift,
  Info,
  MapPin,
  QrCode,
  ReceiptText,
  Search,
  Sparkles,
  Store,
  Ticket,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getClubRedemptions,
  markClubRedemptionUsed,
  redeemClubOffer,
} from '../services/clubRedemptionStore';
import { computeMissionSummary } from '../services/missionStore';
import {
  getPartnerOfferings,
  incrementOfferingViews,
  submitOfferingRequest,
} from '../services/opportunityStore';
import { computePassportSummary } from '../services/passportStore';
import { getWalletSummary } from '../services/pointsLedger';
import {
  getPartnerRewards,
  redeemPartnerReward,
} from '../services/rewardMarketplaceStore';
import { computeSavingsSummary, formatBrl } from '../services/savingsLedgerStore';
import { DEMONSTRATIVE_CLUB_OFFERS } from '../services/superappStore';
import type { ClubOffer, ClubRedemption, ReservationRequest } from '../types/experience';
import type { PartnerOffering } from '../types/marketplace';
import type { CommercialModality } from '../types/partnerCommercial';
import type { Restaurant } from '../types/restaurant';
import type { PartnerReward, RewardVoucher } from '../types/rewards';
import {
  DIRECT_PAYMENT_NOTICE,
  MANDATORY_CHECKIN_INSTRUCTION,
  POINTS_PREVISIT_CHECKIN_NOTICE,
} from '../types/verification';

interface ClubViewProps {
  experiences: Restaurant[];
  onSelectExperience: (item: Restaurant) => void;
  onReservationCreated?: (req: ReservationRequest) => void;
  onPointsChanged?: () => void;
}

const MODALITY_META: Record<
  CommercialModality,
  { label: string; shortLabel: string; icon: typeof CalendarCheck2; badgeCls: string }
> = {
  TRADITIONAL_BOOKING: {
    label: 'Reserva tradicional',
    shortLabel: 'Tradicional',
    icon: CalendarCheck2,
    badgeCls: 'bg-[#123B56]/12 text-[#123B56] dark:bg-[#123B56]/40 dark:text-[#8DC4EA]',
  },
  INDIVIDUAL_OFFER: {
    label: 'Oferta individual',
    shortLabel: 'Individual',
    icon: Gift,
    badgeCls: 'bg-[#397B68]/15 text-[#397B68] dark:text-[#4CA188]',
  },
  DEMAND_OFFER: {
    label: 'Reserva inteligente por demanda',
    shortLabel: 'Por Demanda',
    icon: Users,
    badgeCls: 'bg-[#FF6B35]/15 text-[#FF6B35]',
  },
  LAST_MINUTE: {
    label: 'Oportunidade de última hora',
    shortLabel: 'Última Hora',
    icon: Clock3,
    badgeCls: 'bg-[#D49B27]/15 text-[#B78114] dark:text-[#F7931E]',
  },
};

export function ClubView({
  experiences,
  onSelectExperience,
  onReservationCreated,
  onPointsChanged,
}: ClubViewProps) {
  const [clubSection, setClubSection] = useState<'offerings' | 'rewards'>('offerings');
  const [offerings, setOfferings] = useState<PartnerOffering[]>(() => getPartnerOfferings());
  const [modalityFilter, setModalityFilter] = useState<CommercialModality | 'ALL'>('ALL');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>('');
  const [priceFilter, setPriceFilter] = useState<string>('');
  const [onlyToday, setOnlyToday] = useState<boolean>(false);

  // Condition 2: Cross-partner Rewards Marketplace State
  const [rewards, setRewards] = useState<PartnerReward[]>(() => getPartnerRewards());
  const [rewardSegment, setRewardSegment] = useState<string>('ALL');
  const [rewardNeighborhood, setRewardNeighborhood] = useState<string>('');
  const [rewardCostFilter, setRewardCostFilter] = useState<string>('ALL');
  const [rewardSearch, setRewardSearch] = useState<string>('');
  const [rewardFeedback, setRewardFeedback] = useState<{
    ok: boolean;
    message: string;
    voucher?: RewardVoucher;
  } | null>(null);

  const [activeRequestOfferingId, setActiveRequestOfferingId] = useState<string | null>(null);
  const [requestGuests, setRequestGuests] = useState<number>(2);
  const [whatsappReminder, setWhatsappReminder] = useState<boolean>(true);
  const [requestResult, setRequestResult] = useState<{
    ok: boolean;
    message: string;
    offeringTitle?: string;
    modality?: CommercialModality;
  } | null>(null);

  const [redemptions, setRedemptions] = useState<ClubRedemption[]>(() => getClubRedemptions());
  const [lastVoucher, setLastVoucher] = useState<ClubRedemption | null>(null);
  const [voucherMsg, setVoucherMsg] = useState<string>('');
  const [todayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [savingsTick, setSavingsTick] = useState(0);
  const viewedOfferingIdsRef = useRef<Set<string>>(new Set());

  const savingsSummary = useMemo(() => {
    void savingsTick;
    return computeSavingsSummary();
  }, [savingsTick]);

  const walletSummary = useMemo(() => {
    void savingsTick;
    return getWalletSummary();
  }, [savingsTick]);

  const passportSummary = useMemo(() => {
    void savingsTick;
    return computePassportSummary(experiences);
  }, [experiences, savingsTick]);

  const missionSummary = useMemo(() => {
    void savingsTick;
    return computeMissionSummary(experiences);
  }, [experiences, savingsTick]);

  const neighborhoods = useMemo(() => {
    const set = new Set<string>();
    offerings.forEach((o) => set.add(o.neighborhood));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [offerings]);

  const rewardSegments = useMemo(() => {
    const set = new Set<string>();
    rewards.forEach((r) => set.add(r.segment_category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rewards]);

  const rewardNeighborhoods = useMemo(() => {
    const set = new Set<string>();
    rewards.forEach((r) => set.add(r.neighborhood));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rewards]);

  const filteredOfferings = useMemo(() => {
    return offerings.filter((o) => {
      if (modalityFilter !== 'ALL' && o.modality !== modalityFilter) return false;
      if (neighborhoodFilter && o.neighborhood !== neighborhoodFilter) return false;
      if (priceFilter && o.price_range !== priceFilter) return false;
      if (onlyToday && o.service_date !== todayDate) return false;
      return true;
    });
  }, [offerings, modalityFilter, neighborhoodFilter, priceFilter, onlyToday, todayDate]);

  useEffect(() => {
    if (clubSection !== 'offerings') return;
    for (const off of filteredOfferings) {
      if (!viewedOfferingIdsRef.current.has(off.id)) {
        viewedOfferingIdsRef.current.add(off.id);
        incrementOfferingViews(off.id);
      }
    }
  }, [clubSection, filteredOfferings]);

  const filteredRewards = useMemo(() => {
    const q = rewardSearch.trim().toLowerCase();
    return rewards.filter((r) => {
      if (rewardSegment !== 'ALL' && r.segment_category !== rewardSegment) return false;
      if (rewardNeighborhood && r.neighborhood !== rewardNeighborhood) return false;
      if (rewardCostFilter === 'AFFORDABLE' && r.points_cost > walletSummary.available_balance) {
        return false;
      }
      if (rewardCostFilter === 'UP_TO_150' && r.points_cost > 150) return false;
      if (rewardCostFilter === 'UP_TO_250' && r.points_cost > 250) return false;
      if (q) {
        const hay = `${r.title} ${r.restaurant_name} ${r.eligible_item} ${r.segment_category} ${r.neighborhood}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    rewards,
    rewardSegment,
    rewardNeighborhood,
    rewardCostFilter,
    rewardSearch,
    walletSummary.available_balance,
  ]);

  const openVenue = (expId: string) => {
    const found = experiences.find((e) => e.id === expId);
    if (found) onSelectExperience(found);
  };

  const handleSubmitRequest = (offering: PartnerOffering) => {
    const venue = experiences.find((e) => e.id === offering.restaurant_id);
    const res = submitOfferingRequest({
      offeringId: offering.id,
      guests: requestGuests,
      whatsappReminder,
      attributionOrigin: `club_${offering.modality.toLowerCase()}`,
      venueCoords: venue ? { latitude: venue.latitude, longitude: venue.longitude } : undefined,
    });

    setRequestResult({
      ok: res.ok,
      message: res.message,
      offeringTitle: `${offering.restaurant_name} · ${offering.title}`,
      modality: offering.modality,
    });

    if (res.ok && res.reservation) {
      setOfferings(getPartnerOfferings());
      setActiveRequestOfferingId(null);
      setSavingsTick((n) => n + 1);
      onReservationCreated?.(res.reservation);
    }
  };

  const handleRedeemMarketplaceReward = (reward: PartnerReward) => {
    const res = redeemPartnerReward(reward.id);
    setRewardFeedback({
      ok: res.ok,
      message: res.message,
      voucher: res.voucher,
    });
    if (res.ok) {
      setRewards(getPartnerRewards());
      setSavingsTick((n) => n + 1);
      onPointsChanged?.();
    }
  };

  const handleActivateVoucher = (offer: ClubOffer) => {
    const res = redeemClubOffer(offer);
    setRedemptions(res.all);
    setLastVoucher(res.redemption);
    setSavingsTick((n) => n + 1);
  };

  const handleMarkVoucherUsed = (redemptionId: string) => {
    const res = markClubRedemptionUsed(redemptionId);
    setRedemptions(res.redemptions);
    setVoucherMsg(res.message);
    setSavingsTick((n) => n + 1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Zero Gateway Direct Payment Policy */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#FF6B35]">
            <Crown className="h-4 w-4" />
            Bora Club &amp; Reservas Inteligentes
          </p>
          <h2 className="font-sans mt-1 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Oportunidades, Reservas &amp; Recompensas
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Condição 1 para atrair clientes (reservas e ofertas sem desconto obrigatório) e Condição 2 para resgatar Rio Points em toda a rede com comissão zero.
          </p>
        </div>

        <div className="inline-flex max-w-md items-start gap-2 rounded-2xl border border-[#397B68]/35 bg-[#397B68]/10 px-4 py-3 text-xs text-[var(--text-primary)]">
          <Store className="mt-0.5 h-4 w-4 shrink-0 text-[#397B68]" />
          <span>
            <strong>Sem checkout no app:</strong> {DIRECT_PAYMENT_NOTICE}
          </span>
        </div>
      </div>

      {/* Switcher claro entre Condição 1 (Ofertas & Reservas) e Condição 2 (Marketplace de Recompensas) */}
      <div
        role="tablist"
        aria-label="Seções do Bora Club"
        className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1.5"
      >
        <button
          type="button"
          onClick={() => setClubSection('offerings')}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            clubSection === 'offerings'
              ? 'bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <CalendarCheck2 className="h-4 w-4" />
          Condição 1 · Ofertas &amp; Reservas ({offerings.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setRewards(getPartnerRewards());
            setClubSection('rewards');
          }}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            clubSection === 'rewards'
              ? 'bg-[#123B56] text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Sparkles className="h-4 w-4 text-[#F7931E]" />
          Condição 2 · Marketplace de Recompensas ({rewards.filter((r) => r.status === 'AVAILABLE').length}) · {walletSummary.available_balance} RP
        </button>
      </div>

      {/* Economia Comprovada vs Economia Potencial (Estritamente Separadas) */}
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/8 p-4 text-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Economia Comprovada ({savingsSummary.proven_count} validações)
          </p>
          <p className="mt-1 font-sans text-2xl font-extrabold text-[var(--text-primary)]">
            {formatBrl(savingsSummary.proven_brl)}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            Incrementada apenas após check-in dinâmico validado no estabelecimento.
          </p>
        </div>
        <div className="rounded-2xl border border-[#F7931E]/35 bg-[#F7931E]/8 p-4 text-xs">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#B78114] dark:text-[#F7931E]">
            Economia Potencial ({savingsSummary.potential_count} ativas)
          </p>
          <p className="mt-1 font-sans text-2xl font-extrabold text-[var(--text-primary)]">
            {formatBrl(savingsSummary.potential_brl)}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
            Solicitações ou vouchers ativos aguardando comparecimento e check-in presencial (não somada à comprovada).
          </p>
        </div>
      </section>

      {/* Passaporte Carioca & Missões Auditáveis no Bora Club */}
      <section className="flex flex-col justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-3.5 text-xs md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-bold text-[#397B68] dark:text-[#4CA188]">
            <Compass className="h-4 w-4" />
            {passportSummary.level_label}
          </span>
          <span className="text-[var(--text-secondary)]">
            {passportSummary.verified_checkins_count} check-ins validados ·{' '}
            {passportSummary.verified_consumptions_count || 0} consumos confirmados
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35]/12 px-2.5 py-1 text-[11px] font-bold text-[#FF6B35]">
            <Award className="h-3.5 w-3.5" />
            Missões: {missionSummary.completed_count}/{missionSummary.total_count}
          </span>
          {missionSummary.missions.slice(0, 3).map((m) => (
            <span
              key={m.id}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                m.completed
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
              }`}
            >
              {m.title} ({m.current}/{m.target})
            </span>
          ))}
        </div>
      </section>

      {/* Confirmation Feedback + Mandatory Check-in Instruction */}
      {requestResult && (
        <div
          className={`rounded-2xl border p-4 text-xs ${
            requestResult.ok
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
              : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {requestResult.ok
                  ? requestResult.modality === 'DEMAND_OFFER'
                    ? 'Manifestação individual registrada (Aguardando meta e confirmação do parceiro)'
                    : 'Solicitação registrada (Aguardando confirmação do estabelecimento)'
                  : 'Não foi possível registrar a solicitação'}
              </p>
              {requestResult.offeringTitle && (
                <p className="font-semibold opacity-90">{requestResult.offeringTitle}</p>
              )}
              <p>{requestResult.message}</p>
              {requestResult.ok && (
                <p className="flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 font-semibold text-[#123B56] dark:bg-black/25 dark:text-[#F1E8D8]">
                  <QrCode className="h-4 w-4 shrink-0 text-[#FF6B35]" />
                  <span>{MANDATORY_CHECKIN_INSTRUCTION}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setRequestResult(null)}
              className="rounded-lg border border-current/30 px-3 py-1 font-bold"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {clubSection === 'offerings' ? (
        <>
          {/* Rich Filters */}
          <section className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)]">
                <Filter className="h-3.5 w-3.5 text-[#FF6B35]" />
                Modalidade:
              </span>

              <button
                type="button"
                onClick={() => setModalityFilter('ALL')}
                className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  modalityFilter === 'ALL'
                    ? 'border-transparent bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                }`}
              >
                Todas ({offerings.length})
              </button>

              {(Object.keys(MODALITY_META) as CommercialModality[]).map((modKey) => {
                const meta = MODALITY_META[modKey];
                const active = modalityFilter === modKey;
                return (
                  <button
                    key={modKey}
                    type="button"
                    onClick={() => setModalityFilter(modKey)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      active
                        ? 'border-transparent bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <meta.icon className="h-3.5 w-3.5" />
                    {meta.shortLabel}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-hairline)] pt-3 text-xs">
              <select
                aria-label="Filtrar oportunidades por bairro"
                value={neighborhoodFilter}
                onChange={(e) => setNeighborhoodFilter(e.target.value)}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 font-semibold text-[var(--text-primary)]"
              >
                <option value="">Todos os bairros</option>
                {neighborhoods.map((nb) => (
                  <option key={nb} value={nb}>
                    {nb}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar oportunidades por faixa de preço"
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value)}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 font-semibold text-[var(--text-primary)]"
              >
                <option value="">Qualquer faixa</option>
                <option value="$">$</option>
                <option value="$$">$$</option>
                <option value="$$$">$$$</option>
                <option value="$$$$">$$$$</option>
              </select>

              <button
                type="button"
                onClick={() => setOnlyToday((prev) => !prev)}
                className={`rounded-xl border px-3 py-1.5 font-bold ${
                  onlyToday
                    ? 'border-[#FF6B35] bg-[#FF6B35]/15 text-[#FF6B35]'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                }`}
              >
                Janela de hoje
              </button>
            </div>
          </section>

          {/* Offerings Grid (4 Independent Modalities) */}
          <section>
            {filteredOfferings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center text-xs text-[var(--text-secondary)]">
                Nenhuma oportunidade encontrada com os filtros selecionados. Limpe os filtros para ver todas as modalidades.
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {filteredOfferings.map((off) => {
                  const meta = MODALITY_META[off.modality];
                  const ModIcon = meta.icon;
                  const remaining = Math.max(0, off.capacity_total - off.reserved_count);
                  const isDemand = off.modality === 'DEMAND_OFFER';
                  const minGoal = off.min_demand_goal || 10;
                  const demandPct = isDemand
                    ? Math.min(100, Math.round((off.reserved_count / minGoal) * 100))
                    : 0;
                  const isOpenDrawer = activeRequestOfferingId === off.id;
                  const unavailable =
                    !off.partner_managed_active ||
                    remaining === 0 ||
                    ['SOLD_OUT', 'ENDED_WITHOUT_GOAL', 'CANCELLED', 'COMPLETED', 'DRAFT'].includes(
                      off.status
                    );

                  return (
                    <article
                      key={off.id}
                      className="flex flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs"
                    >
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold ${meta.badgeCls}`}
                          >
                            <ModIcon className="h-3.5 w-3.5" />
                            {meta.label}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {off.is_demonstrative && (
                              <span className="rounded-full bg-[var(--bg-canvas)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                                Piloto / Demo
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                off.status === 'CONFIRMED'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : off.status === 'GOAL_REACHED'
                                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    : off.status === 'ENDED_WITHOUT_GOAL' || off.status === 'CANCELLED'
                                      ? 'bg-red-500/15 text-red-600 dark:text-red-300'
                                      : 'bg-[#FF6B35]/12 text-[#FF6B35]'
                              }`}
                            >
                              {off.status === 'GOAL_REACHED'
                                ? 'Meta atingida · Aguardando confirmação do parceiro'
                                : off.status === 'CONFIRMED'
                                  ? 'Confirmada pelo parceiro'
                                  : off.status === 'ENDED_WITHOUT_GOAL'
                                    ? 'Encerrada sem meta'
                                    : off.status === 'CANCELLED'
                                      ? 'Encerrada pelo parceiro'
                                      : off.status === 'SOLD_OUT'
                                        ? 'Vagas esgotadas'
                                        : `${remaining} vagas reais`}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                            <strong className="text-[var(--text-primary)]">{off.restaurant_name}</strong>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-[#FF6B35]" />
                              {off.neighborhood}
                            </span>
                            <span>·</span>
                            <span>{off.price_range}</span>
                          </div>
                          <h3 className="mt-1 font-sans text-lg font-bold leading-snug text-[var(--text-primary)]">
                            {off.title}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                            {off.description}
                          </p>
                        </div>

                        {/* Commercial Terms & Direct Payment Clarity */}
                        <div className="mt-3 space-y-1.5 rounded-2xl bg-[var(--bg-canvas)] p-3 text-[11px]">
                          <p className="font-semibold text-[var(--text-primary)]">
                            Condição: {off.benefit_summary}
                          </p>
                          {off.eligible_item && (
                            <p className="text-[var(--text-secondary)]">
                              Item elegível: <strong>{off.eligible_item}</strong>
                            </p>
                          )}
                          <p className="text-[var(--text-secondary)]">
                            Janela: <strong>{off.service_date}</strong> às{' '}
                            <strong>{off.time_slot_label}</strong>
                            {off.valid_days_hours ? ` (${off.valid_days_hours})` : ''} · Vagas restantes:{' '}
                            <strong>
                              {remaining}/{off.capacity_total}
                            </strong>
                          </p>
                          {off.base_price_brl != null && off.partner_condition_price_brl != null && (
                            <p className="text-[var(--text-secondary)]">
                              Referência do parceiro: de{' '}
                              <span className="line-through">R$ {off.base_price_brl.toFixed(2)}</span> por{' '}
                              <strong className="text-[#397B68] dark:text-[#4CA188]">
                                R$ {off.partner_condition_price_brl.toFixed(2)}
                              </strong>{' '}
                              (acerto no local)
                            </p>
                          )}
                          <p className="text-[10px] text-[var(--text-secondary)]">
                            {off.rules_summary}
                          </p>
                        </div>

                        {/* Progress for DEMAND_OFFER without misleading premature confirmation */}
                        {isDemand && (
                          <div className="mt-3">
                            <div className="mb-1 flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-[var(--text-primary)]">
                                {off.reserved_count}/{minGoal} manifestações para atingir a meta
                              </span>
                              <span className="font-bold text-[#FF6B35]">{demandPct}%</span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] transition-all"
                                style={{ width: `${demandPct}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                              Cada participante mantém reserva individual independente. Não confirmada antes do parceiro validar.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Inline Request Drawer or Action Buttons */}
                      <div className="mt-4 border-t border-[var(--border-hairline)] pt-3">
                        {isOpenDrawer ? (
                          <div className="space-y-2.5 rounded-2xl border border-[#FF6B35]/35 bg-[var(--bg-canvas)] p-3 text-xs">
                            <p className="font-bold text-[var(--text-primary)]">
                              Solicitar vaga sem checkout no app
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
                                Pessoas:
                              </label>
                              <select
                                value={requestGuests}
                                onChange={(e) => setRequestGuests(Number(e.target.value))}
                                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-bold text-[var(--text-primary)]"
                              >
                                {[1, 2, 3, 4, 6].map((n) => (
                                  <option key={n} value={n} disabled={n > remaining}>
                                    {n} {n === 1 ? 'pessoa' : 'pessoas'}
                                  </option>
                                ))}
                              </select>
                              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                                <input
                                  type="checkbox"
                                  checked={whatsappReminder}
                                  onChange={(e) => setWhatsappReminder(e.target.checked)}
                                  className="rounded accent-[#FF6B35]"
                                />
                                Lembrete WhatsApp
                              </label>
                            </div>

                            <p className="text-[10px] text-[var(--text-secondary)]">
                              <Info className="mr-1 inline h-3 w-3 text-[#FF6B35]" />
                              {off.payment_instructions}
                            </p>
                            <p className="rounded-lg bg-[#FF6B35]/10 px-2 py-1 text-[10px] font-semibold text-[#123B56] dark:text-[#F1E8D8]">
                              {POINTS_PREVISIT_CHECKIN_NOTICE}
                            </p>
                            <p className="text-[10px] font-medium text-[#123B56] dark:text-[#F1E8D8]">
                              Check-in: {MANDATORY_CHECKIN_INSTRUCTION}
                            </p>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSubmitRequest(off)}
                                className="flex-1 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-2 text-xs font-bold text-white"
                              >
                                {isDemand
                                  ? 'Registrar Manifestação Individual'
                                  : 'Enviar Solicitação de Reserva'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveRequestOfferingId(null)}
                                className="rounded-xl border border-[var(--border-hairline)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={unavailable}
                              onClick={() => {
                                setRequestGuests(Math.min(2, Math.max(1, remaining)));
                                setActiveRequestOfferingId(off.id);
                              }}
                              className="flex-1 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-2.5 text-xs font-bold text-white transition hover:opacity-95 disabled:opacity-45"
                            >
                              {unavailable
                                ? 'Indisponível nesta janela'
                                : isDemand
                                  ? 'Manifestar Interesse Individual'
                                  : 'Solicitar Horário / Condição'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openVenue(off.restaurant_id)}
                              className="rounded-xl border border-[var(--border-hairline)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                            >
                              Local
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Legacy Member Vouchers Section Preserved & Harmonized */}
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                  <Ticket className="h-4 w-4" />
                  Vouchers &amp; Benefícios de Membro (Piloto)
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Gere vouchers gratuitos sem cobrança no aplicativo e apresente no local antes do consumo.
                </p>
              </div>
            </div>

            {lastVoucher && (
              <div className="mt-4 flex flex-col justify-between gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-200 sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold">
                    Voucher gerado: <span className="font-mono">{lastVoucher.voucher_code}</span>
                  </p>
                  <p>
                    {lastVoucher.experience_name} — {lastVoucher.offer_title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLastVoucher(null)}
                  className="self-start rounded-lg border border-emerald-500/40 px-3 py-1 font-bold sm:self-auto"
                >
                  Ok
                </button>
              </div>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {DEMONSTRATIVE_CLUB_OFFERS.map((offer) => (
                <div
                  key={offer.id}
                  className="flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 text-xs"
                >
                  <div>
                    <span className="rounded-full bg-[#FF6B35]/12 px-2.5 py-0.5 text-[10px] font-bold text-[#FF6B35]">
                      {offer.discount_label}
                    </span>
                    <h4 className="mt-2 font-sans text-sm font-bold text-[var(--text-primary)]">
                      {offer.experience_name} · {offer.neighborhood}
                    </h4>
                    <p className="mt-1 text-[var(--text-secondary)]">{offer.title}</p>
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--text-secondary)]">
                      <Clock className="h-3 w-3 text-[#FF6B35]" />
                      {offer.valid_window}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleActivateVoucher(offer)}
                    className="mt-3 w-full rounded-xl bg-[#123B56] py-2 font-bold text-white hover:bg-[#102F46]"
                  >
                    Gerar Voucher Gratuito
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-[var(--border-hairline)] pt-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                <ReceiptText className="h-4 w-4 text-[#FF6B35]" />
                Histórico de Resgates ({redemptions.length})
              </div>
              {voucherMsg && (
                <p className="mt-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-800 dark:text-amber-200">
                  {voucherMsg}
                </p>
              )}
              {redemptions.length === 0 ? (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">
                  Nenhum voucher gerado até o momento.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {redemptions.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 text-xs"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-[#FF6B35]">{rec.voucher_code}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              rec.status === 'USED'
                                ? rec.validated_with_checkin
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                                : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                            }`}
                          >
                            {rec.status === 'USED'
                              ? rec.validated_with_checkin
                                ? 'Validado c/ Check-in'
                                : 'Usado sem QR'
                              : 'Ativo'}
                          </span>
                        </div>
                        <p className="mt-1 font-bold text-[var(--text-primary)]">{rec.experience_name}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">{rec.offer_title}</p>
                      </div>
                      {rec.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleMarkVoucherUsed(rec.id)}
                          className="shrink-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-primary)] hover:border-emerald-500"
                        >
                          Validar uso
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        /* CONDIÇÃO 2: MARKETPLACE DE RECOMPENSAS BORARIO (MULTI-SEGMENTO & COMISSÃO ZERO) */
        <div className="space-y-6">
          <section className="rounded-3xl bg-borario-night p-5 text-white shadow-md">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#F7931E]">
                  Marketplace Cross-Parceiro · Rio Points em toda a cidade
                </p>
                <h3 className="mt-1 font-sans text-2xl font-extrabold">
                  Saldo disponível: {walletSummary.available_balance.toLocaleString('pt-BR')} Rio Points
                </h3>
                <p className="mt-1 text-xs text-white/75">
                  Acumule pontos com check-ins validados em qualquer estabelecimento e resgate benefícios em restaurantes, museus, passeios e turismo — comissão ao parceiro: R$ 0,00 (0%).
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-2">
                  <span className="block text-[9px] uppercase text-white/65">Acumulado</span>
                  <strong>{walletSummary.total_accumulated} RP</strong>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-2">
                  <span className="block text-[9px] uppercase text-white/65">Utilizado</span>
                  <strong>{walletSummary.total_spent} RP</strong>
                </div>
                <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-2">
                  <span className="block text-[9px] uppercase text-amber-200/80">Pendente</span>
                  <strong className="text-amber-200">{walletSummary.pending_points} RP</strong>
                </div>
              </div>
            </div>
            <p className="mt-3 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[11px] text-[#F1E8D8]">
              {POINTS_PREVISIT_CHECKIN_NOTICE}
            </p>
          </section>

          {rewardFeedback && (
            <div
              className={`rounded-2xl border p-4 text-xs ${
                rewardFeedback.ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                  : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-bold">{rewardFeedback.message}</p>
                  {rewardFeedback.voucher && (
                    <div className="space-y-0.5 text-[11px]">
                      <p>
                        Código do voucher:{' '}
                        <span className="rounded bg-black/10 px-2 py-0.5 font-mono font-bold dark:bg-white/10">
                          {rewardFeedback.voucher.voucher_code}
                        </span>{' '}
                        · Estado: <strong>{rewardFeedback.voucher.status}</strong> · Comissão ao parceiro: R$ 0,00
                      </p>
                      <p>
                        Item: {rewardFeedback.voucher.snapshot_rules.eligible_item} · Validade até{' '}
                        {new Date(rewardFeedback.voucher.expires_at).toLocaleDateString('pt-BR')} · Disponível em Perfil › Carteira.
                      </p>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setRewardFeedback(null)}
                  className="rounded-lg border border-current/30 px-3 py-1 font-bold"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* Filtros do Marketplace de Recompensas */}
          <section className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 shadow-xs text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setRewardSegment('ALL')}
                className={`rounded-full border px-3 py-1.5 font-bold ${
                  rewardSegment === 'ALL'
                    ? 'border-transparent bg-[#123B56] text-white'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                }`}
              >
                Todos os segmentos ({rewards.length})
              </button>
              {rewardSegments.map((seg) => (
                <button
                  key={seg}
                  type="button"
                  onClick={() => setRewardSegment(seg)}
                  className={`rounded-full border px-3 py-1.5 font-bold ${
                    rewardSegment === seg
                      ? 'border-transparent bg-[#123B56] text-white'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                  }`}
                >
                  {seg}
                </button>
              ))}
            </div>

            <div className="grid gap-2 border-t border-[var(--border-hairline)] pt-3 sm:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={rewardSearch}
                  onChange={(e) => setRewardSearch(e.target.value)}
                  placeholder="Buscar recompensa ou parceiro..."
                  aria-label="Buscar recompensa no marketplace"
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2 pl-8 pr-3 text-xs text-[var(--text-primary)]"
                />
              </div>
              <select
                aria-label="Filtrar recompensas por bairro"
                value={rewardNeighborhood}
                onChange={(e) => setRewardNeighborhood(e.target.value)}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-semibold text-[var(--text-primary)]"
              >
                <option value="">Todos os bairros</option>
                {rewardNeighborhoods.map((nb) => (
                  <option key={nb} value={nb}>
                    {nb}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar recompensas por custo em Rio Points"
                value={rewardCostFilter}
                onChange={(e) => setRewardCostFilter(e.target.value)}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-semibold text-[var(--text-primary)]"
              >
                <option value="ALL">Qualquer pontuação</option>
                <option value="AFFORDABLE">
                  Dentro do meu saldo ({walletSummary.available_balance} RP)
                </option>
                <option value="UP_TO_150">Até 150 RP</option>
                <option value="UP_TO_250">Até 250 RP</option>
              </select>
            </div>
          </section>

          {/* Grid de Recompensas */}
          {filteredRewards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center text-xs text-[var(--text-secondary)]">
              Nenhuma recompensa encontrada com os filtros selecionados.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredRewards.map((rew) => {
                const canAfford = walletSummary.available_balance >= rew.points_cost;
                const isAvailable = rew.status === 'AVAILABLE' && rew.quantity_available > 0;
                return (
                  <article
                    key={rew.id}
                    className="flex flex-col justify-between rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 text-xs shadow-xs"
                  >
                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-[#123B56]/12 px-2.5 py-0.5 text-[10px] font-bold text-[#123B56] dark:bg-[#123B56]/35 dark:text-[#8DC4EA]">
                          {rew.segment_category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {rew.is_demonstrative && (
                            <span className="rounded-full bg-[var(--bg-canvas)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                              Piloto / Demo
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              rew.status === 'AVAILABLE'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {rew.status}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                          <strong className="text-[var(--text-primary)]">{rew.restaurant_name}</strong> ·{' '}
                          {rew.neighborhood}
                        </p>
                        <h4 className="mt-1 font-sans text-base font-bold text-[var(--text-primary)]">
                          {rew.title}
                        </h4>
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                          {rew.description}
                        </p>
                      </div>

                      <div className="mt-3 space-y-1 rounded-2xl bg-[var(--bg-canvas)] p-3 text-[11px]">
                        <p className="font-semibold text-[var(--text-primary)]">
                          Benefício: {rew.eligible_item}
                        </p>
                        <p className="text-[var(--text-secondary)]">
                          Estoque restante:{' '}
                          <strong>
                            {rew.quantity_available}/{rew.quantity_total}
                          </strong>{' '}
                          · Limite: <strong>{rew.max_per_user}x por usuário</strong>
                        </p>
                        <p className="text-[var(--text-secondary)]">
                          Uso: {rew.valid_days_hours} · Validade voucher: {rew.voucher_validity_days} dias
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          Regras: {rew.rules_summary} ({rew.restrictions})
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-3">
                      <div>
                        <span className="block text-[10px] uppercase text-[var(--text-secondary)]">
                          Custo
                        </span>
                        <strong className="font-sans text-lg font-extrabold text-[#FF6B35]">
                          {rew.points_cost} RP
                        </strong>
                      </div>
                      <button
                        type="button"
                        disabled={!isAvailable || !canAfford}
                        onClick={() => handleRedeemMarketplaceReward(rew)}
                        className="rounded-xl bg-[#123B56] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#102F46] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {!isAvailable
                          ? rew.status === 'PAUSED'
                            ? 'Pausada'
                            : 'Esgotada'
                          : canAfford
                            ? `Resgatar (${rew.points_cost} RP)`
                            : `Faltam ${rew.points_cost - walletSummary.available_balance} RP`}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

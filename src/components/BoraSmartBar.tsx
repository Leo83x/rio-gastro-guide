import {
  Award,
  CalendarCheck2,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Gift,
  MapPin,
  QrCode,
  Share2,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getWalletSummary } from '../services/pointsLedger';
import {
  fetchReferralSummaryFromServer,
  getCanonicalAppBaseUrl,
  getMyReferralLink,
  getReferralAttributions,
} from '../services/referralStore';
import { fetchActiveReferralProgramRule } from '../services/pointRulesStore';
import { getPartnerRewards, redeemPartnerReward } from '../services/rewardMarketplaceStore';
import {
  computeSmartBarState,
  getEffectiveReservationStage,
} from '../services/smartBarState';
import { fetchPartnerVipConfig, getCachedPartnerVipConfig } from '../services/vipInviteStore';
import type { ReservationRequest } from '../types/experience';
import type { PartnerVipInviteConfig, ReferralProgramRule, VipInviteRecord } from '../types/growth';
import type { Restaurant } from '../types/restaurant';
import type { PartnerReward } from '../types/rewards';

function formatReservationStageLabel(stage: string): string {
  switch (stage) {
    case 'REQUESTED':
      return 'Aguardando';
    case 'CONFIRMED':
      return 'Confirmada';
    case 'CHECKED_IN':
      return 'Check-in feito';
    case 'ATTENDED':
      return 'Atendida';
    case 'CANCELLED':
      return 'Cancelada';
    case 'NO_SHOW':
      return 'Não compareceu';
    default:
      return stage;
  }
}

function formatReservationDateLabel(dateStr: string): string {
  if (!dateStr) return 'Hoje';
  const now = new Date();
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayIso = toIso(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = toIso(tomorrow);

  if (dateStr === todayIso) return 'Hoje';
  if (dateStr === tomorrowIso) return 'Amanhã';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (match) return `${match[3]}/${match[2]}`;
  return dateStr;
}

interface BoraSmartBarProps {
  reservations: ReservationRequest[];
  restaurants: Restaurant[];
  refreshNonce?: number;
  visible?: boolean;
  onOpenPass: (reservation: ReservationRequest) => void;
  onOpenRewards: () => void;
  onOpenInvitePage?: () => void;
  onDataChanged?: () => void;
}

export function BoraSmartBar({
  reservations,
  restaurants,
  refreshNonce = 0,
  visible = true,
  onOpenPass,
  onOpenRewards,
  onOpenInvitePage,
  onDataChanged,
}: BoraSmartBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [dockOffsetPx, setDockOffsetPx] = useState(84);
  const [vipInvites, setVipInvites] = useState<VipInviteRecord[]>([]);
  const [vipConfigsByVenue, setVipConfigsByVenue] = useState<Record<string, PartnerVipInviteConfig>>({});
  const [referralRule, setReferralRule] = useState<ReferralProgramRule | null>(null);
  const [copiedVipCode, setCopiedVipCode] = useState<string | null>(null);
  const [redeemFeedback, setRedeemFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activeSheetSection, setActiveSheetSection] = useState<
    'overview' | 'reservations' | 'vip' | 'rewards'
  >('overview');
  const touchStartYRef = useRef<number | null>(null);

  // Mede a altura real do dock inferior mobile para evitar sobreposição
  useEffect(() => {
    const updateDockOffset = () => {
      const isDesktop = window.innerWidth >= 1024;
      if (isDesktop) {
        setDockOffsetPx(24);
        return;
      }
      const dock = document.getElementById('borario-mobile-dock');
      if (dock) {
        const rect = dock.getBoundingClientRect();
        const clearance = Math.max(72, Math.round(window.innerHeight - rect.top + 10));
        setDockOffsetPx(clearance);
      } else {
        setDockOffsetPx(84);
      }
    };

    updateDockOffset();
    window.addEventListener('resize', updateDockOffset);

    const dockEl = document.getElementById('borario-mobile-dock');
    let observer: ResizeObserver | null = null;
    if (dockEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateDockOffset);
      observer.observe(dockEl);
    }

    return () => {
      window.removeEventListener('resize', updateDockOffset);
      observer?.disconnect();
    };
  }, []);

  // Sincroniza convites VIP e ledger do servidor quando relevante (sem polling excessivo)
  useEffect(() => {
    let active = true;
    const venueIds = Array.from(
      new Set(
        reservations
          .filter((r) => r.experience_id)
          .map((r) => r.experience_id)
      )
    );

    const cachedMap: Record<string, PartnerVipInviteConfig> = {};
    for (const vid of venueIds) {
      const cached = getCachedPartnerVipConfig(vid);
      if (cached) cachedMap[vid] = cached;
    }
    if (Object.keys(cachedMap).length > 0) {
      setVipConfigsByVenue((prev) => ({ ...prev, ...cachedMap }));
    }

    void fetchReferralSummaryFromServer().then((res) => {
      if (!active || !res.ok) return;
      if (Array.isArray(res.vipInvites)) {
        setVipInvites(res.vipInvites);
        const inviteVenueIds = Array.from(new Set(res.vipInvites.map((v) => v.restaurant_id)));
        for (const vid of inviteVenueIds) {
          void fetchPartnerVipConfig(vid).then((cfg) => {
            if (active && cfg) {
              setVipConfigsByVenue((prev) => ({ ...prev, [vid]: cfg }));
            }
          });
        }
      }
    });

    for (const vid of venueIds) {
      void fetchPartnerVipConfig(vid).then((cfg) => {
        if (active && cfg) {
          setVipConfigsByVenue((prev) => ({ ...prev, [vid]: cfg }));
        }
      });
    }

    void fetchActiveReferralProgramRule().then((rule) => {
      if (active && rule) {
        setReferralRule(rule);
      }
    });

    return () => {
      active = false;
    };
  }, [reservations, refreshNonce]);

  // Fecha Bottom Sheet com Escape
  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheetOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sheetOpen]);

  const smartState = useMemo(() => {
    const wallet = getWalletSummary();
    const rewards = getPartnerRewards();
    const attributions = getReferralAttributions();
    return computeSmartBarState({
      reservations,
      vipInvites,
      vipConfigsByVenue,
      wallet,
      rewards,
      attributions,
    });
  }, [reservations, vipInvites, vipConfigsByVenue, refreshNonce]);

  if (!visible || smartState.primaryState === 'HIDDEN') {
    return null;
  }

  const featuredRes = smartState.todayReservations[0] || smartState.activeReservations[0] || null;
  const venueMap = new Map(restaurants.map((r) => [r.id, r]));

  const buildVipLink = (inv: VipInviteRecord) =>
    `${getCanonicalAppBaseUrl()}/app?vip=${encodeURIComponent(inv.invite_code)}&venue=${encodeURIComponent(inv.restaurant_id)}`;

  const handleShareCompanion = (res: ReservationRequest) => {
    const link = getMyReferralLink(res.experience_id);
    const text = `Bora comigo em *${res.experience_name}* (${res.neighborhood})?\nAtivei minha ida no BoraRio. Cada pessoa precisa ativar seu próprio passe individual pelo link:\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareVipInvite = (inv: VipInviteRecord) => {
    const venueName = venueMap.get(inv.restaurant_id)?.name || 'Estabelecimento BoraRio';
    const link = buildVipLink(inv);
    const text = `🎁 *Convite VIP BoraRio — ${venueName}*\nBenefício autorizado: *${inv.benefit_title}*\n\nAcesse pelo seu link individual antes da expiração:\n${link}\nCódigo: *${inv.invite_code}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleRedeemReward = (reward: PartnerReward) => {
    const res = redeemPartnerReward(reward.id);
    setRedeemFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      onDataChanged?.();
    }
  };

  const renderCapsuleLabel = () => {
    if (smartState.primaryState === 'ACTIVE_RESERVATION' && featuredRes) {
      const extraCount = smartState.activeReservations.length - 1;
      const prefix = smartState.todayReservations.length > 0 ? 'SEU PROGRAMA DE HOJE' : 'PASSE ATIVO';
      return {
        dotColor: 'bg-emerald-400',
        ping: true,
        text: `${prefix} · ${featuredRes.experience_name}${extraCount > 0 ? ` (+${extraCount})` : ''}`,
        actionText: 'Abrir',
        progress: null as number | null,
      };
    }

    if (smartState.primaryState === 'VIP_INVITES_AVAILABLE') {
      const count = smartState.validVipInvites.length;
      return {
        dotColor: 'bg-amber-400',
        ping: false,
        text: `✦ VOCÊ TEM ${count} ${count === 1 ? 'CONVITE VIP' : 'CONVITES VIP'}`,
        actionText: 'Presentear',
        progress: null as number | null,
      };
    }

    if (smartState.primaryState === 'REWARD_AVAILABLE') {
      return {
        dotColor: 'bg-amber-400',
        ping: false,
        text: '✦ VOCÊ TEM UMA RECOMPENSA DISPONÍVEL',
        actionText: 'Resgatar',
        progress: null as number | null,
      };
    }

    return {
      dotColor: 'bg-sky-400',
      ping: false,
      text: `${smartState.wallet.available_balance} RIO POINTS · FALTAM ${smartState.pointsMissingForNext} PARA PRÓXIMA RECOMPENSA`,
      actionText: 'Progresso',
      progress: smartState.progressPct,
    };
  };

  const capsule = renderCapsuleLabel();

  return (
    <>
      {/* Cápsula Flutuante Inteligente */}
      <div
        style={{
          bottom: `calc(${dockOffsetPx}px + env(safe-area-inset-bottom, 0px))`,
        }}
        className="pointer-events-none fixed inset-x-3 z-30 flex justify-center lg:inset-x-auto lg:left-6 lg:justify-start motion-reduce:transition-none transition-all duration-300"
      >
        {minimized ? (
          <button
            type="button"
            onClick={() => setMinimized(false)}
            aria-label="Expandir Meus Passes e Pontos"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-stone-950/90 px-3.5 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-xl hover:border-amber-400/50"
          >
            <span className={`h-2 w-2 rounded-full ${capsule.dotColor}`} />
            <span>
              {smartState.primaryState === 'ACTIVE_RESERVATION'
                ? `Passe Ativo (${smartState.activeReservations.length})`
                : smartState.wallet.available_balance > 0
                  ? `✨ ${smartState.wallet.available_balance} pts`
                  : '🎁 Meus Benefícios'}
            </span>
            <ChevronUp className="h-3.5 w-3.5 text-stone-300" />
          </button>
        ) : (
          <div className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-full border border-white/15 bg-stone-950/90 text-white shadow-2xl backdrop-blur-xl lg:w-auto lg:min-w-[340px] lg:max-w-lg">
            <div className="flex items-center gap-2 px-3.5 py-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSheetSection('overview');
                  setSheetOpen(true);
                }}
                className="flex min-w-0 flex-1 items-center justify-between gap-2.5 text-left focus:outline-none"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    {capsule.ping && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                    )}
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${capsule.dotColor}`} />
                  </span>
                  <span className="truncate text-[11px] font-bold tracking-wide text-stone-100 sm:text-xs">
                    {capsule.text}
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-bold text-amber-300">
                  {capsule.actionText}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Minimizar cápsula"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 hover:bg-white/10 hover:text-white"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {capsule.progress !== null && (
              <div className="h-0.5 w-full bg-white/10">
                <div
                  className="h-full bg-gradient-to-r from-[#FF6B35] to-amber-400 transition-all duration-500 motion-reduce:transition-none"
                  style={{ width: `${Math.max(8, capsule.progress)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Sheet Inteligente */}
      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Meus Passes e Pontos"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-xs sm:items-center sm:p-4"
          onClick={() => setSheetOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              touchStartYRef.current = e.touches[0]?.clientY ?? null;
            }}
            onTouchEnd={(e) => {
              const startY = touchStartYRef.current;
              const endY = e.changedTouches[0]?.clientY ?? null;
              if (startY !== null && endY !== null && endY - startY > 65) {
                setSheetOpen(false);
              }
              touchStartYRef.current = null;
            }}
            className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/15 bg-stone-950 text-stone-100 shadow-2xl sm:rounded-3xl motion-reduce:animate-none animate-in slide-in-from-bottom-4 duration-200"
          >
            {/* Alça de gesto para minimizar/fechar */}
            <div className="sticky top-0 z-10 border-b border-white/10 bg-stone-950/95 px-5 pt-3 pb-3 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Minimizar painel"
                className="mx-auto mb-2.5 block h-1.5 w-12 rounded-full bg-white/25 hover:bg-white/40"
              />
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                    Meus Passes e Pontos
                  </p>
                  <h3 className="text-base font-extrabold text-white">
                    {smartState.wallet.available_balance} Rio Points liberados
                    {smartState.wallet.pending_points > 0 && (
                      <span className="ml-2 text-xs font-medium text-stone-400">
                        ({smartState.wallet.pending_points} pendentes)
                      </span>
                    )}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-stone-200 hover:bg-white/15"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Minimizar
                </button>
              </div>

              {/* Navegação interna entre módulos relevantes */}
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveSheetSection('overview')}
                  className={`rounded-full px-3 py-1 ${
                    activeSheetSection === 'overview'
                      ? 'bg-[#FF6B35] text-white'
                      : 'bg-white/8 text-stone-300 hover:bg-white/15'
                  }`}
                >
                  Resumo
                </button>
                {smartState.activeReservations.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSheetSection('reservations')}
                    className={`rounded-full px-3 py-1 ${
                      activeSheetSection === 'reservations'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/8 text-stone-300 hover:bg-white/15'
                    }`}
                  >
                    Reservas ({smartState.activeReservations.length})
                  </button>
                )}
                {smartState.validVipInvites.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveSheetSection('vip')}
                    className={`rounded-full px-3 py-1 ${
                      activeSheetSection === 'vip'
                        ? 'bg-amber-600 text-white'
                        : 'bg-white/8 text-stone-300 hover:bg-white/15'
                    }`}
                  >
                    Convites VIP ({smartState.validVipInvites.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveSheetSection('rewards')}
                  className={`rounded-full px-3 py-1 ${
                    activeSheetSection === 'rewards'
                      ? 'bg-sky-600 text-white'
                      : 'bg-white/8 text-stone-300 hover:bg-white/15'
                  }`}
                >
                  Recompensas ({smartState.redeemableRewards.length})
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5 text-xs">
              {redeemFeedback && (
                <div
                  className={`rounded-xl px-3.5 py-2.5 font-semibold ${
                    redeemFeedback.ok
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-rose-500/20 text-rose-300'
                  }`}
                >
                  {redeemFeedback.msg}
                </div>
              )}

              {/* BLOCO 1: RESERVAS E PASSES ATIVOS (TODAS) */}
              {(activeSheetSection === 'overview' || activeSheetSection === 'reservations') &&
                smartState.activeReservations.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      <CalendarCheck2 className="h-3.5 w-3.5" />
                      Reservas e Passes Ativos ({smartState.activeReservations.length})
                    </p>
                    {smartState.activeReservations.map((res) => {
                      const venue = venueMap.get(res.experience_id);
                      const stage = getEffectiveReservationStage(res);
                      return (
                        <div
                          key={res.id}
                          className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-white">{res.experience_name}</p>
                              <p className="text-[11px] text-stone-300">
                                {formatReservationDateLabel(res.date)} às {res.time} · {res.guests}{' '}
                                {res.guests === 1 ? 'pessoa' : 'pessoas'}
                              </p>
                              <p className="flex items-center gap-1 text-[11px] text-stone-400">
                                <MapPin className="h-3 w-3 text-[#FF6B35]" />
                                {venue?.address || res.neighborhood}
                              </p>
                            </div>
                            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              {formatReservationStageLabel(stage)}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSheetOpen(false);
                                onOpenPass(res);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF4B2B] to-[#FF6B35] px-3 py-2 text-xs font-bold text-white"
                            >
                              <QrCode className="h-3.5 w-3.5" />
                              Abrir Passe / Check-in
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShareCompanion(res)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-semibold text-stone-200 hover:bg-white/15"
                            >
                              <Users className="h-3.5 w-3.5 text-emerald-400" />
                              Convidar acompanhantes
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              {/* BLOCO 2: CONVITES VIP PÓS-CHECK-IN */}
              {(activeSheetSection === 'overview' || activeSheetSection === 'vip') &&
                smartState.validVipInvites.length > 0 && (
                  <div className="space-y-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      <Gift className="h-3.5 w-3.5" />
                      Convites VIP Autorizados ({smartState.validVipInvites.length})
                    </p>
                    {smartState.validVipInvites.map((inv) => {
                      const venueName = venueMap.get(inv.restaurant_id)?.name || 'Estabelecimento';
                      const link = buildVipLink(inv);
                      return (
                        <div
                          key={inv.id}
                          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-white">{venueName}</p>
                              <p className="text-xs font-semibold text-amber-300">{inv.benefit_title}</p>
                              {inv.conditions_text && (
                                <p className="text-[11px] text-stone-300">{inv.conditions_text}</p>
                              )}
                              <p className="text-[10px] text-stone-400 mt-0.5">
                                Código individual: <span className="font-mono text-white">{inv.invite_code}</span> · Validade:{' '}
                                {new Date(inv.expires_at).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                              {inv.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleShareVipInvite(inv)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              Presentear um amigo
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard?.writeText(link);
                                setCopiedVipCode(inv.invite_code);
                                setTimeout(() => setCopiedVipCode(null), 2000);
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-stone-200"
                            >
                              {copiedVipCode === inv.invite_code ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              Copiar link
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              {/* BLOCO 3 & 4: RECOMPENSAS DISPONÍVEIS OU PROGRESSO */}
              {(activeSheetSection === 'overview' || activeSheetSection === 'rewards') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-400">
                      <Ticket className="h-3.5 w-3.5" />
                      {smartState.redeemableRewards.length > 0
                        ? `Recompensas Disponíveis (${smartState.redeemableRewards.length})`
                        : 'Progresso até a Próxima Recompensa'}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSheetOpen(false);
                        onOpenRewards();
                      }}
                      className="text-[11px] font-bold text-amber-400 hover:underline"
                    >
                      Ver clube completo
                    </button>
                  </div>

                  {smartState.redeemableRewards.length > 0 ? (
                    <div className="space-y-2">
                      {smartState.redeemableRewards.slice(0, 4).map((rw) => (
                        <div
                          key={rw.id}
                          className="rounded-2xl border border-white/10 bg-white/5 p-3.5 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-white">{rw.title}</p>
                              <p className="text-[11px] text-stone-300">
                                {rw.restaurant_name} · {rw.valid_days_hours}
                              </p>
                              <p className="text-[10px] text-stone-400">{rw.rules_summary}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                              {rw.points_cost} RP
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRedeemReward(rw)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            <Award className="h-3.5 w-3.5" />
                            Resgatar recompensa
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : smartState.nextReward ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{smartState.nextReward.title}</span>
                        <span className="text-xs font-bold text-amber-300">
                          {smartState.wallet.available_balance} / {smartState.nextReward.points_cost} RP
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#FF6B35] to-amber-400"
                          style={{ width: `${Math.max(6, smartState.progressPct)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-stone-300">
                        Faltam <strong>{smartState.pointsMissingForNext} Rio Points</strong> liberados para resgatar em{' '}
                        {smartState.nextReward.restaurant_name}. Acumule pontos realizando check-ins presenciais validados.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-400">
                      Nenhuma recompensa ativa disponível no momento.
                    </p>
                  )}
                </div>
              )}

              {/* BLOCO COMPACTO: INDICAÇÕES PENDENTES */}
              {onOpenInvitePage && (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      Convide e ganhe
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {referralRule?.active && referralRule.referrer_points > 0
                        ? `+${referralRule.referrer_points} pts por amigo que fizer check-in${
                            smartState.pendingReferralsCount > 0
                              ? ` · ${smartState.pendingReferralsCount} em andamento`
                              : ''
                          }`
                        : smartState.pendingReferralsCount > 0
                          ? `${smartState.pendingReferralsCount} indicações em acompanhamento`
                          : 'Compartilhe o BoraRio e ganhe pontos após o check-in'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSheetOpen(false);
                      onOpenInvitePage();
                    }}
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
                  >
                    Abrir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

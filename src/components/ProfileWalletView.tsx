import {
  AlertTriangle,
  Award,
  Bookmark,
  CalendarDays,
  CalendarPlus,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  Copy,
  Gift,
  HeartHandshake,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  QrCode,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sparkles,
  Star,
  Store,
  Ticket,
  Trash2,
  UserPlus,
  Users,
  Wand2,
  WifiOff,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  getUserProfileIdentity,
  isSupabaseAuthConfigured,
  requestMagicLinkLogin,
  saveUserProfileIdentity,
  signOutAccount,
} from '../services/authService';
import {
  getConfiaPrivacySettings,
  saveConfiaPrivacySettings,
} from '../services/confiaStore';
import { deleteSavedItinerary, getSavedItineraries } from '../services/itineraryStore';
import { computeMissionSummary } from '../services/missionStore';
import { computePassportSummary } from '../services/passportStore';
import {
  getIncomingReferralCode,
  getMyReferralCode,
  getMyReferralLink,
  getReferralAttributions,
  linkBookingToReferral,
  registerReferralInvitation,
  reverseReferralAttribution,
  setIncomingReferralCode,
  tryConvertAttributionWithProof,
} from '../services/referralStore';
import { getWalletSummary } from '../services/pointsLedger';
import {
  cancelRewardVoucher,
  getPartnerRewards,
  getRewardVouchers,
  redeemPartnerReward,
} from '../services/rewardMarketplaceStore';
import { computeSavingsSummary, formatBrl } from '../services/savingsLedgerStore';
import {
  cancelReservation,
  completeReservationCheckin,
  creditVerifiedReview,
  getPointTransactions,
  getReservations,
  hasValidatedCheckinForVenue,
  validateAndCreditQRCheckin,
  validateGroupCompanionCheckin,
} from '../services/superappStore';
import { queueOfflineContingencyCheckin } from '../services/visitProofStore';
import type { ConfiaPrivacySettings } from '../types/confia';
import type {
  PointTransaction,
  ReservationRequest,
  SavedItinerary,
  UserPreferences,
  UserProfileIdentity,
} from '../types/experience';
import type { ReferralAttribution } from '../types/growth';
import type { Restaurant } from '../types/restaurant';
import type {
  PartnerReward,
  RewardVoucher,
  RewardVoucherStatus,
  WalletSummary,
} from '../types/rewards';
import {
  DIRECT_PAYMENT_NOTICE,
  MANDATORY_CHECKIN_INSTRUCTION,
  POINTS_PREVISIT_CHECKIN_NOTICE,
  WALLET_NON_MONETARY_NOTICE,
  type ReservationLifecycleStage,
} from '../types/verification';
import { haversineKm } from '../utils/geo';

export type ProfileSectionTab = 'passport' | 'agenda' | 'privacy';
export type ProfileFocusTarget = 'ledger' | 'missions' | 'vouchers' | null;

interface ProfileWalletViewProps {
  experiences: Restaurant[];
  preferences: UserPreferences;
  reservations: ReservationRequest[];
  vaultCount: number;
  confiaConnectionsCount: number;
  onSavePreferences: (next: UserPreferences) => void;
  onReservationsUpdated: (next: ReservationRequest[]) => void;
  onOpenPersonalize: () => void;
  onOpenConfiaHub: () => void;
  onPointsChanged: () => void;
  initialSectionTab?: ProfileSectionTab;
  focusTarget?: ProfileFocusTarget;
  deepLinkNonce?: number;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
}

interface WindowWithBarcodeDetector extends Window {
  BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
}

const VOUCHER_STATUS_META: Record<RewardVoucherStatus, { label: string; cls: string }> = {
  AVAILABLE: {
    label: 'AVAILABLE · Disponível',
    cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  REDEEMED: {
    label: 'REDEEMED · Resgatada',
    cls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  },
  ISSUED: {
    label: 'ISSUED · Emitido (Pronto p/ uso)',
    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  USED: {
    label: 'USED · Utilizada no local',
    cls: 'bg-[#397B68]/20 text-[#397B68] dark:text-[#4CA188]',
  },
  EXPIRED: {
    label: 'EXPIRED · Expirado',
    cls: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300',
  },
  CANCELLED: {
    label: 'CANCELLED · Cancelado / Estornado',
    cls: 'bg-red-500/15 text-red-600 dark:text-red-300',
  },
};

const STAGE_BADGE: Record<ReservationLifecycleStage, { label: string; cls: string }> = {
  REQUESTED: {
    label: 'Solicitada',
    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  CONFIRMED: {
    label: 'Confirmada',
    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  CHECKED_IN: {
    label: 'Check-in realizado',
    cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  VERIFIED_VISIT: {
    label: 'Visita verificada',
    cls: 'bg-[#397B68]/20 text-[#397B68] dark:text-[#4CA188]',
  },
  VERIFIED_CONSUMPTION: {
    label: 'Consumo verificado',
    cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  },
  CANCELLED: {
    label: 'Cancelada',
    cls: 'bg-red-500/15 text-red-600 dark:text-red-300',
  },
  NO_SHOW: {
    label: 'Não compareceu',
    cls: 'bg-red-500/15 text-red-600 dark:text-red-300',
  },
  ENDED_WITHOUT_GOAL: {
    label: 'Encerrada sem meta',
    cls: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300',
  },
};

function getEffectiveStage(r: ReservationRequest): ReservationLifecycleStage {
  if (r.stage) return r.stage;
  if (r.status === 'CONFIRMED') return 'CONFIRMED';
  if (r.status === 'CANCELLED') return 'CANCELLED';
  return 'REQUESTED';
}

function buildGoogleCalendarUrl(r: ReservationRequest): string {
  const start = `${r.date.replace(/-/g, '')}T${r.time.replace(':', '')}00`;
  const hour = Math.min(23, parseInt(r.time.split(':')[0] || '19', 10) + 2);
  const end = `${r.date.replace(/-/g, '')}T${String(hour).padStart(2, '0')}${r.time.split(':')[1] || '00'}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${r.experience_name} — BoraRio`,
    dates: `${start}/${end}`,
    details: `Reserva para ${r.guests} pessoas (${getEffectiveStage(r)}). Pagamento direto no local.`,
    location: `${r.neighborhood}, Rio de Janeiro - RJ`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function ProfileWalletView({
  experiences,
  preferences,
  reservations,
  vaultCount,
  confiaConnectionsCount,
  onSavePreferences,
  onReservationsUpdated,
  onOpenPersonalize,
  onOpenConfiaHub,
  onPointsChanged,
  initialSectionTab = 'passport',
  focusTarget = null,
  deepLinkNonce = 0,
}: ProfileWalletViewProps) {
  const [sectionTab, setSectionTab] = useState<ProfileSectionTab>(initialSectionTab);

  useEffect(() => {
    setSectionTab(initialSectionTab);
    if (!focusTarget || deepLinkNonce === 0) return;
    const targetId =
      focusTarget === 'ledger'
        ? 'profile-points-ledger'
        : focusTarget === 'vouchers'
          ? 'profile-vouchers'
          : 'profile-passport-missions';
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [deepLinkNonce, initialSectionTab, focusTarget]);
  const [identity, setIdentity] = useState<UserProfileIdentity>(() => getUserProfileIdentity());
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [draftName, setDraftName] = useState(identity.display_name);
  const [draftNeighborhood, setDraftNeighborhood] = useState(identity.home_neighborhood);
  const [authEmail, setAuthEmail] = useState('');
  const [authMsg, setAuthMsg] = useState('');

  const [wallet, setWallet] = useState<WalletSummary>(() => getWalletSummary());
  const balance = wallet.available_balance;
  const [transactions, setTransactions] = useState<PointTransaction[]>(() =>
    getPointTransactions()
  );
  const [marketplaceRewards, setMarketplaceRewards] = useState<PartnerReward[]>(() =>
    getPartnerRewards()
  );
  const [myVouchers, setMyVouchers] = useState<RewardVoucher[]>(() => getRewardVouchers());
  const [voucherFeedback, setVoucherFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [savedItineraries, setSavedItineraries] = useState<SavedItinerary[]>(() =>
    getSavedItineraries()
  );
  const [confiaPrivacy, setConfiaPrivacy] = useState<ConfiaPrivacySettings>(() =>
    getConfiaPrivacySettings()
  );

  // Check-in QR dinâmico (Passport tab & Agenda drawer)
  const [selectedVenueId, setSelectedVenueId] = useState<string>(experiences[0]?.id || '');
  const [qrInput, setQrInput] = useState<string>('');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Recomende e Ganhe (Rastreável & Antifraude)
  const myReferralCode = useMemo(() => getMyReferralCode(), []);
  const myReferralLink = useMemo(() => getMyReferralLink(), []);
  const [copiedRefLink, setCopiedRefLink] = useState<boolean>(false);
  const [attributions, setAttributions] = useState<ReferralAttribution[]>(() =>
    getReferralAttributions()
  );
  const [inviteFriendName, setInviteFriendName] = useState<string>('');
  const [inviteFriendIdentifier, setInviteFriendIdentifier] = useState<string>('');
  const [inviteBookingId, setInviteBookingId] = useState<string>('');
  const [incomingRefInput, setIncomingRefInput] = useState<string>(
    () => getIncomingReferralCode() || ''
  );
  const [referralFeedback, setReferralFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );
  const [savingsTick, setSavingsTick] = useState<number>(0);

  // Reservation-specific QR Check-in Drawer State
  const [checkinResId, setCheckinResId] = useState<string | null>(null);
  const [drawerCodeOrPin, setDrawerCodeOrPin] = useState<string>('');
  const [drawerFeedback, setDrawerFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Group companion (#2..N) individual check-in drawer (kept collapsed unless opened explicitly)
  const [companionDrawerResId, setCompanionDrawerResId] = useState<string | null>(null);
  const [companionSlotInput, setCompanionSlotInput] = useState<number>(2);
  const [companionNameInput, setCompanionNameInput] = useState<string>('');
  const [companionCodeOrPin, setCompanionCodeOrPin] = useState<string>('');
  const [companionFeedback, setCompanionFeedback] = useState<{ ok: boolean; msg: string } | null>(
    null
  );

  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraInfo, setCameraInfo] = useState<string>('');
  const [showClosedReservations, setShowClosedReservations] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const passport = useMemo(() => {
    void savingsTick;
    void reservations;
    return computePassportSummary(experiences);
  }, [experiences, savingsTick, reservations]);

  const missions = useMemo(() => {
    void savingsTick;
    void reservations;
    return computeMissionSummary(experiences);
  }, [experiences, savingsTick, reservations]);

  const savingsSummary = useMemo(() => {
    void savingsTick;
    void reservations;
    return computeSavingsSummary();
  }, [savingsTick, reservations]);
  const supabaseReady = isSupabaseAuthConfigured();

  const refreshWallet = () => {
    setWallet(getWalletSummary());
    setTransactions(getPointTransactions());
    setAttributions(getReferralAttributions());
    setMarketplaceRewards(getPartnerRewards());
    setMyVouchers(getRewardVouchers());
    setSavingsTick((n) => n + 1);
    onPointsChanged();
  };

  const selectedVenue = experiences.find((e) => e.id === selectedVenueId) || experiences[0];
  const canReviewSelected = selectedVenue ? hasValidatedCheckinForVenue(selectedVenue.id) : false;

  const visibleReservations = useMemo(
    () =>
      reservations
        .filter((r) => {
          const st = getEffectiveStage(r);
          if (!showClosedReservations && st === 'CANCELLED') return false;
          return true;
        })
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [reservations, showClosedReservations]
  );

  const activeReservationsCount = useMemo(
    () =>
      reservations.filter((r) => {
        const st = getEffectiveStage(r);
        return st !== 'CANCELLED' && st !== 'NO_SHOW' && st !== 'ENDED_WITHOUT_GOAL';
      }).length,
    [reservations]
  );

  const conflictIds = useMemo(() => {
    const activeOnly = visibleReservations.filter((r) => {
      const st = getEffectiveStage(r);
      return st !== 'CANCELLED' && st !== 'NO_SHOW' && st !== 'ENDED_WITHOUT_GOAL';
    });
    const set = new Set<string>();
    for (let i = 0; i < activeOnly.length - 1; i++) {
      const a = activeOnly[i];
      const b = activeOnly[i + 1];
      if (a.date === b.date) {
        const minA =
          parseInt(a.time.split(':')[0] || '0', 10) * 60 +
          parseInt(a.time.split(':')[1] || '0', 10);
        const minB =
          parseInt(b.time.split(':')[0] || '0', 10) * 60 +
          parseInt(b.time.split(':')[1] || '0', 10);
        const dist = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
        if (Math.abs(minB - minA) < 90 || (Math.abs(minB - minA) < 120 && dist > 6)) {
          set.add(a.id);
          set.add(b.id);
        }
      }
    }
    return set;
  }, [visibleReservations]);

  const handleSaveIdentity = (e: FormEvent) => {
    e.preventDefault();
    const next = saveUserProfileIdentity({
      display_name: draftName,
      home_neighborhood: draftNeighborhood,
    });
    setIdentity(next);
    setEditingIdentity(false);
  };

  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    const res = await requestMagicLinkLogin(authEmail);
    setAuthMsg(res.message);
  };

  const handleCheckin = () => {
    if (!selectedVenue) return;
    const res = validateAndCreditQRCheckin(selectedVenue.id, selectedVenue.name, qrInput, {
      hasGeolocationEvidence: preferences.lgpd_consents.location,
    });
    setFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setQrInput('');
      onReservationsUpdated(getReservations());
      refreshWallet();
    }
  };

  const handleReservationDynamicCheckin = (resItem: ReservationRequest, codeOrPin: string) => {
    const res = completeReservationCheckin({
      reservationId: resItem.id,
      scannedCodeOrPin: codeOrPin,
      actorContext: 'USER',
      hasGeolocationEvidence: preferences.lgpd_consents.location,
    });
    setDrawerFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      stopCamera();
      setDrawerCodeOrPin('');
      onReservationsUpdated(getReservations());
      refreshWallet();
    }
  };

  const handleOfflineContingency = (resItem: ReservationRequest) => {
    const res = queueOfflineContingencyCheckin({
      reservation: resItem,
      contingencyPinEntered: drawerCodeOrPin,
    });
    setDrawerFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      stopCamera();
      setDrawerCodeOrPin('');
    }
  };

  const handleStartQrCamera = async (resItem: ReservationRequest) => {
    const win = window as WindowWithBarcodeDetector;
    if (!win.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setCameraInfo(
        'Leitura via câmera (BarcodeDetector) indisponível neste navegador. Digite o código BR-QR-... ou o PIN de 6 dígitos fornecido pelo estabelecimento, ou utilize Contingência Offline.'
      );
      return;
    }

    try {
      setCameraInfo('Iniciando câmera para leitura do QR dinâmico...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new win.BarcodeDetector({ formats: ['qr_code'] });

      const scanFrame = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const raw = codes[0]?.rawValue?.trim();
          if (raw) {
            setDrawerCodeOrPin(raw);
            handleReservationDynamicCheckin(resItem, raw);
            return;
          }
        } catch {
          // Ignore single frame detection error
        }
        if (streamRef.current) {
          requestAnimationFrame(() => void scanFrame());
        }
      };
      requestAnimationFrame(() => void scanFrame());
    } catch {
      stopCamera();
      setCameraInfo(
        'Permissão de câmera negada ou câmera ausente. Use o campo manual com o código BR-QR-... ou PIN de 6 dígitos.'
      );
    }
  };

  const handleVerifiedReview = () => {
    if (!selectedVenue) return;
    const res = creditVerifiedReview(selectedVenue.id, selectedVenue.name);
    setFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) refreshWallet();
  };

  const handleRegisterReferral = (e: FormEvent) => {
    e.preventDefault();
    const linkedBooking = reservations.find((r) => r.id === inviteBookingId);
    const res = registerReferralInvitation({
      referredLabel: inviteFriendName,
      referredIdentifier: inviteFriendIdentifier,
      bookingId: linkedBooking?.id,
      experienceId: linkedBooking?.experience_id,
      experienceName: linkedBooking?.experience_name,
    });
    setAttributions(res.attributions);
    setReferralFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setInviteFriendName('');
      setInviteFriendIdentifier('');
      setInviteBookingId('');
      if (linkedBooking && res.attribution) {
        const linkRes = linkBookingToReferral({
          attributionId: res.attribution.id,
          reservation: linkedBooking,
        });
        setAttributions(linkRes.attributions);
        if (linkRes.converted) {
          setReferralFeedback({ ok: true, msg: linkRes.message });
          refreshWallet();
        }
      }
    }
  };

  const handleApplyIncomingReferral = () => {
    const res = setIncomingReferralCode(incomingRefInput);
    setReferralFeedback({ ok: res.ok, msg: res.message });
  };

  const handleVerifyReferralConversion = (attributionId: string) => {
    const res = tryConvertAttributionWithProof(attributionId, reservations);
    setAttributions(res.attributions);
    setReferralFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) refreshWallet();
  };

  const handleLinkBookingToReferral = (attributionId: string, bookingId: string) => {
    const targetBooking = reservations.find((r) => r.id === bookingId);
    if (!targetBooking) return;
    const res = linkBookingToReferral({ attributionId, reservation: targetBooking });
    setAttributions(res.attributions);
    setReferralFeedback({ ok: res.ok, msg: res.message });
    if (res.converted) refreshWallet();
  };

  const handleReverseReferral = (attributionId: string) => {
    const res = reverseReferralAttribution(
      attributionId,
      'Cancelamento ou contestação auditada pelo usuário/parceiro'
    );
    setAttributions(res.attributions);
    setReferralFeedback({ ok: res.ok, msg: res.message });
    refreshWallet();
  };

  const handleRedeemMarketplaceReward = (rewardId: string) => {
    const res = redeemPartnerReward(rewardId);
    setVoucherFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) refreshWallet();
  };

  const handleCancelVoucher = (voucherId: string) => {
    const res = cancelRewardVoucher(voucherId);
    setVoucherFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) refreshWallet();
  };

  const handleCompanionDynamicCheckin = (resItem: ReservationRequest) => {
    const res = validateGroupCompanionCheckin({
      reservationId: resItem.id,
      scannedCodeOrPin: companionCodeOrPin,
      participantSlot: companionSlotInput,
      participantLabel: companionNameInput.trim() || `Acompanhante #${companionSlotInput}`,
    });
    setCompanionFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setCompanionCodeOrPin('');
      setCompanionNameInput('');
      onReservationsUpdated(getReservations());
      refreshWallet();
    }
  };

  const toggleConsent = (key: keyof UserPreferences['lgpd_consents']) => {
    onSavePreferences({
      ...preferences,
      lgpd_consents: {
        ...preferences.lgpd_consents,
        [key]: !preferences.lgpd_consents[key],
      },
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Personal Profile Identity Header (Clean, NOT a second social network) */}
      <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#123B56] to-[#FF6B35] text-lg font-extrabold text-white shadow-sm">
              {identity.avatar_initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-sans text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                  {identity.display_name}
                </h2>
                <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                  {identity.storage_origin === 'supabase_auth'
                    ? 'Conta sincronizada (Supabase)'
                    : 'Perfil local neste dispositivo'}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[#FF6B35]" />
                  Base: {identity.home_neighborhood}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bookmark className="h-3.5 w-3.5 text-[#FF6B35]" />
                  {vaultCount} em Meus Desejos
                </span>
                <span className="inline-flex items-center gap-1">
                  <HeartHandshake className="h-3.5 w-3.5 text-[#397B68]" />
                  {confiaConnectionsCount} na Rede Confia
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditingIdentity((prev) => !prev)}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
            >
              Editar Perfil
            </button>
            <button
              type="button"
              onClick={onOpenPersonalize}
              className="inline-flex items-center gap-1.5 rounded-xl bg-borario-ocean px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:brightness-110"
            >
              <Wand2 className="h-3.5 w-3.5 text-[#FFB347]" />
              Preferências de Match
            </button>
          </div>
        </div>

        {editingIdentity && (
          <form
            onSubmit={handleSaveIdentity}
            className="mt-5 grid gap-3 border-t border-[var(--border-hairline)] pt-4 sm:grid-cols-3"
          >
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Seu nome no BoraRio"
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)]"
            />
            <input
              type="text"
              value={draftNeighborhood}
              onChange={(e) => setDraftNeighborhood(e.target.value)}
              placeholder="Bairro base (ex: Botafogo)"
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)]"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#FF6B35] px-4 py-2 text-xs font-bold text-white hover:bg-[#e8634c]"
            >
              Salvar Dados Pessoais
            </button>
          </form>
        )}

        {/* Internal Section Switcher */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border-hairline)] pt-4">
          {[
            { id: 'passport' as const, label: 'Passaporte Carioca & Rio Points', icon: Award },
            {
              id: 'agenda' as const,
              label: `Minhas Reservas & Roteiros (${activeReservationsCount + savedItineraries.length})`,
              icon: CalendarDays,
            },
            { id: 'privacy' as const, label: 'Privacidade, LGPD & Rede Confia', icon: Shield },
          ].map((item) => {
            const Icon = item.icon;
            const active = sectionTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSectionTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition ${
                  active
                    ? 'border-transparent bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-xs'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 1: Passaporte Carioca & Rio Points */}
      {sectionTab === 'passport' && (
        <div className="space-y-6">
          {/* Passaporte Carioca & Missões Milestones */}
          <section
            id="profile-passport-missions"
            className="scroll-mt-20 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6"
          >
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#397B68]">
                  <Compass className="h-4 w-4" />
                  Passaporte Carioca &amp; Missões Reais
                </p>
                <h3 className="font-sans mt-1 text-xl font-bold text-[var(--text-primary)]">
                  Nível atual: {passport.level_label}
                </h3>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                {passport.verified_checkins_count} check-ins validados ·{' '}
                {passport.verified_consumptions_count || 0} consumos confirmados ·{' '}
                {passport.unique_neighborhoods.length} bairros visitados
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {passport.milestones.map((ms) => (
                <div
                  key={ms.id}
                  className={`rounded-2xl border p-4 text-xs ${
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
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {ms.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Missões e Jornadas (Derivadas exclusivamente de ações reais) */}
            <div className="mt-5 border-t border-[var(--border-hairline)] pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Missões e Jornadas ({missions.completed_count}/{missions.total_count} concluídas)
                </p>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Atualizadas exclusivamente por provas reais (sem progresso simulado)
                </span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {missions.missions.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-2xl border p-3.5 text-xs ${
                      m.completed
                        ? 'border-emerald-500/40 bg-emerald-500/10'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] font-bold text-[#397B68]">
                        {m.category}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#FF6B35]">
                        {m.current}/{m.target}
                      </span>
                    </div>
                    <h4 className="mt-1.5 font-bold text-[var(--text-primary)]">{m.title}</h4>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      {m.description}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-2 text-[10px]">
                      <span className="font-semibold text-[#123B56] dark:text-[#7FB6D9]">
                        {m.reward_badge}
                      </span>
                      <span className="text-[var(--text-secondary)]">{m.verification_rule}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Wallet Hero + QR Check-in */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div
              data-testid="wallet-hero-card"
              className="rounded-3xl border border-sky-400/30 bg-borario-ocean p-6 text-white shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#FFB347]">
                  <Award className="h-4 w-4" />
                  Carteira Rio Points
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
                  Saldo disponível
                </span>
              </div>

              <p data-testid="wallet-available-balance" className="font-sans mt-4 text-4xl font-bold tracking-tight">
                {balance.toLocaleString('pt-BR')} <span className="text-lg text-[#E5B342]">RP</span>
              </p>
              <p className="mt-1 text-xs text-white/70">
                Saldo calculado exclusivamente a partir do histórico transacional auditável.
              </p>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                  <span className="block text-white/65">Total acumulado</span>
                  <strong data-testid="wallet-total-accumulated" className="text-xs text-emerald-300">
                    {wallet.total_accumulated.toLocaleString('pt-BR')} RP
                  </strong>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                  <span className="block text-white/65">Total utilizado</span>
                  <strong data-testid="wallet-total-spent" className="text-xs text-white">
                    {wallet.total_spent.toLocaleString('pt-BR')} RP
                  </strong>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-2">
                  <span className="block text-white/65">Pontos pendentes</span>
                  <strong data-testid="wallet-pending-points" className="text-xs text-amber-300">
                    {wallet.pending_points.toLocaleString('pt-BR')} RP
                  </strong>
                </div>
              </div>

              <p className="mt-2.5 rounded-xl border border-white/10 bg-black/25 px-2.5 py-2 text-[10px] leading-relaxed text-white/75">
                {WALLET_NON_MONETARY_NOTICE}
              </p>

              {/* Economia Comprovada vs Economia Potencial */}
              <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/12 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    Economia Comprovada
                  </p>
                  <p className="mt-1 font-sans text-lg font-extrabold text-white">
                    {formatBrl(savingsSummary.proven_brl)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/70">
                    {savingsSummary.proven_count} pós-check-in
                  </p>
                </div>
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#FFB347]">
                    Economia Potencial
                  </p>
                  <p className="mt-1 font-sans text-lg font-extrabold text-white">
                    {formatBrl(savingsSummary.potential_brl)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/70">
                    {savingsSummary.potential_count} aguardando ida
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#FF6B35]">
                <QrCode className="h-4 w-4" />
                Check-in QR Code Dinâmico &amp; Antifraude
              </div>
              <h3 className="font-sans mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Validar Visita (+50 RP) &amp; Liberar Visita Verificada
              </h3>
              <div className="mt-2 rounded-2xl border border-[#FF6B35]/30 bg-[#FF6B35]/8 px-3.5 py-2.5 text-xs font-semibold text-[#123B56] dark:text-[#F1E8D8]">
                {POINTS_PREVISIT_CHECKIN_NOTICE}
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {MANDATORY_CHECKIN_INSTRUCTION} O check-in valida sua chegada; o selo Consumo Verificado requer confirmação adicional do parceiro após o atendimento.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Estabelecimento Visitado
                  </label>
                  <select
                    value={selectedVenue?.id || ''}
                    onChange={(e) => setSelectedVenueId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs text-[var(--text-primary)]"
                  >
                    {experiences.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.neighborhood})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Token QR Dinâmico ou PIN 6 dígitos
                  </label>
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="BR-QR-... ou PIN 6 dígitos"
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 font-mono text-xs text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleCheckin}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1C1917] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#FF6B35] dark:bg-[#F5F2EB] dark:text-[#0F1115] dark:hover:bg-[#FF6B35] dark:hover:text-white"
                >
                  <QrCode className="h-4 w-4" />
                  Validar Check-in QR (+50 RP)
                </button>

                <button
                  type="button"
                  disabled={!canReviewSelected}
                  onClick={handleVerifiedReview}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[#FF6B35] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Star className="h-4 w-4 text-[#E5B342]" />
                  {canReviewSelected
                    ? 'Publicar Avaliação Verificada (+30 RP)'
                    : 'Avaliação Verificada (requer check-in QR)'}
                </button>
              </div>

              {feedback && (
                <div
                  className={`mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium ${
                    feedback.ok
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-500/15 text-red-600 dark:text-red-300'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{feedback.msg}</span>
                </div>
              )}
            </div>
          </div>

          {/* Recomende e Ganhe (Rastreável & Antifraude) */}
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-4 md:flex-row md:items-center">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#397B68]">
                  <UserPlus className="h-4 w-4" />
                  Recomende e Ganhe · Antifraude
                </p>
                <h3 className="font-sans mt-1 text-xl font-bold text-[var(--text-primary)]">
                  Recompensa apenas por visita validada (+200 RP)
                </h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Zero pontos por clique ou cadastro isolado. Autoindicação bloqueada e estorno automático se a reserva for cancelada ou contestada.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-[var(--text-secondary)]">
                    Seu Código Rastreável
                  </span>
                  <span className="font-mono text-sm font-extrabold text-[#FF6B35]">
                    {myReferralCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(myReferralLink);
                    setCopiedRefLink(true);
                    setTimeout(() => setCopiedRefLink(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-borario-ocean px-3 py-2 text-[11px] font-bold text-white shadow-xs hover:brightness-110"
                >
                  {copiedRefLink ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copiedRefLink ? 'Link copiado!' : 'Copiar link'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <form onSubmit={handleRegisterReferral} className="space-y-3 rounded-2xl bg-[var(--bg-canvas)] p-4 text-xs">
                <p className="font-bold text-[var(--text-primary)]">
                  Registrar convidado indicado (Pendente até check-in real)
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <input
                    type="text"
                    value={inviteFriendName}
                    onChange={(e) => setInviteFriendName(e.target.value)}
                    placeholder="Nome do amigo indicado"
                    className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                  />
                  <input
                    type="text"
                    value={inviteFriendIdentifier}
                    onChange={(e) => setInviteFriendIdentifier(e.target.value)}
                    placeholder="E-mail ou @identificador (opcional)"
                    className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
                    Vincular a reserva elegível (opcional — para rastrear check-in)
                  </label>
                  <select
                    value={inviteBookingId}
                    onChange={(e) => setInviteBookingId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                  >
                    <option value="">Sem reserva vinculada no momento</option>
                    {reservations
                      .filter(
                        (r) =>
                          r.status !== 'CANCELLED' &&
                          r.stage !== 'CANCELLED' &&
                          r.stage !== 'NO_SHOW' &&
                          r.stage !== 'ENDED_WITHOUT_GOAL'
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.experience_name} ({r.date} {r.time} · {STAGE_BADGE[getEffectiveStage(r)].label})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                    <ShieldAlert className="h-3.5 w-3.5 text-[#397B68]" />
                    Cadastro isolado gera +0 RP.
                  </span>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#397B68] px-4 py-2 text-xs font-bold text-white hover:opacity-95"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Registrar Convite
                  </button>
                </div>

                {/* Código de entrada aplicado por convidado */}
                <div className="border-t border-[var(--border-hairline)] pt-3">
                  <label className="mb-1 block text-[11px] font-semibold text-[var(--text-secondary)]">
                    Recebeu código de um amigo? (Bloqueia autoindicação)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={incomingRefInput}
                      onChange={(e) => setIncomingRefInput(e.target.value)}
                      placeholder="Ex: BR-IND-ABC12"
                      className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)]"
                    />
                    <button
                      type="button"
                      onClick={handleApplyIncomingReferral}
                      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </form>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-[var(--text-primary)]">
                    Acompanhamento de Indicações ({attributions.length})
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {attributions.filter((a) => a.status === 'CONVERTED').length} convertidas ·{' '}
                    {attributions.filter((a) => a.status === 'PENDING_CONVERSION').length} pendentes
                  </span>
                </div>

                {referralFeedback && (
                  <p
                    className={`rounded-xl px-3 py-2 text-[11px] font-semibold ${
                      referralFeedback.ok
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-red-500/15 text-red-600 dark:text-red-300'
                    }`}
                  >
                    {referralFeedback.msg}
                  </p>
                )}

                {attributions.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-4 text-xs text-[var(--text-secondary)]">
                    Nenhuma indicação registrada ainda. Compartilhe seu código rastreável acima; as conversões aparecem aqui quando houver reserva e check-in real.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
                    {attributions.map((attr) => (
                      <div
                        key={attr.id}
                        className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <strong className="text-[var(--text-primary)]">
                              {attr.referred_label}
                            </strong>
                            {attr.experience_name && (
                              <span className="ml-1.5 text-[11px] text-[var(--text-secondary)]">
                                · {attr.experience_name}
                              </span>
                            )}
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              attr.status === 'CONVERTED'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : attr.status === 'REVERSED'
                                  ? 'bg-red-500/15 text-red-600 dark:text-red-300'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {attr.status === 'CONVERTED'
                              ? `Convertida (+${attr.reward_points} RP)`
                              : attr.status === 'REVERSED'
                                ? 'Estornada'
                                : 'Pendente (0 RP até check-in)'}
                          </span>
                        </div>

                        {attr.reversal_reason && (
                          <p className="mt-1 text-[10px] text-red-600 dark:text-red-300">
                            Motivo do estorno: {attr.reversal_reason}
                          </p>
                        )}

                        {attr.status === 'PENDING_CONVERSION' && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {!attr.booking_id && reservations.length > 0 && (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleLinkBookingToReferral(attr.id, e.target.value);
                                  }
                                }}
                                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2 py-1 text-[10px]"
                              >
                                <option value="">Vincular reserva...</option>
                                {reservations
                                  .filter(
                                    (r) =>
                                      r.status !== 'CANCELLED' &&
                                      r.stage !== 'CANCELLED' &&
                                      r.stage !== 'NO_SHOW'
                                  )
                                  .map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.experience_name} ({r.date})
                                    </option>
                                  ))}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => handleVerifyReferralConversion(attr.id)}
                              className="rounded-lg bg-[#397B68] px-2.5 py-1 text-[10px] font-bold text-white"
                            >
                              Validar pós-check-in
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReverseReferral(attr.id)}
                              className="rounded-lg border border-red-500/35 px-2.5 py-1 text-[10px] font-bold text-red-600 dark:text-red-300"
                            >
                              Cancelar convite
                            </button>
                          </div>
                        )}

                        {attr.status === 'CONVERTED' && (
                          <div className="mt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleReverseReferral(attr.id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/35 bg-red-500/8 px-2.5 py-1 text-[10px] font-bold text-red-600 dark:text-red-300"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Estornar / Contestar Indicação
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="space-y-6">
            {voucherFeedback && (
              <div
                className={`rounded-2xl border px-4 py-3 text-xs font-semibold ${
                  voucherFeedback.ok
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                    : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
                }`}
              >
                {voucherFeedback.msg}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Marketplace de Recompensas Cross-Parceiro (0% Comissão) */}
              <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                    <Gift className="h-4 w-4" />
                    Marketplace de Recompensas (0% Comissão)
                  </div>
                  <span className="rounded-full bg-[#397B68]/15 px-2.5 py-0.5 text-[10px] font-bold text-[#397B68] dark:text-[#4CA188]">
                    Comissão ao parceiro: R$ 0,00
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                  Troque pontos acumulados em qualquer estabelecimento da rede BoraRio por benefícios em restaurantes, museus, passeios e experiências.
                </p>

                <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1">
                  {marketplaceRewards.map((rew) => {
                    const isAvailable = rew.status === 'AVAILABLE' && rew.quantity_available > 0;
                    const canAfford = balance >= rew.points_cost;
                    return (
                      <div
                        key={rew.id}
                        data-testid={`wallet-reward-${rew.id}`}
                        className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 text-xs sm:flex-row sm:items-center"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-[#123B56]/12 px-2 py-0.5 text-[10px] font-bold text-[#123B56] dark:bg-[#123B56]/40 dark:text-[#8DC4EA]">
                              {rew.segment_category}
                            </span>
                            <span className="text-[10px] text-[var(--text-secondary)]">
                              {rew.restaurant_name} ({rew.neighborhood})
                            </span>
                            {rew.status !== 'AVAILABLE' && (
                              <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                                {rew.status === 'PAUSED'
                                  ? 'Pausada'
                                  : rew.status === 'CLOSED'
                                    ? 'Encerrada'
                                    : 'Esgotada'}
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-[var(--text-primary)]">{rew.title}</p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            {rew.eligible_item} · {rew.valid_days_hours}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="font-bold text-[#D49B27]">{rew.points_cost} RP</span>
                            <span className="text-[var(--text-secondary)]">
                              Estoque: {rew.quantity_available}/{rew.quantity_total} un.
                            </span>
                            <span className="font-semibold text-[#397B68] dark:text-[#4CA188]">
                              Comissão: R$ 0,00
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!isAvailable || !canAfford}
                          onClick={() => handleRedeemMarketplaceReward(rew.id)}
                          className="shrink-0 rounded-lg bg-[#FF6B35] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#e8634c] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {!isAvailable
                            ? 'Indisponível'
                            : !canAfford
                              ? `Faltam ${rew.points_cost - balance} RP`
                              : 'Resgatar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Meus Vouchers de Recompensa (6 estados + Cancelamento com Estorno Integral) */}
              <section
                id="profile-vouchers"
                className="scroll-mt-20 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#123B56] dark:text-[#8DC4EA]">
                    <Ticket className="h-4 w-4 text-[#FF6B35]" />
                    Meus Vouchers de Recompensa ({myVouchers.length})
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(['AVAILABLE', 'REDEEMED', 'ISSUED', 'USED', 'EXPIRED', 'CANCELLED'] as RewardVoucherStatus[]).map(
                    (st) => (
                      <span
                        key={st}
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${VOUCHER_STATUS_META[st].cls}`}
                      >
                        {VOUCHER_STATUS_META[st].label}
                      </span>
                    )
                  )}
                </div>

                <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
                  {myVouchers.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--border-hairline)] p-4 text-xs text-[var(--text-secondary)]">
                      Você ainda não resgatou nenhuma recompensa. Quando resgatar, seu voucher único (<code className="font-mono">BR-REW-...</code>) aparecerá aqui com as regras congeladas e opção de cancelamento com estorno antes do uso.
                    </p>
                  ) : (
                    myVouchers.map((v) => {
                      const vMeta = VOUCHER_STATUS_META[v.status];
                      return (
                        <div
                          key={v.id}
                          data-testid={`wallet-voucher-${v.voucher_code}`}
                          className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-xs font-extrabold text-[#FF6B35]">
                              {v.voucher_code}
                            </span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${vMeta.cls}`}>
                              {vMeta.label}
                            </span>
                          </div>
                          <p className="mt-1.5 font-bold text-[var(--text-primary)]">
                            {v.snapshot_rules.title}
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            {v.restaurant_name} · {v.snapshot_rules.eligible_item}
                          </p>
                          <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                            Regras: {v.snapshot_rules.valid_days_hours} · Validade:{' '}
                            {new Date(v.expires_at).toLocaleDateString('pt-BR')} · -{v.points_spent} RP · Comissão ao parceiro: R$ 0,00
                          </p>

                          {v.status === 'ISSUED' && (
                            <div className="mt-2.5 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleCancelVoucher(v.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-500/35 bg-red-500/8 px-3 py-1.5 text-[10px] font-bold text-red-600 hover:bg-red-500/15 dark:text-red-300"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Cancelar &amp; Estornar Pontos
                              </button>
                            </div>
                          )}

                          {v.status === 'USED' && v.used_at && (
                            <p className="mt-1.5 text-[10px] font-semibold text-[#397B68] dark:text-[#4CA188]">
                              Validado no local em {new Date(v.used_at).toLocaleString('pt-BR')}
                            </p>
                          )}

                          {v.status === 'CANCELLED' && (
                            <p className="mt-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                              Estorno integral de +{v.points_spent} RP creditado no seu extrato.
                            </p>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            {/* Transactional History (Auditável e Imutável) */}
            <section
              id="profile-points-ledger"
              className="scroll-mt-20 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  <Sparkles className="h-4 w-4 text-[#FF6B35]" />
                  Extrato de Pontos
                </div>
                <span className="rounded-full bg-[var(--bg-canvas)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                  Histórico auditável e imutável no cliente (não editável; estornos geram novo lançamento)
                </span>
              </div>
              <div className="mt-4 max-h-64 divide-y divide-[var(--border-hairline)] overflow-y-auto">
                {transactions.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[var(--border-hairline)] p-4 text-xs text-[var(--text-secondary)]">
                    Nenhuma movimentação ainda. Faça check-in via QR dinâmico no estabelecimento ou conclua uma indicação pós-check-in para acumular Rio Points.
                  </p>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                      <div>
                        <p className="font-semibold text-[var(--text-primary)]">{tx.description}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          {new Date(tx.created_at).toLocaleString('pt-BR')} ·{' '}
                          {tx.type === 'REVERSAL' ? 'Estorno' : tx.origin}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 font-bold ${
                          tx.type === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                        }`}
                      >
                        {tx.type === 'CREDIT' ? `+${tx.amount}` : `-${tx.amount}`} RP
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* SECTION 2: Minha Agenda Pessoal, Check-in QR na Reserva & Roteiros Salvos */}
      {sectionTab === 'agenda' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                <CalendarDays className="h-4 w-4" />
                Minhas Reservas &amp; Check-in ({visibleReservations.length})
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={showClosedReservations}
                  onChange={(e) => setShowClosedReservations(e.target.checked)}
                  className="rounded accent-[#FF6B35]"
                />
                Exibir canceladas
              </label>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Acompanhe o estágio real de cada solicitação, instruções de pagamento direto no local e faça o check-in QR dinâmico na chegada.
            </p>

            {visibleReservations.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-[var(--border-hairline)] p-4 text-xs text-[var(--text-secondary)]">
                Nenhuma reserva registrada ainda. Abra qualquer experiência no catálogo ou acesse o <strong>Bora Club</strong>.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleReservations.map((res) => {
                  const stage = getEffectiveStage(res);
                  const stageMeta = STAGE_BADGE[stage];
                  const hasConflict = conflictIds.has(res.id);
                  const isClosed =
                    stage === 'CANCELLED' ||
                    stage === 'NO_SHOW' ||
                    stage === 'ENDED_WITHOUT_GOAL';
                  const alreadyCheckedIn =
                    stage === 'CHECKED_IN' ||
                    stage === 'VERIFIED_VISIT' ||
                    stage === 'VERIFIED_CONSUMPTION';
                  const canDoCheckin = !isClosed && !alreadyCheckedIn;
                  const isDrawerOpen = checkinResId === res.id;
                  const isCompanionDrawerOpen = companionDrawerResId === res.id;
                  const companionSlots = (res.group_validated_slots || []).filter(
                    (s) => s.slot >= 2
                  );
                  const totalPeopleValidated =
                    (alreadyCheckedIn ? 1 : 0) + companionSlots.length;

                  return (
                    <div
                      key={res.id}
                      className={`rounded-2xl border p-4 text-xs ${
                        hasConflict
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${stageMeta.cls}`}>
                              {stageMeta.label}
                            </span>
                            {res.modality === 'DEMAND_OFFER' && stage === 'REQUESTED' && (
                              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                                Demanda · Aguardando meta e confirmação do parceiro
                              </span>
                            )}
                            {res.guests > 1 && !isClosed && (
                              <span className="rounded-full bg-[#123B56]/12 px-2 py-0.5 text-[10px] font-bold text-[#123B56] dark:bg-[#123B56]/40 dark:text-[#8DC4EA]">
                                Grupo · {totalPeopleValidated}/{res.guests} validados
                              </span>
                            )}
                          </div>
                          <h4 className="mt-1.5 text-sm font-bold text-[var(--text-primary)]">
                            {res.offering_title || res.experience_name}
                          </h4>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            {res.experience_name} · {res.date} às {res.time} · {res.guests} pessoas · {res.neighborhood}
                          </p>
                          {res.snapshot_terms?.price_summary && (
                            <p className="mt-1 text-[11px] font-medium text-[var(--text-primary)]">
                              {res.snapshot_terms.price_summary}
                            </p>
                          )}
                        </div>

                        {!isClosed && !alreadyCheckedIn && (
                          <button
                            type="button"
                            title="Cancelar solicitação"
                            onClick={() => {
                              onReservationsUpdated(cancelReservation(res.id));
                              refreshWallet();
                            }}
                            className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {!isClosed && (
                        <div className="mt-2.5 space-y-1.5 rounded-xl bg-[var(--bg-surface)] p-2.5 text-[10px]">
                          <p className="flex items-start gap-1.5 text-[var(--text-secondary)]">
                            <Store className="mt-0.5 h-3 w-3 shrink-0 text-[#397B68]" />
                            <span>{res.payment_instruction || DIRECT_PAYMENT_NOTICE}</span>
                          </p>
                          <p className="flex items-start gap-1.5 font-semibold text-[#FF6B35]">
                            <Award className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{POINTS_PREVISIT_CHECKIN_NOTICE}</span>
                          </p>
                          <p className="flex items-start gap-1.5 font-semibold text-[#123B56] dark:text-[#F1E8D8]">
                            <QrCode className="mt-0.5 h-3 w-3 shrink-0 text-[#FF6B35]" />
                            <span>{MANDATORY_CHECKIN_INSTRUCTION}</span>
                          </p>
                          {res.guests > 1 && (
                            <p className="flex items-start gap-1.5 text-[var(--text-secondary)]">
                              <Users className="mt-0.5 h-3 w-3 shrink-0 text-[#123B56] dark:text-[#8DC4EA]" />
                              <span>
                                <strong>Regra de Grupo ({res.guests} pessoas):</strong> o titular recebe pontos individuais 1x pelo próprio check-in (sem multiplicação por quantidade de pessoas). Cada acompanhante (#2..#{res.guests}) pode validar sua presença individualmente (0 RP ao titular).
                              </span>
                            </p>
                          )}
                        </div>
                      )}

                      {companionSlots.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {companionSlots.map((slot) => (
                            <span
                              key={`${res.id}-slot-${slot.slot}`}
                              className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300"
                            >
                              <CheckCircle2 className="h-3 w-3" />#{slot.slot} {slot.participant_label} validado (0 RP ao titular)
                            </span>
                          ))}
                        </div>
                      )}

                      {stage === 'ENDED_WITHOUT_GOAL' && (
                        <p className="mt-2 rounded-lg bg-zinc-500/10 px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)]">
                          Esta janela por demanda foi encerrada pelo estabelecimento sem atingir a meta mínima, sem cobrança nem ônus.
                        </p>
                      )}

                      {hasConflict && (
                        <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Possível conflito de horário ou deslocamento neste dia.
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {canDoCheckin && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isDrawerOpen) {
                                stopCamera();
                                setCheckinResId(null);
                              } else {
                                setCompanionDrawerResId(null);
                                setCheckinResId(res.id);
                                setDrawerCodeOrPin('');
                                setDrawerFeedback(null);
                                setCameraInfo('');
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-3.5 py-1.5 text-[11px] font-bold text-white shadow-xs"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                            {isDrawerOpen ? 'Fechar Check-in' : 'Fazer Check-in QR Dinâmico'}
                          </button>
                        )}

                        {!isClosed && res.guests > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isCompanionDrawerOpen) {
                                setCompanionDrawerResId(null);
                              } else {
                                stopCamera();
                                setCheckinResId(null);
                                const usedSlots = new Set(companionSlots.map((s) => s.slot));
                                let firstFree = 2;
                                while (firstFree <= res.guests && usedSlots.has(firstFree)) {
                                  firstFree++;
                                }
                                setCompanionSlotInput(Math.min(res.guests, firstFree));
                                setCompanionNameInput('');
                                setCompanionCodeOrPin('');
                                setCompanionFeedback(null);
                                setCompanionDrawerResId(res.id);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[#123B56]/35 bg-[#123B56]/10 px-3 py-1.5 text-[11px] font-bold text-[#123B56] hover:bg-[#123B56]/15 dark:border-[#8DC4EA]/35 dark:bg-[#123B56]/40 dark:text-[#8DC4EA]"
                          >
                            <Users className="h-3.5 w-3.5" />
                            {isCompanionDrawerOpen
                              ? 'Fechar Acompanhantes'
                              : `Validar Acompanhante (#2..${res.guests})`}
                          </button>
                        )}

                        {!isClosed && (
                          <a
                            href={buildGoogleCalendarUrl(res)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                          >
                            <CalendarPlus className="h-3.5 w-3.5 text-[#FF6B35]" />
                            Google Calendar
                          </a>
                        )}
                      </div>

                      {/* Dynamic Check-in Drawer (Camera + Manual BR-QR / PIN + Offline Contingency) */}
                      {isDrawerOpen && (
                        <div className="mt-3 space-y-3 rounded-2xl border border-[#FF6B35]/40 bg-[var(--bg-surface)] p-3.5">
                          <p className="font-bold text-[var(--text-primary)]">
                            Validação presencial na chegada — {res.experience_name}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleStartQrCamera(res)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 text-[11px] font-bold hover:border-[#FF6B35]"
                            >
                              <Camera className="h-3.5 w-3.5 text-[#FF6B35]" />
                              {cameraActive ? 'Câmera ativa' : 'Escanear QR pela Câmera'}
                            </button>
                            {cameraActive && (
                              <button
                                type="button"
                                onClick={stopCamera}
                                className="rounded-lg border border-red-500/35 px-2.5 py-1.5 text-[11px] font-bold text-red-600"
                              >
                                Parar câmera
                              </button>
                            )}
                          </div>

                          {cameraActive && (
                            <video
                              ref={videoRef}
                              muted
                              playsInline
                              className="max-h-40 w-full rounded-xl bg-black object-cover"
                            />
                          )}

                          {cameraInfo && (
                            <p className="text-[11px] text-[var(--text-secondary)]">{cameraInfo}</p>
                          )}

                          <div className="space-y-2">
                            <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                              Token dinâmico (<code className="font-mono">BR-QR-...</code>) ou PIN 6 dígitos do balcão
                            </label>
                            <input
                              type="text"
                              value={drawerCodeOrPin}
                              onChange={(e) => setDrawerCodeOrPin(e.target.value)}
                              placeholder="Ex: BR-QR-XXXX ou 123456"
                              className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-mono text-xs text-[var(--text-primary)]"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleReservationDynamicCheckin(res, drawerCodeOrPin)}
                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#397B68] px-3 py-2 text-[11px] font-bold text-white"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Validar Check-in QR / PIN
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOfflineContingency(res)}
                                className="inline-flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-800 dark:text-amber-200"
                              >
                                <WifiOff className="h-3.5 w-3.5" />
                                Contingência Offline / Sem Câmera
                              </button>
                            </div>
                          </div>

                          {drawerFeedback && (
                            <p
                              className={`rounded-xl px-3 py-2 text-[11px] font-semibold ${
                                drawerFeedback.ok
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-red-500/15 text-red-600 dark:text-red-300'
                              }`}
                            >
                              {drawerFeedback.msg}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Group Companion (#2..N) Individual Validation Drawer */}
                      {isCompanionDrawerOpen && (
                        <div className="mt-3 space-y-2.5 rounded-2xl border border-[#123B56]/35 bg-[var(--bg-surface)] p-3.5">
                          <p className="font-bold text-[var(--text-primary)]">
                            Validação individual de acompanhante — 0 RP ao titular
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            Cada participante (#2 até #{res.guests}) pode validar seu próprio check-in presencial sem multiplicar os Rio Points do titular da reserva.
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <label className="block text-[10px] font-bold text-[var(--text-secondary)]">
                                Posição no grupo
                              </label>
                              <select
                                value={companionSlotInput}
                                onChange={(e) => setCompanionSlotInput(Number(e.target.value))}
                                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                              >
                                {Array.from({ length: Math.max(0, res.guests - 1) }, (_, idx) => idx + 2).map(
                                  (slotNum) => (
                                    <option key={slotNum} value={slotNum}>
                                      Acompanhante #{slotNum}
                                    </option>
                                  )
                                )}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-[var(--text-secondary)]">
                                Nome / identificação (opcional)
                              </label>
                              <input
                                type="text"
                                value={companionNameInput}
                                onChange={(e) => setCompanionNameInput(e.target.value)}
                                placeholder="Ex: Marina Silva"
                                className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-[var(--text-secondary)]">
                              Token QR Dinâmico ou PIN do local
                            </label>
                            <input
                              type="text"
                              value={companionCodeOrPin}
                              onChange={(e) => setCompanionCodeOrPin(e.target.value)}
                              placeholder="Ex: BR-QR-XXXX ou PIN 6 dígitos"
                              className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCompanionDynamicCheckin(res)}
                            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#123B56] px-3 py-2 text-[11px] font-bold text-white hover:bg-[#102F46]"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Confirmar Presença do Acompanhante (0 RP ao titular)
                          </button>
                          {companionFeedback && (
                            <p
                              className={`rounded-xl px-3 py-2 text-[11px] font-semibold ${
                                companionFeedback.ok
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-red-500/15 text-red-600 dark:text-red-300'
                              }`}
                            >
                              {companionFeedback.msg}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#123B56] dark:text-[#F7931E]">
              <Sparkles className="h-4 w-4" />
              Roteiros Salvos ({savedItineraries.length})
            </div>

            {savedItineraries.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-[var(--border-hairline)] p-4 text-xs text-[var(--text-secondary)]">
                Nenhum roteiro salvo ainda. Monte um roteiro na aba <strong>Roteiros</strong> e clique em <strong>Salvar Roteiro</strong>.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {savedItineraries.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-[var(--text-primary)]">{it.title}</h4>
                        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                          {it.steps.length} paradas · ~R$ {it.total_estimated_brl} / pessoa
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSavedItineraries(deleteSavedItinerary(it.id))}
                        className="rounded p-1 text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <ul className="mt-2.5 space-y-1 text-[11px] text-[var(--text-secondary)]">
                      {it.steps.map((s) => (
                        <li key={`${it.id}-${s.time}`}>
                          <strong>{s.time}</strong> — {s.experience_name} ({s.neighborhood})
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* SECTION 3: Privacy, LGPD & Rede Confia Controls */}
      {sectionTab === 'privacy' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LGPD Toggles */}
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Shield className="h-4 w-4" />
              Privacidade &amp; LGPD
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              Controle explícito do uso dos seus dados. Sem inferência passiva oculta e sem coleta infantil no Modo Família.
            </p>
            <div className="mt-4 space-y-3 text-xs">
              {(
                [
                  ['location', 'Usar localização para rotas e "Perto de mim"'],
                  ['personalization', 'Personalizar feed com Match %'],
                  ['notifications', 'Notificações internas no app'],
                  ['whatsapp', 'Receber lembretes via WhatsApp'],
                  ['calendar', 'Integração com Google Calendar'],
                ] as Array<[keyof UserPreferences['lgpd_consents'], string]>
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="text-[var(--text-primary)]">{label}</span>
                  <input
                    type="checkbox"
                    checked={preferences.lgpd_consents[key]}
                    onChange={() => toggleConsent(key)}
                    className="h-4 w-4 rounded accent-[#FF6B35]"
                  />
                </label>
              ))}
            </div>
          </section>

          {/* Rede Confia & Meus Desejos Privacy Controls */}
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#397B68]">
              <Lock className="h-4 w-4" />
              Privacidade &amp; Meus Desejos
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              Padrão fechado por design: seus Desejos guardados nunca são compartilhados automaticamente.
            </p>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-canvas)] p-2.5">
                <span className="text-[var(--text-secondary)]">Envio automático de Meus Desejos para amigos</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Bloqueado</span>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-2">
                <span className="text-[var(--text-primary)]">Aceitar conexões via código de convite</span>
                <input
                  type="checkbox"
                  checked={confiaPrivacy.allow_invites_by_code}
                  onChange={(e) =>
                    setConfiaPrivacy(
                      saveConfiaPrivacySettings({ allow_invites_by_code: e.target.checked })
                    )
                  }
                  className="h-4 w-4 rounded accent-[#397B68]"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-2">
                <span className="text-[var(--text-primary)]">Exibir selo Visita Verificada quando houver QR</span>
                <input
                  type="checkbox"
                  checked={confiaPrivacy.show_verified_visit_badge}
                  onChange={(e) =>
                    setConfiaPrivacy(
                      saveConfiaPrivacySettings({ show_verified_visit_badge: e.target.checked })
                    )
                  }
                  className="h-4 w-4 rounded accent-[#397B68]"
                />
              </label>

              <button
                type="button"
                onClick={onOpenConfiaHub}
                className="w-full rounded-xl border border-[#397B68]/40 bg-[#397B68]/10 py-2 text-xs font-bold text-[#397B68] hover:bg-[#397B68] hover:text-white"
              >
                Gerenciar Círculos &amp; Revogar Acessos
              </button>
            </div>
          </section>

          {/* Optional Cloud Auth (Supabase) */}
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#123B56] dark:text-[#F7931E]">
              <LogIn className="h-4 w-4" />
              Sincronização &amp; Conta
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {supabaseReady
                ? 'Supabase configurado: conecte seu e-mail para sincronizar Desejos e conexões entre dispositivos.'
                : 'Ambiente rodando em modo local neste dispositivo (variáveis Supabase não configuradas).'}
            </p>

            {identity.storage_origin === 'supabase_auth' ? (
              <div className="mt-4 space-y-3 text-xs">
                <p className="font-semibold text-[var(--text-primary)]">
                  Conectado como {identity.email}
                </p>
                <button
                  type="button"
                  onClick={() => void signOutAccount().then(setIdentity)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2 font-bold text-red-600 dark:text-red-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair da conta em nuvem
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => void handleMagicLink(e)} className="mt-4 space-y-2.5">
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#123B56] py-2 text-xs font-bold text-white hover:bg-[#102F46]"
                >
                  {supabaseReady ? 'Enviar Link Mágico' : 'Verificar Sincronização'}
                </button>
                {authMsg && <p className="text-[11px] text-[var(--text-secondary)]">{authMsg}</p>}
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

import {
  AlertCircle,
  ArrowLeft,
  Award,
  Building2,
  CalendarCheck,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  Gift,
  History,
  ImagePlus,
  Lock,
  LogOut,
  Maximize2,
  Moon,
  MoonStar,
  PauseCircle,
  PlayCircle,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  Ticket,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { upsertRestaurants } from '../services/database';
import { checkNightlifeCompleteness, getRioTodayIso } from '../services/nightlife/nightlifeDedup';
import { submitPartnerNightlifeEvent } from '../services/nightlife/nightlifeStore';
import {
  computeActiveProgressiveTier,
  createPartnerOffering,
  getDemandParticipations,
  getPartnerOfferings,
  markOfferingAsSponsored,
  partnerConfirmDemandOffering,
  partnerConfirmSingleReservation,
  partnerEndDemandWithoutGoal,
  updatePartnerOffering,
} from '../services/opportunityStore';
import {
  attachGatewayCheckoutToInvoice,
  confirmGatewayInvoicePayment,
  createPartnerSponsoredCampaign,
  disputePartnerFeeEntry,
  getPartnerAcquisitionCreditLedger,
  getPartnerAcquisitionCreditSummary,
  getPartnerCommercialPlan,
  getPartnerFeeLedger,
  getPartnerMonthlyInvoices,
  getPartnerSponsoredCampaigns,
  savePartnerCommercialPlan,
  setPartnerSponsoredCampaignStatus,
} from '../services/partnerCommercialStore';
import {
  checkInvoicePaymentStatus,
  createInvoiceCheckoutSession,
  type GatewayPaymentMethod,
} from '../services/billingGateway';
import {
  createPartnerReward,
  getPartnerLoyaltyEconomics,
  getPartnerRewards,
  getRewardVouchers,
  partnerValidateRewardVoucher,
  setPartnerRewardStatus,
  updatePartnerReward,
} from '../services/rewardMarketplaceStore';
import type { AppRoute } from '../services/router';
import {
  cancelReservation,
  completeReservationCheckin,
  getReservations,
  markReservationNoShow,
  partnerReconcileContingencyCheckin,
  partnerVerifyPostConsumption,
} from '../services/superappStore';
import {
  getActiveVenueQrToken,
  getCheckinAuditEvents,
  getOfflineContingencyCheckins,
  getVisitProofs,
  issueDynamicVenueQrToken,
  revokeVenueQrToken,
} from '../services/visitProofStore';
import type { ReservationRequest } from '../types/experience';
import type { PartnerOffering } from '../types/marketplace';
import {
  NIGHTLIFE_SUBAREA_META,
  type NightlifeCurationStatus,
  type NightlifeEvent,
  type NightlifeSubArea,
} from '../types/nightlife';
import type {
  PartnerCommercialPlan,
  PartnerMonthlyInvoice,
} from '../types/partnerCommercial';
import type { Restaurant } from '../types/restaurant';
import type { PartnerReward, RewardSegment, RewardType } from '../types/rewards';
import {
  REWARDS_ZERO_COMMISSION_PARTNER_COPY,
  type ReservationLifecycleStage,
} from '../types/verification';

interface PartnerDashboardProps {
  restaurants: Restaurant[];
  reservations: ReservationRequest[];
  nightlifeEvents?: NightlifeEvent[];
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
  onDatabaseUpdated: () => Promise<void>;
  onNightlifeUpdated?: () => Promise<void>;
  onReservationsUpdated?: (next: ReservationRequest[]) => void;
  onSyncAppState?: () => void;
}

type PartnerTab =
  | 'traditional'
  | 'offers'
  | 'demand'
  | 'rewards'
  | 'campaigns'
  | 'nightlife'
  | 'checkin'
  | 'billing'
  | 'profile';

const PARTNER_SESSION_KEY = 'borario_partner_tenant_v1';

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
    label: 'No-Show',
    cls: 'bg-red-500/15 text-red-600 dark:text-red-300',
  },
  ENDED_WITHOUT_GOAL: {
    label: 'Encerrada sem meta',
    cls: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300',
  },
};

const PARTNER_NIGHTLIFE_STATUS_BADGE: Record<NightlifeCurationStatus, { label: string; cls: string }> = {
  PENDENTE: {
    label: 'Pendente de curadoria',
    cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  PROGRAMADO: {
    label: 'Programado',
    cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  PUBLICADO: {
    label: 'Publicado em A noite carioca',
    cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  REJEITADO: {
    label: 'Rejeitado na curadoria',
    cls: 'bg-red-500/15 text-red-600 dark:text-red-300',
  },
  CANCELADO: {
    label: 'Cancelado',
    cls: 'bg-red-500/15 text-red-600 dark:text-red-300',
  },
  EXPIRADO: {
    label: 'Expirado',
    cls: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300',
  },
};

function getEffectiveStage(res: ReservationRequest): ReservationLifecycleStage {
  if (res.stage) return res.stage;
  if (res.status === 'CONFIRMED') return 'CONFIRMED';
  if (res.status === 'CANCELLED') return 'CANCELLED';
  return 'REQUESTED';
}

export function PartnerDashboard({
  restaurants,
  reservations,
  nightlifeEvents = [],
  isDark,
  onToggleTheme,
  onNavigate,
  onDatabaseUpdated,
  onNightlifeUpdated,
  onReservationsUpdated,
  onSyncAppState,
}: PartnerDashboardProps) {
  const [partnerEmail, setPartnerEmail] = useState('gerencia@parceiro.rio.br');
  const [selectedTenantId, setSelectedTenantId] = useState<string>(() => {
    try {
      return localStorage.getItem(PARTNER_SESSION_KEY) || '';
    } catch {
      return '';
    }
  });
  const [draftTenantId, setDraftTenantId] = useState<string>(restaurants[0]?.id || '');
  const [activeTab, setActiveTab] = useState<PartnerTab>('offers');
  const [opFeedback, setOpFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [storeVersion, setStoreVersion] = useState(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [todayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeTenant = useMemo(
    () => restaurants.find((r) => r.id === selectedTenantId) || null,
    [restaurants, selectedTenantId]
  );

  // Tab 6: Official profile form state & Establishment Photos
  const [phone, setPhone] = useState(activeTenant?.phone || '');
  const [website, setWebsite] = useState(activeTenant?.website || '');
  const [openingHours, setOpeningHours] = useState(activeTenant?.opening_hours || '');
  const [description, setDescription] = useState(activeTenant?.description || '');
  const [coverImage, setCoverImage] = useState(activeTenant?.cover_image || '');
  const [gallery, setGallery] = useState<string[]>(activeTenant?.gallery || []);
  const [newGalleryUrl, setNewGalleryUrl] = useState('');

  // Tab 2: Offer photo
  const [offImage, setOffImage] = useState('');

  // Tab 5: Dynamic QR Data URL and Totem view
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQrTotemModal, setShowQrTotemModal] = useState<boolean>(false);

  // Tab 1: Traditional Booking Slot creation
  const [tradTitle, setTradTitle] = useState('Mesa Salão Principal (Sem Desconto Obrigatório)');
  const [tradDate, setTradDate] = useState(todayDate);
  const [tradTime, setTradTime] = useState('20:00');
  const [tradCapacity, setTradCapacity] = useState(16);

  // Tab 2: Unified Offer Form (Uma Oferta, Duas Modalidades: Individual ou Missão Coletiva Progressiva)
  const [offModality, setOffModality] = useState<'INDIVIDUAL_OFFER' | 'LAST_MINUTE'>('INDIVIDUAL_OFFER');
  const [offDistributionMode, setOffDistributionMode] = useState<'INDIVIDUAL' | 'COLLECTIVE_MISSION'>('INDIVIDUAL');
  const [offTitle, setOffTitle] = useState('');
  const [offBenefit, setOffBenefit] = useState('');
  const [offInitialGuaranteedBenefit, setOffInitialGuaranteedBenefit] = useState('');
  const [offTier1Goal] = useState(5);
  const [offTier2Goal, setOffTier2Goal] = useState(15);
  const [offTier2Benefit, setOffTier2Benefit] = useState('');
  const [offTier3Goal, setOffTier3Goal] = useState(25);
  const [offTier3Benefit, setOffTier3Benefit] = useState('');
  const [offSaveAsDraft, setOffSaveAsDraft] = useState(false);
  const [offEligibleItem, setOffEligibleItem] = useState('');
  const [offValidDaysHours, setOffValidDaysHours] = useState('Terça a Quinta · 19h às 22h');
  const [offRules, setOffRules] = useState('Condição válida dentro da janela escolhida; acerto direto no local.');
  const [offBasePrice, setOffBasePrice] = useState('180');
  const [offCondPrice, setOffCondPrice] = useState('135');
  const [offDate, setOffDate] = useState(todayDate);
  const [offTime, setOffTime] = useState('19:30');
  const [offCapacity, setOffCapacity] = useState(15);
  const [editingOfferingId, setEditingOfferingId] = useState<string | null>(null);
  const [editBenefitDraft, setEditBenefitDraft] = useState('');

  // Assisted Onboarding & Responsible Contact
  const [responsibleName, setResponsibleName] = useState('Gerência / Sócio Responsável');
  const [responsibleRole, setResponsibleRole] = useState('Gestor do Estabelecimento');
  const [onboardingMode, setOnboardingMode] = useState<'SELF_SERVE' | 'ASSISTED_BY_BORARIO'>('SELF_SERVE');

  // Momento 4: Campanhas Patrocinadas com Crédito Comercial de Aquisição
  const [campOfferingId, setCampOfferingId] = useState('');
  const [campName, setCampName] = useState('');
  const [campInvestmentBrl, setCampInvestmentBrl] = useState(200);
  const [campConversionPct] = useState(50);
  const [campDurationDays, setCampDurationDays] = useState(14);
  const [campNeighborhoods, setCampNeighborhoods] = useState('Zona Sul, Barra da Tijuca, Centro');

  // Tab 3: Demand offer form
  const [demTitle, setDemTitle] = useState('');
  const [demBenefit, setDemBenefit] = useState('');
  const [demBasePrice, setDemBasePrice] = useState('280');
  const [demCondPrice, setDemCondPrice] = useState('210');
  const [demGoal, setDemGoal] = useState(15);
  const [demCapacity, setDemCapacity] = useState(30);
  const [demDate, setDemDate] = useState(todayDate);
  const [demTime, setDemTime] = useState('20:30');

  // Tab 4 (Condição 2): Recompensa BoraRio form & counter voucher validator
  const [rewTitle, setRewTitle] = useState('');
  const [rewEligibleItem, setRewEligibleItem] = useState('');
  const [rewSegment, setRewSegment] = useState<RewardSegment>('Gastronomia');
  const [rewType, setRewType] = useState<RewardType>('SOBREMESA');
  const [rewRefPrice, setRewRefPrice] = useState<number>(15);
  const [rewEstCost, setRewEstCost] = useState<number>(4.5);
  const [rewMinConsumption, setRewMinConsumption] = useState<number>(0);
  const [rewCost, setRewCost] = useState<number>(1500);
  const [rewQty, setRewQty] = useState(20);
  const [rewMaxPerUser, setRewMaxPerUser] = useState(1);
  const [rewValidityDays, setRewValidityDays] = useState(30);
  const [rewValidDaysHours, setRewValidDaysHours] = useState('Terça a Quinta · 12h às 22h');
  const [rewRules, setRewRules] = useState('Apresente o voucher BR-REW no atendimento antes do pedido.');
  const [rewRestrictions, setRewRestrictions] = useState('Válido apenas para consumo presencial no local.');
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [editRewTitle, setEditRewTitle] = useState('');
  const [editRewItem, setEditRewItem] = useState('');
  const [editRewCost, setEditRewCost] = useState(1500);
  const [editRewRefPrice, setEditRewRefPrice] = useState(15);
  const [editRewEstCost, setEditRewEstCost] = useState(4.5);
  const [editRewMinConsumption, setEditRewMinConsumption] = useState(0);
  const [editRewQty, setEditRewQty] = useState(10);
  const [editRewHours, setEditRewHours] = useState('');
  const [voucherCodeInput, setVoucherCodeInput] = useState('');

  // Tab 4B: Agenda Noturna da Casa (envio para curadoria do Nightlife Radar)
  const [nlTitle, setNlTitle] = useState('');
  const [nlSubArea, setNlSubArea] = useState<NightlifeSubArea>('SAMBA_PAGODE');
  const [nlGenres, setNlGenres] = useState('Samba, Pagode');
  const [nlDate, setNlDate] = useState(() => getRioTodayIso());
  const [nlStartTime, setNlStartTime] = useState('21:00');
  const [nlEndTime, setNlEndTime] = useState('02:00');
  const [nlIsFree, setNlIsFree] = useState(false);
  const [nlPriceMin, setNlPriceMin] = useState('45');
  const [nlTicketUrl, setNlTicketUrl] = useState('');
  const [nlLineup, setNlLineup] = useState('');
  const [nlSummary, setNlSummary] = useState('');
  const [nlCoverUrl, setNlCoverUrl] = useState('');
  const [nlAgeRating, setNlAgeRating] = useState('18+');
  const [nlSubmitting, setNlSubmitting] = useState(false);

  // Tab 5: Dynamic Check-in & Verification
  const [qrTtlSeconds, setQrTtlSeconds] = useState(300);
  const [qrMaxUses, setQrMaxUses] = useState(1);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [counterResId, setCounterResId] = useState('');
  const [consumptionRefs, setConsumptionRefs] = useState<Record<string, string>>({});

  // Tab 6: Billing & Disputes
  const [planOverride] = useState<{
    tenantId: string;
    plan: PartnerCommercialPlan;
  } | null>(null);
  const [disputeTargetId, setDisputeTargetId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] =
    useState<PartnerMonthlyInvoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<GatewayPaymentMethod>('PIX');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingDocument, setBillingDocument] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const bumpStore = (syncReservations = false) => {
    setStoreVersion((v) => v + 1);
    if (syncReservations) {
      onReservationsUpdated?.(getReservations());
    }
    onSyncAppState?.();
  };

  const syncProfileForm = (tenant: Restaurant) => {
    setPhone(tenant.phone || '');
    setWebsite(tenant.website || '');
    setOpeningHours(tenant.opening_hours || '');
    setDescription(tenant.description || '');
    setOpFeedback(null);
  };

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    const targetId = draftTenantId || restaurants[0]?.id;
    if (!targetId) return;
    localStorage.setItem(PARTNER_SESSION_KEY, targetId);
    setSelectedTenantId(targetId);
    setActiveTab('offers');
    const found = restaurants.find((r) => r.id === targetId);
    if (found) syncProfileForm(found);
  };

  const handleLogout = () => {
    localStorage.removeItem(PARTNER_SESSION_KEY);
    setSelectedTenantId('');
    setActiveTab('offers');
    setEditingOfferingId(null);
    setEditingRewardId(null);
    setOpFeedback(null);
  };

  // Tenant-scoped reads
  const tenantReservations = useMemo(() => {
    if (!activeTenant || storeVersion < 0) return [];
    const latest = getReservations();
    const source = latest.length > 0 ? latest : reservations;
    return source
      .filter((res) => res.experience_id === activeTenant.id)
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  }, [activeTenant, reservations, storeVersion]);

  const tenantOfferings = useMemo(() => {
    if (!activeTenant || storeVersion < 0) return [];
    return getPartnerOfferings({ restaurantId: activeTenant.id, includeDrafts: true });
  }, [activeTenant, storeVersion]);

  const traditionalOfferings = tenantOfferings.filter((o) => o.modality === 'TRADITIONAL_BOOKING');
  const individualAndLastMinute = tenantOfferings.filter(
    (o) => o.modality === 'INDIVIDUAL_OFFER' || o.modality === 'LAST_MINUTE'
  );
  const demandOfferings = tenantOfferings.filter((o) => o.modality === 'DEMAND_OFFER');

  const tenantRewards = useMemo(() => {
    if (!activeTenant || storeVersion < 0) return [];
    return getPartnerRewards({ restaurantId: activeTenant.id, includeInactive: true });
  }, [activeTenant, storeVersion]);

  const tenantVouchers = useMemo(() => {
    if (!activeTenant || storeVersion < 0) return [];
    return getRewardVouchers({ restaurantId: activeTenant.id });
  }, [activeTenant, storeVersion]);

  const loyaltyEconomics = useMemo(() => {
    if (!activeTenant || storeVersion < 0) return null;
    return getPartnerLoyaltyEconomics(activeTenant.id);
  }, [activeTenant, storeVersion]);

  const tenantNightlifeEvents = useMemo(() => {
    if (!activeTenant) return [];
    return nightlifeEvents.filter((ev) => ev.venue_id === activeTenant.id);
  }, [activeTenant, nightlifeEvents]);

  const hasCondition1Configured = tenantOfferings.some(
    (o) => o.modality !== 'TRADITIONAL_BOOKING' && o.status !== 'CANCELLED' && o.status !== 'DRAFT'
  );
  const hasCondition2Configured = tenantRewards.some((r) => r.status !== 'CLOSED');

  const activeQr =
    activeTenant && storeVersion >= 0 ? getActiveVenueQrToken(activeTenant.id) : null;
  const qrRemainingSec = activeQr
    ? Math.max(0, Math.floor((new Date(activeQr.expires_at).getTime() - nowMs) / 1000))
    : 0;

  useEffect(() => {
    if (activeQr && !activeQr.revoked && qrRemainingSec > 0) {
      QRCode.toDataURL(activeQr.token_code, {
        width: 380,
        margin: 2,
        color: { dark: '#0A1828', light: '#FFFFFF' },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [activeQr, qrRemainingSec]);

  const tenantContingencies =
    activeTenant && storeVersion >= 0
      ? getOfflineContingencyCheckins(activeTenant.id).filter(
          (c) => c.reconciliation_status === 'PENDING_PARTNER_RECONCILE'
        )
      : [];

  const tenantProofs =
    activeTenant && storeVersion >= 0 ? getVisitProofs({ restaurantId: activeTenant.id }) : [];
  const tenantAuditEvents =
    activeTenant && storeVersion >= 0 ? getCheckinAuditEvents(activeTenant.id) : [];

  const currentPlan: PartnerCommercialPlan | null = activeTenant
    ? planOverride?.tenantId === activeTenant.id
      ? planOverride.plan
      : getPartnerCommercialPlan(activeTenant.id)
    : null;

  const tenantFeeLedger =
    activeTenant && storeVersion >= 0 ? getPartnerFeeLedger(activeTenant.id) : [];

  const tenantSponsoredCampaigns = useMemo(() => {
    if (!activeTenant || storeVersion < 0) return [];
    return getPartnerSponsoredCampaigns(activeTenant.id);
  }, [activeTenant, storeVersion]);

  const tenantCreditSummary = useMemo(() => {
    if (!activeTenant || storeVersion < 0) {
      return {
        totalInitialCreditBrl: 0,
        totalUsedCreditBrl: 0,
        totalRemainingCreditBrl: 0,
        totalInvestmentBrl: 0,
        totalNetAdRevenueBrl: 0,
        activeCampaignsCount: 0,
      };
    }
    return getPartnerAcquisitionCreditSummary(activeTenant.id);
  }, [activeTenant, storeVersion]);

  const tenantCreditLedger = useMemo(() => {
    if (!activeTenant || storeVersion < 0) return [];
    return getPartnerAcquisitionCreditLedger(activeTenant.id);
  }, [activeTenant, storeVersion]);

  const tenantInvoices = useMemo(() => {
    if (!activeTenant || storeVersion < 0) return [];
    return getPartnerMonthlyInvoices(activeTenant.id);
  }, [activeTenant, storeVersion]);

  // Handlers
  const handleSubmitPartnerNightlife = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeTenant || !nlTitle.trim()) return;
    setNlSubmitting(true);
    try {
      const genresList = nlGenres
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean);
      const lineupList = nlLineup
        .split(',')
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await submitPartnerNightlifeEvent(
        {
          title: nlTitle.trim(),
          sub_area: nlSubArea,
          music_genres: genresList.length > 0 ? genresList : NIGHTLIFE_SUBAREA_META[nlSubArea].defaultGenres,
          event_date: nlDate,
          start_time: nlStartTime,
          end_time: nlEndTime.trim() || undefined,
          is_free: nlIsFree,
          price_min_brl: nlIsFree ? 0 : Number(nlPriceMin) || undefined,
          ticket_url: nlTicketUrl.trim() || undefined,
          lineup: lineupList,
          short_summary: nlSummary.trim(),
          cover_image: nlCoverUrl.trim() || undefined,
          age_rating: nlAgeRating,
        },
        activeTenant
      );
      await onNightlifeUpdated?.();
      setOpFeedback({ ok: res.ok, msg: res.message });
      if (res.ok) {
        setNlTitle('');
        setNlLineup('');
        setNlSummary('');
        setNlTicketUrl('');
        setNlCoverUrl('');
      }
      bumpStore();
    } finally {
      setNlSubmitting(false);
    }
  };

  const handleOfferPhotoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setOffImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCoverPhotoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCoverImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGalleryPhotosFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const res = reader.result;
          setGallery((prev) => [...prev, res]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddGalleryUrl = () => {
    if (!newGalleryUrl.trim()) return;
    setGallery((prev) => [...prev, newGalleryUrl.trim()]);
    setNewGalleryUrl('');
  };

  const handleRemoveGalleryPhoto = (index: number) => {
    setGallery((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetCoverPhoto = (url: string) => {
    setCoverImage(url);
    setOpFeedback({ ok: true, msg: 'Foto selecionada como capa principal!' });
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    await upsertRestaurants([
      {
        ...activeTenant,
        phone,
        website,
        opening_hours: openingHours,
        description,
        cover_image: coverImage.trim() || activeTenant.cover_image,
        gallery: gallery,
        image_origin: 'owner_authorized',
        data_source: 'owner_submitted',
        validation_status: 'CONFIRMADO',
        confidence_level: 'ALTA',
        last_verified_at: new Date().toISOString(),
      },
    ]);
    savePartnerCommercialPlan(activeTenant.id, {
      onboarding_mode: onboardingMode,
      onboarding_stage: hasCondition1Configured ? 'PUBLISHED' : 'DRAFT',
      responsible_name: responsibleName.trim() || undefined,
      responsible_role: responsibleRole.trim() || undefined,
    });
    await onDatabaseUpdated();
    bumpStore();
    setOpFeedback({
      ok: true,
      msg:
        onboardingMode === 'ASSISTED_BY_BORARIO'
          ? 'Perfil salvo no modo Cadastro Assistido pelo BoraRio! Agora aprove ou publique sua 1ª oferta.'
          : 'Dados oficiais e fotos do estabelecimento salvos com sucesso!',
    });
  };

  const handleCreateTraditionalSlot = (e: FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    const res = createPartnerOffering({
      restaurant_id: activeTenant.id,
      restaurant_name: activeTenant.name,
      neighborhood: activeTenant.neighborhood,
      category: activeTenant.category,
      price_range: activeTenant.price_range,
      modality: 'TRADITIONAL_BOOKING',
      status: 'PUBLISHED',
      title: tradTitle.trim() || 'Reserva Tradicional de Salão',
      description: 'Horário tradicional com cardápio regular da casa e autonomia de atendimento.',
      benefit_summary: 'Reserva tradicional sem desconto obrigatório',
      rules_summary: 'Sujeita à confirmação do estabelecimento. Pagamento direto no local.',
      eligibility_rules: 'Reservas individuais ou de grupos dentro da capacidade do turno.',
      cancellation_policy: 'Cancelamento sem ônus até 2 horas antes da janela.',
      has_discount: false,
      condition_badge: 'Reserva Tradicional',
      estimated_savings_brl: 0,
      service_date: tradDate,
      time_slot_label: tradTime,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      capacity_total: Math.max(1, tradCapacity),
      partner_managed_active: true,
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    bumpStore();
  };

  const handleCreateIndividualOrLastMinute = (e: FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    const base = Number(offBasePrice) || undefined;
    const cond = Number(offCondPrice) || undefined;
    const estSavings = base && cond && base > cond ? Number((base - cond).toFixed(2)) : 0;

    const isCollective = offDistributionMode === 'COLLECTIVE_MISSION';
    const initialGuarantee =
      offInitialGuaranteedBenefit.trim() ||
      offBenefit.trim() ||
      'Benefício inicial garantido desde a ativação';

    const progressiveTiers = isCollective
      ? [
          {
            tier_level: 1 as const,
            min_adhesions: Math.max(1, offTier1Goal),
            benefit_label: initialGuarantee,
            benefit_description: 'Benefício base garantido para qualquer participante desde a primeira adesão.',
          },
          {
            tier_level: 2 as const,
            min_adhesions: Math.max(2, offTier2Goal),
            benefit_label: offTier2Benefit.trim() || '+ Sobremesa ou drink cortesia desbloqueado',
            benefit_description: 'Bônus adicional liberado para todos os participantes quando a meta da Faixa 2 é atingida.',
          },
          {
            tier_level: 3 as const,
            min_adhesions: Math.max(3, offTier3Goal),
            benefit_label: offTier3Benefit.trim() || 'Benefício máximo + +50 Rio Points extras',
            benefit_description: 'Nível máximo da missão coletiva com benefício completo para todos os participantes.',
          },
        ]
      : undefined;

    const res = createPartnerOffering({
      restaurant_id: activeTenant.id,
      restaurant_name: activeTenant.name,
      neighborhood: activeTenant.neighborhood,
      category: activeTenant.category,
      price_range: activeTenant.price_range,
      modality: isCollective ? 'DEMAND_OFFER' : offModality,
      distribution_mode: offDistributionMode,
      status: offSaveAsDraft ? 'DRAFT' : 'PUBLISHED',
      title: offTitle.trim(),
      description: isCollective
        ? 'Missão coletiva com benefício inicial garantido e faixas progressivas destravadas conforme novas adesões — uso 100% individual.'
        : offModality === 'LAST_MINUTE'
          ? 'Oportunidade de última hora aberta pelo estabelecimento para janela imediata.'
          : 'Oferta individual definida pelo parceiro sem necessidade de quórum coletivo.',
      benefit_summary: isCollective
        ? initialGuarantee
        : offBenefit.trim() || 'Condição especial definida pelo parceiro',
      initial_guaranteed_benefit: isCollective ? initialGuarantee : undefined,
      progressive_tiers: progressiveTiers,
      min_demand_goal: isCollective ? Math.max(2, offTier2Goal) : undefined,
      eligible_item: offEligibleItem.trim() || offBenefit.trim() || offTitle.trim(),
      offer_category: activeTenant.macro_category || activeTenant.category,
      valid_days_hours: offValidDaysHours.trim() || `${offDate} · ${offTime}`,
      rules_summary: offRules.trim(),
      eligibility_rules: 'Uso 100% individual ou em mesa própria. Cobrança apenas por participante validado.',
      cancellation_policy: 'Alteração ou cancelamento gratuito até 2 horas antes.',
      has_discount: estSavings > 0,
      condition_badge: isCollective
        ? 'Missão Coletiva Progressiva'
        : offModality === 'LAST_MINUTE'
          ? 'Última Hora'
          : 'Oferta Individual',
      base_price_brl: base,
      partner_condition_price_brl: cond,
      estimated_savings_brl: estSavings,
      service_date: offDate,
      time_slot_label: offTime,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      capacity_total: Math.max(1, offCapacity),
      partner_managed_active: !offSaveAsDraft,
      image_url: offImage.trim() || undefined,
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setOffTitle('');
      setOffBenefit('');
      setOffEligibleItem('');
      setOffImage('');
      setOffSaveAsDraft(false);
    }
    bumpStore();
  };

  const handleCreateDemandOffer = (e: FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    const base = Number(demBasePrice) || undefined;
    const cond = Number(demCondPrice) || undefined;
    const estSavings = base && cond && base > cond ? Number((base - cond).toFixed(2)) : 0;

    const res = createPartnerOffering({
      restaurant_id: activeTenant.id,
      restaurant_name: activeTenant.name,
      neighborhood: activeTenant.neighborhood,
      category: activeTenant.category,
      price_range: activeTenant.price_range,
      modality: 'DEMAND_OFFER',
      distribution_mode: 'COLLECTIVE_MISSION',
      status: 'PUBLISHED',
      title: demTitle.trim(),
      description:
        'Missão coletiva progressiva com benefício inicial garantido e evolução automática por faixa de adesão. Uso individual sem dividir mesa.',
      benefit_summary: demBenefit.trim() || 'Benefício inicial garantido + evolução por adesões',
      initial_guaranteed_benefit: demBenefit.trim() || 'Benefício inicial garantido desde a publicação',
      progressive_tiers: [
        {
          tier_level: 1 as const,
          min_adhesions: 1,
          benefit_label: 'Benefício inicial garantido ativo',
          benefit_description: 'Garantido desde a primeira adesão sem risco de cancelamento.',
        },
        {
          tier_level: 2 as const,
          min_adhesions: Math.max(2, Math.floor(demGoal / 2)),
          benefit_label: demBenefit.trim() || 'Faixa intermediária desbloqueada',
          benefit_description: 'Benefício ampliado para todos os participantes.',
        },
        {
          tier_level: 3 as const,
          min_adhesions: Math.max(3, demGoal),
          benefit_label: `${demBenefit.trim()} + Bônus VIP`,
          benefit_description: 'Benefício máximo da missão coletiva destravado.',
        },
      ],
      rules_summary:
        'Benefício inicial garantido desde a ativação. Uso individual na janela escolhida.',
      eligibility_rules: 'Participações individuais independentes.',
      cancellation_policy: 'Sem cobrança no app; pagamento apenas por participante validado.',
      has_discount: estSavings > 0,
      condition_badge: 'Missão Coletiva Progressiva',
      base_price_brl: base,
      partner_condition_price_brl: cond,
      estimated_savings_brl: estSavings,
      service_date: demDate,
      time_slot_label: demTime,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      capacity_total: Math.max(2, demCapacity),
      min_demand_goal: Math.max(2, demGoal),
      partner_managed_active: true,
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setDemTitle('');
      setDemBenefit('');
    }
    bumpStore();
  };

  const handleCreateSponsoredCampaign = (e: FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    const targetOffering =
      tenantOfferings.find((o) => o.id === campOfferingId) ||
      tenantOfferings.find((o) => o.modality !== 'TRADITIONAL_BOOKING');
    if (!targetOffering) {
      setOpFeedback({
        ok: false,
        msg: 'Publique ao menos uma oferta antes de ativar uma campanha patrocinada.',
      });
      return;
    }
    const neighborhoods = campNeighborhoods
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    const res = createPartnerSponsoredCampaign({
      restaurantId: activeTenant.id,
      restaurantName: activeTenant.name,
      offeringId: targetOffering.id,
      offeringTitle: targetOffering.title,
      campaignName: campName.trim() || `Impulsionamento · ${targetOffering.title}`,
      targetNeighborhoods: neighborhoods.length > 0 ? neighborhoods : [activeTenant.neighborhood],
      targetCategories: [activeTenant.category],
      durationDays: campDurationDays,
      investmentBrl: campInvestmentBrl,
      creditConversionPct: campConversionPct,
    });
    if (res.ok && res.campaign) {
      markOfferingAsSponsored(targetOffering.id, res.campaign.id, true);
      setCampName('');
    }
    setOpFeedback({ ok: res.ok, msg: res.message });
    bumpStore();
  };

  const handleToggleOffering = (off: PartnerOffering) => {
    const res = updatePartnerOffering(off.id, {
      partner_managed_active: !off.partner_managed_active,
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    bumpStore();
  };

  const handleCloseOffering = (off: PartnerOffering) => {
    const res = updatePartnerOffering(off.id, {
      status: 'CANCELLED',
      partner_managed_active: false,
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    bumpStore();
  };

  const handleSaveOfferingTermEdit = (offeringId: string) => {
    const res = updatePartnerOffering(offeringId, {
      benefit_summary: editBenefitDraft.trim(),
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) setEditingOfferingId(null);
    bumpStore();
  };

  const handleCreateReward = (e: FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    const res = createPartnerReward({
      restaurant_id: activeTenant.id,
      restaurant_name: activeTenant.name,
      neighborhood: activeTenant.neighborhood,
      segment_category: rewSegment,
      reward_type: rewType,
      title: rewTitle.trim(),
      eligible_item: rewEligibleItem.trim(),
      points_cost: rewCost,
      reference_price_brl: rewRefPrice,
      estimated_cost_brl: rewEstCost,
      min_consumption_brl: rewMinConsumption,
      quantity_total: rewQty,
      max_per_user: rewMaxPerUser,
      valid_days_hours: rewValidDaysHours,
      rules_summary: rewRules,
      restrictions: rewRestrictions,
      voucher_validity_days: rewValidityDays,
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setRewTitle('');
      setRewEligibleItem('');
    }
    bumpStore();
  };

  const handleStartEditReward = (rew: PartnerReward) => {
    setEditingRewardId(rew.id);
    setEditRewTitle(rew.title);
    setEditRewItem(rew.eligible_item);
    setEditRewCost(rew.points_cost);
    setEditRewRefPrice(rew.reference_price_brl ?? Number((rew.points_cost / 100).toFixed(2)));
    setEditRewEstCost(rew.estimated_cost_brl ?? 0);
    setEditRewMinConsumption(rew.min_consumption_brl ?? 0);
    setEditRewQty(rew.quantity_total);
    setEditRewHours(rew.valid_days_hours);
  };

  const handleSaveEditReward = (rewardId: string) => {
    const res = updatePartnerReward(rewardId, {
      title: editRewTitle.trim(),
      eligible_item: editRewItem.trim(),
      points_cost: editRewCost,
      reference_price_brl: editRewRefPrice,
      estimated_cost_brl: editRewEstCost,
      min_consumption_brl: editRewMinConsumption,
      quantity_total: editRewQty,
      valid_days_hours: editRewHours.trim(),
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) setEditingRewardId(null);
    bumpStore();
  };

  const handleSetRewardStatus = (rewardId: string, status: 'AVAILABLE' | 'PAUSED' | 'CLOSED') => {
    const res = setPartnerRewardStatus(rewardId, status);
    setOpFeedback({ ok: res.ok, msg: res.message });
    bumpStore();
  };

  const handleValidateRewardVoucher = (codeOverride?: string) => {
    if (!activeTenant) return;
    const targetCode = codeOverride ?? voucherCodeInput;
    const res = partnerValidateRewardVoucher({
      voucherCode: targetCode,
      restaurantId: activeTenant.id,
      partnerLabel: partnerEmail,
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    if (res.ok && !codeOverride) {
      setVoucherCodeInput('');
    }
    bumpStore();
  };

  const handleIssueQr = () => {
    if (!activeTenant) return;
    issueDynamicVenueQrToken({
      restaurantId: activeTenant.id,
      ttlSeconds: qrTtlSeconds,
      maxUses: qrMaxUses,
      issuedByLabel: `Painel (${partnerEmail})`,
    });
    setNowMs(Date.now());
    setOpFeedback({
      ok: true,
      msg: `QR dinâmico gerado com validade de ${Math.round(qrTtlSeconds / 60)} min.`,
    });
    bumpStore();
  };

  const handleRevokeQr = () => {
    if (!activeQr) return;
    revokeVenueQrToken(activeQr.id);
    setOpFeedback({ ok: true, msg: 'Token QR dinâmico revogado.' });
    bumpStore();
  };

  const handleValidateCounterCheckin = () => {
    if (!counterResId || !activeQr) {
      setOpFeedback({
        ok: false,
        msg: 'Selecione uma reserva elegível e garanta um QR dinâmico ativo.',
      });
      return;
    }
    const res = completeReservationCheckin({
      reservationId: counterResId,
      scannedCodeOrPin: activeQr.token_code,
      actorContext: 'PARTNER',
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    bumpStore(true);
  };

  const handleReconcile = (
    contingencyId: string,
    reservationId: string,
    decision: 'RECONCILED' | 'REJECTED'
  ) => {
    const res = partnerReconcileContingencyCheckin({
      contingencyId,
      reservationId,
      decision,
      partnerLabel: activeTenant?.name || partnerEmail,
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    bumpStore(true);
  };

  const handleVerifyConsumption = (visitProofId: string) => {
    const ref = (consumptionRefs[visitProofId] || '').trim();
    const res = partnerVerifyPostConsumption({
      visitProofId,
      partnerLabel: activeTenant?.name || partnerEmail,
      evidenceType: 'PARTNER_POST_CONSUMPTION',
      consumptionReference: ref,
    });
    setOpFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setConsumptionRefs((prev) => ({ ...prev, [visitProofId]: '' }));
    }
    bumpStore(true);
  };

  const handleDisputeFee = (entryId: string) => {
    if (!disputeReason.trim()) {
      setOpFeedback({ ok: false, msg: 'Informe o motivo objetivo da contestação.' });
      return;
    }
    disputePartnerFeeEntry(entryId, disputeReason);
    setDisputeTargetId(null);
    setDisputeReason('');
    setOpFeedback({
      ok: true,
      msg: 'Contestação registrada na auditoria de remuneração do BoraRio.',
    });
    bumpStore();
  };

  const handleGenerateInvoiceCharge = async (invoice: PartnerMonthlyInvoice) => {
    if (!activeTenant) return;
    setPaymentError(null);
    setPaymentFeedback(null);

    const emailToUse = (billingEmail || partnerEmail || '').trim();
    if (!emailToUse) {
      setPaymentError('Informe o e-mail financeiro para emissão da cobrança.');
      return;
    }

    setPaymentProcessing(true);
    try {
      const result = await createInvoiceCheckoutSession({
        invoiceId: invoice.id,
        restaurantId: activeTenant.id,
        restaurantName: activeTenant.name,
        periodLabel: invoice.period_label,
        amountBrl: invoice.total_brl,
        method: paymentMethod,
        dueDate: invoice.due_date,
        returnUrl: window.location.href,
        customer: {
          name: responsibleName || activeTenant.name,
          email: emailToUse,
          document: billingDocument.trim(),
        },
      });

      if (!result.ok || !result.order_id || !result.provider) {
        setPaymentError(
          result.message ||
            'Não foi possível gerar a cobrança. Verifique a chave de integração do gateway.'
        );
        return;
      }

      const updated = attachGatewayCheckoutToInvoice(activeTenant.id, invoice.id, {
        provider: result.provider,
        method: result.method || paymentMethod,
        order_id: result.order_id,
        charge_id: result.charge_id,
        pix_copy_paste_key: result.pix_copy_paste_key,
        pix_qr_code_url: result.pix_qr_code_url,
        bank_slip_barcode: result.bank_slip_barcode,
        boleto_pdf_url: result.boleto_pdf_url,
        checkout_url: result.checkout_url,
        expires_at: result.expires_at,
      });

      if (updated) {
        setSelectedInvoiceForPayment(updated);
      }
      setPaymentFeedback(
        `Cobrança emitida via ${result.provider === 'PAGARME' ? 'Pagar.me' : 'Stripe'}. Conclua o pagamento e clique em verificar.`
      );
      bumpStore();
    } finally {
      setPaymentProcessing(false);
    }
  };

  const handleCheckInvoicePayment = async (invoice: PartnerMonthlyInvoice) => {
    if (!activeTenant || !invoice.gateway_order_id) return;
    setPaymentError(null);
    setCheckingPaymentStatus(true);
    try {
      const statusRes = await checkInvoicePaymentStatus(
        invoice.gateway_order_id,
        invoice.gateway_provider
      );
      if (!statusRes.ok) {
        setPaymentError(statusRes.message || 'Não foi possível consultar o status no gateway.');
        return;
      }
      if (statusRes.paid) {
        const res = confirmGatewayInvoicePayment(activeTenant.id, invoice.id, {
          paymentMethod: invoice.payment_method || paymentMethod,
          provider: statusRes.provider || invoice.gateway_provider,
          orderId: invoice.gateway_order_id,
          paidAt: statusRes.paid_at,
        });
        if (res.ok && res.invoice) {
          setSelectedInvoiceForPayment(res.invoice);
          setPaymentFeedback(res.message);
          bumpStore();
        }
      } else {
        setPaymentFeedback(
          `Status atual no gateway: ${statusRes.status || 'aguardando pagamento'}. Assim que compensar, a fatura será baixada.`
        );
      }
    } finally {
      setCheckingPaymentStatus(false);
    }
  };

  const copyText = (txt: string) => {
    void navigator.clipboard?.writeText(txt);
    setCopiedCode(txt);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const activeLedgerEntries = tenantFeeLedger.filter(
    (f) => f.status === 'ACCRUED' || f.status === 'INVOICED'
  );
  const grossAccruedBrl = activeLedgerEntries.reduce(
    (acc, f) => acc + (f.gross_fee_brl ?? f.total_fee_brl),
    0
  );
  const creditsAbatedBrl = activeLedgerEntries.reduce(
    (acc, f) => acc + (f.credit_abated_brl ?? 0),
    0
  );
  const accruedBrl = activeLedgerEntries.reduce((acc, f) => acc + f.total_fee_brl, 0);
  const totalGuestsBilled = activeLedgerEntries.reduce((acc, f) => acc + f.attended_guests, 0);

  const totalViews = tenantOfferings.reduce((acc, o) => acc + (o.views_count || 0), 0);
  const totalValidAdhesions = tenantOfferings.reduce(
    (acc, o) => acc + (o.valid_adhesions_count ?? o.reserved_count ?? 0),
    0
  );
  const totalActiveReservations = tenantReservations.filter((r) => {
    const st = getEffectiveStage(r);
    return st !== 'CANCELLED' && st !== 'ENDED_WITHOUT_GOAL';
  }).length;

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1680px] items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onNavigate('/parceiros')}>
              <BrandLogo variant="horizontal" size="sm" onDark={isDark} />
            </button>
            <span className="rounded-full bg-[#123B56] px-2.5 py-0.5 text-xs font-bold text-white">
              Painel do Parceiro
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Alternar tema"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-hairline)]"
            >
              {isDark ? <Sun className="h-4 w-4 text-[#FF765E]" /> : <Moon className="h-4 w-4 text-[#123B56]" />}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/app')}
              className="hidden rounded-full border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-semibold hover:border-[#FF765E] sm:inline-flex"
            >
              Ver App
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/parceiros')}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-6 lg:px-10">
        {!activeTenant ? (
          <div className="mx-auto max-w-lg rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#123B56] text-white">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-sans tracking-tight text-2xl font-bold">Acesso do Parceiro</h1>
                <p className="text-xs text-[var(--text-secondary)]">
                  Plataforma inteligente de reservas, experiências e demanda — você define suas condições.
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)]">
                  E-mail corporativo do parceiro
                </label>
                <input
                  type="email"
                  required
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm focus:border-[#FF765E] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)]">
                  Estabelecimento vinculado (sessão isolada por tenant)
                </label>
                <select
                  value={draftTenantId || restaurants[0]?.id || ''}
                  onChange={(e) => setDraftTenantId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm focus:border-[#FF765E] focus:outline-none"
                >
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.neighborhood}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#FF765E] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#e8634c]"
              >
                Entrar no Painel do Estabelecimento
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Banner Principal Limpo e Arejado */}
            <div className="flex flex-col justify-between gap-6 rounded-3xl bg-borario-day p-7 text-white shadow-lg sm:flex-row sm:items-center sm:p-9">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-[#A7E3CE]" />
                  <span>Painel Oficial · {activeTenant.neighborhood}</span>
                </div>
                <h1 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl">
                  {activeTenant.name}
                </h1>
                <p className="text-sm text-[#F1E8D8] sm:text-base">
                  {activeTenant.category} · O cliente paga 100% da conta direto no seu caixa (0% comissão)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
                <span className="rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-xs">
                  Tarifa ativa: R$ {(currentPlan?.fixed_fee_per_guest_brl ?? 5).toFixed(2).replace('.', ',')} / pessoa validada
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
                >
                  <LogOut className="h-4 w-4" />
                  Trocar / Sair
                </button>
              </div>
            </div>

            {/* 4 Indicadores Principais — Grandes, Limpos e Fáceis de Ler */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs">
                <span className="text-sm font-semibold text-[var(--text-secondary)]">
                  Visualizações nas Ofertas
                </span>
                <p className="mt-2 text-3xl font-black text-[var(--text-primary)]">{totalViews}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Interesse gerado no app
                </p>
              </div>

              <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs">
                <span className="text-sm font-semibold text-[var(--text-secondary)]">
                  Reservas &amp; Adesões
                </span>
                <p className="mt-2 text-3xl font-black text-[#123B56] dark:text-[#8DC4EA]">
                  {Math.max(totalValidAdhesions, totalActiveReservations)}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Clientes que ativaram ofertas
                </p>
              </div>

              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 shadow-xs">
                <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  Clientes Atendidos (QR)
                </span>
                <p className="mt-2 text-3xl font-black text-emerald-700 dark:text-emerald-300">
                  {totalGuestsBilled}
                </p>
                <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
                  Presenças validadas no balcão
                </p>
              </div>

              <div className="rounded-3xl border border-[#FF6B35]/30 bg-[#FF6B35]/10 p-6 shadow-xs">
                <span className="text-sm font-bold text-[#FF6B35]">
                  Total do Mês
                </span>
                <p className="mt-2 text-3xl font-black text-[#FF6B35]">
                  R$ {accruedBrl.toFixed(2).replace('.', ',')}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Apenas clientes com check-in
                </p>
              </div>
            </section>

            {/* Jornada Simplificada em 3 Passos Claros */}
            <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-xs">
              <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    Sua Jornada no BoraRio em 3 Passos Simples
                  </h2>
                  <p className="mt-1 text-sm sm:text-base text-[var(--text-secondary)]">
                    Configure apenas o essencial para começar a receber clientes e evolua quando quiser.
                  </p>
                </div>
                {currentPlan?.onboarding_mode === 'ASSISTED_BY_BORARIO' && (
                  <span className="self-start rounded-full bg-[#123B56]/15 px-4 py-1.5 text-sm font-bold text-[#123B56] dark:text-[#8DC4EA]">
                    🤝 Cadastro Assistido BoraRio
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('offers');
                    setOffDistributionMode('INDIVIDUAL');
                    setOpFeedback(null);
                  }}
                  className={`flex flex-col justify-between rounded-2xl border p-5 text-left transition ${
                    activeTab === 'offers' && offDistributionMode === 'INDIVIDUAL'
                      ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[#FF6B35]/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#FF6B35]/15 px-3 py-1 text-xs font-extrabold uppercase text-[#FF6B35]">
                        Passo 1 · Começar
                      </span>
                      <CheckCircle2
                        className={`h-5 w-5 ${
                          hasCondition1Configured ? 'text-emerald-500' : 'text-[var(--text-secondary)]'
                        }`}
                      />
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                      Sua Primeira Oferta
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                      Crie uma condição atrativa para atrair clientes ao salão com validação simples por QR Code.
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#FF6B35]">
                    {hasCondition1Configured ? 'Ver minhas ofertas →' : 'Criar 1ª oferta agora →'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('offers');
                    setOffDistributionMode('COLLECTIVE_MISSION');
                    setOpFeedback(null);
                  }}
                  className={`flex flex-col justify-between rounded-2xl border p-5 text-left transition ${
                    activeTab === 'offers' && offDistributionMode === 'COLLECTIVE_MISSION'
                      ? 'border-[#123B56] bg-[#123B56]/10 dark:border-[#8DC4EA]'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[#123B56]/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#123B56]/15 px-3 py-1 text-xs font-extrabold uppercase text-[#123B56] dark:text-[#8DC4EA]">
                        Passo 2 · Gerar Demanda
                      </span>
                      <Users className="h-5 w-5 text-[#123B56] dark:text-[#8DC4EA]" />
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                      Missão Coletiva Progressiva
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                      Distribuída com benefício inicial garantido e faixas extras destravadas conforme novas adesões.
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#123B56] dark:text-[#8DC4EA]">
                    Configurar missão coletiva →
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('rewards');
                    setOpFeedback(null);
                  }}
                  className={`flex flex-col justify-between rounded-2xl border p-5 text-left transition ${
                    activeTab === 'rewards'
                      ? 'border-[#397B68] bg-[#397B68]/10'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-[#397B68]/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#397B68]/15 px-3 py-1 text-xs font-extrabold uppercase text-[#397B68] dark:text-[#4CA188]">
                        Passo 3 · Opcional
                      </span>
                      <Ticket className="h-5 w-5 text-[#397B68] dark:text-[#4CA188]" />
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                      Fidelidade Rio Points
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                      Ofereça uma cortesia para troca por pontos quando quiser, com 0% de comissão e R$ 0 de taxa.
                    </p>
                  </div>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[#397B68] dark:text-[#4CA188]">
                    {hasCondition2Configured ? `${tenantRewards.length} cortesia(s) ativa(s) →` : 'Conhecer fidelidade →'}
                  </span>
                </button>
              </div>
            </section>

            {/* Menu de Navegação Principal — Botões Amplos e Intuitivos */}
            <nav className="flex flex-wrap gap-2.5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 shadow-xs">
              {[
                {
                  id: 'offers' as const,
                  label: `Ofertas & Missões (${individualAndLastMinute.length + demandOfferings.length})`,
                  icon: Gift,
                },
                {
                  id: 'checkin' as const,
                  label: 'QR Code & Check-in',
                  icon: QrCode,
                },
                {
                  id: 'traditional' as const,
                  label: `Reservas (${tenantReservations.length})`,
                  icon: CalendarCheck,
                },
                {
                  id: 'billing' as const,
                  label: 'Financeiro',
                  icon: ReceiptText,
                },
                {
                  id: 'rewards' as const,
                  label: `Fidelidade (${tenantRewards.length})`,
                  icon: Ticket,
                },
                {
                  id: 'profile' as const,
                  label: 'Perfil & Fotos',
                  icon: Building2,
                },
                {
                  id: 'nightlife' as const,
                  label: `Agenda Noturna (${tenantNightlifeEvents.length})`,
                  icon: MoonStar,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      setOpFeedback(null);
                    }}
                    className={`inline-flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                      active
                        ? 'bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-sm'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {opFeedback && (
              <div
                className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-sm font-semibold ${
                  opFeedback.ok
                    ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-red-500/35 bg-red-500/10 text-red-600 dark:text-red-300'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {opFeedback.ok ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0" />
                  )}
                  {opFeedback.msg}
                </span>
                <button
                  type="button"
                  onClick={() => setOpFeedback(null)}
                  className="rounded-lg px-3 py-1 text-sm font-bold hover:bg-black/5"
                >
                  Fechar
                </button>
              </div>
            )}

            {/* TAB 1: RESERVAS RECEBIDAS */}
            {activeTab === 'traditional' && (
              <div className="grid gap-8 lg:grid-cols-12">
                <form
                  onSubmit={handleCreateTraditionalSlot}
                  className="space-y-5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-xs lg:col-span-5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <CalendarCheck className="h-6 w-6 text-[#123B56] dark:text-[#FF6B35]" />
                      <h2 className="font-sans text-xl font-bold sm:text-2xl">
                        Abrir Horário de Reserva
                      </h2>
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                      Receba reservas comuns no salão sem desconto obrigatório. Você define apenas dias, horários e vagas.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)]">
                      Nome do turno ou ambiente
                    </label>
                    <input
                      type="text"
                      required
                      value={tradTitle}
                      onChange={(e) => setTradTitle(e.target.value)}
                      className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-base"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-[var(--text-primary)]">
                        Data
                      </label>
                      <input
                        type="date"
                        value={tradDate}
                        onChange={(e) => setTradDate(e.target.value)}
                        className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[var(--text-primary)]">
                        Horário
                      </label>
                      <input
                        type="text"
                        value={tradTime}
                        onChange={(e) => setTradTime(e.target.value)}
                        placeholder="20:00"
                        className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)]">
                      Vagas disponíveis (lugares)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={tradCapacity}
                      onChange={(e) => setTradCapacity(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-base font-bold"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-[#123B56] py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-[#102F46]"
                  >
                    Publicar Horário de Reserva
                  </button>

                  {traditionalOfferings.length > 0 && (
                    <div className="space-y-3 border-t border-[var(--border-hairline)] pt-5">
                      <p className="text-sm font-bold text-[var(--text-secondary)]">
                        Horários publicados ({traditionalOfferings.length})
                      </p>
                      {traditionalOfferings.map((off) => (
                        <div
                          key={off.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 text-sm"
                        >
                          <div>
                            <p className="font-bold text-[var(--text-primary)]">{off.title}</p>
                            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                              {off.service_date} · {off.time_slot_label} ({off.reserved_count}/{off.capacity_total} vagas)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleOffering(off)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm font-semibold"
                          >
                            {off.partner_managed_active ? (
                              <>
                                <PauseCircle className="h-4 w-4 text-amber-500" /> Pausar
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-4 w-4 text-emerald-500" /> Ativar
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </form>

                {/* Gestão de Reservas Recebidas */}
                <section className="space-y-5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-xs lg:col-span-7">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
                    <div className="flex items-center gap-2.5">
                      <CalendarDays className="h-6 w-6 text-[#397B68]" />
                      <div>
                        <h2 className="font-sans text-xl font-bold sm:text-2xl">
                          Reservas &amp; Adesões Recebidas ({tenantReservations.length})
                        </h2>
                        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                          Confirme solicitações ou acompanhe os clientes esperados na casa.
                        </p>
                      </div>
                    </div>
                  </div>

                  {tenantReservations.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-[var(--border-hairline)] p-10 text-center">
                      <CalendarDays className="mx-auto h-10 w-10 text-[var(--text-secondary)] opacity-60" />
                      <p className="mt-3 text-base font-bold text-[var(--text-primary)]">
                        Nenhuma reserva recebida ainda
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Assim que um cliente reservar ou aderir a uma oferta de {activeTenant.name}, ela aparecerá aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tenantReservations.map((res) => {
                        const stage = getEffectiveStage(res);
                        const meta = STAGE_BADGE[stage];
                        const isPendingDemand =
                          res.modality === 'DEMAND_OFFER' && stage === 'REQUESTED';
                        const isClosed =
                          stage === 'CANCELLED' ||
                          stage === 'NO_SHOW' ||
                          stage === 'ENDED_WITHOUT_GOAL';

                        return (
                          <div
                            key={res.id}
                            className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5 sm:p-6"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${meta.cls}`}>
                                    {meta.label}
                                  </span>
                                  {res.visit_proof_level && (
                                    <span className="rounded-full bg-[#397B68]/15 px-3 py-1 text-xs font-bold text-[#397B68]">
                                      Check-in Validado
                                    </span>
                                  )}
                                </div>
                                <p className="pt-1 text-lg font-bold text-[var(--text-primary)]">
                                  {res.offering_title || res.experience_name}
                                </p>
                                <p className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                                  <Clock className="h-4 w-4 text-[#FF6B35]" />
                                  <strong>{res.date}</strong> às <strong>{res.time}</strong> ·{' '}
                                  <strong>{res.guests} pessoa(s)</strong>
                                </p>
                                {res.snapshot_terms?.price_summary && (
                                  <p className="text-sm text-[var(--text-secondary)]">
                                    Condição: <strong>{res.snapshot_terms.price_summary}</strong>
                                  </p>
                                )}
                              </div>

                              {!isClosed && (
                                <div className="flex flex-wrap gap-2">
                                  {stage === 'REQUESTED' && !isPendingDemand && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        partnerConfirmSingleReservation(res.id);
                                        setOpFeedback({
                                          ok: true,
                                          msg: `Reserva de ${res.guests} pessoa(s) confirmada com sucesso!`,
                                        });
                                        bumpStore(true);
                                      }}
                                      className="rounded-xl bg-[#397B68] px-4 py-2.5 text-sm font-bold text-white shadow-xs hover:opacity-95"
                                    >
                                      Confirmar Reserva
                                    </button>
                                  )}
                                  {(stage === 'REQUESTED' || stage === 'CONFIRMED') && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          markReservationNoShow(res.id);
                                          setOpFeedback({
                                            ok: true,
                                            msg: 'Marcada como Não Compareceu (R$ 0,00 de cobrança).',
                                          });
                                          bumpStore(true);
                                        }}
                                        className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-sm font-bold text-amber-700 dark:text-amber-300"
                                      >
                                        Não Compareceu
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          cancelReservation(res.id);
                                          setOpFeedback({
                                            ok: true,
                                            msg: 'Reserva cancelada sem cobrança.',
                                          });
                                          bumpStore(true);
                                        }}
                                        className="rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2 text-sm font-bold text-red-600 dark:text-red-300"
                                      >
                                        Cancelar
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 2: OFERTA ÚNICA COM DUAS MODALIDADES DE DISTRIBUIÇÃO (INDIVIDUAL OU MISSÃO COLETIVA PROGRESSIVA) */}
            {activeTab === 'offers' && (
              <div className="grid gap-8 lg:grid-cols-12">
                <form
                  onSubmit={handleCreateIndividualOrLastMinute}
                  className="space-y-5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-xs lg:col-span-5"
                >
                  <div className="space-y-1.5">
                    <span className="inline-block rounded-full bg-[#FF6B35]/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                      Uma Oferta · Duas Modalidades
                    </span>
                    <div className="flex items-center gap-2.5">
                      <Gift className="h-6 w-6 text-[#FF6B35]" />
                      <h2 className="font-sans text-xl font-bold sm:text-2xl">
                        Criar Nova Oferta
                      </h2>
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                      Cadastre sua oferta uma única vez e escolha como deseja distribuí-la aos clientes.
                    </p>
                  </div>

                  {/* Seletor de Modalidade de Distribuição: Modalidade A vs Modalidade B */}
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-[var(--text-primary)]">
                      Como deseja distribuir esta oferta?
                    </label>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setOffDistributionMode('INDIVIDUAL')}
                        className={`rounded-2xl border p-4 text-left transition ${
                          offDistributionMode === 'INDIVIDUAL'
                            ? 'border-[#FF6B35] bg-[#FF6B35]/10 text-[#FF6B35]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className="block text-sm font-extrabold">Oferta Individual</span>
                        <span className="mt-1 block text-xs leading-relaxed opacity-90">
                          Benefício direto por pessoa, sem metas coletivas.
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setOffDistributionMode('COLLECTIVE_MISSION')}
                        className={`rounded-2xl border p-4 text-left transition ${
                          offDistributionMode === 'COLLECTIVE_MISSION'
                            ? 'border-[#123B56] bg-[#123B56]/10 text-[#123B56] dark:border-[#8DC4EA] dark:text-[#8DC4EA]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <span className="block text-sm font-extrabold">Missão Coletiva</span>
                        <span className="mt-1 block text-xs leading-relaxed opacity-90">
                          Benefício inicial garantido + faixas progressivas.
                        </span>
                      </button>
                    </div>
                  </div>

                  {offDistributionMode === 'INDIVIDUAL' && (
                    <div>
                      <label className="block text-sm font-bold text-[var(--text-primary)]">
                        Tipo de janela
                      </label>
                      <select
                        value={offModality}
                        onChange={(e) =>
                          setOffModality(e.target.value as 'INDIVIDUAL_OFFER' | 'LAST_MINUTE')
                        }
                        className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-base"
                      >
                        <option value="INDIVIDUAL_OFFER">
                          Oferta Programada na Semana
                        </option>
                        <option value="LAST_MINUTE">
                          Oportunidade de Última Hora (Hoje)
                        </option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)]">
                      Nome da Oferta
                    </label>
                    <input
                      type="text"
                      required
                      value={offTitle}
                      onChange={(e) => setOffTitle(e.target.value)}
                      placeholder="Ex: Menu executivo em 2 tempos / Quinta de Drinks"
                      className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)]">
                      {offDistributionMode === 'COLLECTIVE_MISSION'
                        ? 'Benefício Inicial Garantido (desde a 1ª pessoa)'
                        : 'Qual é o benefício ou condição especial?'}
                    </label>
                    <input
                      type="text"
                      required
                      value={offBenefit}
                      onChange={(e) => {
                        setOffBenefit(e.target.value);
                        if (offDistributionMode === 'COLLECTIVE_MISSION') {
                          setOffInitialGuaranteedBenefit(e.target.value);
                        }
                      }}
                      placeholder="Ex: Drink de boas-vindas ou Menu especial a R$ 135"
                      className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-base"
                    />
                  </div>

                  {/* Faixas Progressivas da Missão Coletiva (Modalidade B) */}
                  {offDistributionMode === 'COLLECTIVE_MISSION' && (
                    <div className="space-y-4 rounded-2xl border border-[#123B56]/30 bg-[#123B56]/5 p-4 dark:border-[#8DC4EA]/30">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-[#123B56] dark:text-[#8DC4EA]">
                          🎯 Faixas Extras da Missão Coletiva
                        </span>
                        <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                          Uso 100% individual
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                        Conforme mais clientes aderem à oferta no app, novas vantagens são liberadas para todos:
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-[var(--text-primary)]">
                            Faixa 2 · Quantas adesões e qual benefício extra?
                          </label>
                          <div className="mt-1 flex gap-2">
                            <input
                              type="number"
                              min={2}
                              value={offTier2Goal}
                              onChange={(e) => setOffTier2Goal(Number(e.target.value))}
                              className="w-20 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm font-bold"
                              title="Adesões para Faixa 2"
                            />
                            <input
                              type="text"
                              value={offTier2Benefit}
                              onChange={(e) => setOffTier2Benefit(e.target.value)}
                              placeholder="Ex: + Sobremesa cortesia"
                              className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[var(--text-primary)]">
                            Faixa 3 (Máxima) · Quantas adesões e qual benefício completo?
                          </label>
                          <div className="mt-1 flex gap-2">
                            <input
                              type="number"
                              min={3}
                              value={offTier3Goal}
                              onChange={(e) => setOffTier3Goal(Number(e.target.value))}
                              className="w-20 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm font-bold"
                              title="Adesões para Faixa 3"
                            />
                            <input
                              type="text"
                              value={offTier3Benefit}
                              onChange={(e) => setOffTier3Benefit(e.target.value)}
                              placeholder="Ex: + Drink + Sobremesa + 50 RP"
                              className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-bold text-[var(--text-primary)]">
                        Preço normal (R$)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={offBasePrice}
                        onChange={(e) => setOffBasePrice(e.target.value)}
                        className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[var(--text-primary)]">
                        Preço na oferta (R$)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={offCondPrice}
                        onChange={(e) => setOffCondPrice(e.target.value)}
                        className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-base font-bold text-emerald-700 dark:text-emerald-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)]">
                      Dias e horários válidos
                    </label>
                    <input
                      type="text"
                      value={offValidDaysHours}
                      onChange={(e) => setOffValidDaysHours(e.target.value)}
                      placeholder="Ex: Terça a Quinta · 19h às 22h"
                      className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-base"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-[var(--text-primary)]">Data</label>
                      <input
                        type="date"
                        value={offDate}
                        onChange={(e) => setOffDate(e.target.value)}
                        className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[var(--text-primary)]">Horário</label>
                      <input
                        type="text"
                        value={offTime}
                        onChange={(e) => setOffTime(e.target.value)}
                        className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[var(--text-primary)]">Vagas</label>
                      <input
                        type="number"
                        min={1}
                        value={offCapacity}
                        onChange={(e) => setOffCapacity(Number(e.target.value))}
                        className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-3 text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[var(--text-primary)]">
                      Regras simples de utilização
                    </label>
                    <textarea
                      rows={2}
                      value={offRules}
                      onChange={(e) => setOffRules(e.target.value)}
                      className="mt-1.5 w-full rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-sm"
                    />
                  </div>

                  {/* Foto da Oferta */}
                  <div className="space-y-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span className="flex items-center gap-2">
                        <Camera className="h-4 w-4 text-[#FF6B35]" />
                        Foto da Oferta (Opcional)
                      </span>
                      {offImage && (
                        <button
                          type="button"
                          onClick={() => setOffImage('')}
                          className="text-xs font-bold text-red-500 hover:underline"
                        >
                          Remover foto
                        </button>
                      )}
                    </div>

                    {offImage ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-hairline)]">
                        <img
                          src={offImage}
                          alt="Pré-visualização da Oferta"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-hairline)] p-4 transition hover:border-[#FF6B35]/60 hover:bg-[var(--bg-surface)]">
                          <ImagePlus className="h-6 w-6 text-[#FF6B35]" />
                          <span className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">
                            Enviar foto do prato ou ambiente
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleOfferPhotoFile}
                            className="hidden"
                          />
                        </label>
                        <input
                          type="url"
                          value={offImage}
                          onChange={(e) => setOffImage(e.target.value)}
                          placeholder="Ou cole o link de uma foto..."
                          className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Transparência de Cobrança antes da Publicação */}
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                    <p className="font-bold text-emerald-800 dark:text-emerald-300">
                      ✓ Quando você paga:
                    </p>
                    <p className="mt-1 leading-relaxed text-emerald-800/90 dark:text-emerald-200">
                      Apenas <strong>R$ {(currentPlan?.fixed_fee_per_guest_brl ?? 5).toFixed(2).replace('.', ',')}</strong> por cliente que comparecer e validar o QR Code no seu balcão. Acompanhantes sem app e reservas não comparecidas custam <strong>R$ 0,00</strong>.
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      checked={offSaveAsDraft}
                      onChange={(e) => setOffSaveAsDraft(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--border-hairline)]"
                    />
                    Salvar como rascunho para publicar depois
                  </label>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-3.5 text-base font-bold text-white shadow-md transition hover:opacity-95"
                  >
                    {offSaveAsDraft
                      ? 'Salvar Rascunho'
                      : offDistributionMode === 'COLLECTIVE_MISSION'
                        ? 'Publicar Missão Coletiva'
                        : 'Publicar Oferta'}
                  </button>
                </form>

                <section className="space-y-5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-xs lg:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-hairline)] pb-4">
                    <div>
                      <h2 className="font-sans text-xl font-bold sm:text-2xl">
                        Minhas Ofertas ({individualAndLastMinute.length + demandOfferings.length})
                      </h2>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Acompanhe as reservas, adesões e presenças validadas de cada oferta.
                      </p>
                    </div>
                  </div>

                  {individualAndLastMinute.length + demandOfferings.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-[var(--border-hairline)] p-10 text-center">
                      <Gift className="mx-auto h-10 w-10 text-[#FF6B35] opacity-70" />
                      <p className="mt-3 text-base font-bold text-[var(--text-primary)]">
                        Nenhuma oferta criada ainda
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Preencha o formulário ao lado para publicar sua primeira oferta e começar a receber clientes.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[...individualAndLastMinute, ...demandOfferings].map((off) => {
                        const isCancelled = off.status === 'CANCELLED';
                        const isDraft = off.status === 'DRAFT';
                        const isCollective =
                          off.distribution_mode === 'COLLECTIVE_MISSION' ||
                          off.modality === 'DEMAND_OFFER';
                        const progInfo = isCollective ? computeActiveProgressiveTier(off) : null;

                        const linkedBookingsCount = tenantReservations.filter(
                          (r) =>
                            r.offering_id === off.id &&
                            getEffectiveStage(r) !== 'CANCELLED' &&
                            getEffectiveStage(r) !== 'ENDED_WITHOUT_GOAL'
                        ).length;
                        const attendedCount = tenantFeeLedger
                          .filter(
                            (f) =>
                              tenantReservations.some(
                                (r) => r.id === f.booking_id && r.offering_id === off.id
                              ) &&
                              (f.status === 'ACCRUED' || f.status === 'INVOICED')
                          )
                          .reduce((acc, f) => acc + f.attended_guests, 0);

                        return (
                          <div
                            key={off.id}
                            className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-6 transition hover:border-[#FF6B35]/40"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                                      isCollective
                                        ? 'bg-[#123B56]/15 text-[#123B56] dark:text-[#8DC4EA]'
                                        : 'bg-[#FF6B35]/15 text-[#FF6B35]'
                                    }`}
                                  >
                                    {isCollective
                                      ? '🎯 Missão Coletiva Progressiva'
                                      : 'Oferta Individual'}
                                  </span>
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                                      isCancelled
                                        ? 'bg-red-500/15 text-red-600 dark:text-red-300'
                                        : isDraft
                                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                          : off.partner_managed_active
                                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-zinc-500/15 text-zinc-500'
                                    }`}
                                  >
                                    {isCancelled
                                      ? 'Encerrada'
                                      : isDraft
                                        ? 'Rascunho (Aguardando Publicação)'
                                        : off.partner_managed_active
                                          ? 'Ativa no App'
                                          : 'Pausada'}
                                  </span>
                                </div>

                                {off.image_url && (
                                  <div className="mt-3 aspect-video w-full max-h-44 overflow-hidden rounded-2xl border border-[var(--border-hairline)]">
                                    <img
                                      src={off.image_url}
                                      alt={off.title}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                )}

                                <h3 className="pt-1 text-lg font-bold text-[var(--text-primary)] sm:text-xl">
                                  {off.title}
                                </h3>
                                <p className="text-sm sm:text-base font-medium text-[var(--text-secondary)]">
                                  {off.benefit_summary}
                                </p>
                                <p className="text-sm text-[var(--text-secondary)]">
                                  Horário: <strong>{off.valid_days_hours || `${off.service_date} às ${off.time_slot_label}`}</strong> · Vagas: <strong>{off.reserved_count}/{off.capacity_total}</strong>
                                </p>

                                {progInfo && (
                                  <div className="mt-3 rounded-2xl border border-[#123B56]/25 bg-[#123B56]/5 p-4">
                                    <p className="text-sm font-bold text-[#123B56] dark:text-[#8DC4EA]">
                                      Benefício Garantido Ativo: {progInfo.initialGuaranteedBenefit}
                                    </p>
                                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                      Adesões confirmadas: <strong>{progInfo.currentAdhesions}</strong>
                                      {progInfo.nextTier
                                        ? ` · Próxima faixa (${progInfo.nextTier.min_adhesions} adesões): ${progInfo.nextTier.benefit_label}`
                                        : ' · Faixa máxima desbloqueada!'}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {!isCancelled && (
                                <div className="flex flex-wrap gap-2">
                                  {isDraft ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const res = updatePartnerOffering(off.id, {
                                          status: 'PUBLISHED',
                                          partner_managed_active: true,
                                        });
                                        setOpFeedback({
                                          ok: res.ok,
                                          msg: 'Oferta aprovada e publicada no BoraRio!',
                                        });
                                        bumpStore();
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-xs"
                                    >
                                      Aprovar &amp; Publicar
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleOffering(off)}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm font-bold hover:border-[#FF6B35]"
                                    >
                                      {off.partner_managed_active ? 'Pausar' : 'Reativar'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingOfferingId(off.id);
                                      setEditBenefitDraft(off.benefit_summary);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm font-bold hover:border-[#FF6B35]"
                                  >
                                    <Edit3 className="h-4 w-4" /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCloseOffering(off)}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2 text-sm font-bold text-red-600 dark:text-red-300"
                                  >
                                    Encerrar
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* 3 Indicadores Claros da Oferta */}
                            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--border-hairline)] pt-4 text-center">
                              <div className="rounded-2xl bg-[var(--bg-surface)] p-3">
                                <span className="block text-xs font-semibold text-[var(--text-secondary)]">
                                  Visualizações
                                </span>
                                <span className="mt-0.5 block text-lg font-extrabold text-[var(--text-primary)]">
                                  {off.views_count || 0}
                                </span>
                              </div>
                              <div className="rounded-2xl bg-[var(--bg-surface)] p-3">
                                <span className="block text-xs font-semibold text-[var(--text-secondary)]">
                                  Reservas / Adesões
                                </span>
                                <span className="mt-0.5 block text-lg font-extrabold text-[#123B56] dark:text-[#8DC4EA]">
                                  {Math.max(off.valid_adhesions_count ?? off.reserved_count, linkedBookingsCount)}
                                </span>
                              </div>
                              <div className="rounded-2xl bg-emerald-500/10 p-3">
                                <span className="block text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                  Clientes Validados
                                </span>
                                <span className="mt-0.5 block text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
                                  {attendedCount}
                                </span>
                              </div>
                            </div>

                            {editingOfferingId === off.id && (
                              <div className="mt-4 flex flex-wrap gap-2.5 border-t border-[var(--border-hairline)] pt-4">
                                <input
                                  type="text"
                                  value={editBenefitDraft}
                                  onChange={(e) => setEditBenefitDraft(e.target.value)}
                                  className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-2.5 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveOfferingTermEdit(off.id)}
                                  className="rounded-xl bg-[#123B56] px-4 py-2.5 text-sm font-bold text-white"
                                >
                                  Salvar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingOfferingId(null)}
                                  className="rounded-xl border border-[var(--border-hairline)] px-4 py-2.5 text-sm font-semibold"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 3: RESERVA INTELIGENTE POR DEMANDA */}
            {activeTab === 'demand' && (
              <div className="grid gap-6 lg:grid-cols-3">
                <form
                  onSubmit={handleCreateDemandOffer}
                  className="space-y-3 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#FF6B35]" />
                    <h2 className="font-sans text-lg font-bold">
                      Criar Reserva Inteligente por Demanda
                    </h2>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                    Agregue manifestações de interesse individuais para a mesma data e horário. Os clientes não dividem mesa e nenhuma solicitação é confirmada antes de atingir a meta e receber sua confirmação.
                  </p>

                  <div>
                    <label className="text-xs font-bold">Experiência / Menu</label>
                    <input
                      type="text"
                      required
                      value={demTitle}
                      onChange={(e) => setDemTitle(e.target.value)}
                      placeholder="Ex: Jantar Degustação Quinta-feira"
                      className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold">Condição ao atingir a meta</label>
                    <input
                      type="text"
                      required
                      value={demBenefit}
                      onChange={(e) => setDemBenefit(e.target.value)}
                      placeholder="Ex: Menu em 3 tempos a R$ 210 + taça de boas-vindas"
                      className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold">Meta mínima (pessoas)</label>
                      <input
                        type="number"
                        min={2}
                        value={demGoal}
                        onChange={(e) => setDemGoal(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold">Capacidade máxima</label>
                      <input
                        type="number"
                        min={2}
                        value={demCapacity}
                        onChange={(e) => setDemCapacity(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold">Preço regular (R$)</label>
                      <input
                        type="number"
                        min={0}
                        value={demBasePrice}
                        onChange={(e) => setDemBasePrice(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold">Preço condição (R$)</label>
                      <input
                        type="number"
                        min={0}
                        value={demCondPrice}
                        onChange={(e) => setDemCondPrice(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold">Data da janela</label>
                      <input
                        type="date"
                        value={demDate}
                        onChange={(e) => setDemDate(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold">Horário</label>
                      <input
                        type="text"
                        value={demTime}
                        onChange={(e) => setDemTime(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-[#FF6B35] py-2.5 text-xs font-bold text-white hover:bg-[#e8634c]"
                  >
                    Publicar Demanda Agregada
                  </button>
                </form>

                <section className="space-y-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-2">
                  <h2 className="font-sans text-lg font-bold">
                    Demanda Consolidada &amp; Confirmação Pós-Meta ({demandOfferings.length})
                  </h2>

                  {demandOfferings.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-6 text-center text-xs text-[var(--text-secondary)]">
                      Nenhuma janela por demanda configurada para {activeTenant.name}. Crie uma ao lado caso deseje preencher dias ou horários estratégicos.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {demandOfferings.map((off) => {
                        const goal = off.min_demand_goal || 10;
                        const pct = Math.min(100, Math.round((off.reserved_count / goal) * 100));
                        const parts = getDemandParticipations(off.id);
                        const linkedRequests = tenantReservations.filter((r) => r.offering_id === off.id);
                        const attendedCount = linkedRequests.filter((r) => {
                          const st = getEffectiveStage(r);
                          return (
                            st === 'CHECKED_IN' ||
                            st === 'VERIFIED_VISIT' ||
                            st === 'VERIFIED_CONSUMPTION'
                          );
                        }).length;
                        const isEnded =
                          off.status === 'ENDED_WITHOUT_GOAL' || off.status === 'CANCELLED';

                        return (
                          <div
                            key={off.id}
                            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 text-xs"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-[#FF6B35]/15 px-2.5 py-0.5 text-xs font-bold text-[#FF6B35]">
                                    {off.status}
                                  </span>
                                  <span className="text-xs text-[var(--text-secondary)]">
                                    {off.service_date} às {off.time_slot_label}
                                  </span>
                                </div>
                                <h3 className="mt-1 text-sm font-bold">{off.title}</h3>
                                <p className="text-xs text-[var(--text-secondary)]">
                                  {off.benefit_summary}
                                </p>
                              </div>

                              {!isEnded && off.status !== 'CONFIRMED' && (
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const res = partnerConfirmDemandOffering(off.id);
                                      setOpFeedback({ ok: res.ok, msg: res.message });
                                      bumpStore(true);
                                    }}
                                    className="rounded-xl bg-[#397B68] px-3 py-1.5 text-xs font-bold text-white hover:opacity-95"
                                  >
                                    Confirmar Demanda e Condições
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const res = partnerEndDemandWithoutGoal(off.id);
                                      setOpFeedback({ ok: res.ok, msg: res.message });
                                      bumpStore(true);
                                    }}
                                    className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-300"
                                  >
                                    Encerrar Sem Meta
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="mt-3">
                              <div className="mb-1 flex justify-between text-xs">
                                <span>
                                  <strong>{off.reserved_count}</strong>/{goal} lugares manifestados (capacidade {off.capacity_total})
                                </span>
                                <span className="font-bold text-[#FF6B35]">{pct}% da meta</span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E]"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-hairline)] pt-2.5 text-xs text-[var(--text-secondary)]">
                              <span>
                                Solicitações individuais independentes registradas:{' '}
                                <strong>{Math.max(parts.length, linkedRequests.length)}</strong>
                              </span>
                              <span className="flex items-center gap-3">
                                <span className="inline-flex items-center gap-1">
                                  <Eye className="h-3.5 w-3.5 text-[#123B56] dark:text-[#8DC4EA]" />
                                  Visualizações: <strong>{off.views_count || 0}</strong>
                                </span>
                                <span>
                                  Comparecimentos: <strong>{attendedCount}</strong>
                                </span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 4: CONDIÇÃO 2 — MINHA RECOMPENSA BORARIO (COMISSÃO ZERO) */}
            {activeTab === 'rewards' && (
              <div className="space-y-6">
                {/* Banner de Regra Econômica Permanente: 0% de comissão */}
                <section className="rounded-3xl border border-[#397B68]/35 bg-gradient-to-r from-[#397B68]/12 via-[#123B56]/8 to-[#FF6B35]/10 p-6">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div className="max-w-3xl space-y-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#397B68] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Economia de Recompensas (Comissão 0%)
                      </span>
                      <p className="text-sm font-semibold leading-relaxed text-[var(--text-primary)]">
                        {REWARDS_ZERO_COMMISSION_PARTNER_COPY}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Percentual de comissão sobre resgates em Rio Points: <strong>0% (R$ 0,00)</strong>. Nunca há cobrança no extrato contratual pelo uso de recompensas.
                      </p>
                    </div>

                    {loyaltyEconomics && (
                      <div className="grid shrink-0 grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-center">
                          <span className="block text-[11px] text-[var(--text-secondary)]">Ativas</span>
                          <strong className="text-sm font-black text-[var(--text-primary)]">
                            {loyaltyEconomics.active_rewards_count}/{loyaltyEconomics.registered_rewards_count}
                          </strong>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-center">
                          <span className="block text-[11px] text-[var(--text-secondary)]">Vouchers Validados</span>
                          <strong className="text-sm font-black text-[#397B68] dark:text-[#4CA188]">
                            {loyaltyEconomics.vouchers_used_count}/{loyaltyEconomics.vouchers_issued_count}
                          </strong>
                        </div>
                        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-center">
                          <span className="block text-[11px] text-[var(--text-secondary)]">Custo Real Estimado</span>
                          <strong className="text-sm font-black text-[#FF6B35]">
                            R$ {loyaltyEconomics.total_estimated_cost_brl.toFixed(2)}
                          </strong>
                        </div>
                        <div className="rounded-2xl border border-[#397B68]/35 bg-[#397B68]/10 px-3 py-2 text-center">
                          <span className="block text-[11px] text-[#397B68] dark:text-[#4CA188]">Comissão BoraRio</span>
                          <strong className="text-sm font-black text-[#397B68] dark:text-[#4CA188]">R$ 0,00 (0%)</strong>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Formulário: Publicar Recompensa BoraRio */}
                  <form
                    onSubmit={handleCreateReward}
                    className="space-y-3 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6"
                  >
                    <div className="flex items-center gap-2">
                      <Ticket className="h-5 w-5 text-[#FF6B35]" />
                      <h2 className="font-sans text-lg font-bold">
                        Publicar Recompensa BoraRio
                      </h2>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Ofereça benefícios para atrair novos clientes da rede com <strong>0% de comissão</strong> sobre resgates.
                    </p>

                    <div>
                      <label className="text-xs font-bold">Título da recompensa</label>
                      <input
                        type="text"
                        required
                        value={rewTitle}
                        onChange={(e) => setRewTitle(e.target.value)}
                        placeholder="Ex: Tiramisù da Casa ou Drink Autoral"
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold">Produto / serviço elegível</label>
                      <input
                        type="text"
                        required
                        value={rewEligibleItem}
                        onChange={(e) => setRewEligibleItem(e.target.value)}
                        placeholder="Ex: 1 Tiramisù Tradicional ou 1 Chopp 350ml"
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold">Segmento (6 Pilares)</label>
                        <select
                          value={rewSegment}
                          onChange={(e) => setRewSegment(e.target.value as RewardSegment)}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-semibold"
                        >
                          <option value="Gastronomia">Gastronomia</option>
                          <option value="Bares & Noite">Bares &amp; Noite</option>
                          <option value="Passeios & Turismo">Passeios &amp; Turismo</option>
                          <option value="Hospedagem">Hospedagem</option>
                          <option value="Bem-estar">Bem-estar</option>
                          <option value="Cultura & Entretenimento">Cultura &amp; Entretenimento</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold">Tipo de benefício</label>
                        <select
                          value={rewType}
                          onChange={(e) => setRewType(e.target.value as RewardType)}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-semibold"
                        >
                          <option value="SOBREMESA">Sobremesa</option>
                          <option value="ENTRADA">Entrada</option>
                          <option value="BEBIDA_NAO_ALCOOLICA">Bebida / Chopp</option>
                          <option value="PASSEIO">Passeio / Tour</option>
                          <option value="UPGRADE_HOTEL">Hospedagem / Day Use</option>
                          <option value="SERVICO_BEM_ESTAR">Bem-estar / Massagem</option>
                          <option value="INGRESSO">Ingresso / Museu</option>
                          <option value="EXPERIENCIA">Experiência especial</option>
                        </select>
                      </div>
                    </div>

                    {/* Preço de Referência & Custo Estimado & Consumo Mínimo */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-[var(--text-primary)]">
                          Preço Ref. (R$)
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={0.5}
                          value={rewRefPrice}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setRewRefPrice(val);
                            setRewCost(Math.round(val * 100));
                            setRewEstCost(Number((val * 0.3).toFixed(2)));
                          }}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[var(--text-primary)]">
                          Custo Real (R$)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={rewEstCost}
                          onChange={(e) => setRewEstCost(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[var(--text-primary)]">
                          Consumo Mín. (R$)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={5}
                          value={rewMinConsumption}
                          onChange={(e) => setRewMinConsumption(Number(e.target.value))}
                          placeholder="0 = Livre"
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-2 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold">Custo em Pontos</label>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            100 RP = R$ 1
                          </span>
                        </div>
                        <input
                          type="number"
                          min={500}
                          max={2500}
                          step={50}
                          value={rewCost}
                          onChange={(e) => setRewCost(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-extrabold text-[#FF6B35]"
                        />
                        <span className="mt-0.5 block text-[10px] text-[var(--text-secondary)]">
                          Equivale a R$ {(rewCost / 100).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <label className="text-xs font-bold">Estoque de Recompensas</label>
                        <input
                          type="number"
                          min={1}
                          value={rewQty}
                          onChange={(e) => setRewQty(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-bold"
                        />
                        <span className="mt-0.5 block text-[10px] text-[var(--text-secondary)]">
                          Capacidade total desta oferta
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold">Limite por usuário</label>
                        <input
                          type="number"
                          min={1}
                          value={rewMaxPerUser}
                          onChange={(e) => setRewMaxPerUser(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold">Validade voucher (dias)</label>
                        <input
                          type="number"
                          min={1}
                          value={rewValidityDays}
                          onChange={(e) => setRewValidityDays(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold">Datas e horários de uso</label>
                      <input
                        type="text"
                        value={rewValidDaysHours}
                        onChange={(e) => setRewValidDaysHours(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold">Regras de resgate</label>
                      <textarea
                        rows={2}
                        value={rewRules}
                        onChange={(e) => setRewRules(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold">Restrições e condições</label>
                      <input
                        type="text"
                        value={rewRestrictions}
                        onChange={(e) => setRewRestrictions(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-2.5 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-95 transition"
                    >
                      Publicar Recompensa BoraRio (0% Comissão)
                    </button>
                  </form>

                  {/* Coluna direita: Validador de Voucher + Recompensas + Vouchers */}
                  <div className="space-y-6 lg:col-span-2">
                    {/* Validador Presencial de Voucher no Balcão */}
                    <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#397B68]">
                          <Award className="h-4 w-4" />
                          Validar Voucher no Balcão (ISSUED → USED)
                        </div>
                        <span className="rounded-full bg-[#397B68]/15 px-2.5 py-0.5 text-xs font-bold text-[#397B68] dark:text-[#4CA188]">
                          Comissão por validação: R$ 0,00
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Informe o código único (<code className="font-mono">BR-REW-...</code>) apresentado pelo cliente. Vouchers já emitidos antes de pausa ou encerramento da recompensa continuam válidos para atendimento presencial.
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={voucherCodeInput}
                          onChange={(e) => setVoucherCodeInput(e.target.value)}
                          placeholder="Ex: BR-REW-XXXXXX"
                          className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-mono text-xs uppercase text-[var(--text-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() => handleValidateRewardVoucher()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#397B68] px-4 py-2 text-xs font-bold text-white hover:opacity-95"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Validar Voucher no Balcão
                        </button>
                      </div>

                      {tenantVouchers.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-[var(--border-hairline)] pt-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                            Vouchers deste estabelecimento ({tenantVouchers.length})
                          </p>
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {tenantVouchers.map((v) => (
                              <div
                                key={v.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs"
                              >
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono font-extrabold text-[#FF6B35]">
                                      {v.voucher_code}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                        v.status === 'USED'
                                          ? 'bg-[#397B68]/20 text-[#397B68] dark:text-[#4CA188]'
                                          : v.status === 'CANCELLED' || v.status === 'EXPIRED'
                                            ? 'bg-red-500/15 text-red-600 dark:text-red-300'
                                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      }`}
                                    >
                                      {v.status}
                                    </span>
                                    <span className="text-xs text-[var(--text-secondary)]">
                                      Comissão: R$ 0,00
                                    </span>
                                  </div>
                                  <p className="mt-0.5 font-semibold text-[var(--text-primary)]">
                                    {v.snapshot_rules.title} — {v.snapshot_rules.eligible_item}
                                  </p>
                                  <p className="text-xs text-[var(--text-secondary)]">
                                    Resgatado com {v.points_spent} RP · Expira em{' '}
                                    {new Date(v.expires_at).toLocaleDateString('pt-BR')}
                                  </p>
                                </div>

                                {v.status === 'ISSUED' && (
                                  <button
                                    type="button"
                                    onClick={() => handleValidateRewardVoucher(v.voucher_code)}
                                    className="rounded-lg bg-[#397B68] px-3 py-1.5 text-xs font-bold text-white"
                                  >
                                    Validar agora
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>

                    {/* Lista de Recompensas do Parceiro */}
                    <section className="space-y-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-sans text-lg font-bold">
                          Minhas Recompensas Cadastradas ({tenantRewards.length})
                        </h2>
                        <span className="text-xs text-[var(--text-secondary)]">
                          Pausar ou encerrar bloqueia novos resgates preservando vouchers já emitidos.
                        </span>
                      </div>

                      {tenantRewards.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-6 text-center text-xs text-[var(--text-secondary)]">
                          Nenhuma recompensa publicada ainda para {activeTenant.name}. Crie sua Recompensa BoraRio ao lado com comissão zero.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {tenantRewards.map((rew) => (
                            <div
                              key={rew.id}
                              className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 text-xs"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                        rew.status === 'AVAILABLE'
                                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                          : rew.status === 'PAUSED'
                                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                            : 'bg-red-500/15 text-red-600 dark:text-red-300'
                                      }`}
                                    >
                                      {rew.status}
                                    </span>
                                    <span className="rounded-full bg-[#123B56]/12 px-2.5 py-0.5 text-xs font-bold text-[#123B56] dark:bg-[#123B56]/40 dark:text-[#8DC4EA]">
                                      {rew.segment_category}
                                    </span>
                                    <span className="font-extrabold text-[#FF6B35]">
                                      {rew.points_cost} RP
                                    </span>
                                    <span className="rounded-md bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                                      Ref: R$ {(rew.reference_price_brl ?? rew.points_cost / 100).toFixed(2)}
                                    </span>
                                  </div>
                                  <h3 className="mt-1.5 text-sm font-bold text-[var(--text-primary)]">
                                    {rew.title}
                                  </h3>
                                  <p className="text-xs text-[var(--text-secondary)]">
                                    Item: <strong>{rew.eligible_item}</strong> · Estoque:{' '}
                                    <strong>
                                      {rew.quantity_available}/{rew.quantity_total}
                                    </strong>{' '}
                                    · {rew.valid_days_hours}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)]">
                                    <span>
                                      Custo real estimado:{' '}
                                      <strong className="text-stone-700 dark:text-stone-300">
                                        R$ {(rew.estimated_cost_brl ?? 0).toFixed(2)}
                                      </strong>
                                    </span>
                                    <span>·</span>
                                    <span>
                                      Consumo mínimo:{' '}
                                      <strong className="text-stone-700 dark:text-stone-300">
                                        {rew.min_consumption_brl ? `R$ ${rew.min_consumption_brl.toFixed(2)}` : 'Livre'}
                                      </strong>
                                    </span>
                                    <span>·</span>
                                    <span>Limite: {rew.max_per_user}x por usuário</span>
                                    <span>·</span>
                                    <span className="text-[#397B68] font-bold">Comissão: R$ 0,00</span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditReward(rew)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-bold"
                                  >
                                    <Edit3 className="h-3 w-3" /> Editar
                                  </button>

                                  {rew.status !== 'CLOSED' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSetRewardStatus(
                                            rew.id,
                                            rew.status === 'PAUSED' ? 'AVAILABLE' : 'PAUSED'
                                          )
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-bold"
                                      >
                                        {rew.status === 'PAUSED' ? (
                                          <>
                                            <PlayCircle className="h-3.5 w-3.5 text-emerald-500" /> Reativar
                                          </>
                                        ) : (
                                          <>
                                            <PauseCircle className="h-3.5 w-3.5 text-amber-500" /> Pausar
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSetRewardStatus(rew.id, 'CLOSED')}
                                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/35 bg-red-500/10 px-2.5 py-1.5 text-xs font-bold text-red-600 dark:text-red-300"
                                      >
                                        <XCircle className="h-3.5 w-3.5" /> Encerrar
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {editingRewardId === rew.id && (
                                <div className="mt-3 space-y-2.5 border-t border-[var(--border-hairline)] pt-3">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div>
                                      <label className="text-[10px] font-bold text-[var(--text-secondary)]">Título</label>
                                      <input
                                        type="text"
                                        value={editRewTitle}
                                        onChange={(e) => setEditRewTitle(e.target.value)}
                                        placeholder="Título da recompensa"
                                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-[var(--text-secondary)]">Item elegível</label>
                                      <input
                                        type="text"
                                        value={editRewItem}
                                        onChange={(e) => setEditRewItem(e.target.value)}
                                        placeholder="Item elegível"
                                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
                                    <div>
                                      <label className="text-[10px] font-bold text-[var(--text-secondary)]">Preço Ref. (R$)</label>
                                      <input
                                        type="number"
                                        min={1}
                                        step={0.5}
                                        value={editRewRefPrice}
                                        onChange={(e) => {
                                          const v = Math.max(0, Number(e.target.value));
                                          setEditRewRefPrice(v);
                                          setEditRewCost(Math.round(v * 100));
                                        }}
                                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-bold"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-[var(--text-secondary)]">Custo Real (R$)</label>
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.5}
                                        value={editRewEstCost}
                                        onChange={(e) => setEditRewEstCost(Number(e.target.value))}
                                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-[var(--text-secondary)]">Consumo Mín. (R$)</label>
                                      <input
                                        type="number"
                                        min={0}
                                        step={5}
                                        value={editRewMinConsumption}
                                        onChange={(e) => setEditRewMinConsumption(Number(e.target.value))}
                                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-[var(--text-secondary)]">Custo em Pontos</label>
                                      <input
                                        type="number"
                                        min={500}
                                        max={2500}
                                        step={50}
                                        value={editRewCost}
                                        onChange={(e) => setEditRewCost(Number(e.target.value))}
                                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-black text-[#FF6B35]"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div>
                                      <label className="text-[10px] font-bold text-[var(--text-secondary)]">Estoque total</label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={editRewQty}
                                        onChange={(e) => setEditRewQty(Number(e.target.value))}
                                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-[var(--text-secondary)]">Horários de uso</label>
                                      <input
                                        type="text"
                                        value={editRewHours}
                                        onChange={(e) => setEditRewHours(e.target.value)}
                                        placeholder="Ex: Terça a Quinta · 12h às 22h"
                                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEditReward(rew.id)}
                                      className="rounded-lg bg-[#123B56] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#102F46]"
                                    >
                                      Salvar alteração
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingRewardId(null)}
                                      className="rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </div>

                {/* 3. RELATÓRIO DE AUDITORIA & UTILIZAÇÃO DE RECOMPENSAS */}
                {loyaltyEconomics && (
                  <section className="space-y-5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-[var(--border-hairline)] pb-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                          <ShieldCheck className="h-4 w-4" />
                          Auditoria de Resgates, Passivo &amp; Utilização
                        </div>
                        <h2 className="mt-1 font-sans text-lg font-bold text-[var(--text-primary)]">
                          Relatório de Auditoria da Economia Rio Points
                        </h2>
                        <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                          Auditoria do passivo de pontos, custo real das recompensas e velocidade de acúmulo da sua casa.
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-2xl bg-[#397B68]/15 border border-[#397B68]/30 px-3.5 py-1.5 text-xs font-bold text-[#397B68] dark:text-[#4CA188]">
                        <CheckCircle2 className="h-4 w-4" />
                        Auditoria Antifraude Ativa
                      </div>
                    </div>

                    {/* 4 Blocos da Auditoria */}
                    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                      {/* Velocidade de Acúmulo */}
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 text-xs">
                        <span className="block text-[11px] font-bold uppercase text-[var(--text-secondary)]">
                          Velocidade de Acúmulo
                        </span>
                        <p className="mt-1 font-sans text-xl font-black text-[#FF6B35]">
                          +250 RP / visita
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                          Usuário acumula 1 recompensa (500 a 2.500 RP) a cada <strong>2 a 10 visitas</strong> individuais verificadas.
                        </p>
                      </div>

                      {/* Custo Real Incorrido */}
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 text-xs">
                        <span className="block text-[11px] font-bold uppercase text-[var(--text-secondary)]">
                          Custo Real Absorvido
                        </span>
                        <p className="mt-1 font-sans text-xl font-black text-stone-800 dark:text-stone-200">
                          R$ {loyaltyEconomics.total_estimated_cost_brl.toFixed(2)}
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                          CMV estimado de 30% sobre <strong>R$ {loyaltyEconomics.total_reference_value_brl.toFixed(2)}</strong> em valor de referência entregue.
                        </p>
                      </div>

                      {/* Passivo & Regra de Expiração */}
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 text-xs">
                        <span className="block text-[11px] font-bold uppercase text-[var(--text-secondary)]">
                          Passivo &amp; Expiração
                        </span>
                        <p className="mt-1 font-sans text-xl font-black text-amber-600 dark:text-amber-400">
                          12 Meses
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                          Expiração auditada a cada 12 meses. Pontos não utilizados presencialmente prescrevem, protegendo a rede.
                        </p>
                      </div>

                      {/* Retorno Comercial Líquido */}
                      <div className="rounded-2xl border border-[#397B68]/30 bg-[#397B68]/10 p-4 text-xs">
                        <span className="block text-[11px] font-bold uppercase text-[#397B68] dark:text-[#4CA188]">
                          Retorno Pós-Resgate
                        </span>
                        <p className="mt-1 font-sans text-xl font-black text-[#397B68] dark:text-[#4CA188]">
                          {loyaltyEconomics.return_visits_post_redemption} visitas
                        </p>
                        <p className="mt-1 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                          Clientes que retornaram à casa. Faturamento indireto: <strong>R$ {loyaltyEconomics.indirect_booking_revenue_brl.toFixed(2)}</strong> (0% comissão).
                        </p>
                      </div>
                    </div>

                    {/* Tabela Auditável de Vouchers Emitidos / Utilizados */}
                    <div className="border-t border-[var(--border-hairline)] pt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-sans text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                          Extrato Auditável de Vouchers ({tenantVouchers.length})
                        </h3>
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          {loyaltyEconomics.vouchers_used_count} validados · {loyaltyEconomics.vouchers_issued_count - loyaltyEconomics.vouchers_used_count} pendentes · {loyaltyEconomics.vouchers_expired_count} expirados
                        </span>
                      </div>

                      {tenantVouchers.length === 0 ? (
                        <p className="mt-3 text-center text-xs text-[var(--text-secondary)] py-4">
                          Nenhum voucher resgatado ou emitido para este estabelecimento até o momento.
                        </p>
                      ) : (
                        <div className="mt-3 max-h-64 overflow-y-auto divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                          {tenantVouchers.map((v) => {
                            const refPrice = v.snapshot_rules.reference_price_brl ?? Number((v.points_spent / 100).toFixed(2));
                            const estCost = v.snapshot_rules.estimated_cost_brl ?? Number((refPrice * 0.3).toFixed(2));
                            return (
                              <div
                                key={v.id}
                                className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-black text-[#FF6B35]">
                                      {v.voucher_code}
                                    </span>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        v.status === 'USED'
                                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                          : v.status === 'ISSUED'
                                            ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                            : 'bg-stone-500/15 text-stone-600 dark:text-stone-300'
                                      }`}
                                    >
                                      {v.status}
                                    </span>
                                    <span className="text-[10px] text-[var(--text-secondary)]">
                                      {new Date(v.issued_at).toLocaleDateString('pt-BR')}
                                    </span>
                                  </div>
                                  <p className="font-bold text-[var(--text-primary)]">
                                    {v.snapshot_rules.title} · <span className="font-normal text-[var(--text-secondary)]">{v.snapshot_rules.eligible_item}</span>
                                  </p>
                                </div>

                                <div className="flex items-center gap-4 text-right">
                                  <div>
                                    <span className="block text-[10px] text-[var(--text-secondary)]">Pontos / Ref</span>
                                    <span className="font-bold text-[var(--text-primary)]">
                                      {v.points_spent} RP <span className="font-normal text-stone-500">(R$ {refPrice.toFixed(2)})</span>
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-[var(--text-secondary)]">Custo Real Casa</span>
                                    <span className="font-bold text-stone-700 dark:text-stone-300">
                                      R$ {estCost.toFixed(2)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="block text-[10px] text-[#397B68] dark:text-[#4CA188]">Comissão</span>
                                    <span className="font-black text-[#397B68] dark:text-[#4CA188]">
                                      R$ 0,00 (0%)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* EVOLUÇÃO FUTURA (OCULTA NO INÍCIO): CAMPANHAS PATROCINADAS */}
            {false && activeTab === 'campaigns' && (
              <div className="space-y-6">
                {/* Resumo de Crédito Comercial de Aquisição */}
                <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      Campanhas Ativas
                    </span>
                    <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                      {tenantCreditSummary.activeCampaignsCount}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      Ofertas com selo "Patrocinado" no topo do BoraRio
                    </p>
                  </div>
                  <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5">
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      Crédito Inicial Gerado (50%)
                    </span>
                    <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-300">
                      R$ {tenantCreditSummary.totalInitialCreditBrl.toFixed(2)}
                    </p>
                    <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-200/80">
                      Metade da mídia vira crédito para abater visitas
                    </p>
                  </div>
                  <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      Crédito Já Utilizado em Visitas
                    </span>
                    <p className="mt-1 text-2xl font-black text-[#123B56] dark:text-[#8DC4EA]">
                      R$ {tenantCreditSummary.totalUsedCreditBrl.toFixed(2)}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      Abatido automaticamente dos check-ins validados
                    </p>
                  </div>
                  <div className="rounded-3xl border border-emerald-500/35 bg-emerald-500/10 p-5">
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      Saldo Disponível para Abater
                    </span>
                    <p className="mt-1 text-2xl font-black text-emerald-700 dark:text-emerald-300">
                      R$ {tenantCreditSummary.totalRemainingCreditBrl.toFixed(2)}
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-800/80 dark:text-emerald-200/80">
                      Cobre até{' '}
                      {Math.floor(
                        tenantCreditSummary.totalRemainingCreditBrl /
                          Math.max(1, currentPlan?.fixed_fee_per_guest_brl ?? 5)
                      )}{' '}
                      participantes validados sem custo adicional
                    </p>
                  </div>
                </section>

                <div className="grid gap-6 lg:grid-cols-3">
                  {/* Formulário para Impulsionar Oferta Existente */}
                  <form
                    onSubmit={handleCreateSponsoredCampaign}
                    className="space-y-3.5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6"
                  >
                    <div className="space-y-1">
                      <span className="inline-block rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        4. Acelerar · Sem Criar Outra Oferta
                      </span>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        <h2 className="font-sans text-lg font-bold">
                          Impulsionar Oferta Existente
                        </h2>
                      </div>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Promova uma oferta que já está cadastrada. Parte do investimento vira <strong>Crédito Comercial de Aquisição</strong> para abater automaticamente a tarifa por participante validado (R$ {(currentPlan?.fixed_fee_per_guest_brl ?? 5).toFixed(2)}).
                    </p>

                    <div>
                      <label className="text-xs font-bold">Selecione a Oferta Existente</label>
                      <select
                        value={
                          campOfferingId ||
                          [...individualAndLastMinute, ...demandOfferings][0]?.id ||
                          ''
                        }
                        onChange={(e) => setCampOfferingId(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      >
                        {[...individualAndLastMinute, ...demandOfferings].length === 0 ? (
                          <option value="">Cadastre sua 1ª oferta primeiro</option>
                        ) : (
                          [...individualAndLastMinute, ...demandOfferings].map((off) => (
                            <option key={off.id} value={off.id}>
                              {off.title} ({off.condition_badge})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold">Nome da Campanha (Opcional)</label>
                      <input
                        type="text"
                        value={campName}
                        onChange={(e) => setCampName(e.target.value)}
                        placeholder="Ex: Destaque Fim de Semana Zona Sul"
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold">Bairros / Região de Destaque</label>
                      <input
                        type="text"
                        value={campNeighborhoods}
                        onChange={(e) => setCampNeighborhoods(e.target.value)}
                        placeholder="Ipanema, Leblon, Botafogo"
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold">Investimento (R$)</label>
                        <input
                          type="number"
                          min={50}
                          step={50}
                          value={campInvestmentBrl}
                          onChange={(e) => setCampInvestmentBrl(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold">Duração (dias)</label>
                        <input
                          type="number"
                          min={3}
                          max={90}
                          value={campDurationDays}
                          onChange={(e) => setCampDurationDays(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                        />
                      </div>
                    </div>

                    {/* Simulador Automático de Crédito de Aquisição */}
                    <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200">
                        <span>Investimento em Mídia:</span>
                        <span>R$ {campInvestmentBrl.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between font-extrabold text-emerald-700 dark:text-emerald-300">
                        <span>Crédito Comercial Gerado ({campConversionPct}%):</span>
                        <span>R$ {((campInvestmentBrl * campConversionPct) / 100).toFixed(2)}</span>
                      </div>
                      <p className="pt-1 text-[11px] text-[var(--text-secondary)]">
                        Equivale a{' '}
                        <strong>
                          {Math.floor(
                            (campInvestmentBrl * campConversionPct) /
                              100 /
                              Math.max(1, currentPlan?.fixed_fee_per_guest_brl ?? 5)
                          )}{' '}
                          visitas faturáveis abatidas
                        </strong>{' '}
                        (a R$ {(currentPlan?.fixed_fee_per_guest_brl ?? 5).toFixed(2)}/participante validado). Validade do crédito: 60 dias.
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-gradient-to-r from-amber-500 via-[#FF6B35] to-[#FF4B2B] py-2.5 text-xs font-bold text-white shadow-sm"
                    >
                      Ativar Impulsionamento &amp; Gerar Crédito
                    </button>
                  </form>

                  {/* Lista de Campanhas Patrocinadas e Extrato de Crédito */}
                  <section className="space-y-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-sans text-lg font-bold">
                        Campanhas Patrocinadas &amp; Saldo de Crédito ({tenantSponsoredCampaigns.length})
                      </h2>
                      <span className="text-xs text-[var(--text-secondary)]">
                        Receita de mídia e passivo de crédito comercial controlados separadamente
                      </span>
                    </div>

                    {tenantSponsoredCampaigns.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-6 text-center text-xs text-[var(--text-secondary)]">
                        Nenhuma campanha patrocinada ativa. Selecione uma oferta existente ao lado para destacar no app e converter 50% em crédito de visitas.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {tenantSponsoredCampaigns.map((camp) => (
                          <div
                            key={camp.id}
                            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 text-xs"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-extrabold text-amber-700 dark:text-amber-300">
                                    ⚡ Patrocinado
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                      camp.status === 'ACTIVE'
                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-zinc-500/15 text-zinc-500'
                                    }`}
                                  >
                                    {camp.status}
                                  </span>
                                  <span className="text-[11px] text-[var(--text-secondary)]">
                                    Expira em {new Date(camp.credits_expire_at).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                                <h3 className="mt-1.5 text-sm font-bold text-[var(--text-primary)]">
                                  {camp.campaign_name}
                                </h3>
                                <p className="text-xs text-[var(--text-secondary)]">
                                  Oferta promovida: <strong>{camp.offering_title}</strong> · Bairros:{' '}
                                  {camp.target_neighborhoods.join(', ')}
                                </p>
                              </div>

                              {camp.status === 'ACTIVE' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPartnerSponsoredCampaignStatus(camp.id, 'PAUSED');
                                    markOfferingAsSponsored(camp.offering_id, camp.id, false);
                                    bumpStore();
                                  }}
                                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-bold"
                                >
                                  Pausar Mídia
                                </button>
                              )}
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--border-hairline)] pt-3 sm:grid-cols-4">
                              <div>
                                <span className="block text-[10px] text-[var(--text-secondary)]">
                                  Investimento Mídia
                                </span>
                                <span className="font-bold">R$ {camp.investment_brl.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-[var(--text-secondary)]">
                                  Crédito Inicial ({camp.credit_conversion_pct}%)
                                </span>
                                <span className="font-bold text-amber-700 dark:text-amber-300">
                                  R$ {camp.initial_acquisition_credit_brl.toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-[var(--text-secondary)]">
                                  Crédito Abatido
                                </span>
                                <span className="font-bold text-[#123B56] dark:text-[#8DC4EA]">
                                  R$ {camp.used_acquisition_credit_brl.toFixed(2)} ({camp.attributed_billable_visits_count} visita(s))
                                </span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-emerald-700 dark:text-emerald-300">
                                  Saldo Restante
                                </span>
                                <span className="font-black text-emerald-700 dark:text-emerald-300">
                                  R$ {camp.remaining_acquisition_credit_brl.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Movimentações do Crédito Comercial */}
                    {tenantCreditLedger.length > 0 && (
                      <div className="border-t border-[var(--border-hairline)] pt-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Histórico Auditável de Uso do Crédito Comercial ({tenantCreditLedger.length})
                        </h3>
                        <div className="mt-2.5 max-h-52 overflow-y-auto divide-y divide-[var(--border-hairline)] rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
                          {tenantCreditLedger.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
                            >
                              <div>
                                <span
                                  className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                    item.entry_type === 'CREDIT_GRANTED'
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      : 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                                  }`}
                                >
                                  {item.entry_type === 'CREDIT_GRANTED'
                                    ? '+ Crédito Gerado'
                                    : '- Abatimento em Visita'}
                                </span>
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {item.description}
                                </span>
                              </div>
                              <div className="text-right">
                                <span
                                  className={`font-black ${
                                    item.amount_brl >= 0
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : 'text-[#123B56] dark:text-[#8DC4EA]'
                                  }`}
                                >
                                  {item.amount_brl >= 0 ? '+' : ''}R$ {item.amount_brl.toFixed(2)}
                                </span>
                                <span className="ml-2 text-[11px] text-[var(--text-secondary)]">
                                  (Saldo: R$ {item.balance_after_brl.toFixed(2)})
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )}

            {/* TAB 4B: AGENDA NOTURNA DA CASA (ENVIO PARA CURADORIA) */}
            {activeTab === 'nightlife' && (
              <div className="grid gap-6 lg:grid-cols-12">
                <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                    <MoonStar className="h-4 w-4" />
                    Agenda Noturna · Submissão do Parceiro
                  </div>
                  <h2 className="mt-1 font-sans text-lg font-bold tracking-tight">
                    Enviar Evento para A Noite Carioca
                  </h2>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Divulgue shows, rodas de samba, festas ou noites especiais em{' '}
                    <strong>{activeTenant.name}</strong>. Todo envio entra obrigatoriamente em fila{' '}
                    <strong>PENDENTE</strong> de curadoria antes de aparecer na Home pública.
                  </p>

                  <form
                    onSubmit={(e) => void handleSubmitPartnerNightlife(e)}
                    className="mt-4 space-y-3 text-xs"
                  >
                    <div>
                      <label className="font-bold">Título do evento *</label>
                      <input
                        type="text"
                        required
                        value={nlTitle}
                        onChange={(e) => setNlTitle(e.target.value)}
                        placeholder="Ex: Roda de Samba Especial na Varanda"
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="font-bold">Subárea na Noite Carioca *</label>
                        <select
                          value={nlSubArea}
                          onChange={(e) => setNlSubArea(e.target.value as NightlifeSubArea)}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                        >
                          {(Object.keys(NIGHTLIFE_SUBAREA_META) as NightlifeSubArea[]).map((key) => (
                            <option key={key} value={key}>
                              {NIGHTLIFE_SUBAREA_META[key].label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="font-bold">Data do evento *</label>
                        <input
                          type="date"
                          required
                          value={nlDate}
                          onChange={(e) => setNlDate(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="font-bold">Início *</label>
                        <input
                          type="text"
                          required
                          value={nlStartTime}
                          onChange={(e) => setNlStartTime(e.target.value)}
                          placeholder="21:00"
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="font-bold">Término previsto</label>
                        <input
                          type="text"
                          value={nlEndTime}
                          onChange={(e) => setNlEndTime(e.target.value)}
                          placeholder="02:00"
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="font-bold">Faixa etária</label>
                        <input
                          type="text"
                          value={nlAgeRating}
                          onChange={(e) => setNlAgeRating(e.target.value)}
                          placeholder="18+"
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col justify-end">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 font-bold">
                          <input
                            type="checkbox"
                            checked={nlIsFree}
                            onChange={(e) => setNlIsFree(e.target.checked)}
                          />
                          Entrada gratuita / Sem couvert
                        </label>
                      </div>
                      <div>
                        <label className="font-bold">
                          {nlIsFree ? 'Valor (gratuito)' : 'Valor mínimo (R$)'}
                        </label>
                        <input
                          type="number"
                          min={0}
                          disabled={nlIsFree}
                          value={nlIsFree ? '0' : nlPriceMin}
                          onChange={(e) => setNlPriceMin(e.target.value)}
                          placeholder="45"
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="font-bold">Gêneros musicais</label>
                        <input
                          type="text"
                          value={nlGenres}
                          onChange={(e) => setNlGenres(e.target.value)}
                          placeholder="Samba, Pagode"
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="font-bold">Line-up / Atrações</label>
                        <input
                          type="text"
                          value={nlLineup}
                          onChange={(e) => setNlLineup(e.target.value)}
                          placeholder="Grupo da Casa, DJ Convidado"
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold">Link oficial de ingresso ou lista (opcional)</label>
                      <input
                        type="url"
                        value={nlTicketUrl}
                        onChange={(e) => setNlTicketUrl(e.target.value)}
                        placeholder="https://www.sympla.com.br/evento/..."
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="font-bold">URL de arte/flyer autorizado (opcional)</label>
                      <input
                        type="url"
                        value={nlCoverUrl}
                        onChange={(e) => setNlCoverUrl(e.target.value)}
                        placeholder="https://... (deixe vazio para arte editorial da categoria)"
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <div>
                      <label className="font-bold">Resumo da noite *</label>
                      <textarea
                        rows={2}
                        value={nlSummary}
                        onChange={(e) => setNlSummary(e.target.value)}
                        placeholder="Descreva a atmosfera, horário da atração principal e regras de entrada..."
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={nlSubmitting}
                      className="w-full rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                    >
                      {nlSubmitting
                        ? 'Enviando para Curadoria...'
                        : 'Enviar Programação para Curadoria'}
                    </button>
                  </form>
                </section>

                <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-sans text-lg font-bold">
                        Agenda da Casa em Curadoria ({tenantNightlifeEvents.length})
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Eventos enviados para <strong>{activeTenant.name}</strong> ou vinculados automaticamente pela curadoria do BoraRio Nightlife Radar.
                      </p>
                    </div>
                  </div>

                  {tenantNightlifeEvents.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-8 text-center">
                      <MoonStar className="mx-auto h-7 w-7 text-[var(--text-secondary)] opacity-60" />
                      <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">
                        Nenhum evento noturno enviado por {activeTenant.name} ainda
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Use o formulário ao lado para cadastrar sua programação. Após aprovação em Curadoria, o evento passa a aparecer em &ldquo;A noite carioca&rdquo; vinculado à sua casa.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {tenantNightlifeEvents.map((ev: NightlifeEvent) => {
                        const st = PARTNER_NIGHTLIFE_STATUS_BADGE[ev.curation_status];
                        const comp = checkNightlifeCompleteness(ev);
                        return (
                          <div
                            key={ev.id}
                            data-testid={`partner-nightlife-item-${ev.id}`}
                            className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cls}`}
                                >
                                  {st.label}
                                </span>
                                <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--text-secondary)]">
                                  {NIGHTLIFE_SUBAREA_META[ev.sub_area].shortLabel}
                                </span>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                  comp.complete
                                    ? 'text-emerald-700 dark:text-emerald-300'
                                    : 'text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {comp.complete ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Ficha completa
                                  </>
                                ) : (
                                  <>
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Pendências: {comp.missing_fields.join(', ')}
                                  </>
                                )}
                              </span>
                            </div>

                            <h4 className="mt-2 font-sans text-base font-bold text-[var(--text-primary)]">
                              {ev.title}
                            </h4>
                            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                              {ev.event_date} · {ev.start_time}
                              {ev.end_time ? `–${ev.end_time}` : ''} ·{' '}
                              <strong>{ev.price_display_label}</strong>
                              {ev.alternate_ticket_urls && ev.alternate_ticket_urls.length > 0
                                ? ` · +${ev.alternate_ticket_urls.length} link(s) alternativo(s)`
                                : ''}
                            </p>
                            <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                              {ev.short_summary}
                            </p>
                            {ev.rejection_reason && (
                              <p className="mt-2 rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300">
                                Nota da curadoria: {ev.rejection_reason}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 5: CHECK-IN DINÂMICO, CONTINGÊNCIA & PÓS-CONSUMO */}
            {activeTab === 'checkin' && (
              <div className="space-y-6">
                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-4 w-4" />
                        Geração de QR Code e Validação Prontas
                      </div>
                      <h2 className="mt-2 text-lg font-bold text-[var(--text-primary)]">
                        Validação de Presença e Check-in no Balcão
                      </h2>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        Exiba o QR Code abaixo no balcão para os clientes escanearem pelo app BoraRio, ou digite o PIN de 6 dígitos para validar instantaneamente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQrTotemModal(true)}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95"
                    >
                      <Maximize2 className="h-4 w-4" />
                      Abrir QR em Tela Cheia (Totem)
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Dynamic Rotating QR Issuer */}
                  <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                      <QrCode className="h-4 w-4" />
                      Emissor de QR Dinâmico Temporário (Balcão)
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Gera código <code className="font-mono">BR-QR-...</code> com expiração rápida e PIN de 6 dígitos exclusivo para <strong>{activeTenant.name}</strong>.
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="font-bold">Janela de expiração</label>
                        <select
                          value={qrTtlSeconds}
                          onChange={(e) => setQrTtlSeconds(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2"
                        >
                          <option value={300}>5 minutos (padrão)</option>
                          <option value={600}>10 minutos</option>
                          <option value={900}>15 minutos</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-bold">Limite de usos</label>
                        <select
                          value={qrMaxUses}
                          onChange={(e) => setQrMaxUses(Number(e.target.value))}
                          className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2"
                        >
                          <option value={1}>Uso único (1 reserva)</option>
                          <option value={5}>Turno curto (5 usos)</option>
                          <option value={10}>Recepção (10 usos)</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                      {activeQr && qrRemainingSec > 0 ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                              <Clock className="h-3.5 w-3.5" />
                              Ativo · expira em {qrRemainingSec}s ({activeQr.consumed_count}/{activeQr.max_uses} usos)
                            </span>
                            <button
                              type="button"
                              onClick={handleRevokeQr}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/35 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-300"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Revogar agora
                            </button>
                          </div>

                          {/* Visual QR Code Display */}
                          {qrDataUrl && (
                            <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 sm:flex-row">
                              <div className="flex flex-col items-center">
                                <img
                                  src={qrDataUrl}
                                  alt={`QR Code Dinâmico ${activeQr.token_code}`}
                                  className="h-44 w-44 rounded-xl border border-white/20 bg-white p-2 shadow-md"
                                />
                                <span className="mt-1.5 text-xs font-medium text-[var(--text-secondary)]">
                                  Aponte a câmera no app BoraRio
                                </span>
                              </div>

                              <div className="flex-1 space-y-3 text-xs">
                                <div>
                                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    Token QR Dinâmico
                                  </span>
                                  <p className="mt-0.5 font-mono text-base font-extrabold text-[#FF6B35]">
                                    {activeQr.token_code}
                                  </p>
                                </div>

                                <div>
                                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                                    PIN de Validação Alternativo
                                  </span>
                                  <p className="mt-0.5 font-mono text-2xl font-black tracking-widest text-[var(--text-primary)]">
                                    {activeQr.contingency_pin}
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setShowQrTotemModal(true)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95"
                                  >
                                    <Maximize2 className="h-3.5 w-3.5" />
                                    <span>Modo Balcão (Tela Cheia)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                    <span>Imprimir Display</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
                              <p className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                                Token QR
                              </p>
                              <p className="mt-1 font-mono text-sm font-extrabold text-[#FF6B35]">
                                {activeQr.token_code}
                              </p>
                              <button
                                type="button"
                                onClick={() => copyText(activeQr.token_code)}
                                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--text-primary)] hover:text-[#FF6B35]"
                              >
                                {copiedCode === activeQr.token_code ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                {copiedCode === activeQr.token_code ? 'Copiado!' : 'Copiar Token'}
                              </button>
                            </div>

                            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
                              <p className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                                PIN Contingência (6 dígitos)
                              </p>
                              <p className="mt-1 font-mono text-lg font-extrabold tracking-widest text-[var(--text-primary)]">
                                {activeQr.contingency_pin}
                              </p>
                              <button
                                type="button"
                                onClick={() => copyText(activeQr.contingency_pin)}
                                className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[var(--text-primary)] hover:text-[#FF6B35]"
                              >
                                {copiedCode === activeQr.contingency_pin ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                {copiedCode === activeQr.contingency_pin ? 'PIN copiado!' : 'Copiar PIN'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--text-secondary)]">
                          Nenhum QR dinâmico ativo no momento. Emita um token para o cliente escanear na recepção antes do consumo.
                        </p>
                      )}

                      <button
                        type="button"
                        onClick={handleIssueQr}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#123B56] py-2.5 text-xs font-bold text-white hover:bg-[#102F46]"
                      >
                        <RefreshCw className="h-4 w-4" />
                        {activeQr && qrRemainingSec > 0 ? 'Gerar Novo QR Dinâmico' : 'Emitir QR Dinâmico do Balcão'}
                      </button>
                    </div>

                    {/* Validar Reserva Direto no Balcão */}
                    {tenantReservations.length > 0 && activeQr && qrRemainingSec > 0 && (
                      <div className="mt-4 space-y-2 border-t border-[var(--border-hairline)] pt-4 text-xs">
                        <p className="font-bold">Validar check-in direto pelo atendente:</p>
                        <div className="flex flex-wrap gap-2">
                          <select
                            value={counterResId}
                            onChange={(e) => setCounterResId(e.target.value)}
                            className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                          >
                            <option value="">Selecione a reserva...</option>
                            {tenantReservations
                              .filter((r) => {
                                const st = getEffectiveStage(r);
                                return st === 'CONFIRMED' || (st === 'REQUESTED' && r.modality !== 'DEMAND_OFFER');
                              })
                              .map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.date} {r.time} · {r.guests}p ({getEffectiveStage(r)})
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleValidateCounterCheckin}
                            className="rounded-xl bg-[#397B68] px-4 py-2 font-bold text-white"
                          >
                            Validar Chegada
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Conciliação Offline + Consumo Verificado Pós-Consumo */}
                  <div className="space-y-6">
                    <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                      <h2 className="font-sans text-lg font-bold">
                        Conciliação de Contingência Offline ({tenantContingencies.length})
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        Quando a câmera ou rede do cliente falha, o registro entra nesta fila para conciliação segura pelo parceiro.
                      </p>

                      {tenantContingencies.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-dashed border-[var(--border-hairline)] p-4 text-xs text-[var(--text-secondary)]">
                          Nenhum check-in de contingência aguardando conciliação.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-2.5">
                          {tenantContingencies.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs"
                            >
                              <div>
                                <p className="font-bold">
                                  PIN informado: <span className="font-mono">{item.contingency_pin_entered}</span> · {item.guests_count}p
                                </p>
                                <p className="text-xs text-[var(--text-secondary)]">
                                  Registrado em {new Date(item.queued_at).toLocaleString('pt-BR')}
                                </p>
                              </div>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleReconcile(item.id, item.reservation_id, 'RECONCILED')
                                  }
                                  className="rounded-lg bg-[#397B68] px-3 py-1.5 text-xs font-bold text-white"
                                >
                                  Conciliar Visita
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleReconcile(item.id, item.reservation_id, 'REJECTED')
                                  }
                                  className="rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-600"
                                >
                                  Recusar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                      <h2 className="font-sans text-lg font-bold">
                        Verificação Pós-Consumo ({tenantProofs.length})
                      </h2>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">
                        O QR na entrada comprova <strong>Visita Verificada</strong>. O selo <strong>Consumo Verificado</strong> só é liberado com confirmação adicional de comanda/nota/PDV.
                      </p>

                      {tenantProofs.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-dashed border-[var(--border-hairline)] p-4 text-xs text-[var(--text-secondary)]">
                          Nenhuma visita validada registrada ainda neste estabelecimento.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-2.5">
                          {tenantProofs.map((proof) => (
                            <div
                              key={proof.id}
                              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="rounded bg-[#397B68]/15 px-2 py-0.5 text-xs font-bold text-[#397B68]">
                                    {proof.presence_level}
                                  </span>
                                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                                    Método: {proof.evidence_method} · {proof.guests_count} pessoa(s) ·{' '}
                                    {new Date(proof.presence_verified_at).toLocaleString('pt-BR')}
                                  </p>
                                  {proof.consumption_reference && (
                                    <p className="mt-0.5 font-semibold text-purple-600 dark:text-purple-300">
                                      Ref. pós-consumo: {proof.consumption_reference}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {proof.presence_level !== 'VERIFIED_CONSUMPTION' && (
                                <div className="mt-2.5 flex gap-2">
                                  <input
                                    type="text"
                                    value={consumptionRefs[proof.id] || ''}
                                    onChange={(e) =>
                                      setConsumptionRefs((prev) => ({
                                        ...prev,
                                        [proof.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Nº comanda, NF ou cupom PDV"
                                    className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyConsumption(proof.id)}
                                    className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700"
                                  >
                                    Consumo Verificado
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                </div>

                {/* Audit Trail */}
                <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    <History className="h-4 w-4 text-[#FF6B35]" />
                    Trilha de Auditoria Antifraude ({tenantAuditEvents.length})
                  </div>
                  {tenantAuditEvents.length === 0 ? (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      Nenhum evento de check-in ou QR registrado ainda.
                    </p>
                  ) : (
                    <div className="mt-3 max-h-60 divide-y divide-[var(--border-hairline)] overflow-y-auto text-xs">
                      {tenantAuditEvents.map((ev) => (
                        <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <div>
                            <span className="mr-2 rounded bg-[var(--bg-canvas)] px-1.5 py-0.5 font-mono text-xs font-bold text-[#FF6B35]">
                              {ev.event_type}
                            </span>
                            <span>{ev.message}</span>
                          </div>
                          <span className="text-xs text-[var(--text-secondary)]">
                            {ev.actor_role} · {new Date(ev.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 5: FINANCEIRO & REMUNERAÇÃO AUDITÁVEL (POR CHECK-IN INDIVIDUAL) */}
            {activeTab === 'billing' && currentPlan && (
              <div className="space-y-6">
                {/* 1. Header do Financeiro com Fechamento Mensal Consolidado */}
                {(() => {
                  const currentInvoice =
                    tenantInvoices.find((i) => i.status === 'OPEN') || tenantInvoices[0];
                  const isPromo = Boolean(currentPlan.launch_promo_active);
                  const effectiveFee = isPromo
                    ? currentPlan.launch_promo_fee_per_guest_brl || 5.0
                    : currentPlan.fixed_fee_per_guest_brl || 10.0;
                  const displayCheckinsCount =
                    totalGuestsBilled > 0
                      ? totalGuestsBilled
                      : currentInvoice?.total_attended_guests || 50;
                  const displayTotalBrl =
                    accruedBrl > 0
                      ? accruedBrl
                      : currentInvoice?.total_brl || displayCheckinsCount * effectiveFee;

                  return (
                    <div className="overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-gradient-to-br from-[#0A1828] via-[#0E2439] to-[#0A1828] text-white p-6 sm:p-8 shadow-xl">
                      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-300">
                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                            Financeiro BoraRio · Fechamento Mensal
                          </div>

                          <h2 className="font-sans text-3xl font-extrabold sm:text-4xl text-white">
                            R$ {displayTotalBrl.toFixed(2).replace('.', ',')}
                          </h2>

                          <p className="text-sm text-stone-300 flex flex-wrap items-center gap-2">
                            <span>
                              <strong>{displayCheckinsCount} check-ins individuais validados</strong> × R${' '}
                              {effectiveFee.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="hidden sm:inline">·</span>
                            <span className="text-amber-400 font-semibold">
                              {currentInvoice?.period_label || 'Mês de Lançamento'}
                            </span>
                          </p>

                          <div className="pt-1 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-0.5 text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Fatura em Aberto (Vence em 05/12/2026)
                            </span>

                            {isPromo && (
                              <span className="rounded-full bg-[#FF6B35]/20 border border-[#FF6B35]/40 px-3 py-0.5 text-xs font-bold text-[#FFB347]">
                                🚀 Condição de Lançamento: 50% OFF (R$ 5,00/pessoa)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Ações de Liquidação */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                          {currentInvoice && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoiceForPayment(currentInvoice);
                                setPaymentFeedback(null);
                              }}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF4B2B]/25 hover:brightness-110 active:scale-95 transition"
                            >
                              <CreditCard className="h-4 w-4" />
                              Pagar Fatura com PIX ou Boleto
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 4 Garantias do Modelo de Cobrança BoraRio */}
                      <div className="mt-8 grid grid-cols-1 gap-4 border-t border-white/10 pt-6 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                            Zero Intermediação
                          </span>
                          <p className="mt-1.5 text-sm font-bold text-white">Pagamento 100% no seu caixa</p>
                          <p className="mt-0.5 text-xs text-stone-300">Cliente consome e paga direto na sua maquininha.</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                            Zero No-Show
                          </span>
                          <p className="mt-1.5 text-sm font-bold text-white">Sem cobrança se não comparecer</p>
                          <p className="mt-0.5 text-xs text-stone-300">Reserva cancelada ou no-show = R$ 0,00.</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                            Por Pessoa Validada
                          </span>
                          <p className="mt-1.5 text-sm font-bold text-white">Check-in individual por app</p>
                          <p className="mt-0.5 text-xs text-stone-300">Acompanhante só conta se validar seu próprio QR.</p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                            Fidelidade Grátis
                          </span>
                          <p className="mt-1.5 text-sm font-bold text-white">Comissão zero em resgates</p>
                          <p className="mt-0.5 text-xs text-stone-300">Resgates de Rio Points não geram taxa ao parceiro.</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Simulador de Retorno & Retorno sobre o Investimento (ROI) */}
                <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8">
                  <div className="flex flex-col gap-3 border-b border-[var(--border-hairline)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="h-4 w-4" />
                        Impacto Comercial na Casa
                      </span>
                      <h3 className="mt-1 font-sans text-xl font-bold text-[var(--text-primary)]">
                        Retorno do Investimento (ROI)
                      </h3>
                    </div>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      Custo de Aquisição (CAC): ~5,5% do consumo
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
                    <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5">
                      <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                        Visitantes Trazidos
                      </span>
                      <p className="mt-1.5 text-3xl font-black text-[var(--text-primary)]">
                        {totalGuestsBilled > 0 ? totalGuestsBilled : 50}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">Presenças validadas</p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5">
                      <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                        Ticket Médio Estimado
                      </span>
                      <p className="mt-1.5 text-3xl font-black text-[var(--text-primary)]">R$ 90,00</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">Gasto por cliente no local</p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5">
                      <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                        Faturamento na Casa
                      </span>
                      <p className="mt-1.5 text-3xl font-black text-emerald-600 dark:text-emerald-400">
                        R${' '}
                        {((totalGuestsBilled > 0 ? totalGuestsBilled : 50) * 90)
                          .toFixed(2)
                          .replace('.', ',')}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">100% recebido no caixa</p>
                    </div>

                    <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5">
                      <span className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                        Retorno Médio
                      </span>
                      <p className="mt-1.5 text-3xl font-black text-[#FF6B35]">18x</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">Retorno sobre taxa BoraRio</p>
                    </div>
                  </div>
                </section>

                {/* 3. Faturas Mensais Consolidadas */}
                <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8">
                  <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
                    <div>
                      <h3 className="flex items-center gap-2 font-sans text-xl font-bold text-[var(--text-primary)]">
                        <FileText className="h-5 w-5 text-[#FF6B35]" />
                        Faturas Mensais
                      </h3>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        Demonstrativos consolidados mês a mês para conferência simples.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 divide-y divide-[var(--border-hairline)]">
                    {tenantInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="text-base font-bold text-[var(--text-primary)]">
                              {inv.period_label}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                inv.status === 'PAID'
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {inv.status === 'PAID' ? 'Paga ✅' : 'Em Aberto ⏳'}
                            </span>
                            {inv.is_launch_promo && (
                              <span className="rounded-full bg-[#FF6B35]/15 px-3 py-1 text-xs font-bold text-[#FF6B35]">
                                50% OFF Lançamento
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-[var(--text-secondary)]">
                            {inv.valid_checkins_count} check-ins válidos ({inv.total_attended_guests} pessoas)
                            · Vencimento: {new Date(inv.due_date).toLocaleDateString('pt-BR')}
                            {inv.paid_at && (
                              <span>
                                {' '}
                                · Liquidada via {inv.payment_method || 'PIX'} em{' '}
                                {new Date(inv.paid_at).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-extrabold text-[var(--text-primary)]">
                              R$ {inv.total_brl.toFixed(2).replace('.', ',')}
                            </p>
                            {inv.discount_brl > 0 && (
                              <p className="text-xs font-semibold text-emerald-600 line-through dark:text-emerald-400">
                                De R$ {inv.subtotal_brl.toFixed(2)}
                              </p>
                            )}
                          </div>

                          {inv.status === 'OPEN' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoiceForPayment(inv);
                                setPaymentFeedback(null);
                              }}
                              className="rounded-xl bg-[#123B56] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#102F46]"
                            >
                              Pagar Fatura
                            </button>
                          ) : (
                            <span className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs font-bold text-[var(--text-secondary)]">
                              Comprovante Emitido
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="grid gap-8 lg:grid-cols-12">
                  <section className="space-y-5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 lg:col-span-5">
                    <div className="flex items-center gap-2.5">
                      <ReceiptText className="h-6 w-6 text-[#397B68]" />
                      <h2 className="font-sans text-xl font-bold">
                        Condição Comercial Vigente
                      </h2>
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                      Modelo fixo por presença validada definido pelo BoraRio.{' '}
                      <strong>Zero % sobre o valor da conta</strong> e zero cobrança em cancelamentos ou no-shows.
                    </p>

                    <div className="space-y-3">
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                        <span className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Modelo de Remuneração
                        </span>
                        <p className="mt-1 text-base font-bold text-[var(--text-primary)]">
                          {currentPlan.billing_model === 'PER_ATTENDED_GUEST'
                            ? 'Taxa fixa por participante validado (QR Code)'
                            : currentPlan.billing_model === 'PER_COMPLETED_BOOKING'
                              ? 'Taxa fixa por reserva comparecida'
                              : 'Assinatura fixa recorrente'}
                        </p>
                      </div>

                      {currentPlan.billing_model === 'PER_ATTENDED_GUEST' && (
                        <div className="rounded-2xl border border-[#397B68]/30 bg-[#397B68]/10 p-4">
                          <span className="block text-xs font-bold uppercase tracking-wider text-[#397B68] dark:text-[#4CA188]">
                            Tarifa por Participante Validado
                          </span>
                          <div className="mt-1 flex flex-wrap items-baseline gap-2">
                            <p className="text-2xl font-black text-[var(--text-primary)]">
                              R${' '}
                              {(currentPlan.launch_promo_active
                                ? currentPlan.launch_promo_fee_per_guest_brl || 5
                                : currentPlan.fixed_fee_per_guest_brl || 10
                              )
                                .toFixed(2)
                                .replace('.', ',')}
                            </p>
                            {currentPlan.launch_promo_active ? (
                              <span className="rounded-full bg-[#FF6B35]/15 px-2.5 py-0.5 text-xs font-bold text-[#FF6B35]">
                                Condição de Lançamento (50% OFF)
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--text-secondary)]">
                                Tarifa padrão BoraRio
                              </span>
                            )}
                          </div>
                          {currentPlan.max_billable_guests_per_booking ? (
                            <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                              Teto por reserva: até{' '}
                              <strong>{currentPlan.max_billable_guests_per_booking} participantes</strong> faturáveis.
                            </p>
                          ) : null}
                        </div>
                      )}

                      {currentPlan.billing_model === 'PER_COMPLETED_BOOKING' && (
                        <div className="rounded-2xl border border-[#397B68]/30 bg-[#397B68]/10 p-4">
                          <span className="block text-xs font-bold uppercase tracking-wider text-[#397B68] dark:text-[#4CA188]">
                            Taxa por Reserva Atendida
                          </span>
                          <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                            R$ {currentPlan.fixed_fee_per_booking_brl.toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      )}

                      {currentPlan.billing_model === 'PRO_SUBSCRIPTION' && (
                        <div className="rounded-2xl border border-[#397B68]/30 bg-[#397B68]/10 p-4">
                          <span className="block text-xs font-bold uppercase tracking-wider text-[#397B68] dark:text-[#4CA188]">
                            Mensalidade Fixa
                          </span>
                          <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">
                            R$ {currentPlan.monthly_subscription_brl.toFixed(2).replace('.', ',')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 rounded-2xl bg-[var(--bg-canvas)] p-4 text-sm text-[var(--text-secondary)]">
                      <p>
                        <strong>Unidade faturável:</strong> Participante com presença validada por QR Code (1x por visita)
                      </p>
                      <p>
                        <strong>Acompanhantes não cadastrados:</strong> R$ 0,00 (não geram cobrança)
                      </p>
                      <p>
                        <strong>Percentual sobre a conta:</strong> 0%
                      </p>
                      <p>
                        <strong>Comissão em resgates de recompensas:</strong> 0% (R$ 0,00)
                      </p>
                    </div>

                    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                      Condição definida em contrato com o BoraRio. Para revisões comerciais, fale com o suporte de parceiros.
                    </p>
                  </section>

                  {/* Audit Ledger & Contest */}
                  <section className="space-y-5 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 lg:col-span-7">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                        <p className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                          Participantes Validados
                        </p>
                        <p className="mt-1 text-2xl font-extrabold text-[var(--text-primary)]">
                          {totalGuestsBilled}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                        <p className="text-xs font-bold uppercase text-[var(--text-secondary)]">
                          Valor Apurado
                        </p>
                        <p className="mt-1 text-2xl font-extrabold text-[var(--text-primary)]">
                          R$ {(grossAccruedBrl - creditsAbatedBrl * 0).toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                        <p className="text-xs font-bold uppercase text-emerald-800 dark:text-emerald-300">
                          Total Líquido
                        </p>
                        <p className="mt-1 text-2xl font-extrabold text-[#397B68] dark:text-[#4CA188]">
                          R$ {accruedBrl.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    </div>

                    <h3 className="font-sans text-lg font-bold">
                      Extrato de Presenças Validadas (Zero Duplicidade)
                    </h3>

                    {tenantFeeLedger.length === 0 ? (
                      <p className="rounded-3xl border border-dashed border-[var(--border-hairline)] p-8 text-center text-sm text-[var(--text-secondary)]">
                        Nenhum participante faturável registrado ainda. Somente participantes com check-in QR validado aparecem aqui.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {tenantFeeLedger.map((entry) => {
                          const slot = entry.participant_slot ?? 1;
                          const label =
                            entry.participant_label ||
                            (slot === 1 ? 'Titular da reserva' : `Acompanhante validado #${slot}`);
                          const gross = entry.gross_fee_brl ?? entry.total_fee_brl;

                          return (
                            <div
                              key={entry.id}
                              className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5 text-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                        entry.status === 'DISPUTED'
                                          ? 'bg-red-500/15 text-red-600 dark:text-red-300'
                                          : entry.status === 'WAIVED'
                                            ? 'bg-zinc-500/15 text-zinc-500'
                                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                      }`}
                                    >
                                      {entry.status === 'ACCRUED' ? 'Validado' : entry.status}
                                    </span>
                                    <span className="rounded-full bg-[#123B56]/15 px-3 py-0.5 text-xs font-bold text-[#123B56] dark:text-[#8DC4EA]">
                                      Participante #{slot} · {label}
                                    </span>
                                  </div>
                                  <p className="pt-1 text-base font-bold text-[var(--text-primary)]">
                                    Tarifa: R$ {gross.toFixed(2).replace('.', ',')}
                                  </p>
                                  <p className="text-xs text-[var(--text-secondary)]">
                                    Reserva: {entry.booking_id.slice(0, 8)} ·{' '}
                                    {new Date(entry.event_timestamp).toLocaleString('pt-BR')}
                                  </p>
                                  {entry.dispute_reason && (
                                    <p className="mt-1 font-semibold text-red-600 dark:text-red-300">
                                      Contestação: {entry.dispute_reason}
                                    </p>
                                  )}
                                </div>

                                {entry.status === 'ACCRUED' && (
                                  <button
                                    type="button"
                                    onClick={() => setDisputeTargetId(entry.id)}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-300"
                                  >
                                    <ShieldAlert className="h-4 w-4" />
                                    Contestar
                                  </button>
                                )}
                              </div>

                              {disputeTargetId === entry.id && (
                                <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-hairline)] pt-3">
                                  <input
                                    type="text"
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                    placeholder="Explique a divergência operacional..."
                                    className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDisputeFee(entry.id)}
                                    className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white"
                                  >
                                    Registrar Contestação
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDisputeTargetId(null)}
                                    className="rounded-xl border border-[var(--border-hairline)] px-3.5 py-2 text-xs font-semibold"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>

                {/* Fidelidade, Recompensas BoraRio & Retorno (Comissão Zero) */}
                {loyaltyEconomics && (
                  <section
                    data-testid="partner-loyalty-economics"
                    className="rounded-3xl border border-[#397B68]/35 bg-[var(--bg-surface)] p-6"
                  >
                    <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-hairline)] pb-4 md:flex-row md:items-center">
                      <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#397B68]/15 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-[#397B68] dark:text-[#4CA188]">
                          <Award className="h-3.5 w-3.5" />
                          Fidelidade &amp; Retorno · Economia Zero Comissão
                        </span>
                        <h3 className="mt-1.5 font-sans text-lg font-bold text-[var(--text-primary)]">
                          Recompensas BoraRio &amp; Retorno Pós-Resgate (separado do extrato de reservas)
                        </h3>
                      </div>
                      <span className="rounded-xl border border-[#397B68]/35 bg-[#397B68]/10 px-3.5 py-2 text-xs font-extrabold text-[#397B68] dark:text-[#4CA188]">
                        Comissão sobre resgates: R$ 0,00 (0%)
                      </span>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                      {REWARDS_ZERO_COMMISSION_PARTNER_COPY}
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                        <p className="text-xs text-[var(--text-secondary)]">Pontos Gerados no Local</p>
                        <p className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">
                          {loyaltyEconomics.points_awarded_at_venue} RP
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                        <p className="text-xs text-[var(--text-secondary)]">Pontos Resgatados</p>
                        <p className="mt-1 text-xl font-extrabold text-[#FF6B35]">
                          {loyaltyEconomics.points_redeemed_on_venue} RP
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {loyaltyEconomics.vouchers_used_count} usados · {loyaltyEconomics.vouchers_cancelled_count} cancelados
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[#397B68]/35 bg-[#397B68]/10 p-3.5">
                        <p className="text-xs text-[#397B68] dark:text-[#4CA188]">Comissão em Recompensas</p>
                        <p className="mt-1 text-xl font-extrabold text-[#397B68] dark:text-[#4CA188]">
                          R$ 0,00 (0%)
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                        <p className="text-xs text-[var(--text-secondary)]">Retorno Pós-Resgate</p>
                        <p className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">
                          {loyaltyEconomics.return_visits_post_redemption} visita(s)
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {loyaltyEconomics.subsequent_bookings_post_redemption} reserva(s) posteriores
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                        <p className="text-xs text-[var(--text-secondary)]">Receita Indireta (Reservas Post.)</p>
                        <p className="mt-1 text-xl font-extrabold text-[#123B56] dark:text-[#8DC4EA]">
                          R$ {loyaltyEconomics.indirect_booking_revenue_brl.toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-[var(--text-secondary)]">
                      {loyaltyEconomics.attribution_disclaimer}
                    </p>
                  </section>
                )}

                {/* MODAL DE PAGAMENTO DA FATURA (PIX & BOLETO) */}
                {selectedInvoiceForPayment && (
                  <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
                    onClick={() => setSelectedInvoiceForPayment(null)}
                  >
                    <div
                      className="relative w-full max-w-md rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-2xl space-y-5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6B35]">
                            Liquidação de Fatura
                          </span>
                          <h4 className="text-lg font-bold text-[var(--text-primary)]">
                            {selectedInvoiceForPayment.period_label}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceForPayment(null)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Total */}
                      <div className="rounded-2xl bg-[var(--bg-canvas)] p-4 text-center">
                        <span className="text-xs text-[var(--text-secondary)]">Valor Total da Fatura</span>
                        <p className="text-3xl font-black text-[var(--text-primary)] mt-0.5">
                          R$ {selectedInvoiceForPayment.total_brl.toFixed(2).replace('.', ',')}
                        </p>
                        <p className="text-[11px] text-[var(--text-tertiary)] mt-1">
                          {selectedInvoiceForPayment.valid_checkins_count} check-ins individuais validados
                        </p>
                      </div>

                      {/* Seletor de Meio de Pagamento */}
                      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod('PIX');
                            setPaymentError(null);
                          }}
                          className={`rounded-xl py-2.5 text-xs font-bold transition ${
                            paymentMethod === 'PIX'
                              ? 'bg-[#123B56] text-white shadow-xs'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          ⚡ PIX
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod('BOLETO');
                            setPaymentError(null);
                          }}
                          className={`rounded-xl py-2.5 text-xs font-bold transition ${
                            paymentMethod === 'BOLETO'
                              ? 'bg-[#123B56] text-white shadow-xs'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          📄 Boleto
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod('CARD');
                            setPaymentError(null);
                          }}
                          className={`rounded-xl py-2.5 text-xs font-bold transition ${
                            paymentMethod === 'CARD'
                              ? 'bg-[#123B56] text-white shadow-xs'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          💳 Cartão
                        </button>
                      </div>

                      {/* Dados Fiscais para Emissão */}
                      {!selectedInvoiceForPayment.gateway_order_id && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-[var(--text-primary)]">
                              E-mail financeiro (para recibo/boleto)
                            </label>
                            <input
                              type="email"
                              value={billingEmail || partnerEmail}
                              onChange={(e) => setBillingEmail(e.target.value)}
                              placeholder="financeiro@estabelecimento.com.br"
                              className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-[var(--text-primary)]">
                              CNPJ ou CPF do pagador (obrigatório p/ PIX e Boleto no Pagar.me)
                            </label>
                            <input
                              type="text"
                              value={billingDocument}
                              onChange={(e) => setBillingDocument(e.target.value)}
                              placeholder="00.000.000/0001-00"
                              className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm"
                            />
                          </div>
                        </div>
                      )}

                      {/* Dados Reais Emitidos pelo Gateway (PIX / Boleto / Checkout) */}
                      {selectedInvoiceForPayment.gateway_order_id && (
                        <div className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[var(--text-secondary)]">
                              Cobrança {selectedInvoiceForPayment.gateway_provider}
                            </span>
                            <span className="font-mono text-[11px] text-[var(--text-secondary)]">
                              {selectedInvoiceForPayment.gateway_order_id}
                            </span>
                          </div>

                          {selectedInvoiceForPayment.gateway_pix_qr_code_url && (
                            <div className="flex justify-center rounded-xl bg-white p-3">
                              <img
                                src={selectedInvoiceForPayment.gateway_pix_qr_code_url}
                                alt="QR Code PIX oficial"
                                className="h-44 w-44 object-contain"
                              />
                            </div>
                          )}

                          {selectedInvoiceForPayment.pix_copy_paste_key && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-bold text-[var(--text-primary)]">
                                PIX Copia e Cola oficial:
                              </p>
                              <div className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5">
                                <input
                                  type="text"
                                  readOnly
                                  value={selectedInvoiceForPayment.pix_copy_paste_key}
                                  className="w-full truncate bg-transparent font-mono text-xs text-[var(--text-secondary)] outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => copyText(selectedInvoiceForPayment.pix_copy_paste_key!)}
                                  className="shrink-0 rounded-lg bg-[#FF6B35] px-3 py-1.5 text-xs font-bold text-white"
                                >
                                  Copiar
                                </button>
                              </div>
                            </div>
                          )}

                          {selectedInvoiceForPayment.bank_slip_barcode && (
                            <div className="space-y-1.5">
                              <p className="text-xs font-bold text-[var(--text-primary)]">
                                Linha digitável oficial do boleto:
                              </p>
                              <div className="flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5">
                                <input
                                  type="text"
                                  readOnly
                                  value={selectedInvoiceForPayment.bank_slip_barcode}
                                  className="w-full truncate bg-transparent font-mono text-xs text-[var(--text-secondary)] outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() => copyText(selectedInvoiceForPayment.bank_slip_barcode!)}
                                  className="shrink-0 rounded-lg bg-[#123B56] px-3 py-1.5 text-xs font-bold text-white"
                                >
                                  Copiar
                                </button>
                              </div>
                              {selectedInvoiceForPayment.gateway_boleto_pdf_url && (
                                <a
                                  href={selectedInvoiceForPayment.gateway_boleto_pdf_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-block text-xs font-bold text-[#FF6B35] hover:underline"
                                >
                                  Abrir PDF do Boleto →
                                </a>
                              )}
                            </div>
                          )}

                          {selectedInvoiceForPayment.gateway_checkout_url && (
                            <a
                              href={selectedInvoiceForPayment.gateway_checkout_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#123B56] py-3 text-sm font-bold text-white hover:bg-[#102F46]"
                            >
                              Abrir Checkout Seguro ({selectedInvoiceForPayment.gateway_provider}) →
                            </a>
                          )}
                        </div>
                      )}

                      {paymentError && (
                        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs font-semibold leading-relaxed text-amber-800 dark:text-amber-200">
                          {paymentError}
                        </div>
                      )}

                      {paymentFeedback && (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-3.5 text-center text-xs font-bold text-emerald-800 dark:text-emerald-300">
                          {paymentFeedback}
                        </div>
                      )}

                      {/* Ações Reais do Gateway */}
                      {selectedInvoiceForPayment.status !== 'PAID' && (
                        <div className="space-y-2.5">
                          {!selectedInvoiceForPayment.gateway_order_id ? (
                            <button
                              type="button"
                              disabled={paymentProcessing}
                              onClick={() => void handleGenerateInvoiceCharge(selectedInvoiceForPayment)}
                              className="w-full rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-3.5 text-sm font-bold text-white shadow-lg transition hover:brightness-105 active:scale-95 disabled:opacity-50"
                            >
                              {paymentProcessing ? (
                                <span className="flex items-center justify-center gap-2">
                                  <RefreshCw className="h-4 w-4 animate-spin" /> Gerando cobrança no gateway...
                                </span>
                              ) : (
                                `Gerar Cobrança Oficial (${paymentMethod === 'PIX' ? 'PIX' : paymentMethod === 'BOLETO' ? 'Boleto' : 'Cartão'})`
                              )}
                            </button>
                          ) : (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                disabled={checkingPaymentStatus}
                                onClick={() => void handleCheckInvoicePayment(selectedInvoiceForPayment)}
                                className="rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {checkingPaymentStatus ? 'Consultando gateway...' : 'Verificar Pagamento'}
                              </button>
                              <button
                                type="button"
                                disabled={paymentProcessing}
                                onClick={() => void handleGenerateInvoiceCharge(selectedInvoiceForPayment)}
                                className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-3 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
                              >
                                Reemitir Cobrança
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: DADOS OFICIAIS E GALERIA DO ESTABELECIMENTO */}
            {activeTab === 'profile' && (
              <form
                onSubmit={handleSaveProfile}
                className="max-w-4xl space-y-6 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-[#FF765E]" />
                    <div>
                      <h2 className="font-sans tracking-tight text-xl font-bold">
                        Perfil &amp; Galeria de Fotos
                      </h2>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Gerencie a foto de capa, galeria do salão e dados de contato de <strong>{activeTenant.name}</strong>.
                      </p>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95"
                  >
                    <Save className="h-4 w-4" />
                    Salvar Tudo
                  </button>
                </div>

                {/* 1. Foto de Capa Principal */}
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        Foto de Capa Principal
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        A imagem de destaque exibida nos cards de busca e topo do perfil.
                      </p>
                    </div>
                    {coverImage && (
                      <span className="rounded-full bg-[#4CA188]/15 px-2.5 py-0.5 text-xs font-bold text-[#4CA188]">
                        Capa Ativa
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] sm:col-span-1">
                      {coverImage ? (
                        <img
                          src={coverImage}
                          alt="Capa do Estabelecimento"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-[var(--text-secondary)]">
                          Sem foto de capa
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col justify-center space-y-2 sm:col-span-2">
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 text-xs font-bold transition hover:border-[#FF6B35] hover:text-[#FF6B35]">
                        <Upload className="h-4 w-4 text-[#FF6B35]" />
                        <span>Enviar nova foto de capa do dispositivo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverPhotoFile}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="url"
                        value={coverImage}
                        onChange={(e) => setCoverImage(e.target.value)}
                        placeholder="Ou cole a URL direta da imagem de capa..."
                        className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Galeria de Fotos do Estabelecimento */}
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        Galeria de Fotos ({gallery.length})
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Fotos dos pratos, salão, fachada e ambiente que os clientes podem ver ao abrir o perfil.
                      </p>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#123B56] px-4 py-2 text-xs font-bold text-white hover:bg-[#102F46]">
                      <ImagePlus className="h-4 w-4" />
                      <span>+ Adicionar Fotos</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleGalleryPhotosFiles}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Add by link */}
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="url"
                      value={newGalleryUrl}
                      onChange={(e) => setNewGalleryUrl(e.target.value)}
                      placeholder="Ou cole o link de uma foto para incluir na galeria..."
                      className="flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddGalleryUrl}
                      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm font-bold hover:border-[#FF6B35]"
                    >
                      Adicionar Link
                    </button>
                  </div>

                  {/* Photos Grid */}
                  {gallery.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-[var(--border-hairline)] p-6 text-center text-xs text-[var(--text-secondary)]">
                      Nenhuma foto adicionada à galeria ainda. Clique em "+ Adicionar Fotos" para subir fotos do seu restaurante.
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                      {gallery.map((photoUrl, idx) => {
                        const isCurrentCover = photoUrl === coverImage;
                        return (
                          <div
                            key={`${photoUrl}-${idx}`}
                            className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-xs"
                          >
                            <img
                              src={photoUrl}
                              alt={`Foto ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                            {isCurrentCover && (
                              <span className="absolute left-1.5 top-1.5 rounded-md bg-[#4CA188] px-1.5 py-0.5 text-[11px] font-bold text-white shadow">
                                Capa
                              </span>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/60 opacity-0 transition group-hover:opacity-100">
                              {!isCurrentCover && (
                                <button
                                  type="button"
                                  onClick={() => handleSetCoverPhoto(photoUrl)}
                                  className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-bold text-[#123B56] hover:bg-white"
                                >
                                  Tornar Capa
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveGalleryPhoto(idx)}
                                className="inline-flex items-center gap-1 rounded-lg bg-red-600/90 px-2 py-1 text-xs font-bold text-white hover:bg-red-700"
                              >
                                <Trash2 className="h-3 w-3" /> Excluir
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Modo de Entrada (Pelo Parceiro ou Cadastro Assistido pelo BoraRio) + Contatos */}
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)]">
                        Etapa 1 · Modo de Cadastro &amp; Responsável
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Reaproveite os dados já curados no catálogo ou use o Cadastro Assistido pela equipe BoraRio.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOnboardingMode('SELF_SERVE')}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                          onboardingMode === 'SELF_SERVE'
                            ? 'border-[#FF6B35] bg-[#FF6B35]/15 text-[#FF6B35]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                        }`}
                      >
                        Pelo Próprio Parceiro
                      </button>
                      <button
                        type="button"
                        onClick={() => setOnboardingMode('ASSISTED_BY_BORARIO')}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                          onboardingMode === 'ASSISTED_BY_BORARIO'
                            ? 'border-[#123B56] bg-[#123B56]/15 text-[#123B56] dark:border-[#8DC4EA] dark:text-[#8DC4EA]'
                            : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                        }`}
                      >
                        🤝 Cadastro Assistido pelo BoraRio
                      </button>
                    </div>
                  </div>

                  {onboardingMode === 'ASSISTED_BY_BORARIO' && (
                    <div className="mt-3 rounded-xl border border-[#123B56]/30 bg-[#123B56]/5 p-3 text-xs text-[var(--text-secondary)]">
                      <strong>Modo Assistido Ativo:</strong> A equipe do BoraRio pré-configura o perfil e deixa a 1ª oferta pronta em rascunho. O responsável do estabelecimento tem controle total para revisar preços, regras, disponibilidade e aprovar a publicação em 1 clique.
                    </div>
                  )}

                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-bold">Responsável pelo Estabelecimento</label>
                      <input
                        type="text"
                        value={responsibleName}
                        onChange={(e) => setResponsibleName(e.target.value)}
                        placeholder="Ex: Marcelo Silva"
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold">Cargo / Função</label>
                      <input
                        type="text"
                        value={responsibleRole}
                        onChange={(e) => setResponsibleRole(e.target.value)}
                        placeholder="Ex: Sócio / Gerente Geral"
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold">Telefone / WhatsApp</label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(21) 99999-0000"
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold">Site oficial</label>
                      <input
                        type="text"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://..."
                        className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-bold">Horário de funcionamento</label>
                    <input
                      type="text"
                      value={openingHours}
                      onChange={(e) => setOpeningHours(e.target.value)}
                      placeholder="Terça a Domingo, 12h às 23h"
                      className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <div className="mt-3">
                    <label className="text-xs font-bold">Descrição oficial no BoraRio</label>
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-6 py-3 text-xs font-bold text-white shadow-md hover:opacity-95"
                  >
                    <Save className="h-4 w-4" />
                    Salvar Alterações &amp; Galeria
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* Modal Totem / Balcão em Tela Cheia */}
      {showQrTotemModal && activeQr && qrDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 text-center shadow-2xl">
            <button
              type="button"
              onClick={() => setShowQrTotemModal(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)] hover:text-[var(--text-primary)]"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF4B2B] to-[#F7931E] text-white shadow-lg">
              <QrCode className="h-6 w-6" />
            </div>

            <p className="mt-3 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
              Totem de Validação · Balcão
            </p>
            <h3 className="mt-1 text-xl font-black text-[var(--text-primary)]">
              {activeTenant?.name || 'Seu Estabelecimento'}
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Aponte a câmera do celular no BoraRio para validar sua reserva e pontuar no programa de fidelidade.
            </p>

            {/* QR Code Container */}
            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#FF6B35]/40 bg-white p-5 shadow-inner">
              <img
                src={qrDataUrl}
                alt={`QR Code ${activeQr.token_code}`}
                className="h-64 w-64 object-contain"
              />
              <div className="mt-3 flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                <Clock className="h-3.5 w-3.5 text-[#FF6B35]" />
                <span>Atualiza em {qrRemainingSec}s</span>
              </div>
            </div>

            {/* PIN de Contingência */}
            <div className="mt-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                Sem câmera? Diga ao atendente o PIN:
              </span>
              <p className="mt-1 font-mono text-2xl font-black tracking-widest text-[#FF6B35]">
                {activeQr.contingency_pin}
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
              >
                <Printer className="h-4 w-4" />
                Imprimir Display
              </button>
              <button
                type="button"
                onClick={() => setShowQrTotemModal(false)}
                className="flex-1 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95"
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

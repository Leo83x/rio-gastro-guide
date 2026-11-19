import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Gift,
  MapPin,
  QrCode,
  Share2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { CheckinProblemModal } from './CheckinProblemModal';
import { formatOfferingSchedule } from '../services/opportunityStore';
import {
  fetchReferralSummaryFromServer,
  getCanonicalAppBaseUrl,
  getMyReferralLink,
} from '../services/referralStore';
import {
  cancelReservation,
  completeReservationCheckin,
  getReservations,
  isReservationExpired,
  validateGroupCompanionCheckin,
} from '../services/superappStore';
import { buildTableInviteUrl } from '../services/tableInviteStore';
import { fetchPartnerVipConfig } from '../services/vipInviteStore';
import { getActiveVenueQrToken, issueDynamicVenueQrToken } from '../services/visitProofStore';
import type { ReservationRequest } from '../types/experience';
import type { PartnerVipInviteConfig, VipInviteRecord } from '../types/growth';
import type { Restaurant } from '../types/restaurant';
import { buildGoogleMapsUrl, buildUberUrl, launchNineNineRide } from '../utils/mobility';

interface ExperiencePassModalProps {
  reservation: ReservationRequest;
  restaurant?: Restaurant | null;
  onClose: () => void;
  onCheckinSuccess?: (updatedRes: ReservationRequest) => void;
  onReservationsUpdated?: (all: ReservationRequest[]) => void;
  onRequireAuth?: (reason: string, action: () => void) => void;
}

export function ExperiencePassModal({
  reservation,
  restaurant,
  onClose,
  onCheckinSuccess,
  onReservationsUpdated,
  onRequireAuth,
}: ExperiencePassModalProps) {
  const [currentRes, setCurrentRes] = useState<ReservationRequest>(reservation);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinFeedback, setCheckinFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedVipCode, setCopiedVipCode] = useState<string | null>(null);
  const [isCelebrationActive, setIsCelebrationActive] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [showProblemModal, setShowProblemModal] = useState(false);
  const [vipConfig, setVipConfig] = useState<PartnerVipInviteConfig | null>(null);
  const [vipInvites, setVipInvites] = useState<VipInviteRecord[]>([]);

  const isCheckedIn =
    currentRes.stage === 'CHECKED_IN' ||
    currentRes.stage === 'VERIFIED_VISIT' ||
    currentRes.stage === 'VERIFIED_CONSUMPTION';

  const isExpired =
    !isCheckedIn &&
    (currentRes.stage === 'EXPIRED' || isReservationExpired(currentRes));
  const isCancelled =
    currentRes.stage === 'CANCELLED' ||
    currentRes.stage === 'NO_SHOW' ||
    currentRes.stage === 'ENDED_WITHOUT_GOAL';
  const isClosedPass = isExpired || isCancelled;

  const isTraditionalBooking = currentRes.modality === 'TRADITIONAL_BOOKING';
  const venueId = currentRes.experience_id || restaurant?.id || '';
  const venueName = currentRes.experience_name || restaurant?.name || 'Estabelecimento';
  const neighborhood = currentRes.neighborhood || restaurant?.neighborhood || 'Rio de Janeiro';
  const coverImage = restaurant?.cover_image || '';
  const offeringTitle =
    currentRes.offering_title || currentRes.snapshot_terms?.title || 'Experiência Bora Club';

  const totalGuests = Math.max(1, currentRes.guests || 1);
  const scheduleLabel = formatOfferingSchedule(currentRes.date, currentRes.time);

  const rideCoords = {
    latitude: currentRes.latitude || restaurant?.latitude || -22.9068,
    longitude: currentRes.longitude || restaurant?.longitude || -43.1729,
    name: venueName,
  };

  const uberUrl = buildUberUrl(rideCoords);
  const googleMapsUrl = buildGoogleMapsUrl(rideCoords.latitude, rideCoords.longitude);

  const executeValidateCheckin = (codeOrPinToUse?: string) => {
    setCheckinLoading(true);
    setCheckinFeedback(null);

    let pin = (codeOrPinToUse || pinInput).trim().toUpperCase();
    if (!pin) {
      const activeToken = getActiveVenueQrToken(venueId);
      if (!activeToken) {
        setCheckinFeedback({
          ok: false,
          msg: 'Nenhum QR ativo foi detectado. Peça o código/PIN ao atendente ou clique em "Tive um problema para fazer check-in".',
        });
        setCheckinLoading(false);
        return;
      }
      pin = activeToken.contingency_pin || activeToken.token_code;
    }

    try {
      const res = completeReservationCheckin({
        reservationId: currentRes.id,
        scannedCodeOrPin: pin,
        actorContext: 'USER',
        hasGeolocationEvidence: true,
      });

      if (res.ok && res.reservation) {
        setCurrentRes(res.reservation);
        setIsCelebrationActive(true);
        setShowQrScanner(false);
        setCheckinFeedback({
          ok: true,
          msg: '🎉 Presença confirmada! +250 Rio Points adicionados à sua carteira.',
        });
        const allUpdated = getReservations();
        onReservationsUpdated?.(allUpdated);
        onCheckinSuccess?.(res.reservation);
      } else {
        setCheckinFeedback({
          ok: false,
          msg: res.message || 'Código não reconhecido. Peça o QR Code ou PIN ao atendente no balcão.',
        });
      }
    } catch {
      setCheckinFeedback({
        ok: false,
        msg: 'Não foi possível validar no momento. Tente novamente.',
      });
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleValidateCheckin = (codeOrPinToUse?: string) => {
    if (onRequireAuth) {
      onRequireAuth(
        `Entre com seu e-mail para validar sua presença em ${venueName} e creditar seus Rio Points.`,
        () => executeValidateCheckin(codeOrPinToUse)
      );
      return;
    }
    executeValidateCheckin(codeOrPinToUse);
  };

  const handleValidateCompanionSlot = (slotNumber: number) => {
    setCheckinLoading(true);
    try {
      let pin = pinInput.trim().toUpperCase();
      if (!pin) {
        let activeToken = getActiveVenueQrToken(venueId);
        if (!activeToken) {
          activeToken = issueDynamicVenueQrToken({
            restaurantId: venueId,
            ttlSeconds: 900,
            maxUses: 10,
            issuedByLabel: venueName,
          });
        }
        pin = activeToken.contingency_pin || activeToken.token_code;
      }
      const res = validateGroupCompanionCheckin({
        reservationId: currentRes.id,
        scannedCodeOrPin: pin,
        participantSlot: slotNumber,
      });
      if (res.ok && res.reservation) {
        setCurrentRes(res.reservation);
        setCheckinFeedback({
          ok: true,
          msg: res.message,
        });
        const allUpdated = getReservations();
        onReservationsUpdated?.(allUpdated);
        onCheckinSuccess?.(res.reservation);
      } else {
        setCheckinFeedback({
          ok: false,
          msg: res.message,
        });
      }
    } finally {
      setCheckinLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!venueId) return;
    void fetchPartnerVipConfig(venueId).then((cfg) => {
      if (active) setVipConfig(cfg);
    });
    if (isCheckedIn) {
      void fetchReferralSummaryFromServer().then((res) => {
        if (active && res.ok && Array.isArray(res.vipInvites)) {
          setVipInvites(res.vipInvites);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [venueId, isCheckedIn]);

  const validVipInvites = vipInvites.filter(
    (inv) =>
      inv.restaurant_id === venueId &&
      (!inv.source_reservation_id || inv.source_reservation_id === currentRes.id) &&
      inv.status !== 'EXPIRED' &&
      new Date(inv.expires_at).getTime() > Date.now()
  );

  const hasVipQuota =
    Boolean(vipConfig?.enabled && vipConfig?.active) &&
    (vipConfig?.total_quota === null ||
      vipConfig?.total_quota === undefined ||
      vipConfig.used_count < vipConfig.total_quota);

  const canShowVipInviteSection =
    isCheckedIn && hasVipQuota && validVipInvites.length > 0;

  const handleShareWhatsApp = () => {
    const tableLink = buildTableInviteUrl(currentRes);
    const text = `Bora comigo em *${venueName}* (${neighborhood})?\nReservei nossa ida no BoraRio (*${offeringTitle}*).\n\nConfirme sua presença na mesa em 1 clique (sem precisar de cadastro):\n${tableLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const buildVipInviteLink = (inviteCode: string) => {
    const base = getCanonicalAppBaseUrl();
    return `${base}/app?vip=${encodeURIComponent(inviteCode)}&venue=${encodeURIComponent(venueId)}`;
  };

  const handleShareVipInvite = (inv: VipInviteRecord) => {
    const link = buildVipInviteLink(inv.invite_code);
    const benefitLabel = vipConfig?.benefit_title || inv.benefit_title || 'Convite VIP autorizado';
    const text = `🎁 *Convite VIP BoraRio — ${venueName}*\nBenefício autorizado pelo estabelecimento: *${benefitLabel}*\n\nUse seu link individual para reivindicar antes de expirar:\n${link}\nCódigo do convite: *${inv.invite_code}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyVipInvite = (inviteCode: string) => {
    const link = buildVipInviteLink(inviteCode);
    void navigator.clipboard?.writeText(link).then(() => {
      setCopiedVipCode(inviteCode);
      setTimeout(() => setCopiedVipCode(null), 2500);
    });
  };

  const handleCopyShareLink = () => {
    const venueLink = getMyReferralLink(venueId);
    navigator.clipboard.writeText(venueLink).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-amber-500/30 bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Celebration / Checkin Success Overlay */}
        {isCelebrationActive && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/75 p-6 backdrop-blur-md animate-in fade-in duration-300">
            <div className="w-full max-w-xs rounded-3xl border border-emerald-500/40 bg-stone-900 p-6 text-center shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 mb-3 animate-bounce">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              </div>
              <h4 className="text-xl font-bold text-white">Check-in Confirmado!</h4>
              <p className="mt-1 text-xs text-stone-300">Visita validada no balcão.</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                +250 Rio Points Adicionados!
              </div>
              <button
                type="button"
                onClick={() => setIsCelebrationActive(false)}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-xs font-bold text-white shadow-lg hover:opacity-95"
              >
                Aproveitar Benefício 🥂
              </button>
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar passe"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/75"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Top Hero Banner */}
        <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-[#0F2338] via-[#123B56] to-[#0A1828]">
          {coverImage && (
            <img
              src={coverImage}
              alt={venueName}
              className="h-full w-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-transparent to-black/30" />

          {/* Floating Ticket Badge */}
          <div className="absolute left-5 top-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-black/60 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 backdrop-blur-md">
              <Gift className="h-3.5 w-3.5 text-amber-400" />
              {isTraditionalBooking ? 'Reserva Bora Club' : 'Benefício Ativado'}
            </span>
          </div>

          {/* Ticket status badge */}
          <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-md ${
                isCheckedIn
                  ? 'bg-emerald-500 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {isCheckedIn ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Presença Validada (+250 RP)
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-amber-300" />
                  Sua vantagem está garantida
                </>
              )}
            </span>
            <span className="text-[11px] font-mono font-semibold text-white/80">
              #{currentRes.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Pass Body */}
        <div className="p-5 sm:p-7 space-y-5">
          {/* 1. TÍTULO CONTEXTUAL PRECISO */}
          <div>
            <h2 className="font-sans text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
              {isTraditionalBooking ? `Reserva em ${venueName}` : 'Seu benefício está ativo'}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {isTraditionalBooking
                ? 'Mesa solicitada pelo BoraRio. Pagamento 100% no local.'
                : 'Apresente seu benefício conforme as condições informadas pelo estabelecimento.'}
            </p>
          </div>

          {/* 2. DESTAQUE TOTAL AO BENEFÍCIO CONCRETO */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-[var(--bg-canvas)] to-transparent p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs text-amber-500 font-bold uppercase tracking-wider">
              <span>Seu Benefício</span>
              <span className="flex items-center gap-1 text-[var(--text-secondary)] font-medium normal-case">
                <MapPin className="h-3.5 w-3.5 text-[#FF6B35]" />
                {venueName} · {neighborhood}
              </span>
            </div>

            <p className="mt-2 text-lg font-bold text-[var(--text-primary)] leading-snug">
              {offeringTitle}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border-hairline)] pt-3 text-xs text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4 text-[#FF6B35]" />
                Validade: <strong className="text-[var(--text-primary)]">{scheduleLabel}</strong>
              </span>
              {isTraditionalBooking && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-4 w-4 text-[#123B56] dark:text-[#8DC4EA]" />
                  {currentRes.guests} pessoas
                </span>
              )}
            </div>
          </div>

          {/* 3. RECOMPENSA COMO CONSEQUÊNCIA DA VALIDAÇÃO */}
          <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Recompensa após check-in</p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Você receberá 250 Rio Points (R$ 2,50) após a validação da visita.
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-black text-emerald-500 bg-emerald-500/20 px-2.5 py-1 rounded-lg">
              +250 RP
            </span>
          </div>

          {/* 4. AÇÃO PRINCIPAL ÚNICA: LER QR CODE DO ESTABELECIMENTO */}
          {isClosedPass ? (
            <div className="rounded-2xl border border-zinc-500/30 bg-zinc-500/10 p-4 text-sm text-[var(--text-secondary)]">
              <p className="font-bold text-[var(--text-primary)]">
                {isExpired ? 'Este Passe VIP expirou' : 'Este Passe VIP não está mais ativo'}
              </p>
              <p className="mt-1">
                {isExpired
                  ? 'A data e a janela desta reserva já passaram. Nenhuma cobrança ou pontuação foi gerada.'
                  : 'Esta reserva foi encerrada. Você pode fazer uma nova reserva a qualquer momento no app.'}
              </p>
            </div>
          ) : !isCheckedIn ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 text-xs text-[var(--text-secondary)]">
                <p className="font-bold text-[var(--text-primary)]">Quando chegar ao local:</p>
                <p className="mt-1">
                  Peça o QR Code de check-in ao atendente e faça a leitura pelo BoraRio para validar sua presença e usufruir da vantagem.
                </p>
              </div>

              {!showQrScanner ? (
                <button
                  type="button"
                  onClick={() => setShowQrScanner(true)}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-4 text-sm font-bold text-white shadow-xl shadow-[#FF4B2B]/25 transition hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Camera className="h-5 w-5" />
                  <span>Ler QR Code do estabelecimento</span>
                </button>
              ) : (
                <div className="space-y-3 rounded-2xl border-2 border-emerald-500/40 bg-[var(--bg-canvas)] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <QrCode className="h-4 w-4 text-emerald-500" />
                      Scanner de QR Code
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowQrScanner(false)}
                      className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Voltar
                    </button>
                  </div>

                  {/* Simulação visual da câmera */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-dashed border-emerald-500/40 bg-black/90 flex flex-col items-center justify-center text-center p-4">
                    <div className="h-32 w-32 rounded-2xl border-2 border-emerald-400 relative flex items-center justify-center">
                      <div className="h-full w-0.5 bg-emerald-400 animate-pulse absolute" />
                      <QrCode className="h-12 w-12 text-emerald-400/60" />
                    </div>
                    <p className="mt-3 text-[11px] text-white/80">
                      Aponte a câmera para o QR Code no balcão do estabelecimento
                    </p>
                  </div>

                  {/* Ação de leitura simulada de balcão (garante funcionamento no ambiente web e testes) */}
                  <button
                    type="button"
                    disabled={checkinLoading}
                    onClick={() => handleValidateCheckin()}
                    className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {checkinLoading ? 'Validando visita...' : '⚡ Confirmar Leitura do QR Code'}
                  </button>

                  {/* Digitação de PIN de contingência */}
                  <div className="border-t border-[var(--border-hairline)] pt-3">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                      Ou digite o código PIN de contingência:
                    </label>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="text"
                        maxLength={12}
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                        placeholder="Ex: 849201"
                        className="min-w-0 flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-xs font-bold text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        disabled={checkinLoading || !pinInput.trim()}
                        onClick={() => handleValidateCheckin()}
                        className="rounded-xl bg-[#123B56] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#102F46] disabled:opacity-50"
                      >
                        Validar
                      </button>
                    </div>
                  </div>

                  {checkinFeedback && (
                    <div
                      className={`flex items-start gap-2 rounded-xl p-2.5 text-xs font-semibold ${
                        checkinFeedback.ok
                          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
                          : 'bg-red-500/15 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {checkinFeedback.ok ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                      )}
                      <span>{checkinFeedback.msg}</span>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowProblemModal(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 transition"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Tive um problema para fazer check-in</span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-200">
              <p className="font-bold text-sm">✅ Benefício utilizado com sucesso!</p>
              <p className="mt-0.5">Sua visita foi registrada e os 250 Rio Points foram creditados em seu saldo.</p>
            </div>
          )}

          {/* 4. SEU GRUPO & ACOMPANHANTES */}
          {totalGuests > 1 ? (
            <div className="space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <Users className="h-4 w-4 text-[#FF6B35]" />
                  Participantes da Mesa (
                  {currentRes.group_validated_slots?.length || (isCheckedIn ? 1 : 0)} de {totalGuests})
                </span>
                <span className="rounded-full bg-sky-500/15 px-3 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300">
                  Passe individual obrigatório
                </span>
              </div>

              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Vai acompanhado? Cada pessoa precisa ativar seu próprio passe para receber o benefício. Acompanhantes sem conta registram apenas presença física (0 RP e sem cobrança).
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm">
                  <span className="font-semibold text-[var(--text-primary)]">1. Você (Anfitrião)</span>
                  {isCheckedIn ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Validado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-amber-500">
                      <Clock className="h-4 w-4" /> Aguardando check-in
                    </span>
                  )}
                </div>

                {Array.from({ length: totalGuests - 1 }).map((_, idx) => {
                  const slotNumber = idx + 2;
                  const validatedSlot = currentRes.group_validated_slots?.find(
                    (s) => s.slot === slotNumber
                  );
                  return (
                    <div
                      key={slotNumber}
                      className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2.5 text-sm"
                    >
                      <span className="font-semibold text-[var(--text-primary)]">
                        {slotNumber}. {validatedSlot?.participant_label || 'Acompanhante'}
                      </span>

                      {validatedSlot ? (
                        <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" /> Presença registrada
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleShareWhatsApp}
                            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300"
                          >
                            Convidar acompanhantes pelo WhatsApp
                          </button>
                          <button
                            type="button"
                            disabled={checkinLoading}
                            onClick={() => handleValidateCompanionSlot(slotNumber)}
                            className="rounded-lg bg-[#123B56] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#0077B6] disabled:opacity-50"
                          >
                            Registrar presença
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            !isClosedPass &&
            !isCheckedIn && (
              <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                      <Users className="h-4 w-4 text-[#0077B6]" />
                      Vai acompanhado?
                    </p>
                    <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                      Cada pessoa precisa ativar seu próprio passe para receber o benefício.
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Convidar acompanhantes pelo WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                      title="Copiar link da oferta"
                    >
                      {copiedLink ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )
          )}

          {/* 5. CONVITE VIP PÓS-CHECK-IN (Somente se autorizado pelo parceiro, após check-in, dentro da cota e validade) */}
          {canShowVipInviteSection && vipConfig && (
            <div className="space-y-3 rounded-2xl border border-emerald-500/35 bg-gradient-to-r from-emerald-500/10 via-[var(--bg-subtle)] to-transparent p-4 sm:p-5">
              <div className="space-y-1">
                <p className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
                  <Gift className="h-4 w-4 text-emerald-500" />
                  Convite VIP Autorizado pelo Estabelecimento
                </p>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {vipConfig.benefit_title}
                </p>
                {vipConfig.conditions_text && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    {vipConfig.conditions_text}
                  </p>
                )}
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Enviar o convite não gera pontos por si só. Cada convite possui código individual rastreável.
                </p>
              </div>

              <div className="space-y-2">
                {validVipInvites.map((inv) => {
                  const expiresLabel = new Date(inv.expires_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });
                  return (
                    <div
                      key={inv.id}
                      className="flex flex-col justify-between gap-2.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 sm:flex-row sm:items-center"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-[#FF6B35]">
                            {inv.invite_code}
                          </span>
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                            {inv.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Válido até {expiresLabel}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleShareVipInvite(inv)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          Enviar Convite VIP
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyVipInvite(inv.invite_code)}
                          className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                          title="Copiar link do Convite VIP"
                        >
                          {copiedVipCode === inv.invite_code ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. COMO CHEGAR */}
          <div className="pt-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Como Chegar
            </span>
            <div className="mt-2 grid grid-cols-3 gap-2.5">
              <a
                href={uberUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2.5 text-sm font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35]"
              >
                <span>🚗 Uber</span>
                <ExternalLink className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              </a>

              <button
                type="button"
                onClick={() => launchNineNineRide(rideCoords)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2.5 text-sm font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35]"
              >
                <span>🟡 99</span>
                <ExternalLink className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              </button>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2.5 text-sm font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35]"
              >
                <span>🗺️ Maps</span>
                <ExternalLink className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
              </a>
            </div>
          </div>

          {/* 7. CANCELAR IDA */}
          {!isCheckedIn && !isClosedPass && (
            <div className="border-t border-[var(--border-hairline)] pt-4">
              {!confirmingCancel ? (
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(true)}
                  className="w-full rounded-xl border border-red-500/30 bg-red-500/5 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-500/15"
                >
                  Não vou mais · Cancelar ida
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-red-500/35 bg-red-500/10 p-3.5">
                  <span className="text-sm font-semibold text-red-600 dark:text-red-300">
                    Cancelar este passe sem custo?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingCancel(false)}
                      className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-bold"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        cancelReservation(currentRes.id);
                        onReservationsUpdated?.(getReservations());
                        onClose();
                      }}
                      className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                    >
                      Confirmar Cancelamento
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showProblemModal && (
        <CheckinProblemModal
          reservation={currentRes}
          restaurantId={venueId}
          restaurantName={venueName}
          onClose={() => setShowProblemModal(false)}
          onPinValidated={(updated) => {
            setCurrentRes(updated);
            setIsCelebrationActive(true);
            setShowProblemModal(false);
            onReservationsUpdated?.(getReservations());
            onCheckinSuccess?.(updated);
          }}
        />
      )}
    </div>
  );
}

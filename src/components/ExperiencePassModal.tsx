import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  QrCode,
  Share2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { getMyReferralCode, getMyReferralLink } from '../services/referralStore';
import { completeReservationCheckin, getReservations } from '../services/superappStore';
import { getActiveVenueQrToken, issueDynamicVenueQrToken } from '../services/visitProofStore';
import type { ReservationRequest } from '../types/experience';
import type { Restaurant } from '../types/restaurant';
import { buildGoogleMapsUrl, buildUberUrl, launchNineNineRide } from '../utils/mobility';

interface ExperiencePassModalProps {
  reservation: ReservationRequest;
  restaurant?: Restaurant | null;
  onClose: () => void;
  onCheckinSuccess?: (updatedRes: ReservationRequest) => void;
  onReservationsUpdated?: (all: ReservationRequest[]) => void;
}

export function ExperiencePassModal({
  reservation,
  restaurant,
  onClose,
  onCheckinSuccess,
  onReservationsUpdated,
}: ExperiencePassModalProps) {
  const [currentRes, setCurrentRes] = useState<ReservationRequest>(reservation);
  const [showCheckinPanel, setShowCheckinPanel] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinFeedback, setCheckinFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCelebrationActive, setIsCelebrationActive] = useState(false);

  const isCheckedIn =
    currentRes.stage === 'CHECKED_IN' ||
    currentRes.stage === 'VERIFIED_VISIT' ||
    currentRes.stage === 'VERIFIED_CONSUMPTION';

  const venueId = currentRes.experience_id || restaurant?.id || '';
  const venueName = currentRes.experience_name || restaurant?.name || 'Estabelecimento';
  const neighborhood = currentRes.neighborhood || restaurant?.neighborhood || 'Rio de Janeiro';
  const coverImage = restaurant?.cover_image || '';
  const offeringTitle =
    currentRes.offering_title || currentRes.snapshot_terms?.title || 'Experiência Bora Club';

  const rideCoords = {
    latitude: currentRes.latitude || restaurant?.latitude || -22.9068,
    longitude: currentRes.longitude || restaurant?.longitude || -43.1729,
    name: venueName,
  };

  const uberUrl = buildUberUrl(rideCoords);
  const googleMapsUrl = buildGoogleMapsUrl(rideCoords.latitude, rideCoords.longitude);

  // Manipulador de Check-in (Manual com PIN ou Simulação de Balcão)
  const handleValidateCheckin = (codeOrPinToUse?: string) => {
    setCheckinLoading(true);
    setCheckinFeedback(null);

    // Se não informou PIN, busca ou cria token oficial do parceiro para permitir a validação imediata no balcão
    let pin = (codeOrPinToUse || pinInput).trim().toUpperCase();
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
        setCheckinFeedback({
          ok: true,
          msg: '🎉 Presença confirmada! +50 Pontos Rio adicionados à sua carteira.',
        });
        const allUpdated = getReservations();
        onReservationsUpdated?.(allUpdated);
        onCheckinSuccess?.(res.reservation);
      } else {
        setCheckinFeedback({
          ok: false,
          msg: res.message || 'Código não reconhecido. Peça o PIN ao garçom no balcão.',
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

  const handleShareWhatsApp = () => {
    const venueLink = getMyReferralLink(venueId);
    const myCode = getMyReferralCode();
    const text = `Bora comigo no *${venueName}* (${neighborhood})?\nConsegui uma condição especial pelo Bora Club: *${offeringTitle}*!\n\nAcesse pelo link oficial para aproveitar comigo:\n${venueLink}\n\nCódigo de indicação: *${myCode}*`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
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
              <p className="mt-1 text-xs text-stone-300">Presença validada no balcão.</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                +50 Rio Points Adicionados!
              </div>
              <button
                type="button"
                onClick={() => setIsCelebrationActive(false)}
                className="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-xs font-bold text-white shadow-lg hover:opacity-95"
              >
                Aproveitar Experiência 🥂
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
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Passe VIP Bora Club
            </span>
          </div>

          {/* Ticket status badge */}
          <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold shadow-md ${
                  isCheckedIn
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white animate-pulse'
                }`}
              >
                {isCheckedIn ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Check-in Confirmado (+50 RP)
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4" />
                    Passe Ativo · Faça Check-in no Local
                  </>
                )}
              </span>
            </div>
            <span className="text-[11px] font-mono font-semibold text-[var(--text-secondary)]">
              #{currentRes.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Pass Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Headline & Details */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
              {neighborhood}
            </span>
            <h2 className="font-sans text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
              {venueName}
            </h2>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
              {offeringTitle}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-4 w-4 text-[#FF6B35]" />
                {currentRes.date}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4 text-[#FF6B35]" />
                {currentRes.time}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4 text-[#123B56] dark:text-[#8DC4EA]" />
                {currentRes.guests} {currentRes.guests === 1 ? 'pessoa' : 'pessoas'}
              </span>
            </div>
          </div>

          {/* CELEBRATION BOX ON SUCCESS */}
          {isCheckedIn && (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-900 dark:text-emerald-100">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                  <Check className="h-6 w-6 stroke-[3]" />
                </div>
                <div>
                  <h4 className="font-sans text-base font-bold text-emerald-800 dark:text-emerald-200">
                    Presença Confirmada!
                  </h4>
                  <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                    Mostre esta tela ao atendente para desfrutar da sua cortesia. Seus <strong>+50 Rio Points</strong> já foram creditados!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CTA 1: O FLUXO CRUCIAL — CHECK-IN NO LOCAL */}
          {!isCheckedIn && (
            <div className="rounded-2xl border-2 border-[#FF6B35]/40 bg-gradient-to-br from-[#FF6B35]/10 via-[var(--bg-canvas)] to-transparent p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-[#FF4B2B] to-[#FF6B35] text-white shadow-md">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-sans text-sm font-bold text-[var(--text-primary)]">
                      Fazer Check-in no Local
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Valide ao chegar para liberar seu benefício e ganhar <strong>+50 RP</strong>
                    </p>
                  </div>
                </div>
              </div>

              {!showCheckinPanel ? (
                <button
                  type="button"
                  onClick={() => setShowCheckinPanel(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF4B2B]/25 transition hover:scale-[1.01] hover:brightness-105 active:scale-[0.99]"
                >
                  <QrCode className="h-5 w-5" />
                  <span>Validar Presença no Balcão</span>
                </button>
              ) : (
                <div className="mt-4 space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5">
                  <label className="block text-xs font-bold text-[var(--text-primary)]">
                    Digite o PIN de 6 dígitos exibido no balcão:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={12}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.toUpperCase())}
                      placeholder="Ex: 849201 ou BR-QR-..."
                      className="min-w-0 flex-1 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 font-mono text-sm font-bold tracking-wider text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={checkinLoading}
                      onClick={() => handleValidateCheckin()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#123B56] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#102F46] disabled:opacity-50"
                    >
                      {checkinLoading ? 'Validando...' : 'Confirmar'}
                    </button>
                  </div>

                  {/* Fast Simulation Action for Immediate Testing */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleValidateCheckin()}
                      className="text-xs font-semibold text-[#FF6B35] hover:underline"
                    >
                      💡 Simular Validação Rápida no Balcão
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCheckinPanel(false)}
                      className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      Cancelar
                    </button>
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
            </div>
          )}

          {/* CTA 2: COMO CHEGAR (MOBILIDADE INTEGRADA) */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Como Chegar
            </span>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={uberUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 text-xs font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35] hover:bg-black hover:text-white"
              >
                <span>🚗 Uber</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>

              <button
                type="button"
                onClick={() => launchNineNineRide(rideCoords)}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 text-xs font-bold text-[var(--text-primary)] transition hover:border-amber-500 hover:bg-amber-500 hover:text-black"
              >
                <span>🚕 99</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </button>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 text-xs font-bold text-[var(--text-primary)] transition hover:border-[#0077B6] hover:bg-[#0077B6] hover:text-white"
              >
                <span>🗺️ Maps</span>
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            </div>
          </div>

          {/* CTA 3: INDICAÇÃO & CONVITE (WHATSAPP COM LINK OFICIAL DO APP) */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="h-4 w-4 text-[#397B68]" />
                <span className="text-xs font-bold text-[var(--text-primary)]">
                  Chamar Amigos para Ir Junto
                </span>
              </div>
              <span className="text-xs font-bold text-amber-500">
                +100 RP por amigo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <span>WhatsApp</span>
                <Share2 className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                onClick={handleCopyShareLink}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2.5 text-xs font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35]"
              >
                {copiedLink ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                    <span>Link Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar Link do App</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* REGRAS CLARAS EM 3 BULLETS (SEM TEXTÃO NEM FONTE PEQUENA) */}
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--bg-canvas)] p-3 text-center">
            <div className="space-y-1">
              <span className="block text-base">💳</span>
              <p className="text-xs font-bold text-[var(--text-primary)]">Pagamento Direto</p>
              <p className="text-xs text-[var(--text-secondary)]">100% no local</p>
            </div>
            <div className="space-y-1 border-x border-[var(--border-hairline)]">
              <span className="block text-base">🎁</span>
              <p className="text-xs font-bold text-[var(--text-primary)]">Vantagem VIP</p>
              <p className="text-xs text-[var(--text-secondary)]">Ativa com check-in</p>
            </div>
            <div className="space-y-1">
              <span className="block text-base">⏱️</span>
              <p className="text-xs font-bold text-[var(--text-primary)]">Tolerância</p>
              <p className="text-xs text-[var(--text-secondary)]">15 minutos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import {
  AlertCircle,
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
import { useState } from 'react';
import { formatOfferingSchedule } from '../services/opportunityStore';
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
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinFeedback, setCheckinFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isCelebrationActive, setIsCelebrationActive] = useState(false);

  const isCheckedIn =
    currentRes.stage === 'CHECKED_IN' ||
    currentRes.stage === 'VERIFIED_VISIT' ||
    currentRes.stage === 'VERIFIED_CONSUMPTION';

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

  const handleValidateCheckin = (codeOrPinToUse?: string) => {
    setCheckinLoading(true);
    setCheckinFeedback(null);

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

  const handleShareWhatsApp = () => {
    const venueLink = getMyReferralLink(venueId);
    const myCode = getMyReferralCode();
    const text = `Bora comigo no *${venueName}* (${neighborhood})?\nConsegui uma vantagem exclusiva pelo Bora Club: *${offeringTitle}*!\n\nAcesse pelo link oficial para aproveitar também:\n${venueLink}\n\nCódigo de indicação: *${myCode}*`;
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
          {!isCheckedIn ? (
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
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-200">
              <p className="font-bold text-sm">✅ Benefício utilizado com sucesso!</p>
              <p className="mt-0.5">Sua visita foi registrada e os 250 Rio Points foram creditados em seu saldo.</p>
            </div>
          )}

          {/* 4. SEU GRUPO & VALIDAÇÃO INDIVIDUAL */}
          {totalGuests > 1 && (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-[#FF6B35]" />
                  Seu grupo ({isCheckedIn ? 1 : 0} de {totalGuests} confirmados)
                </span>
                <span className="text-[10px] font-bold uppercase rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 px-2.5 py-0.5">
                  Check-in individual
                </span>
              </div>

              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                <strong>Cada pessoa valida sua própria visita.</strong> Para todos receberem seus 250 Rio Points e registrarem o carimbo no Passaporte BoraRio, cada participante deve abrir o app e validar a presença no balcão.
              </p>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-xl bg-[var(--bg-surface)] px-3 py-2 text-xs border border-[var(--border-hairline)]">
                  <span className="font-semibold text-[var(--text-primary)]">Você (Titular)</span>
                  {isCheckedIn ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Validado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                      <Clock className="h-3.5 w-3.5" /> Aguardando check-in
                    </span>
                  )}
                </div>

                {Array.from({ length: totalGuests - 1 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl bg-[var(--bg-surface)] px-3 py-2 text-xs border border-[var(--border-hairline)]"
                  >
                    <span className="text-[var(--text-secondary)]">Participante {idx + 2}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-tertiary)]">
                      <Clock className="h-3 w-3" /> Aguardando no app
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 p-2.5 text-[11px] text-sky-950 dark:text-sky-200">
                💡 <em>Por que cada um deve fazer o check-in?</em> Assim, cada pessoa recebe seus próprios pontos e registra sua visita no Passaporte BoraRio.
              </div>
            </div>
          )}

          {/* 5. ÁREA DE COMPARTILHAMENTO SIMPLIFICADA */}
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Share2 className="h-3.5 w-3.5 text-emerald-600" />
                  Chamar amigos para ir junto
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  Seu amigo também ganha benefícios e você recebe pontos adicionais quando a visita dele for validada no local.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                  title="Copiar link do benefício"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* 6. COMO CHEGAR (ATALHOS COMPACTOS DE MOBILIDADE) */}
          <div className="pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
              Como Chegar
            </span>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <a
                href={uberUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2 text-xs font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35]"
              >
                <span>🚗 Uber</span>
                <ExternalLink className="h-3 w-3 text-[var(--text-tertiary)]" />
              </a>

              <button
                type="button"
                onClick={() => launchNineNineRide(rideCoords)}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2 text-xs font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35]"
              >
                <span>🟡 99</span>
                <ExternalLink className="h-3 w-3 text-[var(--text-tertiary)]" />
              </button>

              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] py-2 text-xs font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35]"
              >
                <span>🗺️ Maps</span>
                <ExternalLink className="h-3 w-3 text-[var(--text-tertiary)]" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

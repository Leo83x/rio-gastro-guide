import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Gift,
  Info,
  MapPin,
  Share2,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { formatOfferingSchedule } from '../services/opportunityStore';
import { getMyReferralLink } from '../services/referralStore';
import { createReservationRequest } from '../services/superappStore';
import type { ReservationRequest } from '../types/experience';
import type { PartnerOffering } from '../types/marketplace';
import type { Restaurant } from '../types/restaurant';
import { DIRECT_PAYMENT_NOTICE } from '../types/verification';

interface BenefitActivationModalProps {
  offering: PartnerOffering;
  restaurant?: Restaurant | null;
  onClose: () => void;
  onActivated: (reservation: ReservationRequest) => void;
}

export function BenefitActivationModal({
  offering,
  restaurant,
  onClose,
  onActivated,
}: BenefitActivationModalProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Parâmetros opcionais para reserva tradicional
  const [todayIso] = useState(() => new Date().toISOString().slice(0, 10));
  const [resDate, setResDate] = useState(offering.service_date || todayIso);
  const [resTime, setResTime] = useState(offering.time_slot_label || '20:00');
  const [resGuests, setResGuests] = useState(2);

  const venueName = offering.restaurant_name || restaurant?.name || 'Estabelecimento';
  const neighborhood = offering.neighborhood || restaurant?.neighborhood || 'Rio de Janeiro';
  const coverImage = offering.image_url || restaurant?.cover_image || '';
  const isTraditionalBooking = offering.modality === 'TRADITIONAL_BOOKING';

  const scheduleLabel = formatOfferingSchedule(offering.service_date, offering.time_slot_label);

  const handleActivate = () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const newReservation = createReservationRequest({
        experience_id: offering.restaurant_id,
        experience_name: venueName,
        neighborhood,
        latitude: restaurant?.latitude || -22.9068,
        longitude: restaurant?.longitude || -43.1729,
        date: isTraditionalBooking ? resDate : offering.service_date || todayIso,
        time: isTraditionalBooking ? resTime : offering.time_slot_label || '20:00',
        guests: isTraditionalBooking ? resGuests : 2,
        modality: offering.modality,
        offering_id: offering.id,
        offering_title: offering.title,
        whatsapp_reminder: true,
        payment_instruction: DIRECT_PAYMENT_NOTICE,
        snapshot_terms: {
          title: offering.title,
          benefit_summary: offering.benefit_summary,
          base_price_brl: offering.base_price_brl,
          partner_condition_price_brl: offering.partner_condition_price_brl,
          estimated_savings_brl: offering.estimated_savings_brl,
        },
      });

      onActivated(newReservation);
    } catch {
      setErrorMsg('Não foi possível ativar o benefício no momento. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar confirmação"
          className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition hover:bg-black/75"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Top Header Banner */}
        <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-[#0F2338] via-[#123B56] to-[#0A1828]">
          {coverImage && (
            <img
              src={coverImage}
              alt={venueName}
              className="h-full w-full object-cover opacity-65"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-surface)] via-transparent to-black/40" />

          <div className="absolute left-5 top-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-black/60 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 backdrop-blur-md">
              <Gift className="h-3.5 w-3.5 text-emerald-400" />
              Benefício Disponível
            </span>
          </div>

          <div className="absolute bottom-3 left-5 right-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Seu próximo rolê tem vantagem
            </p>
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl drop-shadow-md truncate">
              {venueName}
            </h2>
            <p className="flex items-center gap-1 text-xs text-white/90">
              <MapPin className="h-3.5 w-3.5 text-[#FF6B35]" />
              {neighborhood}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-5 sm:p-7 space-y-5">
          {/* O que está garantido */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
              Vantagem Garantida
            </span>
            <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)] leading-snug">
              {offering.benefit_summary || offering.title}
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
              Benefício válido para as condições e o período informados pelo estabelecimento. Pagamento 100% no local.
            </p>
          </div>

          {/* Reserva tradicional campos (se aplicável) */}
          {isTraditionalBooking ? (
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[#FF6B35]" />
                  Reserva de Mesa
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">Direto no local</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Data</label>
                  <input
                    type="date"
                    min={todayIso}
                    value={resDate}
                    onChange={(e) => setResDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Horário</label>
                  <select
                    value={resTime}
                    onChange={(e) => setResTime(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)]"
                  >
                    <option value="12:30">12:30</option>
                    <option value="13:00">13:00</option>
                    <option value="19:30">19:30</option>
                    <option value="20:00">20:00</option>
                    <option value="20:30">20:30</option>
                    <option value="21:00">21:00</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Pessoas</label>
                  <select
                    value={resGuests}
                    onChange={(e) => setResGuests(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-primary)]"
                  >
                    {[1, 2, 3, 4, 5, 6, 8].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'pessoa' : 'pessoas'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                <span>A solicitação ainda não significa confirmação. O estabelecimento confirmará a mesa.</span>
              </p>
            </div>
          ) : (
            /* Checklist "Antes de ativar" para vouchers normais */
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-4 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Antes de ativar
              </p>

              <div className="flex items-start gap-2.5 text-xs">
                <Clock className="h-4 w-4 shrink-0 text-[#FF6B35] mt-0.5" />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Validade da Oportunidade</p>
                  <p className="text-[var(--text-secondary)]">{scheduleLabel}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Condições de Utilização</p>
                  <p className="text-[var(--text-secondary)]">
                    {offering.rules_summary || 'Válido para consumo no local. Apresente o QR Code ao atendente.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs">
                <Users className="h-4 w-4 shrink-0 text-[#0077B6] mt-0.5" />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">Utilização Direta</p>
                  <p className="text-[var(--text-secondary)]">
                    Basta apresentar o voucher digital no balcão (sem necessidade de reserva de mesa).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recompensa */}
          <div className="flex items-center justify-between rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Recompensa após check-in individual</p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  Você receberá 250 Rio Points (R$ 2,50 de poder de troca) após a validação da visita.
                </p>
              </div>
            </div>
            <span className="shrink-0 text-xs font-black text-emerald-500 bg-emerald-500/20 px-2.5 py-1 rounded-lg">
              +250 RP
            </span>
          </div>

          {/* Aviso Pedagógico e Convite para Acompanhantes */}
          <div className="space-y-2.5 rounded-2xl border border-sky-500/25 bg-sky-500/10 p-3.5 text-xs text-sky-950 dark:text-sky-200">
            <div className="flex items-start gap-2.5">
              <Users className="h-4 w-4 shrink-0 text-[#0077B6] mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-[var(--text-primary)]">Vai acompanhado?</p>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  Cada pessoa precisa ativar seu próprio passe para receber o benefício e validar sua presença no local.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const link = getMyReferralLink(offering.restaurant_id);
                const text = `Bora comigo em *${venueName}* (${neighborhood})?\nAtive seu próprio passe no BoraRio para garantir o benefício individual (*${offering.title}*):\n${link}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
              }}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 transition"
            >
              <Share2 className="h-3.5 w-3.5" />
              Convidar acompanhantes pelo WhatsApp
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* CTA Principal Único */}
          <button
            type="button"
            disabled={loading}
            onClick={handleActivate}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-4 text-sm font-bold text-white shadow-xl shadow-[#FF4B2B]/20 transition-all hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <span>Ativando benefício...</span>
            ) : isTraditionalBooking ? (
              <span>Solicitar Reserva de Mesa</span>
            ) : (
              <span>Ativar meu benefício 🎟️</span>
            )}
          </button>

          <p className="text-center text-[10px] text-[var(--text-tertiary)]">
            Ao ativar, seu voucher fica salvo no Bora Club e disponível para validação no estabelecimento.
          </p>
        </div>
      </div>
    </div>
  );
}

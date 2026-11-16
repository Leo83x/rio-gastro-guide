import {
  Bookmark,
  Building2,
  Calendar,
  Car,
  Clock,
  ExternalLink,
  MapPin,
  Music,
  Navigation,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { formatEventDateBadgePt } from '../services/nightlife/nightlifeDedup';
import {
  NIGHTLIFE_SOURCE_LABELS,
  NIGHTLIFE_SUBAREA_META,
  type NightlifeAvailabilityStatus,
  type NightlifeEvent,
} from '../types/nightlife';
import type { Restaurant } from '../types/restaurant';
import { NightlifeCoverArt } from './NightlifeCoverArt';

interface NightlifeEventModalProps {
  event: NightlifeEvent;
  linkedVenue?: Restaurant | null;
  inVault?: boolean;
  onClose: () => void;
  onOpenPermanentVenue?: (venue: Restaurant) => void;
  onSaveToVault?: (event: NightlifeEvent) => void;
  onAskBoraIa?: (promptText: string) => void;
}

const AVAILABILITY_META: Record<
  NightlifeAvailabilityStatus,
  { label: string; cls: string }
> = {
  DISPONIVEL: {
    label: 'Disponível',
    cls: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
  },
  ULTIMOS_INGRESSOS: {
    label: 'Últimos ingressos',
    cls: 'bg-amber-500/25 text-amber-100 border-amber-400/40',
  },
  ESGOTADO: {
    label: 'Esgotado',
    cls: 'bg-red-500/25 text-red-100 border-red-400/45',
  },
  LISTA_AMIGA: {
    label: 'Lista amiga / Condição',
    cls: 'bg-purple-500/25 text-purple-100 border-purple-400/40',
  },
  PORTA: {
    label: 'Na porta / Bilheteria',
    cls: 'bg-sky-500/25 text-sky-100 border-sky-400/40',
  },
  GRATUITO: {
    label: 'Entrada gratuita',
    cls: 'bg-emerald-500/25 text-emerald-100 border-emerald-400/45',
  },
};

export function NightlifeEventModal({
  event,
  linkedVenue = null,
  inVault = false,
  onClose,
  onOpenPermanentVenue,
  onSaveToVault,
  onAskBoraIa,
}: NightlifeEventModalProps) {
  const meta = NIGHTLIFE_SUBAREA_META[event.sub_area];
  const availMeta = AVAILABILITY_META[event.availability_status] || AVAILABILITY_META.DISPONIVEL;
  const dateLabel = formatEventDateBadgePt(event.event_date);
  const sourceLabel = NIGHTLIFE_SOURCE_LABELS[event.source_platform] || event.source_platform;

  const destinationQuery = encodeURIComponent(
    `${event.venue_name} ${event.address || `${event.neighborhood}, Rio de Janeiro`}`
  );
  const googleMapsUrl =
    event.latitude && event.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${destinationQuery}`;

  const uberUrl =
    event.latitude && event.longitude
      ? `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${event.latitude}&dropoff[longitude]=${event.longitude}&dropoff[nickname]=${encodeURIComponent(
          event.venue_name
        )}`
      : `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${destinationQuery}`;

  const isSoldOut = event.availability_status === 'ESGOTADO';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nightlife-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative my-auto max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-none border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes do evento"
          className="fixed right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-md transition hover:bg-[#FF6B35] sm:absolute"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Capa do evento */}
        <div className="relative aspect-[16/9] max-h-[320px] w-full overflow-hidden bg-[#0D1E30]">
          <NightlifeCoverArt
            src={event.cover_image}
            alt={event.title}
            subArea={event.sub_area}
            imageOrigin={event.image_origin}
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07111C]/95 via-[#07111C]/35 to-transparent" />

          <div className="absolute inset-x-5 bottom-5 flex flex-col gap-2 sm:inset-x-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#FF6B35] px-3 py-1 text-[11px] font-bold text-white">
                {meta.label}
              </span>
              <span
                className={`rounded-full border px-3 py-1 text-[11px] font-bold backdrop-blur-md ${availMeta.cls}`}
              >
                {availMeta.label}
              </span>
              <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                {event.age_rating || '18+'}
              </span>
            </div>

            <h2
              id="nightlife-modal-title"
              className="font-sans text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
            >
              {event.title}
            </h2>
          </div>
        </div>

        {/* Corpo */}
        <div className="space-y-5 p-5 sm:p-7">
          {/* Metadados principais */}
          <div className="grid gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 sm:grid-cols-3">
            <div className="flex items-start gap-2.5">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" />
              <div className="text-xs">
                <p className="font-bold text-[var(--text-primary)]">{dateLabel}</p>
                <p className="text-[var(--text-secondary)]">
                  Início {event.start_time}
                  {event.end_time ? ` · Término previsto ${event.end_time}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#FF6B35]" />
              <div className="text-xs">
                <p className="font-bold text-[var(--text-primary)]">{event.venue_name}</p>
                <p className="text-[var(--text-secondary)]">
                  {event.neighborhood}
                  {event.address ? ` · ${event.address}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-[#397B68]" />
              <div className="text-xs">
                <p className="font-bold text-[var(--text-primary)]">
                  {event.price_display_label}
                </p>
                <p className="text-[var(--text-secondary)]">Fonte: {sourceLabel}</p>
              </div>
            </div>
          </div>

          {/* Resumo editorial */}
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Sobre a programação</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {event.short_summary}
            </p>
          </div>

          {/* Line-up e gêneros */}
          {(event.lineup.length > 0 || event.music_genres.length > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {event.lineup.length > 0 && (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                    <Users className="h-3.5 w-3.5 text-[#FF6B35]" />
                    Line-up / Atrações
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.lineup.map((artist) => (
                      <span
                        key={artist}
                        className="rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--text-primary)]"
                      >
                        {artist}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {event.music_genres.length > 0 && (
                <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                    <Music className="h-3.5 w-3.5 text-[#397B68]" />
                    Gêneros e atmosfera
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.music_genres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-full bg-[#397B68]/12 px-2.5 py-0.5 text-[11px] font-bold text-[#397B68] dark:text-[#4CA188]"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transparência & Procedência */}
          <div className="rounded-2xl border border-[#397B68]/30 bg-[#397B68]/8 p-3.5 text-xs">
            <p className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
              <ShieldCheck className="h-4 w-4 text-[#397B68]" />
              Sem cobrança nem intermediação financeira no BoraRio
            </p>
            <p className="mt-1 text-[var(--text-secondary)]">
              O BoraRio reúne a agenda curada da noite carioca e direciona você com transparência para a fonte oficial de ingresso ou para a casa realizadora. Curadoria verificada em{' '}
              {new Date(event.last_verified_at).toLocaleDateString('pt-BR')}.
            </p>
          </div>

          {/* Ações */}
          <div className="flex flex-wrap gap-2.5">
            {event.ticket_url && !isSoldOut && (
              <a
                href={event.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-95 sm:text-sm"
              >
                <Ticket className="h-4 w-4" />
                Ver ingressos na fonte oficial ({sourceLabel})
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}

            {isSoldOut && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-600 dark:text-red-300">
                <Clock className="h-4 w-4" />
                Lotes esgotados na fonte oficial
              </span>
            )}

            {linkedVenue && onOpenPermanentVenue && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPermanentVenue(linkedVenue);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[#123B56]/35 bg-[#123B56] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#102F46] sm:text-sm"
              >
                <Building2 className="h-4 w-4 text-[#F7931E]" />
                Abrir ficha da casa no BoraRio
              </button>
            )}

            {onSaveToVault && (
              <button
                type="button"
                onClick={() => onSaveToVault(event)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition sm:text-sm ${
                  inVault
                    ? 'bg-[#FF6B35] text-white'
                    : 'border border-[#FF6B35]/40 bg-[#FF6B35]/10 text-[#FF6B35] hover:bg-[#FF6B35] hover:text-white'
                }`}
              >
                <Bookmark className={`h-4 w-4 ${inVault ? 'fill-current' : ''}`} />
                {inVault ? 'Salvo no Cofre' : 'Guardar no Cofre'}
              </button>
            )}

            {onAskBoraIa && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAskBoraIa(
                    `Monte um plano para ir ao evento "${event.title}" em ${event.neighborhood} com bar ou jantar antes.`
                  );
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35] sm:text-sm"
              >
                <Sparkles className="h-4 w-4 text-[#FF6B35]" />
                Combinar com Bora IA
              </button>
            )}

            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] hover:border-[#123B56]"
            >
              <Navigation className="h-3.5 w-3.5 text-[#FF6B35]" />
              Maps
            </a>

            <a
              href={uberUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs font-bold text-[var(--text-primary)] hover:border-[#123B56]"
            >
              <Car className="h-3.5 w-3.5" />
              Uber
            </a>
          </div>

          {event.alternate_ticket_urls && event.alternate_ticket_urls.length > 0 && (
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs">
              <p className="font-bold text-[var(--text-primary)]">
                Outras plataformas oficiais detectadas (deduplicado):
              </p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {event.alternate_ticket_urls.map((alt) => (
                  <a
                    key={alt.ticket_url}
                    href={alt.ticket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 font-semibold text-[#FF6B35] hover:underline"
                  >
                    {NIGHTLIFE_SOURCE_LABELS[alt.source_platform] || alt.source_platform}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

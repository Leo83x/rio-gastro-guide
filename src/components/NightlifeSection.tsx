import {
  ArrowRight,
  Bookmark,
  Building2,
  CalendarClock,
  Clock,
  Disc3,
  MapPin,
  Mic2,
  MoonStar,
  Music,
  Sparkles,
  Ticket,
  Wine,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  cleanEventTitle,
  formatEventDateBadgePt,
  isEventVisiblePublicly,
  matchesDateFilter,
} from '../services/nightlife/nightlifeDedup';
import {
  NIGHTLIFE_SUBAREA_META,
  type NightlifeDateFilter,
  type NightlifeEvent,
  type NightlifeSubArea,
} from '../types/nightlife';
import type { Restaurant } from '../types/restaurant';
import { NightlifeCoverArt } from './NightlifeCoverArt';
import { NightlifeEventModal } from './NightlifeEventModal';

interface NightlifeSectionProps {
  events: NightlifeEvent[];
  permanentVenues: Restaurant[];
  savedEventTitlesOrUrls?: Set<string>;
  onSelectPermanentVenue: (venue: Restaurant) => void;
  onFilterPermanentNightlife?: () => void;
  onSaveEventToVault?: (event: NightlifeEvent) => void;
  onAskBoraIa?: (promptText: string) => void;
  onGoToAdminNightlife?: () => void;
  activeSubArea?: NightlifeSubArea | 'ALL';
  onSubAreaChange?: (subArea: NightlifeSubArea | 'ALL') => void;
  activeDateFilter?: NightlifeDateFilter;
  onDateFilterChange?: (dateFilter: NightlifeDateFilter) => void;
}

const SUBAREA_FILTERS: Array<{
  id: NightlifeSubArea | 'ALL';
  label: string;
  icon: typeof Sparkles;
}> = [
  { id: 'ALL', label: 'Todas', icon: Sparkles },
  { id: 'SAMBA_PAGODE', label: 'Samba e pagode', icon: Music },
  { id: 'FESTAS_BALADAS', label: 'Festas e baladas', icon: Disc3 },
  { id: 'SHOWS', label: 'Shows', icon: Mic2 },
  { id: 'ROOFTOPS_EXPERIENCIAS', label: 'Rooftops e experiências', icon: Wine },
];

const DATE_FILTERS: Array<{ id: NightlifeDateFilter; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'TODAY', label: 'Hoje' },
  { id: 'TOMORROW', label: 'Amanhã' },
  { id: 'FRIDAY', label: 'Sexta' },
  { id: 'SATURDAY', label: 'Sábado' },
  { id: 'SUNDAY', label: 'Domingo' },
  { id: 'FREE', label: 'Gratuitos' },
];

export function NightlifeSection({
  events,
  permanentVenues,
  savedEventTitlesOrUrls = new Set(),
  onSelectPermanentVenue,
  onFilterPermanentNightlife,
  onSaveEventToVault,
  onAskBoraIa,
  activeSubArea,
  onSubAreaChange,
  activeDateFilter,
  onDateFilterChange,
}: NightlifeSectionProps) {
  const [internalSubAreaFilter, setInternalSubAreaFilter] = useState<NightlifeSubArea | 'ALL'>('ALL');
  const [internalDateFilter, setInternalDateFilter] = useState<NightlifeDateFilter>('ALL');
  const [expanded, setExpanded] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<NightlifeEvent | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const subAreaFilter = activeSubArea !== undefined ? activeSubArea : internalSubAreaFilter;
  const dateFilter = activeDateFilter !== undefined ? activeDateFilter : internalDateFilter;

  const handleSubAreaClick = (sub: NightlifeSubArea | 'ALL') => {
    setInternalSubAreaFilter(sub);
    onSubAreaChange?.(sub);
  };

  const handleDateClick = (df: NightlifeDateFilter) => {
    setInternalDateFilter(df);
    onDateFilterChange?.(df);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const activePublished = useMemo(() => {
    const now = new Date(nowMs);
    return events
      .filter((ev) => isEventVisiblePublicly(ev, now))
      .sort((a, b) => {
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      });
  }, [events, nowMs]);

  const filteredEvents = useMemo(() => {
    const now = new Date(nowMs);
    return activePublished.filter((ev) => {
      if (subAreaFilter !== 'ALL' && ev.sub_area !== subAreaFilter) return false;
      if (!matchesDateFilter(ev, dateFilter, now)) return false;
      return true;
    });
  }, [activePublished, subAreaFilter, dateFilter, nowMs]);

  const matchingPermanentVenues = useMemo(() => {
    if (subAreaFilter === 'ALL') return [];
    return permanentVenues.filter((v) => {
      const cat = (v.category || '').toLowerCase();
      const name = (v.name || '').toLowerCase();
      const desc = (v.description || '').toLowerCase();

      if (subAreaFilter === 'ROOFTOPS_EXPERIENCIAS') {
        return (
          cat.includes('rooftop') ||
          name.includes('rooftop') ||
          desc.includes('rooftop') ||
          desc.includes('vista panorâmica')
        );
      }
      if (subAreaFilter === 'SAMBA_PAGODE') {
        return (
          cat.includes('samba') ||
          name.includes('samba') ||
          desc.includes('samba') ||
          name.includes('scenarium') ||
          name.includes('rato')
        );
      }
      if (subAreaFilter === 'FESTAS_BALADAS') {
        return (
          cat.includes('balada') ||
          cat.includes('festa') ||
          name.includes('bosque') ||
          name.includes('circo')
        );
      }
      if (subAreaFilter === 'SHOWS') {
        return (
          cat.includes('show') ||
          cat.includes('teatro') ||
          name.includes('circo') ||
          name.includes('municipal')
        );
      }
      return false;
    });
  }, [permanentVenues, subAreaFilter]);

  const visibleEvents = expanded ? filteredEvents : filteredEvents.slice(0, 6);

  const selectedLinkedVenue = useMemo(() => {
    if (!selectedEvent?.venue_id) return null;
    return permanentVenues.find((v) => v.id === selectedEvent.venue_id) || null;
  }, [selectedEvent, permanentVenues]);

  return (
    <section
      aria-labelledby="home-block-nightlife"
      className="rounded-3xl border border-[#123B56]/25 bg-gradient-to-br from-[#0A1828] via-[#0E2235] to-[#123B56] p-5 text-white shadow-lg sm:p-7"
    >
      {/* Cabeçalho da vertical */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="home-block-nightlife"
            className="font-sans text-2xl font-black tracking-tight text-white sm:text-3xl flex items-center gap-2.5"
          >
            <MoonStar className="h-6 w-6 text-[#FFB347]" />
            A noite carioca
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onFilterPermanentNightlife && (
            <button
              type="button"
              onClick={onFilterPermanentNightlife}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
            >
              Bares, casas e shows no catálogo <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-áreas */}
      <div className="mt-4 flex w-full items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {SUBAREA_FILTERS.map((sub) => {
          const Icon = sub.icon;
          const active = subAreaFilter === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => handleSubAreaClick(sub.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                active
                  ? 'bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-sm'
                  : 'border border-white/20 bg-white/8 text-white/85 hover:bg-white/15 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* Recorte temporal */}
      <div className="mt-2.5 flex w-full items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {DATE_FILTERS.map((df) => {
          const active = dateFilter === df.id;
          return (
            <button
              key={df.id}
              type="button"
              onClick={() => handleDateClick(df.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                active
                  ? 'bg-white text-[#0D1E30]'
                  : 'border border-white/15 bg-white/5 text-[#F1E8D8]/85 hover:bg-white/12'
              }`}
            >
              {df.label}
            </button>
          );
        })}
      </div>

      {/* Conteúdo principal: Estado Convidativo vs Agenda Publicada */}
      {activePublished.length === 0 ? (
        <div
          data-testid="nightlife-clean-empty-state"
          className="mt-5 flex flex-col justify-between gap-4 rounded-2xl border border-dashed border-white/25 bg-white/6 p-5 backdrop-blur-md sm:flex-row sm:items-center"
        >
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF6B35]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#FFB347]">
              <Sparkles className="h-3.5 w-3.5" />
              Programação da Noite
            </div>
            <p className="text-sm font-bold text-white sm:text-base">
              Fique por dentro das melhores festas, sambas e shows do Rio!
            </p>
            <p className="max-w-2xl text-xs leading-relaxed text-[#F1E8D8]/85">
              Reunimos os eventos mais disputados da cidade com horários confirmados e ingressos oficiais para você curtir sem erro. Enquanto os próximos agitos entram em cartaz, aproveite para descobrir os bares, rooftops e botecos incríveis abertos hoje!
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {onFilterPermanentNightlife && (
              <button
                type="button"
                onClick={onFilterPermanentNightlife}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-95"
              >
                <span>Explorar Bares &amp; Casas Noturnas</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/6 p-5 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-sm font-bold text-white">
                Nenhum evento com ingresso aberto para esta data específica.
              </p>
              <p className="text-xs text-[#F1E8D8]/80">
                {matchingPermanentVenues.length > 0
                  ? `Confira as casas e rooftops recomendados abertos abaixo:`
                  : `Há ${activePublished.length} evento(s) na programação completa de A noite carioca.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                handleSubAreaClick('ALL');
                handleDateClick('ALL');
              }}
              className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#0D1E30]"
            >
              Ver toda a programação ({activePublished.length})
            </button>
          </div>

          {matchingPermanentVenues.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matchingPermanentVenues.map((venue) => (
                <div
                  key={venue.id}
                  onClick={() => onSelectPermanentVenue(venue)}
                  className="group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 p-3.5 transition hover:bg-white/20"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white group-hover:text-[#FFB347]">
                      {venue.name}
                    </p>
                    <p className="truncate text-xs text-[#F1E8D8]/80">
                      {venue.neighborhood} · {venue.category}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-[#FFB347]">Ver casa →</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEvents.map((ev) => {
              const subMeta = NIGHTLIFE_SUBAREA_META[ev.sub_area];
              const dateLabel = formatEventDateBadgePt(ev.event_date);
              const linkedVenue = ev.venue_id
                ? permanentVenues.find((v) => v.id === ev.venue_id)
                : undefined;
              const isSaved =
                savedEventTitlesOrUrls.has(ev.title) ||
                (ev.ticket_url ? savedEventTitlesOrUrls.has(ev.ticket_url) : false);

              return (
                <article
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0B1B2B]/90 shadow-md transition hover:-translate-y-0.5 hover:border-[#FF6B35]/70"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden">
                    <NightlifeCoverArt
                      src={ev.cover_image}
                      alt={ev.title}
                      subArea={ev.sub_area}
                      imageOrigin={ev.image_origin}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#07111C]/90 via-transparent to-black/35" />

                    <div className="absolute left-3 right-3 top-3 flex flex-wrap items-center justify-between gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
                        <CalendarClock className="h-3 w-3 text-[#FF6B35]" />
                        {dateLabel} · {ev.start_time}
                      </span>

                      {ev.availability_status === 'ESGOTADO' ? (
                        <span className="rounded-full bg-red-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white">
                          Esgotado
                        </span>
                      ) : ev.availability_status === 'ULTIMOS_INGRESSOS' ? (
                        <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-[#102F46]">
                          Últimos ingressos
                        </span>
                      ) : ev.is_featured ? (
                        <span className="rounded-full bg-gradient-to-r from-[#FF4B2B] to-[#F7931E] px-2.5 py-0.5 text-[10px] font-bold text-white">
                          Destaque
                        </span>
                      ) : null}
                    </div>

                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2">
                      <span className="rounded-full border border-white/20 bg-white/15 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
                        {subMeta.shortLabel}
                      </span>
                      {onSaveEventToVault && (
                        <button
                          type="button"
                          aria-label={isSaved ? 'Salvo em Meus Desejos' : 'Salvar evento em Meus Desejos'}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSaveEventToVault(ev);
                          }}
                          className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-md transition ${
                            isSaved
                              ? 'bg-[#FF6B35] text-white'
                              : 'bg-black/60 text-white hover:bg-[#FF6B35]'
                          }`}
                        >
                          <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <h3 className="line-clamp-2 font-sans text-base font-bold leading-snug text-white group-hover:text-[#FFB347]">
                        {cleanEventTitle(ev.title)}
                      </h3>

                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#F1E8D8]">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#FF6B35]" />
                        <span className="truncate">
                          {ev.venue_name} · {ev.neighborhood}
                        </span>
                      </p>

                      {ev.music_genres.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {ev.music_genres.slice(0, 2).map((genre) => (
                            <span
                              key={genre}
                              className="rounded-full border border-white/15 bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-[#F1E8D8]"
                            >
                              {genre}
                            </span>
                          ))}
                          {linkedVenue && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#397B68]/25 px-2 py-0.5 text-[10px] font-bold text-[#95E4CA]">
                              <Building2 className="h-2.5 w-2.5" />
                              Casa no BoraRio
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
                      <span className="inline-flex items-center gap-1 font-bold text-[#FFB347]">
                        <Ticket className="h-3.5 w-3.5" />
                        {ev.price_display_label}
                      </span>
                      <span className="font-bold text-white/90 group-hover:text-[#FF6B35]">
                        Ver detalhes →
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredEvents.length > 6 && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20"
              >
                <Clock className="h-3.5 w-3.5" />
                {expanded
                  ? 'Mostrar apenas 6 destaques da noite'
                  : `Ver todos os eventos da noite (${filteredEvents.length})`}
              </button>
            </div>
          )}
        </>
      )}

      {selectedEvent && (
        <NightlifeEventModal
          event={selectedEvent}
          linkedVenue={selectedLinkedVenue}
          inVault={
            savedEventTitlesOrUrls.has(selectedEvent.title) ||
            (selectedEvent.ticket_url
              ? savedEventTitlesOrUrls.has(selectedEvent.ticket_url)
              : false)
          }
          onClose={() => setSelectedEvent(null)}
          onOpenPermanentVenue={onSelectPermanentVenue}
          onSaveToVault={onSaveEventToVault}
          onAskBoraIa={onAskBoraIa}
        />
      )}
    </section>
  );
}

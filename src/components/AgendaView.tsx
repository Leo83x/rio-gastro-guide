import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Clock,
  MapPin,
  Navigation,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { cancelReservation } from '../services/superappStore';
import type { ReservationRequest } from '../types/experience';
import type { Restaurant } from '../types/restaurant';

interface AgendaViewProps {
  experiences: Restaurant[];
  reservations: ReservationRequest[];
  onReservationsUpdated: (next: ReservationRequest[]) => void;
  onSelectExperience: (item: Restaurant) => void;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildGoogleCalendarUrl(r: ReservationRequest): string {
  const start = `${r.date.replace(/-/g, '')}T${r.time.replace(':', '')}00`;
  const hour = Math.min(23, parseInt(r.time.split(':')[0] || '19', 10) + 2);
  const end = `${r.date.replace(/-/g, '')}T${String(hour).padStart(2, '0')}${r.time.split(':')[1] || '00'}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${r.experience_name} — Rio Gastro Guide`,
    dates: `${start}/${end}`,
    details: `Reserva para ${r.guests} pessoas (${r.status === 'CONFIRMED' ? 'Confirmada' : 'Solicitação pendente'}).`,
    location: `${r.neighborhood}, Rio de Janeiro - RJ`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function AgendaView({
  experiences,
  reservations,
  onReservationsUpdated,
  onSelectExperience,
}: AgendaViewProps) {
  const [onlyFreeEvents, setOnlyFreeEvents] = useState(false);
  const [nearCenterOnly, setNearCenterOnly] = useState(false);

  const cityEvents = useMemo(() => {
    return experiences.filter((e) => {
      const isEventOrCulture =
        e.macro_category === 'Eventos & Shows' ||
        e.macro_category === 'Cultura & Museus' ||
        e.macro_category === 'Vida Noturna' ||
        e.macro_category === 'Atrações Infantis';
      if (!isEventOrCulture) return false;
      if (onlyFreeEvents && !e.attributes?.is_free) return false;
      if (nearCenterOnly) {
        const km = haversineKm(-22.92, -43.18, e.latitude, e.longitude);
        if (km > 5) return false;
      }
      return true;
    });
  }, [experiences, onlyFreeEvents, nearCenterOnly]);

  const nearbyDiningForEvent = (ev: Restaurant): Restaurant[] => {
    return experiences
      .filter((r) => (r.macro_category || 'Gastronomia') === 'Gastronomia' && r.id !== ev.id)
      .map((r) => ({
        item: r,
        dist: haversineKm(ev.latitude, ev.longitude, r.latitude, r.longitude),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2)
      .map((x) => x.item);
  };

  // Detect conflicts among active reservations
  const activeReservations = useMemo(
    () =>
      reservations
        .filter((r) => r.status !== 'CANCELLED')
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    [reservations]
  );

  const conflictIds = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < activeReservations.length - 1; i++) {
      const a = activeReservations[i];
      const b = activeReservations[i + 1];
      if (a.date === b.date) {
        const minA = parseInt(a.time.split(':')[0] || '0', 10) * 60 + parseInt(a.time.split(':')[1] || '0', 10);
        const minB = parseInt(b.time.split(':')[0] || '0', 10) * 60 + parseInt(b.time.split(':')[1] || '0', 10);
        const dist = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
        if (Math.abs(minB - minA) < 90 || (Math.abs(minB - minA) < 120 && dist > 6)) {
          set.add(a.id);
          set.add(b.id);
        }
      }
    }
    return set;
  }, [activeReservations]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
            <CalendarDays className="h-4 w-4" />
            Agenda da Cidade &amp; Pessoal
          </p>
          <h2 className="font-editorial mt-1 text-3xl font-bold text-[var(--text-primary)]">
            Calendário Vivo do Rio de Janeiro
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Eventos, cultura, feiras e suas reservas salvas com detector automático de conflitos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setNearCenterOnly(!nearCenterOnly)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
              nearCenterOnly
                ? 'border-[#E05A47] bg-[#E05A47] text-white'
                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            <Navigation className="h-3.5 w-3.5" />
            Perto de mim (Centro / Zona Sul)
          </button>
          <button
            type="button"
            onClick={() => setOnlyFreeEvents(!onlyFreeEvents)}
            className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
              onlyFreeEvents
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            Apenas Gratuitos
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* City Calendar */}
        <section className="space-y-4 lg:col-span-2">
          <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
            Programação Cultural &amp; Eventos ({cityEvents.length})
          </h3>

          <div className="space-y-4">
            {cityEvents.map((ev) => {
              const nearbyFood = nearbyDiningForEvent(ev);
              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#E05A47]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#E05A47]">
                          {ev.macro_category}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                          <MapPin className="h-3.5 w-3.5 text-[#E05A47]" />
                          {ev.neighborhood}
                        </span>
                        {ev.attributes?.is_free && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            Gratuito
                          </span>
                        )}
                      </div>

                      <h4
                        onClick={() => onSelectExperience(ev)}
                        className="font-editorial mt-2 cursor-pointer text-xl font-bold text-[var(--text-primary)] hover:text-[#E05A47]"
                      >
                        {ev.name}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {ev.description}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-primary)]">
                        <Clock className="h-3.5 w-3.5 text-[#E05A47]" />
                        {ev.opening_hours || ev.attributes?.event_date || 'Consultar programação'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectExperience(ev)}
                      className="shrink-0 rounded-xl border border-[var(--border-hairline)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[#E05A47]"
                    >
                      Ver detalhes
                    </button>
                  </div>

                  {nearbyFood.length > 0 && (
                    <div className="mt-4 border-t border-[var(--border-hairline)] pt-3">
                      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                        <Utensils className="h-3.5 w-3.5 text-[#E05A47]" />
                        Onde jantar perto deste evento:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {nearbyFood.map((food) => (
                          <button
                            key={food.id}
                            type="button"
                            onClick={() => onSelectExperience(food)}
                            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-1.5 text-left text-xs transition-colors hover:border-[#E05A47]"
                          >
                            <strong className="text-[var(--text-primary)]">{food.name}</strong>{' '}
                            <span className="text-[var(--text-secondary)]">
                              · {food.neighborhood} ({food.price_range})
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Personal Agenda */}
        <section className="space-y-4">
          <h3 className="font-editorial text-xl font-bold text-[var(--text-primary)]">
            Minha Agenda Pessoal ({activeReservations.length})
          </h3>

          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            {activeReservations.length === 0 ? (
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                Você ainda não salvou nenhuma reserva ou evento. Abra qualquer estabelecimento e use a{' '}
                <strong>Reserva Rápida em 3 Cliques</strong> para adicionar aqui.
              </p>
            ) : (
              <div className="space-y-3">
                {activeReservations.map((res) => {
                  const hasConflict = conflictIds.has(res.id);
                  return (
                    <div
                      key={res.id}
                      className={`rounded-xl border p-3.5 text-xs ${
                        hasConflict
                          ? 'border-amber-500/50 bg-amber-500/10'
                          : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              res.status === 'CONFIRMED'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {res.status === 'CONFIRMED'
                              ? 'Confirmada'
                              : 'Solicitação Pendente'}
                          </span>
                          <h4 className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                            {res.experience_name}
                          </h4>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            {res.date} às {res.time} · {res.guests} pessoas · {res.neighborhood}
                          </p>
                        </div>

                        <button
                          type="button"
                          title="Cancelar solicitação"
                          onClick={() => onReservationsUpdated(cancelReservation(res.id))}
                          className="rounded p-1 text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {hasConflict && (
                        <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Possível conflito de horário ou deslocamento neste dia.
                        </p>
                      )}

                      <a
                        href={buildGoogleCalendarUrl(res)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#E05A47]"
                      >
                        <CalendarPlus className="h-3.5 w-3.5 text-[#E05A47]" />
                        Adicionar ao Google Calendar
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

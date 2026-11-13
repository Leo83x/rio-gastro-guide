import {
  Activity,
  AlertTriangle,
  CalendarCheck2,
  Car,
  CheckCircle2,
  ExternalLink,
  ParkingCircle,
  TrainFront,
} from 'lucide-react';
import { useState } from 'react';
import { createReservationRequest } from '../services/superappStore';
import type { ReservationRequest } from '../types/experience';
import type { Restaurant } from '../types/restaurant';

interface ExperienceIntelligenceBlocksProps {
  experience: Restaurant;
  onReservationCreated?: (req: ReservationRequest) => void;
}

const HOURS_CURVE = [
  { hour: '12h', pct: 48 },
  { hour: '13h', pct: 72 },
  { hour: '14h', pct: 64 },
  { hour: '15h', pct: 38 },
  { hour: '16h', pct: 28 },
  { hour: '17h', pct: 34 },
  { hour: '18h', pct: 55 },
  { hour: '19h', pct: 78 },
  { hour: '20h', pct: 92 },
  { hour: '21h', pct: 86 },
  { hour: '22h', pct: 68 },
  { hour: '23h', pct: 42 },
];

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

export function ExperienceIntelligenceBlocks({
  experience,
  onReservationCreated,
}: ExperienceIntelligenceBlocksProps) {
  // 3-Click Quick Reservation State
  const todayStr = new Date().toISOString().slice(0, 10);
  const [resDate, setResDate] = useState<string>(todayStr);
  const [resTime, setResTime] = useState<string>('19:30');
  const [resGuests, setResGuests] = useState<number>(2);
  const [whatsappReminder, setWhatsappReminder] = useState<boolean>(true);
  const [resSaved, setResSaved] = useState<boolean>(false);

  // Reference: Copacabana / Zona Sul central point (-22.966, -43.185)
  const distKm = Math.max(
    0.8,
    Number(haversineKm(-22.966, -43.185, experience.latitude, experience.longitude).toFixed(1))
  );
  const carMinutes = Math.max(6, Math.round(distKm * 3.1));
  const transitMinutes = Math.max(10, Math.round(distKm * 4.5));

  const isEventZone =
    experience.neighborhood === 'Lapa' ||
    experience.neighborhood === 'Centro' ||
    experience.neighborhood === 'Ipanema';

  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${experience.latitude}&dropoff[longitude]=${experience.longitude}&dropoff[nickname]=${encodeURIComponent(
    experience.name
  )}`;
  const nineNineUrl = `https://99app.com/`;
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${experience.latitude},${experience.longitude}`;

  const currentHour = new Date().getHours();
  const currentBar = HOURS_CURVE.find((h) => parseInt(h.hour, 10) === currentHour);
  const currentPct = currentBar?.pct ?? 52;
  const crowdStatus =
    currentPct < 45 ? 'Movimento Baixo' : currentPct < 75 ? 'Movimento Moderado' : 'Movimento Alto';

  const handleReserve = () => {
    const req = createReservationRequest({
      experience_id: experience.id,
      experience_name: experience.name,
      neighborhood: experience.neighborhood,
      latitude: experience.latitude,
      longitude: experience.longitude,
      date: resDate,
      time: resTime,
      guests: resGuests,
      whatsapp_reminder: whatsappReminder,
    });
    setResSaved(true);
    onReservationCreated?.(req);
  };

  return (
    <div className="space-y-5 border-t border-[var(--border-hairline)] pt-6">
      {/* 1. Termômetro de Experiência */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <Activity className="h-4 w-4 text-[#E05A47]" />
            Termômetro de Experiência (12h–23h)
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            {crowdStatus} · Melhor janela: 16h–18h
          </span>
        </div>

        <div className="mt-4 flex h-20 items-end gap-1.5">
          {HOURS_CURVE.map((bar) => {
            const isBestWindow = bar.hour === '16h' || bar.hour === '17h';
            return (
              <div key={bar.hour} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-14 w-full items-end">
                  <div
                    style={{ height: `${bar.pct}%` }}
                    className={`w-full rounded-t-md transition-all ${
                      isBestWindow
                        ? 'bg-emerald-500'
                        : bar.pct >= 75
                          ? 'bg-[#E05A47]'
                          : 'bg-[#D49B27]/75'
                    }`}
                  />
                </div>
                <span className="text-[9px] font-medium text-[var(--text-secondary)]">
                  {bar.hour}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-2.5 text-[10px] text-[var(--text-secondary)]">
          Previsão baseada em histórico, clima e eventos próximos{' '}
          <span className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-semibold">
            Estimativa calculada pela plataforma (demonstrativo)
          </span>
        </p>
      </div>

      {/* 2. Comparador de Mobilidade & Custo do Rolê */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <Car className="h-4 w-4 text-[#E05A47]" />
            Comparador de Mobilidade &amp; Custo
          </span>
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
            ~{distKm} km do ponto de referência
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5">
            <p className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
              <Car className="h-3 w-3 text-[#E05A47]" /> Carro / App
            </p>
            <p className="mt-0.5 font-bold text-[var(--text-primary)]">~{carMinutes} min</p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5">
            <p className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
              <TrainFront className="h-3 w-3 text-sky-500" /> Metrô / Ônibus
            </p>
            <p className="mt-0.5 font-bold text-[var(--text-primary)]">~{transitMinutes} min</p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2.5">
            <p className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
              <ParkingCircle className="h-3 w-3 text-emerald-500" /> Estacionamento
            </p>
            <p className="mt-0.5 font-bold text-[var(--text-primary)]">
              {experience.attributes?.has_parking
                ? experience.attributes.parking_avg_cost || 'Disponível'
                : 'Não informado'}
            </p>
          </div>
        </div>

        {isEventZone && (
          <p className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Região sujeita a tarifa dinâmica / fluxo intenso em horários de eventos.
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={uberUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-black px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-85"
          >
            Chamar Uber <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={nineNineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-[#FFCC00] px-3 py-1.5 text-[11px] font-bold text-black hover:opacity-90"
          >
            Abrir 99 <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#E05A47]"
          >
            Rotas Google Maps <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* 3. Reserva Rápida em 3 Cliques */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
            <CalendarCheck2 className="h-4 w-4 text-[#E05A47]" />
            Reserva Rápida em 3 Cliques
          </span>
          <span className="text-[10px] text-[var(--text-secondary)]">
            Salva em Minha Agenda
          </span>
        </div>

        {resSaved ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3.5 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>
              Solicitação pendente registrada para {resDate} às {resTime} ({resGuests} pessoas) e adicionada à sua Agenda!
            </span>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <input
                type="date"
                value={resDate}
                onChange={(e) => setResDate(e.target.value)}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              />
              <select
                value={resTime}
                onChange={(e) => setResTime(e.target.value)}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              >
                <option>12:30</option>
                <option>13:30</option>
                <option>18:30</option>
                <option>19:30</option>
                <option>20:30</option>
                <option>21:30</option>
              </select>
              <select
                value={resGuests}
                onChange={(e) => setResGuests(Number(e.target.value))}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-2 text-xs text-[var(--text-primary)]"
              >
                {[1, 2, 3, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'pessoa' : 'pessoas'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={whatsappReminder}
                  onChange={(e) => setWhatsappReminder(e.target.checked)}
                  className="rounded accent-[#E05A47]"
                />
                Lembrete automático via WhatsApp
              </label>

              <button
                type="button"
                onClick={handleReserve}
                className="rounded-xl bg-[#E05A47] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c84b39]"
              >
                Solicitar Reserva
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { isUserAuthenticated } from '../services/authService';
import {
  confirmTableRsvpWithoutSignup,
  parseTableInviteFromSearch,
} from '../services/tableInviteStore';
import { BrandLogo } from './BrandLogo';

interface TableInvitePageProps {
  onOpenApp: () => void;
  onRequireAuth?: (reason: string, action: () => void) => void;
}

function formatTableDate(dateStr: string): string {
  const now = new Date();
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayIso = toIso(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = toIso(tomorrow);

  if (dateStr === todayIso) return 'Hoje';
  if (dateStr === tomorrowIso) return 'Amanhã';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (match) return `${match[3]}/${match[2]}`;
  return dateStr;
}

export function TableInvitePage({ onOpenApp, onRequireAuth }: TableInvitePageProps) {
  const invite =
    typeof window !== 'undefined' ? parseTableInviteFromSearch(window.location.search) : null;
  const [guestName, setGuestName] = useState('');
  const [confirmedName, setConfirmedName] = useState<string | null>(null);
  const authenticated = isUserAuthenticated();

  const handleConfirmPresence = (e: FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    const clean = guestName.trim();
    if (!clean) return;
    const rec = confirmTableRsvpWithoutSignup({
      reservationId: invite.reservationId,
      guestName: clean,
      hasAccount: authenticated,
    });
    setConfirmedName(rec.guest_name);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-md space-y-6">
        <div className="flex items-center justify-between">
          <button type="button" onClick={onOpenApp} className="text-left focus:outline-none">
            <BrandLogo variant="horizontal" size="md" />
          </button>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35]/15 px-3 py-1 text-[11px] font-bold text-[#FF6B35]">
            <Users className="h-3.5 w-3.5" />
            Convite de Mesa
          </span>
        </div>

        {!invite ? (
          <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 text-center shadow-lg space-y-4">
            <h1 className="font-sans text-xl font-extrabold">Convite de mesa não encontrado</h1>
            <p className="text-xs text-[var(--text-secondary)]">
              Este link pode estar incompleto ou expirado. Explore as experiências do BoraRio no app!
            </p>
            <button
              type="button"
              onClick={onOpenApp}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF4B2B] to-[#FF6B35] px-5 py-3 text-xs font-bold text-white"
            >
              Abrir BoraRio
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-xl">
            <div className="bg-gradient-to-br from-[#0E2235] via-[#123B56] to-[#0077B6] p-6 text-white">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#FFB347]">
                {invite.hostName} convidou você
              </p>
              <h1 className="mt-1.5 font-sans text-2xl font-black leading-tight">
                {invite.venueName}
              </h1>
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/90">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[#FF6B35]" />
                  {invite.neighborhood}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[#90E0EF]" />
                  {formatTableDate(invite.date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-[#FFB347]" />
                  {invite.time}
                </span>
              </div>
              {invite.offeringTitle && (
                <div className="mt-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white">
                  Experiência: {invite.offeringTitle}
                </div>
              )}
            </div>

            <div className="p-6 space-y-5">
              {confirmedName ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-1.5">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <h2 className="font-sans text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
                      Presença confirmada na mesa, {confirmedName}!
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {invite.hostName} já sabe que você vai em <strong>{invite.venueName}</strong> ({formatTableDate(invite.date)} às {invite.time}).
                    </p>
                  </div>

                  {!authenticated && onRequireAuth && (
                    <div className="rounded-2xl border border-[#FF6B35]/30 bg-[#FF6B35]/8 p-4 space-y-2.5">
                      <p className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--text-primary)]">
                        <Sparkles className="h-4 w-4 text-[#FF6B35]" />
                        Quer ganhar Rio Points nesta visita?
                      </p>
                      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        Você não precisa de conta para ir com a mesa. Mas se quiser acumular Rio Points e ter seu próprio passe no BoraRio, entre em segundos com seu e-mail:
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          onRequireAuth(
                            `Entre com seu e-mail para ativar seu passe individual em ${invite.venueName} e acumular Rio Points.`,
                            onOpenApp
                          )
                        }
                        className="w-full rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-2.5 text-xs font-extrabold text-white shadow-sm"
                      >
                        Entrar e ganhar Rio Points
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onOpenApp}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-3 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
                  >
                    Explorar o BoraRio
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleConfirmPresence} className="space-y-4">
                  <div>
                    <h2 className="font-sans text-base font-extrabold">
                      Confirmar sua ida na mesa
                    </h2>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      Sem cadastro obrigatório: basta informar seu nome para confirmar sua presença com {invite.hostName}.
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">
                      Seu nome
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
                      <input
                        type="text"
                        required
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="Ex: Mariana"
                        className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-3 pl-9 pr-3 text-sm text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-3.5 text-xs font-extrabold text-white shadow-md transition hover:brightness-105"
                  >
                    Confirmar presença na mesa
                  </button>

                  <div className="flex items-start gap-2 rounded-xl bg-[var(--bg-canvas)] p-3 text-[11px] text-[var(--text-secondary)]">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#4CA188]" />
                    <span>
                      Presença de acompanhante sem conta é gratuita e não gera cobrança automática. Se quiser pontuar depois, basta entrar com seu e-mail.
                    </span>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

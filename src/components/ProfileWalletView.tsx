import {
  AlertTriangle,
  Award,
  Bookmark,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Compass,
  Gift,
  HeartHandshake,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  QrCode,
  Shield,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  Wand2,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import {
  getUserProfileIdentity,
  isSupabaseAuthConfigured,
  requestMagicLinkLogin,
  saveUserProfileIdentity,
  signOutAccount,
} from '../services/authService';
import {
  getConfiaPrivacySettings,
  saveConfiaPrivacySettings,
} from '../services/confiaStore';
import { deleteSavedItinerary, getSavedItineraries } from '../services/itineraryStore';
import { computePassportSummary } from '../services/passportStore';
import {
  cancelReservation,
  creditReferralBonus,
  creditVerifiedReview,
  getPointsBalance,
  getPointTransactions,
  hasValidatedCheckinForVenue,
  redeemReward,
  validateAndCreditQRCheckin,
} from '../services/superappStore';
import type { ConfiaPrivacySettings } from '../types/confia';
import type {
  PointTransaction,
  ReservationRequest,
  SavedItinerary,
  UserPreferences,
  UserProfileIdentity,
} from '../types/experience';
import type { Restaurant } from '../types/restaurant';

interface ProfileWalletViewProps {
  experiences: Restaurant[];
  preferences: UserPreferences;
  reservations: ReservationRequest[];
  vaultCount: number;
  confiaConnectionsCount: number;
  onSavePreferences: (next: UserPreferences) => void;
  onReservationsUpdated: (next: ReservationRequest[]) => void;
  onOpenPersonalize: () => void;
  onOpenConfiaHub: () => void;
  onPointsChanged: () => void;
}

type ProfileSectionTab = 'passport' | 'agenda' | 'privacy';

const REWARDS_CATALOG = [
  { id: 'rew-1', title: 'Sobremesa cortesia em casas parceiras (Demo)', cost: 250 },
  { id: 'rew-2', title: 'Voucher R$ 50 no Bora Club (Demo)', cost: 500 },
  { id: 'rew-3', title: 'Par de ingressos Museu do Amanhã (Demo)', cost: 350 },
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

function buildGoogleCalendarUrl(r: ReservationRequest): string {
  const start = `${r.date.replace(/-/g, '')}T${r.time.replace(':', '')}00`;
  const hour = Math.min(23, parseInt(r.time.split(':')[0] || '19', 10) + 2);
  const end = `${r.date.replace(/-/g, '')}T${String(hour).padStart(2, '0')}${r.time.split(':')[1] || '00'}00`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${r.experience_name} — BoraRio`,
    dates: `${start}/${end}`,
    details: `Reserva para ${r.guests} pessoas (${r.status === 'CONFIRMED' ? 'Confirmada' : 'Solicitação pendente'}).`,
    location: `${r.neighborhood}, Rio de Janeiro - RJ`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function ProfileWalletView({
  experiences,
  preferences,
  reservations,
  vaultCount,
  confiaConnectionsCount,
  onSavePreferences,
  onReservationsUpdated,
  onOpenPersonalize,
  onOpenConfiaHub,
  onPointsChanged,
}: ProfileWalletViewProps) {
  const [sectionTab, setSectionTab] = useState<ProfileSectionTab>('passport');
  const [identity, setIdentity] = useState<UserProfileIdentity>(() => getUserProfileIdentity());
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [draftName, setDraftName] = useState(identity.display_name);
  const [draftNeighborhood, setDraftNeighborhood] = useState(identity.home_neighborhood);
  const [authEmail, setAuthEmail] = useState('');
  const [authMsg, setAuthMsg] = useState('');

  const [balance, setBalance] = useState<number>(() => getPointsBalance());
  const [transactions, setTransactions] = useState<PointTransaction[]>(() =>
    getPointTransactions()
  );
  const [savedItineraries, setSavedItineraries] = useState<SavedItinerary[]>(() =>
    getSavedItineraries()
  );
  const [confiaPrivacy, setConfiaPrivacy] = useState<ConfiaPrivacySettings>(() =>
    getConfiaPrivacySettings()
  );

  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    experiences[0]?.id || ''
  );
  const [qrInput, setQrInput] = useState<string>('RGG-QR-DEMO-2026');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const passport = useMemo(() => computePassportSummary(experiences), [experiences]);
  const supabaseReady = isSupabaseAuthConfigured();

  const refreshWallet = () => {
    setBalance(getPointsBalance());
    setTransactions(getPointTransactions());
    onPointsChanged();
  };

  const selectedVenue = experiences.find((e) => e.id === selectedVenueId) || experiences[0];
  const canReviewSelected = selectedVenue ? hasValidatedCheckinForVenue(selectedVenue.id) : false;

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

  const handleSaveIdentity = (e: FormEvent) => {
    e.preventDefault();
    const next = saveUserProfileIdentity({
      display_name: draftName,
      home_neighborhood: draftNeighborhood,
    });
    setIdentity(next);
    setEditingIdentity(false);
  };

  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    const res = await requestMagicLinkLogin(authEmail);
    setAuthMsg(res.message);
  };

  const handleCheckin = () => {
    if (!selectedVenue) return;
    const res = validateAndCreditQRCheckin(selectedVenue.id, selectedVenue.name, qrInput);
    setFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setQrInput(`RGG-QR-${Date.now().toString().slice(-5)}`);
      refreshWallet();
    }
  };

  const handleVerifiedReview = () => {
    if (!selectedVenue) return;
    const res = creditVerifiedReview(selectedVenue.id, selectedVenue.name);
    setFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) refreshWallet();
  };

  const handleReferral = () => {
    const res = creditReferralBonus(`Amigo #${Math.floor(Math.random() * 900 + 100)}`);
    setFeedback({ ok: res.ok, msg: res.message });
    refreshWallet();
  };

  const handleRedeem = (title: string, cost: number) => {
    const res = redeemReward(title, cost);
    setFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) refreshWallet();
  };

  const toggleConsent = (key: keyof UserPreferences['lgpd_consents']) => {
    onSavePreferences({
      ...preferences,
      lgpd_consents: {
        ...preferences.lgpd_consents,
        [key]: !preferences.lgpd_consents[key],
      },
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Personal Profile Identity Header (Clean, NOT a second social network) */}
      <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#123B56] to-[#FF6B35] text-lg font-extrabold text-white shadow-sm">
              {identity.avatar_initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-sans text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                  {identity.display_name}
                </h2>
                <span className="rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                  {identity.storage_origin === 'supabase_auth'
                    ? 'Conta sincronizada (Supabase)'
                    : 'Perfil local neste dispositivo'}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-[#FF6B35]" />
                  Base: {identity.home_neighborhood}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bookmark className="h-3.5 w-3.5 text-[#FF6B35]" />
                  {vaultCount} no Cofre
                </span>
                <span className="inline-flex items-center gap-1">
                  <HeartHandshake className="h-3.5 w-3.5 text-[#397B68]" />
                  {confiaConnectionsCount} na Rede Confia
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEditingIdentity((prev) => !prev)}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2 text-xs font-bold text-[var(--text-primary)] hover:border-[#FF6B35]"
            >
              Editar Perfil
            </button>
            <button
              type="button"
              onClick={onOpenPersonalize}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#123B56] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#102F46]"
            >
              <Wand2 className="h-3.5 w-3.5 text-[#F7931E]" />
              Preferências de Match
            </button>
          </div>
        </div>

        {editingIdentity && (
          <form
            onSubmit={handleSaveIdentity}
            className="mt-5 grid gap-3 border-t border-[var(--border-hairline)] pt-4 sm:grid-cols-3"
          >
            <input
              type="text"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Seu nome no BoraRio"
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)]"
            />
            <input
              type="text"
              value={draftNeighborhood}
              onChange={(e) => setDraftNeighborhood(e.target.value)}
              placeholder="Bairro base (ex: Botafogo)"
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)]"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#FF6B35] px-4 py-2 text-xs font-bold text-white hover:bg-[#e8634c]"
            >
              Salvar Dados Pessoais
            </button>
          </form>
        )}

        {/* Internal Section Switcher */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--border-hairline)] pt-4">
          {[
            { id: 'passport' as const, label: 'Passaporte Carioca & Rio Points', icon: Award },
            {
              id: 'agenda' as const,
              label: `Minha Agenda & Roteiros (${activeReservations.length + savedItineraries.length})`,
              icon: CalendarDays,
            },
            { id: 'privacy' as const, label: 'Privacidade, LGPD & Rede Confia', icon: Shield },
          ].map((item) => {
            const Icon = item.icon;
            const active = sectionTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSectionTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold transition ${
                  active
                    ? 'border-transparent bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-xs'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* SECTION 1: Passaporte Carioca & Rio Points */}
      {sectionTab === 'passport' && (
        <div className="space-y-6">
          {/* Passaporte Carioca Milestones */}
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#397B68]">
                  <Compass className="h-4 w-4" />
                  Passaporte Carioca
                </p>
                <h3 className="font-sans mt-1 text-xl font-bold text-[var(--text-primary)]">
                  Nível atual: {passport.level_label}
                </h3>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                {passport.verified_checkins_count} check-ins QR · {passport.unique_neighborhoods.length} bairros visitados
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {passport.milestones.map((ms) => (
                <div
                  key={ms.id}
                  className={`rounded-2xl border p-4 text-xs ${
                    ms.unlocked
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-[var(--text-primary)]">{ms.title}</strong>
                    <span className="font-mono text-[11px] font-bold text-[#FF6B35]">
                      {ms.current}/{ms.target}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                    {ms.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Wallet Hero + QR Check-in */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-[#E05A47]/30 bg-gradient-to-br from-[#1C1917] via-[#26221F] to-[#141210] p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#FF6B35]">
                  <Award className="h-4 w-4" />
                  Carteira Rio Points
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
                  Livro Transacional
                </span>
              </div>

              <p className="font-sans mt-4 text-4xl font-bold tracking-tight">
                {balance.toLocaleString('pt-BR')} <span className="text-lg text-[#E5B342]">RP</span>
              </p>
              <p className="mt-1 text-xs text-white/70">
                Saldo calculado exclusivamente a partir do histórico transacional (sem edição arbitrária).
              </p>

              <button
                type="button"
                onClick={handleReferral}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B35] py-2.5 text-xs font-semibold text-white hover:bg-[#e8634c]"
              >
                <UserPlus className="h-4 w-4" />
                Simular Indicação Validada (+200 RP)
              </button>
            </div>

            <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#FF6B35]">
                <QrCode className="h-4 w-4" />
                Check-in QR Code Dinâmico &amp; Antifraude
              </div>
              <h3 className="font-sans mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Validar Visita (+50 RP) &amp; Liberar Visita Verificada
              </h3>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Estabelecimento Visitado
                  </label>
                  <select
                    value={selectedVenue?.id || ''}
                    onChange={(e) => setSelectedVenueId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs text-[var(--text-primary)]"
                  >
                    {experiences.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.neighborhood})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[var(--text-secondary)]">
                    Token QR Dinâmico
                  </label>
                  <input
                    type="text"
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder="RGG-QR-..."
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 font-mono text-xs text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleCheckin}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1C1917] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#FF6B35] dark:bg-[#F5F2EB] dark:text-[#0F1115] dark:hover:bg-[#FF6B35] dark:hover:text-white"
                >
                  <QrCode className="h-4 w-4" />
                  Validar Check-in QR (+50 RP)
                </button>

                <button
                  type="button"
                  disabled={!canReviewSelected}
                  onClick={handleVerifiedReview}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[#FF6B35] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Star className="h-4 w-4 text-[#E5B342]" />
                  {canReviewSelected
                    ? 'Publicar Avaliação Verificada (+30 RP)'
                    : 'Avaliação Verificada (requer check-in QR)'}
                </button>
              </div>

              {feedback && (
                <div
                  className={`mt-3 flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium ${
                    feedback.ok
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-500/15 text-red-600 dark:text-red-300'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{feedback.msg}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Rewards Catalog */}
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
                <Gift className="h-4 w-4" />
                Catálogo de Recompensas (Demo)
              </div>
              <div className="mt-4 space-y-3">
                {REWARDS_CATALOG.map((rew) => (
                  <div
                    key={rew.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3"
                  >
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">{rew.title}</p>
                      <p className="text-[11px] font-semibold text-[#D49B27]">{rew.cost} RP</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRedeem(rew.title, rew.cost)}
                      className="shrink-0 rounded-lg bg-[#FF6B35] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#e8634c]"
                    >
                      Resgatar
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Transactional History */}
            <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                <Sparkles className="h-4 w-4 text-[#FF6B35]" />
                Extrato de Pontos
              </div>
              <div className="mt-4 max-h-64 divide-y divide-[var(--border-hairline)] overflow-y-auto">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{tx.description}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">
                        {new Date(tx.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-bold ${
                        tx.type === 'CREDIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                      }`}
                    >
                      {tx.type === 'CREDIT' ? `+${tx.amount}` : `-${tx.amount}`} RP
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* SECTION 2: Minha Agenda Pessoal, Reservas & Roteiros Salvos (Migrated cleanly from AgendaView) */}
      {sectionTab === 'agenda' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#FF6B35]">
              <CalendarDays className="h-4 w-4" />
              Minhas Reservas &amp; Google Calendar ({activeReservations.length})
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Suas solicitações de reserva com detector automático de conflitos de horário e distância.
            </p>

            {activeReservations.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-[var(--border-hairline)] p-4 text-xs text-[var(--text-secondary)]">
                Nenhuma reserva registrada ainda. Abra qualquer experiência no catálogo e use a{' '}
                <strong>Reserva Rápida em 3 Cliques</strong>.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {activeReservations.map((res) => {
                  const hasConflict = conflictIds.has(res.id);
                  return (
                    <div
                      key={res.id}
                      className={`rounded-2xl border p-4 text-xs ${
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
                            {res.status === 'CONFIRMED' ? 'Confirmada' : 'Solicitação Pendente'}
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
                          className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-600"
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
                        className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                      >
                        <CalendarPlus className="h-3.5 w-3.5 text-[#FF6B35]" />
                        Adicionar ao Google Calendar
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#123B56] dark:text-[#F7931E]">
              <Sparkles className="h-4 w-4" />
              Roteiros Salvos ({savedItineraries.length})
            </div>

            {savedItineraries.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-[var(--border-hairline)] p-4 text-xs text-[var(--text-secondary)]">
                Nenhum roteiro salvo ainda. Monte um roteiro na aba <strong>Roteiros</strong> e clique em <strong>Salvar Roteiro</strong>.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {savedItineraries.map((it) => (
                  <div
                    key={it.id}
                    className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-[var(--text-primary)]">{it.title}</h4>
                        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                          {it.steps.length} paradas · ~R$ {it.total_estimated_brl} / pessoa
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSavedItineraries(deleteSavedItinerary(it.id))}
                        className="rounded p-1 text-[var(--text-secondary)] hover:bg-red-500/15 hover:text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <ul className="mt-2.5 space-y-1 text-[11px] text-[var(--text-secondary)]">
                      {it.steps.map((s) => (
                        <li key={`${it.id}-${s.time}`}>
                          <strong>{s.time}</strong> — {s.experience_name} ({s.neighborhood})
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* SECTION 3: Privacy, LGPD & Rede Confia Controls */}
      {sectionTab === 'privacy' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LGPD Toggles */}
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <Shield className="h-4 w-4" />
              Privacidade &amp; LGPD
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              Controle explícito do uso dos seus dados. Sem inferência passiva oculta e sem coleta infantil no Modo Família.
            </p>
            <div className="mt-4 space-y-3 text-xs">
              {(
                [
                  ['location', 'Usar localização para rotas e "Perto de mim"'],
                  ['personalization', 'Personalizar feed com Match %'],
                  ['notifications', 'Notificações internas no app'],
                  ['whatsapp', 'Receber lembretes via WhatsApp'],
                  ['calendar', 'Integração com Google Calendar'],
                ] as Array<[keyof UserPreferences['lgpd_consents'], string]>
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-2">
                  <span className="text-[var(--text-primary)]">{label}</span>
                  <input
                    type="checkbox"
                    checked={preferences.lgpd_consents[key]}
                    onChange={() => toggleConsent(key)}
                    className="h-4 w-4 rounded accent-[#FF6B35]"
                  />
                </label>
              ))}
            </div>
          </section>

          {/* Rede Confia & Vault Privacy Controls */}
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#397B68]">
              <Lock className="h-4 w-4" />
              Privacidade Rede Confia &amp; Cofre
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              Padrão fechado por design: seu Cofre de Intenções nunca é compartilhado automaticamente.
            </p>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-canvas)] p-2.5">
                <span className="text-[var(--text-secondary)]">Envio automático do Cofre para amigos</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Bloqueado</span>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-2">
                <span className="text-[var(--text-primary)]">Aceitar conexões via código de convite</span>
                <input
                  type="checkbox"
                  checked={confiaPrivacy.allow_invites_by_code}
                  onChange={(e) =>
                    setConfiaPrivacy(
                      saveConfiaPrivacySettings({ allow_invites_by_code: e.target.checked })
                    )
                  }
                  className="h-4 w-4 rounded accent-[#397B68]"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-2">
                <span className="text-[var(--text-primary)]">Exibir selo Visita Verificada quando houver QR</span>
                <input
                  type="checkbox"
                  checked={confiaPrivacy.show_verified_visit_badge}
                  onChange={(e) =>
                    setConfiaPrivacy(
                      saveConfiaPrivacySettings({ show_verified_visit_badge: e.target.checked })
                    )
                  }
                  className="h-4 w-4 rounded accent-[#397B68]"
                />
              </label>

              <button
                type="button"
                onClick={onOpenConfiaHub}
                className="w-full rounded-xl border border-[#397B68]/40 bg-[#397B68]/10 py-2 text-xs font-bold text-[#397B68] hover:bg-[#397B68] hover:text-white"
              >
                Gerenciar Círculos &amp; Revogar Acessos
              </button>
            </div>
          </section>

          {/* Optional Cloud Auth (Supabase) */}
          <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#123B56] dark:text-[#F7931E]">
              <LogIn className="h-4 w-4" />
              Sincronização &amp; Conta
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              {supabaseReady
                ? 'Supabase configurado: conecte seu e-mail para sincronizar Cofre e Rede Confia entre dispositivos.'
                : 'Ambiente rodando em modo local neste dispositivo (variáveis Supabase não configuradas).'}
            </p>

            {identity.storage_origin === 'supabase_auth' ? (
              <div className="mt-4 space-y-3 text-xs">
                <p className="font-semibold text-[var(--text-primary)]">
                  Conectado como {identity.email}
                </p>
                <button
                  type="button"
                  onClick={() => void signOutAccount().then(setIdentity)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-2 font-bold text-red-600 dark:text-red-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair da conta em nuvem
                </button>
              </div>
            ) : (
              <form onSubmit={(e) => void handleMagicLink(e)} className="mt-4 space-y-2.5">
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#123B56] py-2 text-xs font-bold text-white hover:bg-[#102F46]"
                >
                  {supabaseReady ? 'Enviar Link Mágico' : 'Verificar Sincronização'}
                </button>
                {authMsg && <p className="text-[11px] text-[var(--text-secondary)]">{authMsg}</p>}
              </form>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

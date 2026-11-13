import {
  Award,
  CheckCircle2,
  Gift,
  QrCode,
  Shield,
  Sparkles,
  Star,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import {
  creditReferralBonus,
  creditVerifiedReview,
  getPointsBalance,
  getPointTransactions,
  hasValidatedCheckinForVenue,
  redeemReward,
  validateAndCreditQRCheckin,
} from '../services/superappStore';
import type { PointTransaction, UserPreferences } from '../types/experience';
import type { Restaurant } from '../types/restaurant';

interface ProfileWalletViewProps {
  experiences: Restaurant[];
  preferences: UserPreferences;
  onSavePreferences: (next: UserPreferences) => void;
  onPointsChanged: () => void;
}

const REWARDS_CATALOG = [
  { id: 'rew-1', title: 'Sobremesa cortesia em casas parceiras', cost: 250 },
  { id: 'rew-2', title: 'Voucher R$ 50 no Rio Gastro Club', cost: 500 },
  { id: 'rew-3', title: 'Par de ingressos Museu do Amanhã (Demo)', cost: 350 },
];

export function ProfileWalletView({
  experiences,
  preferences,
  onSavePreferences,
  onPointsChanged,
}: ProfileWalletViewProps) {
  const [balance, setBalance] = useState<number>(() => getPointsBalance());
  const [transactions, setTransactions] = useState<PointTransaction[]>(() =>
    getPointTransactions()
  );

  const [selectedVenueId, setSelectedVenueId] = useState<string>(
    experiences[0]?.id || ''
  );
  const [qrInput, setQrInput] = useState<string>('RGG-QR-DEMO-2026');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const refreshWallet = () => {
    setBalance(getPointsBalance());
    setTransactions(getPointTransactions());
    onPointsChanged();
  };

  const selectedVenue = experiences.find((e) => e.id === selectedVenueId) || experiences[0];
  const canReviewSelected = selectedVenue ? hasValidatedCheckinForVenue(selectedVenue.id) : false;

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
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Wallet Hero */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-[#E05A47]/30 bg-gradient-to-br from-[#1C1917] via-[#26221F] to-[#141210] p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
              <Award className="h-4 w-4" />
              Carteira Rio Points
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/80">
              Livro Transacional
            </span>
          </div>

          <p className="font-sans tracking-tight mt-4 text-4xl font-bold">
            {balance.toLocaleString('pt-BR')} <span className="text-lg text-[#E5B342]">RP</span>
          </p>
          <p className="mt-1 text-xs text-white/70">
            Saldo calculado exclusivamente a partir do histórico transacional (sem edição arbitrária).
          </p>

          <button
            type="button"
            onClick={handleReferral}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E05A47] py-2.5 text-xs font-semibold text-white hover:bg-[#c84b39]"
          >
            <UserPlus className="h-4 w-4" />
            Simular Indicação Validada (+200 RP)
          </button>
        </div>

        {/* Dynamic QR Code Check-in & Anti-Fraud */}
        <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
            <QrCode className="h-4 w-4" />
            Check-in QR Code Dinâmico &amp; Antifraude
          </div>
          <h3 className="font-sans tracking-tight mt-1 text-2xl font-bold text-[var(--text-primary)]">
            Validar Visita na Mesa (+50 RP) &amp; Avaliação Verificada (+30 RP)
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
                Token QR Dinâmico (gerado no Painel B2B)
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
              className="inline-flex items-center gap-2 rounded-xl bg-[#1C1917] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#E05A47] dark:bg-[#F5F2EB] dark:text-[#0F1115] dark:hover:bg-[#E05A47] dark:hover:text-white"
            >
              <QrCode className="h-4 w-4" />
              Validar Check-in QR (+50 RP)
            </button>

            <button
              type="button"
              disabled={!canReviewSelected}
              onClick={handleVerifiedReview}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[#E05A47] disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* Rewards + Ledger + LGPD */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Rewards Catalog */}
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#E05A47]">
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
                  className="shrink-0 rounded-lg bg-[#E05A47] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#c84b39]"
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
            <Sparkles className="h-4 w-4 text-[#E05A47]" />
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

        {/* Privacy & LGPD Controls */}
        <section className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <Shield className="h-4 w-4" />
            Privacidade, LGPD &amp; Canais
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            Gerencie seus consentimentos. Nenhum dado pessoal infantil é coletado no Modo Família.
          </p>
          <div className="mt-4 space-y-2.5 text-xs">
            {(
              [
                ['location', 'Usar localização para "Perto de mim"'],
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
                  className="h-4 w-4 rounded accent-[#E05A47]"
                />
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

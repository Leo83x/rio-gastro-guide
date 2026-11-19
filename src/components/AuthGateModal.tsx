import { CheckCircle2, Gift, KeyRound, Mail, MapPin, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import {
  getUserProfileIdentity,
  isSupabaseAuthConfigured,
  isUserAuthenticated,
  requestMagicLinkLogin,
  subscribeToAuthChanges,
  verifyEmailOtpLogin,
} from '../services/authService';
import { getIncomingReferralCode } from '../services/referralStore';
import type { UserProfileIdentity } from '../types/experience';

interface AuthGateModalProps {
  open: boolean;
  reason?: string;
  onClose: () => void;
  onAuthenticated: (identity: UserProfileIdentity) => void;
}

const NEIGHBORHOODS = [
  'Botafogo',
  'Copacabana',
  'Ipanema',
  'Leblon',
  'Lapa',
  'Santa Teresa',
  'Tijuca',
  'Barra da Tijuca',
  'Centro',
  'Jardim Botânico',
  'Flamengo',
  'Laranjeiras',
];

export function AuthGateModal({
  open,
  reason,
  onClose,
  onAuthenticated,
}: AuthGateModalProps) {
  const current = getUserProfileIdentity();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [displayName, setDisplayName] = useState(
    current.display_name && current.display_name !== 'Explorador Carioca'
      ? current.display_name
      : ''
  );
  const [email, setEmail] = useState(current.email || '');
  const [neighborhood, setNeighborhood] = useState(current.home_neighborhood || 'Botafogo');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const incomingRef = getIncomingReferralCode();
  const incomingVip =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('vip') : null;
  const authConfigured = isSupabaseAuthConfigured();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    const unsub = subscribeToAuthChanges((identity) => {
      if (isUserAuthenticated(identity)) {
        onAuthenticated(identity);
      }
    });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      unsub();
    };
  }, [open, onClose, onAuthenticated]);

  if (!open) return null;

  const handleSendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setFeedback({ ok: false, msg: 'Informe seu nome para identificar seu passe.' });
      return;
    }
    setLoading(true);
    setFeedback(null);
    const res = await requestMagicLinkLogin(email, {
      display_name: displayName.trim(),
      home_neighborhood: neighborhood,
    });
    setLoading(false);
    setFeedback({ ok: res.ok, msg: res.message });
    if (res.ok) {
      setStep('otp');
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    const res = await verifyEmailOtpLogin(email, otpCode, {
      display_name: displayName.trim(),
      home_neighborhood: neighborhood,
    });
    setLoading(false);
    if (!res.ok) {
      setFeedback({ ok: false, msg: res.message });
      return;
    }
    setFeedback({ ok: true, msg: res.message });
    if (res.identity) {
      onAuthenticated(res.identity);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Identificação BoraRio"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-hairline)] bg-gradient-to-r from-[#0E2235] via-[#123B56] to-[#0077B6] px-5 py-4 text-white">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#FFB347]">
              <Sparkles className="h-3 w-3" />
              Conta BoraRio
            </p>
            <h2 className="mt-1 font-sans text-lg font-extrabold leading-tight">
              {step === 'email' ? 'Entre para confirmar sua ação' : 'Digite o código de acesso'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar identificação"
            className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5 text-xs">
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            {reason ||
              'Para garantir seu passe nominal, validar check-ins e creditar seus Rio Points com segurança, entre com seu e-mail.'}
          </p>

          {(incomingRef || incomingVip) && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              <Gift className="h-4 w-4 shrink-0 text-amber-500" />
              <span>
                {incomingVip
                  ? `Convite VIP (${incomingVip}) será vinculado à sua conta após entrar.`
                  : `Indicação (${incomingRef}) será vinculada à sua conta após entrar.`}
              </span>
            </div>
          )}

          {!authConfigured && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[11px] text-rose-700 dark:text-rose-300">
              O servidor de autenticação não está configurado neste ambiente. Configure as variáveis do Supabase para ativar contas reais.
            </div>
          )}

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-[11px] font-semibold ${
                feedback.ok
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
              }`}
            >
              {feedback.ok && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              <span>{feedback.msg}</span>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">
                  Seu nome
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Como você quer aparecer no passe"
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-9 pr-3 text-xs text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">
                  Seu melhor e-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-9 pr-3 text-xs text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">
                  Bairro base no Rio
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <select
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-9 pr-3 text-xs text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
                  >
                    {NEIGHBORHOODS.map((nb) => (
                      <option key={nb} value={nb}>
                        {nb}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !authConfigured}
                className="w-full rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-3 text-xs font-extrabold text-white shadow-md transition hover:brightness-105 disabled:opacity-50"
              >
                {loading ? 'Enviando código...' : 'Enviar código de acesso (sem senha)'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-[var(--text-secondary)]">
                  Código de 6 dígitos enviado para {email}
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    maxLength={8}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="000000"
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] py-2.5 pl-9 pr-3 font-mono text-sm tracking-widest text-[var(--text-primary)] focus:border-[#FF6B35] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-3 text-xs font-extrabold text-white shadow-md transition hover:brightness-105 disabled:opacity-50"
              >
                {loading ? 'Validando...' : 'Confirmar código e continuar'}
              </button>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setFeedback(null);
                  }}
                  className="font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Alterar e-mail
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    void requestMagicLinkLogin(email, {
                      display_name: displayName.trim(),
                      home_neighborhood: neighborhood,
                    }).then((res) => setFeedback({ ok: res.ok, msg: res.message }));
                  }}
                  className="font-bold text-[#FF6B35] hover:underline"
                >
                  Reenviar código
                </button>
              </div>
            </form>
          )}

          <div className="flex items-center gap-2 border-t border-[var(--border-hairline)] pt-3 text-[10px] text-[var(--text-secondary)]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#4CA188]" />
            <span>
              Sem senha para decorar. Seus dados seguem a LGPD e garantem que pontos e benefícios sejam só seus.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

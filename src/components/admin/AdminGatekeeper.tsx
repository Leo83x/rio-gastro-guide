import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { BrandLogo } from '../BrandLogo';

interface AdminGatekeeperProps {
  onAuthenticated: () => void;
  onExit: () => void;
  isDark?: boolean;
}

const VALID_ADMIN_PINS = new Set([
  'borario@admin2025',
  'borario2025',
  '8383',
  'rio@admin',
  'admin83',
]);

export function AdminGatekeeper({ onAuthenticated, onExit, isDark = true }: AdminGatekeeperProps) {
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanPin = pin.trim();

    if (!cleanPin) {
      setErrorMsg('Informe a senha ou PIN de acesso.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      if (VALID_ADMIN_PINS.has(cleanPin)) {
        try {
          sessionStorage.setItem('borario_admin_authenticated', 'true');
        } catch {
          // ignore
        }
        setLoading(false);
        onAuthenticated();
      } else {
        setLoading(false);
        setErrorMsg('Senha ou PIN de administrador inválido.');
      }
    }, 300);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#06101B] via-[#0A1D30] to-[#0E2235] px-4 py-12 text-white">
      {/* Background Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#FF6B35]/15 blur-3xl" />
        <div className="absolute -bottom-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-[#0077B6]/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Top Back Link */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao aplicativo
          </button>
          <span className="rounded-full bg-red-500/15 px-3 py-1 text-[11px] font-bold text-red-300">
            Acesso Restrito
          </span>
        </div>

        {/* Security Card */}
        <div className="rounded-3xl border border-white/15 bg-[#0B1B2B]/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-lg shadow-[#FF4B2B]/25">
              <Lock className="h-7 w-7" />
            </div>

            <div className="mt-4 flex items-center justify-center">
              <BrandLogo variant="horizontal" size="sm" onDark={isDark} />
            </div>

            <h1 className="mt-3 font-sans text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              Painel de Curadoria & Operações
            </h1>
            <p className="mt-1.5 text-xs leading-relaxed text-[#F1E8D8]/80">
              Área de uso exclusivo da equipe do BoraRio para gestão de banco de dados, coletores de eventos e moderação.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="admin-pin-input"
                className="block text-xs font-bold uppercase tracking-wider text-[#F1E8D8]"
              >
                Senha de Administrador
              </label>
              <div className="relative mt-1.5">
                <input
                  id="admin-pin-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoFocus
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Digite sua senha de acesso..."
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-10 text-sm font-semibold text-white placeholder:text-white/40 focus:border-[#FF6B35] focus:outline-none focus:ring-1 focus:ring-[#FF6B35]"
                />
                <KeyRound className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-white/40" />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-3 text-white/50 hover:text-white"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/15 p-3 text-center text-xs font-semibold text-red-300">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-105 disabled:opacity-50"
            >
              {loading ? (
                <span>Verificando credenciais...</span>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Acessar Painel</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-4 text-center text-[11px] text-white/50">
            <p>Se você é parceiro comercial, acesse o <strong>Painel do Parceiro</strong> em <button type="button" onClick={onExit} className="text-[#FFB347] underline">/parceiros</button>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

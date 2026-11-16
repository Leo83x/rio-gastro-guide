import {
  Bell,
  CheckCircle2,
  Download,
  Share,
  Smartphone,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { BrandLogo } from './BrandLogo';

interface PwaInstallModalProps {
  isOpen: boolean;
  canInstall: boolean;
  onInstall: () => Promise<boolean | void>;
  onClose: () => void;
}

export function PwaInstallModal({
  isOpen,
  canInstall,
  onInstall,
  onClose,
}: PwaInstallModalProps) {
  const [isIos] = useState(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const userAgent = navigator.userAgent || '';
    return (
      /iPad|iPhone|iPod/.test(userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream
    );
  });
  const [isInstalling, setIsInstalling] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    try {
      setIsInstalling(true);
      await onInstall();
    } finally {
      setIsInstalling(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#06101B]/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-[var(--bg-surface)] p-6 text-[var(--text-primary)] shadow-2xl transition-all sm:p-8"
      >
        {/* Glow decoration */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-[#FF4B2B]/20 via-[#FF6B35]/20 to-[#F7931E]/10 blur-2xl" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 rounded-full p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header with App Logo & Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] shadow-lg shadow-[#FF4B2B]/30">
            <Smartphone className="h-8 w-8 text-white" />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#123B56] text-white shadow">
              <Sparkles className="h-3.5 w-3.5 text-[#FFB347]" />
            </span>
          </div>

          <BrandLogo variant="horizontal" size="sm" />

          <h2
            id="pwa-install-title"
            className="mt-3 font-sans text-xl font-extrabold tracking-tight sm:text-2xl"
          >
            Instale o BoraRio no seu celular
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)] sm:text-sm">
            A melhor experiência da gastronomia, festas e passeios do Rio direto na sua tela inicial.
          </p>
        </div>

        {/* Benefits list */}
        <div className="mt-6 space-y-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-subtle)]/50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF6B35]/15 text-[#FF6B35]">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">Acesso em 1 Toque</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Abra sem digitar URL, em tela cheia com velocidade nativa de app.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#4CA188]/15 text-[#4CA188]">
              <WifiOff className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">Modo Offline &amp; Desejos</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Acesse seus lugares e roteiros salvos mesmo em áreas com sinal fraco.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0077B6]/15 text-[#0077B6]">
              <Bell className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">Alertas de Festas &amp; Ofertas</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Receba novidades da noite carioca e vantagens exclusivas do Bora Club.
              </p>
            </div>
          </div>
        </div>

        {/* Actions / Instructions */}
        <div className="mt-6 space-y-3">
          {canInstall ? (
            <button
              type="button"
              disabled={isInstalling}
              onClick={handleInstallClick}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF4B2B]/25 transition hover:brightness-105 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{isInstalling ? 'Instalando...' : 'Instalar Agora (Grátis)'}</span>
            </button>
          ) : isIos ? (
            <div className="rounded-2xl border border-[#0077B6]/25 bg-[#0077B6]/10 p-4 text-xs">
              <p className="font-bold text-[#0077B6] dark:text-[#90E0EF]">
                Como instalar no iPhone / iPad:
              </p>
              <ol className="mt-2 space-y-1.5 text-[11px] text-[var(--text-secondary)]">
                <li className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0077B6] text-[9px] font-bold text-white">
                    1
                  </span>
                  <span>
                    Toque no botão <strong className="text-[var(--text-primary)]">Compartilhar</strong> (ícone <Share className="inline h-3 w-3 text-[#0077B6]" /> na barra do Safari).
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#0077B6] text-[9px] font-bold text-white">
                    2
                  </span>
                  <span>
                    Role e toque em <strong className="text-[var(--text-primary)]">Adicionar à Tela de Início</strong>.
                  </span>
                </li>
              </ol>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#FF4B2B]/25 transition hover:brightness-105"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Adicionar Atalho aos Favoritos</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          >
            Continuar pelo navegador
          </button>
        </div>
      </div>
    </div>
  );
}

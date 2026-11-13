import { Moon, Sun, UtensilsCrossed, Zap, ArrowLeft } from 'lucide-react';

interface NavbarProps {
  view: 'guide' | 'admin';
  onToggleView: (view: 'guide' | 'admin') => void;
  isDark: boolean;
  onToggleTheme: () => void;
  totalCount: number;
}

export function Navbar({
  view,
  onToggleView,
  isDark,
  onToggleTheme,
  totalCount,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => onToggleView('guide')}
          className="group flex items-center gap-3 text-left focus:outline-none"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E05A47] text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-editorial text-lg font-bold tracking-tight text-[var(--text-primary)] sm:text-xl">
                Rio Gastro Guide
              </span>
              <span className="hidden rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] sm:inline-block">
                {totalCount} casas
              </span>
            </div>
            <p className="hidden text-xs text-[var(--text-secondary)] sm:block">
              Curadoria gastronômica do Rio de Janeiro
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Alternar tema claro/escuro"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:border-[#E05A47]/50 hover:text-[var(--text-primary)]"
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          {view === 'guide' ? (
            <button
              id="btn-open-admin"
              type="button"
              onClick={() => onToggleView('admin')}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-xs transition-all hover:border-[#E05A47]/60 hover:bg-[#E05A47]/5 hover:text-[#E05A47] sm:text-sm"
            >
              <Zap className="h-3.5 w-3.5 text-[#E05A47]" />
              <span className="hidden sm:inline">Painel de Importação em Lote (Admin)</span>
              <span className="sm:hidden">Admin / Importar</span>
            </button>
          ) : (
            <button
              id="btn-back-guide"
              type="button"
              onClick={() => onToggleView('guide')}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#1C1917] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#E05A47] dark:bg-[#F5F2EB] dark:text-[#0F1115] dark:hover:bg-[#E05A47] dark:hover:text-white sm:text-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Guia Público
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

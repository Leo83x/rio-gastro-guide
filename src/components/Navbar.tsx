import {
  ArrowLeft,
  Award,
  Bell,
  Building2,
  Compass,
  Crown,
  Download,
  HeartHandshake,
  MapPin,
  Moon,
  MoreHorizontal,
  Sparkles,
  Sun,
  User,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AppRoute } from '../services/router';
import type { NotificationItem } from '../types/experience';
import { BrandLogo } from './BrandLogo';

export type AppTab = 'discover' | 'planner' | 'confia' | 'club' | 'profile' | 'admin';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onNavigateRoute: (route: AppRoute) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  totalCount: number;
  pointsBalance: number;
  confiaBadgeCount?: number;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  isOnline?: boolean;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
  overlayHero?: boolean;
}

const MAIN_TABS: Array<{
  id: Exclude<AppTab, 'admin'>;
  label: string;
  shortLabel: string;
  icon: typeof Compass;
}> = [
  { id: 'discover', label: 'Descobrir', shortLabel: 'Descobrir', icon: Compass },
  { id: 'planner', label: 'Roteiros', shortLabel: 'Roteiros', icon: MapPin },
  { id: 'confia', label: 'Rede Confia', shortLabel: 'Confia', icon: HeartHandshake },
  { id: 'club', label: 'Bora Club', shortLabel: 'Club', icon: Crown },
  { id: 'profile', label: 'Perfil', shortLabel: 'Perfil', icon: User },
];

export function Navbar({
  activeTab,
  onSelectTab,
  onNavigateRoute,
  isDark,
  onToggleTheme,
  totalCount,
  pointsBalance,
  confiaBadgeCount = 0,
  notifications,
  onMarkNotificationsRead,
  isOnline = true,
  canInstallPwa = false,
  onInstallPwa,
  overlayHero = false,
}: NavbarProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 36);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isOverHero = overlayHero && !isScrolled;

  return (
    <>
      <header
        className={`${
          overlayHero ? 'fixed inset-x-0 top-0' : 'sticky top-0'
        } z-40 w-full transition-all duration-300 ${
          isOverHero
            ? 'border-b border-transparent bg-gradient-to-b from-[#061524]/35 via-[#061524]/10 to-transparent'
            : 'border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/90 shadow-xs backdrop-blur-xl'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 lg:px-8">
          {/* Brand */}
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateRoute('/')}
              title="Ir para a página inicial do BoraRio"
              className="group flex shrink-0 items-center text-left focus:outline-none"
            >
              <BrandLogo variant="horizontal" size="md" onDark={isDark || isOverHero} />
            </button>
            {!isOnline && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isOverHero
                    ? 'border border-amber-300/35 bg-amber-500/20 text-amber-100 backdrop-blur-md'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                }`}
              >
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
          </div>

          {/* Desktop 5-Tab Navigation */}
          <nav
            aria-label="Navegação principal desktop"
            className={`hidden items-center gap-1 rounded-full border p-1 transition-all lg:flex ${
              isOverHero
                ? 'border-white/30 bg-white/14 shadow-[0_4px_18px_rgba(0,0,0,0.12)] backdrop-blur-md'
                : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)]'
            }`}
          >
            {MAIN_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              const badge = tab.id === 'confia' ? confiaBadgeCount : 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all ${
                    active
                      ? 'bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-sm'
                      : isOverHero
                        ? 'text-white/90 hover:bg-white/15 hover:text-white'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {badge > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${
                        active ? 'bg-white/25 text-white' : 'bg-[#397B68] text-white'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Clean Right Utilities */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => onSelectTab('profile')}
              className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition sm:inline-flex ${
                isOverHero
                  ? 'border-white/30 bg-white/15 text-white shadow-[0_4px_14px_rgba(0,0,0,0.1)] backdrop-blur-md hover:border-white/50 hover:bg-white/25'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-primary)] hover:border-[#FF6B35]'
              }`}
            >
              <Award className="h-3.5 w-3.5 text-[#F7931E]" />
              <span>{pointsBalance.toLocaleString('pt-BR')} pts</span>
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                aria-label="Central de Notificações"
                onClick={() => {
                  setShowMoreMenu(false);
                  const next = !showNotifs;
                  setShowNotifs(next);
                  if (next && unreadCount > 0) onMarkNotificationsRead();
                }}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                  isOverHero
                    ? 'border-white/30 bg-white/15 text-white shadow-[0_4px_14px_rgba(0,0,0,0.1)] backdrop-blur-md hover:border-white/50 hover:bg-white/25'
                    : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[#FF6B35]/50 hover:text-[var(--text-primary)]'
                }`}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF4B2B] text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/92 shadow-xl backdrop-blur-xl sm:w-80">
                  <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      Central de Notificações
                    </p>
                    <Sparkles className="h-3.5 w-3.5 text-[#FF6B35]" />
                  </div>
                  <div className="max-h-72 divide-y divide-[var(--border-hairline)] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-[var(--text-secondary)]">
                        Nenhuma notificação no momento.
                      </p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className="px-4 py-3 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-[var(--text-primary)]">{n.title}</strong>
                            <span className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--text-secondary)]">
                              {n.channel}
                            </span>
                          </div>
                          <p className="mt-1 text-[var(--text-secondary)]">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              title={isDark ? 'Modo Rio de dia' : 'Modo Rio à noite'}
              aria-label="Alternar tema Rio de dia / Rio à noite"
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                isOverHero
                  ? 'border-white/30 bg-white/15 text-white shadow-[0_4px_14px_rgba(0,0,0,0.1)] backdrop-blur-md hover:border-white/50 hover:bg-white/25'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[#FF6B35]/50 hover:text-[var(--text-primary)]'
              }`}
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-[#F7931E]" />
              ) : (
                <Moon className={`h-4 w-4 ${isOverHero ? 'text-white' : 'text-[#123B56]'}`} />
              )}
            </button>

            {activeTab === 'admin' ? (
              <button
                id="btn-back-guide"
                type="button"
                onClick={() => onNavigateRoute('/app')}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-3.5 py-2 text-xs font-bold text-white shadow-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao App
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  aria-label="Mais opções"
                  onClick={() => {
                    setShowNotifs(false);
                    setShowMoreMenu((prev) => !prev);
                  }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
                    isOverHero
                      ? 'border-white/30 bg-white/15 text-white shadow-[0_4px_14px_rgba(0,0,0,0.1)] backdrop-blur-md hover:border-white/50 hover:bg-white/25'
                      : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[#FF6B35]/50 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>

                {showMoreMenu && (
                  <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)]/92 p-1.5 shadow-xl backdrop-blur-xl">
                    <div className="px-3 py-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                      {totalCount} locais no catálogo · {pointsBalance} pts
                    </div>
                    <div className="my-1 border-t border-[var(--border-hairline)]" />

                    {canInstallPwa && onInstallPwa && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          onInstallPwa();
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                      >
                        <Download className="h-4 w-4 text-[#FF6B35]" />
                        Instalar App (PWA)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        onNavigateRoute('/parceiros');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    >
                      <Building2 className="h-4 w-4 text-[#397B68]" />
                      Área de Parceiros
                    </button>

                    <button
                      id="btn-open-admin"
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        onNavigateRoute('/admin');
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]"
                    >
                      <Zap className="h-4 w-4 text-[#FF6B35]" />
                      Administração
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Floating Glassmorphic Bottom Navigation Bar (Mobile - 5 Tabs) */}
      {activeTab !== 'admin' && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 px-3 lg:hidden">
          <nav
            aria-label="Navegação principal mobile"
            className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-1 rounded-full border border-white/40 bg-white/88 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/15 dark:bg-[#0D1E30]/90"
          >
            {MAIN_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              const badge = tab.id === 'confia' ? confiaBadgeCount : 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-bold transition-all ${
                    active
                      ? 'bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] text-white shadow-md'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.shortLabel}</span>
                  {badge > 0 && (
                    <span className="absolute right-2 top-1 h-2 w-2 rounded-full bg-[#397B68] ring-2 ring-white dark:ring-[#0D1E30]" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}

import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarDays,
  Compass,
  Crown,
  Download,
  MapPin,
  Moon,
  Sparkles,
  Sun,
  UserCheck,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import type { AppRoute } from '../services/router';
import type { NotificationItem } from '../types/experience';
import { BrandLogo } from './BrandLogo';

export type AppTab = 'discover' | 'planner' | 'club' | 'agenda' | 'profile' | 'admin';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onNavigateRoute: (route: AppRoute) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  totalCount: number;
  pointsBalance: number;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  isOnline?: boolean;
  canInstallPwa?: boolean;
  onInstallPwa?: () => void;
}

const MAIN_TABS: Array<{
  id: Exclude<AppTab, 'admin'>;
  label: string;
  shortLabel: string;
  icon: typeof Compass;
}> = [
  { id: 'discover', label: 'Descobrir', shortLabel: 'Descobrir', icon: Compass },
  { id: 'planner', label: 'Explorar & IA', shortLabel: 'Explorar', icon: MapPin },
  { id: 'club', label: 'Club', shortLabel: 'Club', icon: Crown },
  { id: 'agenda', label: 'Agenda', shortLabel: 'Agenda', icon: CalendarDays },
  { id: 'profile', label: 'Perfil', shortLabel: 'Perfil', icon: UserCheck },
];

export function Navbar({
  activeTab,
  onSelectTab,
  onNavigateRoute,
  isDark,
  onToggleTheme,
  totalCount,
  pointsBalance,
  notifications,
  onMarkNotificationsRead,
  isOnline = true,
  canInstallPwa = false,
  onInstallPwa,
}: NavbarProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigateRoute('/')}
              title="Ir para a página inicial do BoraRio"
              className="group flex shrink-0 items-center gap-2 text-left focus:outline-none"
            >
              <BrandLogo variant="horizontal" size="sm" onDark={isDark} />
            </button>
            <span className="hidden rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)] xl:inline-block">
              {totalCount} locais
            </span>
            {!isOnline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
          </div>

          {/* Desktop 5-Tab Navigation */}
          <nav className="hidden items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-1 lg:flex">
            {MAIN_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[#FF765E] text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.id === 'profile' && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-[#397B68]/15 text-[#397B68] dark:text-[#6fd1b4]'
                      }`}
                    >
                      {pointsBalance} RP
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Utilities */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {canInstallPwa && onInstallPwa && (
              <button
                type="button"
                onClick={onInstallPwa}
                className="hidden items-center gap-1 rounded-full bg-[#397B68] px-3 py-1.5 text-[11px] font-bold text-white shadow-xs hover:bg-[#2e6656] sm:inline-flex"
              >
                <Download className="h-3.5 w-3.5" />
                Instalar App
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigateRoute('/parceiros')}
              className="hidden items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:border-[#FF765E]/60 hover:text-[var(--text-primary)] xl:inline-flex"
            >
              <Building2 className="h-3.5 w-3.5 text-[#397B68]" />
              Parceiros
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                aria-label="Central de Notificações"
                onClick={() => {
                  const next = !showNotifs;
                  setShowNotifs(next);
                  if (next && unreadCount > 0) onMarkNotificationsRead();
                }}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] transition-colors hover:border-[#FF765E]/50 hover:text-[var(--text-primary)]"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#FF765E] text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-xl">
                  <div className="flex items-center justify-between border-b border-[var(--border-hairline)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      Central de Notificações
                    </p>
                    <Sparkles className="h-3.5 w-3.5 text-[#FF765E]" />
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
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] transition-colors hover:border-[#FF765E]/50 hover:text-[var(--text-primary)]"
            >
              {isDark ? <Sun className="h-4 w-4 text-[#FF765E]" /> : <Moon className="h-4 w-4 text-[#123B56]" />}
            </button>

            {activeTab !== 'admin' ? (
              <button
                id="btn-open-admin"
                type="button"
                onClick={() => onNavigateRoute('/admin')}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-xs transition-all hover:border-[#FF765E]/60 hover:text-[#FF765E]"
              >
                <Zap className="h-3.5 w-3.5 text-[#FF765E]" />
                <span className="hidden sm:inline">Admin</span>
              </button>
            ) : (
              <button
                id="btn-back-guide"
                type="button"
                onClick={() => onNavigateRoute('/app')}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#123B56] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#FF765E]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao App
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation (5 Tabs) */}
      {activeTab !== 'admin' && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 px-1 py-1.5 backdrop-blur-md lg:hidden">
          {MAIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-semibold transition-colors ${
                  active ? 'text-[#FF765E]' : 'text-[var(--text-secondary)]'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{tab.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}

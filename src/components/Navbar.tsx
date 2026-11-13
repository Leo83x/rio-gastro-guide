import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Compass,
  Crown,
  Moon,
  Sparkles,
  Sun,
  UserCheck,
  UtensilsCrossed,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import type { NotificationItem } from '../types/experience';

export type AppTab = 'discover' | 'planner' | 'club' | 'agenda' | 'profile' | 'admin';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  totalCount: number;
  pointsBalance: number;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
}

const MAIN_TABS: Array<{ id: Exclude<AppTab, 'admin'>; label: string; shortLabel: string; icon: typeof Compass }> = [
  { id: 'discover', label: 'Descobrir', shortLabel: 'Descobrir', icon: Compass },
  { id: 'planner', label: 'Planejador IA', shortLabel: 'Roteiro', icon: Sparkles },
  { id: 'club', label: 'Rio Gastro Club', shortLabel: 'Club', icon: Crown },
  { id: 'agenda', label: 'Agenda', shortLabel: 'Agenda', icon: CalendarDays },
  { id: 'profile', label: 'Perfil & Pontos', shortLabel: 'Pontos', icon: UserCheck },
];

export function Navbar({
  activeTab,
  onSelectTab,
  isDark,
  onToggleTheme,
  totalCount,
  pointsBalance,
  notifications,
  onMarkNotificationsRead,
}: NavbarProps) {
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          {/* Brand */}
          <button
            type="button"
            onClick={() => onSelectTab('discover')}
            className="group flex shrink-0 items-center gap-2.5 text-left focus:outline-none"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E05A47] text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
              <UtensilsCrossed className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-editorial text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-lg">
                  Rio Gastro Guide
                </span>
                <span className="hidden rounded-full border border-[var(--border-hairline)] bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)] xl:inline-block">
                  {totalCount} experiências
                </span>
              </div>
              <p className="hidden text-[11px] text-[var(--text-secondary)] sm:block">
                Superapp &amp; Concierge do Rio
              </p>
            </div>
          </button>

          {/* Desktop 5-Tab Navigation */}
          <nav className="hidden items-center gap-1 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1 lg:flex">
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
                      ? 'bg-[#E05A47] text-white shadow-xs'
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
                          : 'bg-[#D49B27]/15 text-[#B78114] dark:text-[#E5B342]'
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
          <div className="flex items-center gap-2">
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
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:border-[#E05A47]/50 hover:text-[var(--text-primary)]"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#E05A47] text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-xl">
                  <div className="border-b border-[var(--border-hairline)] px-4 py-3">
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      Central de Notificações
                    </p>
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
              aria-label="Alternar tema claro/escuro"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:border-[#E05A47]/50 hover:text-[var(--text-primary)]"
            >
              {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            </button>

            {activeTab !== 'admin' ? (
              <button
                id="btn-open-admin"
                type="button"
                onClick={() => onSelectTab('admin')}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-xs transition-all hover:border-[#E05A47]/60 hover:bg-[#E05A47]/5 hover:text-[#E05A47]"
              >
                <Zap className="h-3.5 w-3.5 text-[#E05A47]" />
                <span className="hidden sm:inline">Admin &amp; B2B</span>
                <span className="sm:hidden">Admin</span>
              </button>
            ) : (
              <button
                id="btn-back-guide"
                type="button"
                onClick={() => onSelectTab('discover')}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#1C1917] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#E05A47] dark:bg-[#F5F2EB] dark:text-[#0F1115] dark:hover:bg-[#E05A47] dark:hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao App
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
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
                active ? 'text-[#E05A47]' : 'text-[var(--text-secondary)]'
              }`}
            >
              <Icon className="h-4.5 w-4.5" />
              <span>{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

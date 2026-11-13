import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Lock,
  LogOut,
  Moon,
  Save,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { upsertRestaurants } from '../services/database';
import type { AppRoute } from '../services/router';
import type { ReservationRequest } from '../types/experience';
import type { Restaurant } from '../types/restaurant';

interface PartnerDashboardProps {
  restaurants: Restaurant[];
  reservations: ReservationRequest[];
  isDark: boolean;
  onToggleTheme: () => void;
  onNavigate: (route: AppRoute) => void;
  onDatabaseUpdated: () => Promise<void>;
}

const PARTNER_SESSION_KEY = 'borario_partner_tenant_v1';

export function PartnerDashboard({
  restaurants,
  reservations,
  isDark,
  onToggleTheme,
  onNavigate,
  onDatabaseUpdated,
}: PartnerDashboardProps) {
  const [partnerEmail, setPartnerEmail] = useState('gerencia@parceiro.rio.br');
  const [selectedTenantId, setSelectedTenantId] = useState<string>(() => {
    try {
      return localStorage.getItem(PARTNER_SESSION_KEY) || '';
    } catch {
      return '';
    }
  });
  const [draftTenantId, setDraftTenantId] = useState<string>(restaurants[0]?.id || '');

  const activeTenant = useMemo(
    () => restaurants.find((r) => r.id === selectedTenantId) || null,
    [restaurants, selectedTenantId]
  );

  // Isolated tenant form state
  const [phone, setPhone] = useState(activeTenant?.phone || '');
  const [website, setWebsite] = useState(activeTenant?.website || '');
  const [openingHours, setOpeningHours] = useState(activeTenant?.opening_hours || '');
  const [description, setDescription] = useState(activeTenant?.description || '');
  const [clubOfferDraft, setClubOfferDraft] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const syncForm = (tenant: Restaurant) => {
    setPhone(tenant.phone || '');
    setWebsite(tenant.website || '');
    setOpeningHours(tenant.opening_hours || '');
    setDescription(tenant.description || '');
    setSaveMessage('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = draftTenantId || restaurants[0]?.id;
    if (!targetId) return;
    localStorage.setItem(PARTNER_SESSION_KEY, targetId);
    setSelectedTenantId(targetId);
    const found = restaurants.find((r) => r.id === targetId);
    if (found) syncForm(found);
  };

  const handleLogout = () => {
    localStorage.removeItem(PARTNER_SESSION_KEY);
    setSelectedTenantId('');
    setSaveMessage('');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTenant) return;
    await upsertRestaurants([
      {
        ...activeTenant,
        phone,
        website,
        opening_hours: openingHours,
        description,
        data_source: 'owner_submitted',
        validation_status: 'CONFIRMADO',
        confidence_level: 'ALTA',
        last_verified_at: new Date().toISOString(),
      },
    ]);
    await onDatabaseUpdated();
    setSaveMessage('Dados do estabelecimento salvos com procedência "Fornecido pelo estabelecimento".');
  };

  // Strict Tenant Isolation: only reservations belonging to activeTenant
  const tenantReservations = useMemo(() => {
    if (!activeTenant) return [];
    return reservations.filter((res) => res.experience_id === activeTenant.id);
  }, [activeTenant, reservations]);

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onNavigate('/parceiros')}>
              <BrandLogo variant="horizontal" size="sm" onDark={isDark} />
            </button>
            <span className="rounded-full bg-[#123B56] px-2.5 py-0.5 text-[11px] font-bold text-white">
              Painel do Parceiro
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-hairline)]"
            >
              {isDark ? <Sun className="h-4 w-4 text-[#FF765E]" /> : <Moon className="h-4 w-4 text-[#123B56]" />}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/parceiros')}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {!activeTenant ? (
          <div className="mx-auto max-w-lg rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#123B56] text-white">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-editorial text-2xl font-bold">Acesso do Parceiro</h1>
                <p className="text-xs text-[var(--text-secondary)]">
                  Ambiente isolado por estabelecimento (tenant) — separado do Admin global.
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)]">
                  E-mail corporativo do parceiro
                </label>
                <input
                  type="email"
                  required
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm focus:border-[#FF765E] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)]">
                  Estabelecimento vinculado (sessão demonstrativa)
                </label>
                <select
                  value={draftTenantId || restaurants[0]?.id || ''}
                  onChange={(e) => setDraftTenantId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm focus:border-[#FF765E] focus:outline-none"
                >
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — {r.neighborhood}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-[#FF765E] py-3 text-sm font-bold text-white shadow-sm hover:bg-[#e8634c]"
              >
                Entrar no Painel do Estabelecimento
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tenant Banner */}
            <div className="flex flex-col justify-between gap-4 rounded-3xl bg-borario-day p-6 text-white sm:flex-row sm:items-center">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5 text-[#A7E3CE]" />
                  Sessão isolada · {partnerEmail}
                </div>
                <h1 className="font-editorial mt-2 text-2xl font-bold sm:text-3xl">
                  {activeTenant.name}
                </h1>
                <p className="text-xs text-[#F1E8D8]">
                  {activeTenant.category} · {activeTenant.neighborhood} · Status:{' '}
                  <strong>{activeTenant.validation_status}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 sm:self-auto"
              >
                <LogOut className="h-3.5 w-3.5" />
                Trocar / Sair
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Edit Own Establishment */}
              <form
                onSubmit={handleSaveProfile}
                className="space-y-4 rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-2"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#FF765E]" />
                  <h2 className="font-editorial text-xl font-bold">
                    Dados Oficiais do Estabelecimento
                  </h2>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold">Telefone / WhatsApp</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(21) 99999-0000"
                      className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold">Site oficial</label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://..."
                      className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold">Horário de funcionamento</label>
                  <input
                    type="text"
                    value={openingHours}
                    onChange={(e) => setOpeningHours(e.target.value)}
                    placeholder="Terça a Domingo, 12h às 23h"
                    className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold">Descrição oficial no BoraRio</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm"
                  />
                </div>

                {saveMessage && (
                  <div className="flex items-center gap-2 rounded-xl bg-[#397B68]/15 px-3.5 py-2.5 text-xs font-semibold text-[#397B68]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {saveMessage}
                  </div>
                )}

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#123B56] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#102F46]"
                >
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </button>
              </form>

              {/* Tenant Reservations & Club Draft */}
              <div className="space-y-6">
                <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-[#397B68]" />
                    <h2 className="font-editorial text-lg font-bold">
                      Solicitações de Reserva ({tenantReservations.length})
                    </h2>
                  </div>
                  <div className="mt-4 space-y-3">
                    {tenantReservations.length === 0 ? (
                      <p className="text-xs text-[var(--text-secondary)]">
                        Nenhuma solicitação recebida para este estabelecimento ainda.
                      </p>
                    ) : (
                      tenantReservations.map((res) => (
                        <div
                          key={res.id}
                          className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3 text-xs"
                        >
                          <p className="font-bold text-[var(--text-primary)]">{res.experience_name}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[var(--text-secondary)]">
                            <Clock className="h-3 w-3" />
                            {res.date} às {res.time} · {res.guests} pessoas
                          </p>
                          <span className="mt-1.5 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                            {res.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
                  <div className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-[#D49B27]" />
                    <h2 className="font-editorial text-lg font-bold">Proposta Rio Gastro Club</h2>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Rascunho demonstrativo para campanha exclusiva de membros.
                  </p>
                  <input
                    type="text"
                    value={clubOfferDraft}
                    onChange={(e) => setClubOfferDraft(e.target.value)}
                    placeholder="Ex: Welcome drink às quartas-feiras"
                    className="mt-3 w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

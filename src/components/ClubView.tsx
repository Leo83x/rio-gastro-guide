import { Clock, Crown, Flame, Gift, Info, Percent, Users } from 'lucide-react';
import { useState } from 'react';
import {
  DEMONSTRATIVE_CLUB_OFFERS,
  getGroupDrops,
  toggleJoinGroupDrop,
} from '../services/superappStore';
import type { GroupDrop } from '../types/experience';
import type { Restaurant } from '../types/restaurant';

interface ClubViewProps {
  experiences: Restaurant[];
  onSelectExperience: (item: Restaurant) => void;
}

export function ClubView({ experiences, onSelectExperience }: ClubViewProps) {
  const [drops, setDrops] = useState<GroupDrop[]>(() => getGroupDrops());

  const openVenue = (expId: string) => {
    const found = experiences.find((e) => e.id === expId);
    if (found) onSelectExperience(found);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header + Transparency Notice */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#E05A47]">
            <Crown className="h-4 w-4" />
            Rio Gastro Club
          </p>
          <h2 className="font-sans tracking-tight mt-1 text-3xl font-bold text-[var(--text-primary)]">
            Vantagens Exclusivas &amp; Ofertas Coletivas
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Benefícios Off-Peak em horários estratégicos e Drops de Grupo que destravam descontos ao atingir a meta.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            <strong>Modo Demonstrativo:</strong> fluxo de adesão sem cobrança financeira real até integração do gateway de pagamento.
          </span>
        </div>
      </div>

      {/* Exclusive Benefits */}
      <section>
        <h3 className="font-sans tracking-tight mb-4 text-xl font-bold text-[var(--text-primary)]">
          Benefícios de Membro &amp; Off-Peak
        </h3>
        <div className="grid gap-5 md:grid-cols-3">
          {DEMONSTRATIVE_CLUB_OFFERS.map((offer) => (
            <div
              key={offer.id}
              className="flex flex-col justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E05A47]/15 px-2.5 py-1 text-[11px] font-bold text-[#E05A47]">
                    {offer.benefit_type === 'OFF_PEAK' ? (
                      <Percent className="h-3 w-3" />
                    ) : (
                      <Gift className="h-3 w-3" />
                    )}
                    {offer.discount_label}
                  </span>
                  <span className="rounded bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                    Demonstrativo
                  </span>
                </div>

                <h4 className="font-sans tracking-tight mt-3 text-lg font-bold text-[var(--text-primary)]">
                  {offer.experience_name}
                </h4>
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  {offer.neighborhood}
                </p>
                <p className="mt-2.5 text-sm font-medium text-[var(--text-primary)]">
                  {offer.title}
                </p>
              </div>

              <div className="mt-4 border-t border-[var(--border-hairline)] pt-3">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <Clock className="h-3.5 w-3.5 text-[#E05A47]" />
                  <span>{offer.valid_window}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openVenue(offer.experience_id)}
                  className="mt-3 w-full rounded-xl bg-[#1C1917] py-2 text-xs font-semibold text-white transition-colors hover:bg-[#E05A47] dark:bg-[#F5F2EB] dark:text-[#0F1115] dark:hover:bg-[#E05A47] dark:hover:text-white"
                >
                  Ver Estabelecimento &amp; Usar Benefício
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Collective Group Drops */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Flame className="h-5 w-5 text-[#E05A47]" />
          <h3 className="font-sans tracking-tight text-xl font-bold text-[var(--text-primary)]">
            Ofertas Coletivas (Drops de Grupo)
          </h3>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {drops.map((drop) => {
            const pct = Math.min(
              100,
              Math.round((drop.current_participants / drop.target_participants) * 100)
            );
            const unlocked = drop.current_participants >= drop.target_participants;

            return (
              <div
                key={drop.id}
                className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-[#E05A47] px-3 py-1 text-xs font-bold text-white">
                    {drop.discount_label}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {drop.deadline_label}
                  </span>
                </div>

                <h4 className="font-sans tracking-tight mt-3 text-xl font-bold text-[var(--text-primary)]">
                  {drop.title}
                </h4>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {drop.experience_name} · {drop.neighborhood}
                </p>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                      <Users className="h-3.5 w-3.5 text-[#E05A47]" />
                      {drop.current_participants}/{drop.target_participants} adesões confirmadas
                    </span>
                    <span className="font-bold text-[#E05A47]">{pct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[#E05A47] transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-[var(--text-secondary)]">
                    {unlocked
                      ? 'Meta atingida! Oferta destravada para os participantes.'
                      : 'Destrava automaticamente ao atingir a meta mínima. Sem cobrança antecipada neste fluxo demonstrativo.'}
                  </p>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDrops(toggleJoinGroupDrop(drop.id))}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-semibold transition-colors ${
                      drop.joined
                        ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-[#E05A47] text-white hover:bg-[#c84b39]'
                    }`}
                  >
                    {drop.joined ? 'Adesão Registrada (Cancelar)' : 'Confirmar Adesão no Grupo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openVenue(drop.experience_id)}
                    className="rounded-xl border border-[var(--border-hairline)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[#E05A47]"
                  >
                    Detalhes
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

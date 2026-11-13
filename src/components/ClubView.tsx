import {
  CheckCircle2,
  Clock,
  Crown,
  Flame,
  Gift,
  Info,
  Percent,
  ReceiptText,
  Ticket,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import {
  getClubRedemptions,
  markClubRedemptionUsed,
  redeemClubOffer,
} from '../services/clubRedemptionStore';
import {
  DEMONSTRATIVE_CLUB_OFFERS,
  getGroupDrops,
  toggleJoinGroupDrop,
} from '../services/superappStore';
import type { ClubOffer, ClubRedemption, GroupDrop } from '../types/experience';
import type { Restaurant } from '../types/restaurant';

interface ClubViewProps {
  experiences: Restaurant[];
  onSelectExperience: (item: Restaurant) => void;
}

export function ClubView({ experiences, onSelectExperience }: ClubViewProps) {
  const [drops, setDrops] = useState<GroupDrop[]>(() => getGroupDrops());
  const [redemptions, setRedemptions] = useState<ClubRedemption[]>(() => getClubRedemptions());
  const [lastVoucher, setLastVoucher] = useState<ClubRedemption | null>(null);

  const openVenue = (expId: string) => {
    const found = experiences.find((e) => e.id === expId);
    if (found) onSelectExperience(found);
  };

  const handleActivateOffer = (offer: ClubOffer) => {
    const res = redeemClubOffer(offer);
    setRedemptions(res.all);
    setLastVoucher(res.redemption);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header + Transparency Notice */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-6 md:flex-row md:items-end">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#FF6B35]">
            <Crown className="h-4 w-4" />
            Bora Club
          </p>
          <h2 className="font-sans mt-1 text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Vantagens Exclusivas &amp; Ofertas Coletivas
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Benefícios Off-Peak em horários estratégicos e Drops de Grupo que destravam descontos ao atingir a meta.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-800 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            <strong>Modo Demonstrativo:</strong> fluxos de benefício e geração de voucher sem cobrança financeira real até integração de gateway/POS parceiro.
          </span>
        </div>
      </div>

      {lastVoucher && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 text-xs text-emerald-800 dark:text-emerald-200 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="font-bold">
                Voucher gerado no Bora Club (Demo): <span className="font-mono">{lastVoucher.voucher_code}</span>
              </p>
              <p className="opacity-90">
                {lastVoucher.experience_name} — {lastVoucher.offer_title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastVoucher(null)}
            className="self-start rounded-lg border border-emerald-500/40 px-3 py-1 font-bold hover:bg-emerald-500/20 sm:self-auto"
          >
            Ok
          </button>
        </div>
      )}

      {/* Exclusive Benefits */}
      <section>
        <h3 className="font-sans mb-4 text-xl font-bold tracking-tight text-[var(--text-primary)]">
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FF6B35]/15 px-2.5 py-1 text-[11px] font-bold text-[#FF6B35]">
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

                <h4 className="font-sans mt-3 text-lg font-bold tracking-tight text-[var(--text-primary)]">
                  {offer.experience_name}
                </h4>
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  {offer.neighborhood}
                </p>
                <p className="mt-2.5 text-sm font-medium text-[var(--text-primary)]">
                  {offer.title}
                </p>
              </div>

              <div className="mt-4 space-y-2 border-t border-[var(--border-hairline)] pt-3">
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                  <Clock className="h-3.5 w-3.5 text-[#FF6B35]" />
                  <span>Janela: {offer.valid_window}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleActivateOffer(offer)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] py-2 text-xs font-bold text-white transition-opacity hover:opacity-95"
                  >
                    <Ticket className="h-3.5 w-3.5" />
                    Gerar Voucher
                  </button>
                  <button
                    type="button"
                    onClick={() => openVenue(offer.experience_id)}
                    className="rounded-xl border border-[var(--border-hairline)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                  >
                    Local
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Collective Group Drops */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Flame className="h-5 w-5 text-[#FF6B35]" />
          <h3 className="font-sans text-xl font-bold tracking-tight text-[var(--text-primary)]">
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
                  <span className="rounded-full bg-[#FF6B35] px-3 py-1 text-xs font-bold text-white">
                    {drop.discount_label}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {drop.deadline_label}
                  </span>
                </div>

                <h4 className="font-sans mt-3 text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  {drop.title}
                </h4>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  {drop.experience_name} · {drop.neighborhood}
                </p>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
                      <Users className="h-3.5 w-3.5 text-[#FF6B35]" />
                      {drop.current_participants}/{drop.target_participants} adesões confirmadas
                    </span>
                    <span className="font-bold text-[#FF6B35]">{pct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                    <div
                      className="h-full rounded-full bg-[#FF6B35] transition-all duration-300"
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
                        : 'bg-[#FF6B35] text-white hover:bg-[#e8634c]'
                    }`}
                  >
                    {drop.joined ? 'Adesão Registrada (Cancelar)' : 'Confirmar Adesão no Grupo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openVenue(drop.experience_id)}
                    className="rounded-xl border border-[var(--border-hairline)] px-4 py-2.5 text-xs font-semibold text-[var(--text-primary)] hover:border-[#FF6B35]"
                  >
                    Detalhes
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Redemption History & Rules */}
      <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
          <ReceiptText className="h-4 w-4 text-[#FF6B35]" />
          Histórico de Resgates &amp; Regras do Bora Club
        </div>

        {redemptions.length === 0 ? (
          <p className="mt-3 text-xs text-[var(--text-secondary)]">
            Você ainda não gerou vouchers no Bora Club. Clique em <strong>Gerar Voucher</strong> em qualquer benefício acima para testar o fluxo e acompanhar seu histórico aqui.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {redemptions.map((rec) => (
              <div
                key={rec.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3.5 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#FF6B35]">{rec.voucher_code}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        rec.status === 'USED'
                          ? 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {rec.status === 'USED' ? 'Utilizado' : 'Ativo (Demo)'}
                    </span>
                  </div>
                  <p className="mt-1 font-bold text-[var(--text-primary)]">{rec.experience_name}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{rec.offer_title}</p>
                </div>

                {rec.status === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => setRedemptions(markClubRedemptionUsed(rec.id))}
                    className="shrink-0 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-primary)] hover:border-emerald-500"
                  >
                    Marcar usado
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

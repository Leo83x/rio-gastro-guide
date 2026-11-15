import {
  BarChart3,
  CalendarCheck2,
  Check,
  Clock,
  Copy,
  Info,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { EXTERNAL_INTEGRATIONS_REGISTRY } from '../services/integrations/registry';
import { getPartnerOfferings } from '../services/opportunityStore';
import { getPartnerCommercialPlan, getPartnerFeeLedger } from '../services/partnerCommercialStore';
import {
  getActiveVenueQrToken,
  getVisitProofs,
  issueDynamicVenueQrToken,
  revokeVenueQrToken,
} from '../services/visitProofStore';
import type { ReservationRequest } from '../types/experience';
import type { Restaurant } from '../types/restaurant';
import type { VenueQrToken } from '../types/verification';

interface B2BPartnerViewProps {
  experiences: Restaurant[];
  reservations: ReservationRequest[];
}

export function B2BPartnerView({ experiences, reservations }: B2BPartnerViewProps) {
  const [selectedId, setSelectedId] = useState<string>(experiences[0]?.id || '');
  const [copiedToken, setCopiedToken] = useState(false);
  const [qrRefreshTick, setQrRefreshTick] = useState(0);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const selected = experiences.find((e) => e.id === selectedId) || experiences[0];

  const venueReservations = selected
    ? reservations.filter(
        (r) =>
          r.experience_id === selected.id &&
          r.status !== 'CANCELLED' &&
          r.stage !== 'CANCELLED' &&
          r.stage !== 'NO_SHOW' &&
          r.stage !== 'ENDED_WITHOUT_GOAL'
      )
    : [];

  const venueOfferings = selected
    ? getPartnerOfferings({ restaurantId: selected.id, includeDrafts: true })
    : [];

  const venueProofs = selected ? getVisitProofs({ restaurantId: selected.id }) : [];
  const venueFees = selected ? getPartnerFeeLedger(selected.id) : [];
  const plan = selected ? getPartnerCommercialPlan(selected.id) : null;

  // Read active token dynamically; trigger re-read when qrRefreshTick updates
  const activeToken: VenueQrToken | null =
    selected && qrRefreshTick >= 0 ? getActiveVenueQrToken(selected.id) : null;

  const remainingSeconds = activeToken
    ? Math.max(0, Math.floor((new Date(activeToken.expires_at).getTime() - nowMs) / 1000))
    : 0;

  const accruedTotalBrl = venueFees
    .filter((f) => f.status === 'ACCRUED' || f.status === 'INVOICED')
    .reduce((acc, f) => acc + f.total_fee_brl, 0);

  const handleEmitQr = () => {
    if (!selected) return;
    issueDynamicVenueQrToken({
      restaurantId: selected.id,
      ttlSeconds: 300,
      maxUses: 1,
      issuedByLabel: 'Admin / Balcão Parceiro',
    });
    setNowMs(Date.now());
    setQrRefreshTick((t) => t + 1);
  };

  const handleRevokeQr = () => {
    if (!activeToken) return;
    revokeVenueQrToken(activeToken.id);
    setQrRefreshTick((t) => t + 1);
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Multi-Tenant Isolation & Commercial Positioning Banner */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#397B68]/35 bg-[#397B68]/10 p-4 text-xs text-[var(--text-primary)] sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#397B68]" />
          <div>
            <strong>BoraRio — Plataforma inteligente de reservas, experiências e geração de demanda:</strong>{' '}
            o parceiro define as condições comerciais sem desconto obrigatório e sem percentual sobre a conta consumida. O acesso B2B completo e isolado fica em <strong>/parceiros/painel</strong>.
          </div>
        </div>
      </div>

      {/* Venue Selector & Real Local Operational Summary */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#E05A47]">
              Visão Operacional B2B do Estabelecimento
            </p>
            <h3 className="font-sans tracking-tight text-2xl font-bold text-[var(--text-primary)]">
              {selected?.name || 'Selecione um estabelecimento'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {selected?.neighborhood} · {selected?.macro_category || selected?.category}
            </p>
          </div>

          <select
            value={selected?.id || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-xs font-semibold text-[var(--text-primary)]"
          >
            {experiences.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.name} ({exp.neighborhood})
              </option>
            ))}
          </select>
        </div>

        {/* Metrics Grid (Zero Fabricated Telemetry) */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
              Reservas Ativas
            </p>
            <p className="font-sans tracking-tight mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {venueReservations.length}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              Solicitações &amp; confirmadas
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <CalendarCheck2 className="h-3.5 w-3.5 text-[#FF6B35]" />
              Ofertas / Janelas
            </p>
            <p className="font-sans tracking-tight mt-2 text-2xl font-bold text-[var(--text-primary)]">
              {venueOfferings.length}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              Nas 4 modalidades independentes
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#397B68]" />
              Visitas com Check-in QR
            </p>
            <p className="font-sans tracking-tight mt-2 text-2xl font-bold text-[var(--text-primary)]">
              {venueProofs.length}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              Validados antes do consumo
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <ReceiptText className="h-3.5 w-3.5 text-[#D49B27]" />
              Taxa Fixa Apurada (0% conta)
            </p>
            <p className="font-sans tracking-tight mt-2 text-2xl font-bold text-[var(--text-primary)]">
              R$ {accruedTotalBrl.toFixed(2)}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              {plan?.billing_model === 'PER_ATTENDED_GUEST'
                ? `R$ ${plan.fixed_fee_per_guest_brl.toFixed(2)}/hóspede atendido`
                : plan?.billing_model === 'PER_COMPLETED_BOOKING'
                  ? `R$ ${plan.fixed_fee_per_booking_brl.toFixed(2)}/reserva atendida`
                  : 'Plano fixo recorrente'}
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Rotating Temporary QR Generator + Integrations */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#E05A47]">
            <QrCode className="h-4 w-4" />
            Gerador de QR Dinâmico Temporário (5 min · Uso único)
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
            Gera um token rotativo temporário (<code className="font-mono">BR-QR-...</code>) e um PIN de 6 dígitos vinculado a <strong>{selected?.name}</strong>. Bloqueia expiração, reutilização e check-in em outro local.
          </p>

          <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5 sm:flex-row">
            <div className="flex h-28 w-28 shrink-0 flex-col items-center justify-center rounded-xl bg-white p-2 text-[#1C1917] shadow-xs">
              <QrCode className="h-16 w-16" />
              <span className="mt-1 font-mono text-[9px] font-bold">
                {activeToken ? activeToken.contingency_pin : 'SEM ATIVO'}
              </span>
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <p className="text-xs font-bold text-[var(--text-primary)]">{selected?.name}</p>
              {activeToken && remainingSeconds > 0 ? (
                <>
                  <p className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs font-bold text-[#E05A47]">
                    {activeToken.token_code}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] sm:justify-start">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                      <Clock className="h-3 w-3" />
                      Expira em {remainingSeconds}s
                    </span>
                    <span className="rounded bg-[var(--bg-surface)] px-2 py-0.5 font-mono font-bold text-[var(--text-primary)]">
                      PIN: {activeToken.contingency_pin}
                    </span>
                  </div>
                </>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--border-hairline)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                  Nenhum QR dinâmico ativo no momento. Emita um novo para o cliente escanear ou digitar na chegada.
                </p>
              )}

              <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-start">
                <button
                  type="button"
                  onClick={handleEmitQr}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#123B56] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#102F46]"
                >
                  <RefreshCw className="h-3 w-3" />
                  {activeToken && remainingSeconds > 0 ? 'Rotacionar QR Dinâmico' : 'Emitir QR Dinâmico (5 min)'}
                </button>
                {activeToken && remainingSeconds > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(activeToken.token_code);
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#1C1917] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#E05A47] dark:bg-[#F5F2EB] dark:text-[#0F1115]"
                    >
                      {copiedToken ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copiedToken ? 'Copiado!' : 'Copiar Token'}
                    </button>
                    <button
                      type="button"
                      onClick={handleRevokeQr}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-600 dark:text-red-300"
                    >
                      <XCircle className="h-3 w-3" />
                      Revogar
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modular External Integrations Status */}
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            Camada Modular de Integrações Externas
          </p>
          <div className="mt-3 max-h-60 divide-y divide-[var(--border-hairline)] overflow-y-auto text-xs">
            {EXTERNAL_INTEGRATIONS_REGISTRY.map((intg) => (
              <div key={intg.id} className="py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[var(--text-primary)]">{intg.name}</strong>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      intg.status === 'OPERATIONAL' || intg.status === 'OPERATIONAL_DEEP_LINK'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : intg.status === 'CONFIGURABLE'
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {intg.status}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                  {intg.provider} · {intg.costAndLimits}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

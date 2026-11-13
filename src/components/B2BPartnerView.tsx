import {
  BarChart3,
  Check,
  Copy,
  Eye,
  Info,
  Navigation,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import { useState } from 'react';
import { EXTERNAL_INTEGRATIONS_REGISTRY } from '../services/integrations/registry';
import type { ReservationRequest } from '../types/experience';
import type { Restaurant } from '../types/restaurant';

interface B2BPartnerViewProps {
  experiences: Restaurant[];
  reservations: ReservationRequest[];
}

export function B2BPartnerView({ experiences, reservations }: B2BPartnerViewProps) {
  const [selectedId, setSelectedId] = useState<string>(experiences[0]?.id || '');
  const [nonce, setNonce] = useState<string>(() =>
    Math.random().toString(36).substring(2, 7).toUpperCase()
  );
  const [copiedToken, setCopiedToken] = useState(false);

  const selected = experiences.find((e) => e.id === selectedId) || experiences[0];
  const realReservationsCount = selected
    ? reservations.filter((r) => r.experience_id === selected.id && r.status !== 'CANCELLED').length
    : 0;

  const qrToken = selected
    ? `RGG-QR-${selected.slug.slice(0, 8).toUpperCase()}-${nonce}`
    : 'RGG-QR-DEMO-001';

  return (
    <div className="mt-6 space-y-6">
      {/* Multi-Tenant Isolation & Transparency Banner */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-200 sm:flex-row sm:items-center">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <strong>Visão Comercial B2B (Demonstração Multi-Tenant):</strong> na operação real com autenticação, cada parceiro acessa exclusivamente seus próprios estabelecimentos, reservas, QR Codes e campanhas. Métricas de tráfego abaixo são demonstrativas até a conexão do backend de analytics.
          </div>
        </div>
      </div>

      {/* Venue Selector */}
      <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#E05A47]">
              Painel do Parceiro
            </p>
            <h3 className="font-editorial text-2xl font-bold text-[var(--text-primary)]">
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

        {/* Metrics Grid */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <Eye className="h-3.5 w-3.5 text-[#E05A47]" />
              Visualizações (Demo)
            </p>
            <p className="font-editorial mt-2 text-2xl font-bold text-[var(--text-primary)]">
              Indisponível
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              Requer analytics de produção
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <Navigation className="h-3.5 w-3.5 text-sky-500" />
              Cliques "Como Chegar"
            </p>
            <p className="font-editorial mt-2 text-2xl font-bold text-[var(--text-primary)]">
              Indisponível
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              Telemetria pendente
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
              Reservas Solicitadas
            </p>
            <p className="font-editorial mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {realReservationsCount}
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              Contagem real local
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <Ticket className="h-3.5 w-3.5 text-[#D49B27]" />
              Cupons Club (Demo)
            </p>
            <p className="font-editorial mt-2 text-2xl font-bold text-[var(--text-primary)]">
              0
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              Sem resgates registrados
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#E05A47]" />
              Check-ins QR Mesa
            </p>
            <p className="font-editorial mt-2 text-2xl font-bold text-[var(--text-primary)]">
              Ativo
            </p>
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              Validação antifraude pronta
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Anti-Fraud QR Code Generator */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#E05A47]">
            <QrCode className="h-4 w-4" />
            Gerador de QR Code Dinâmico Antifraude (Display de Mesa)
          </div>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
            Cada código contém o identificador do estabelecimento e um nonce rotativo contra reutilização. Copie o token e teste na aba <strong>Perfil &amp; Pontos</strong>.
          </p>

          <div className="mt-4 flex flex-col items-center gap-4 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5 sm:flex-row">
            {/* Stylized QR Matrix SVG */}
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-xs">
              <QrCode className="h-20 w-20 text-[#1C1917]" />
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {selected?.name}
              </p>
              <p className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs font-bold text-[#E05A47]">
                {qrToken}
              </p>
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard?.writeText(qrToken);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#1C1917] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#E05A47] dark:bg-[#F5F2EB] dark:text-[#0F1115]"
                >
                  {copiedToken ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedToken ? 'Copiado!' : 'Copiar Token QR'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNonce(Math.random().toString(36).substring(2, 7).toUpperCase())
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] hover:border-[#E05A47]"
                >
                  <RefreshCw className="h-3 w-3" />
                  Gerar Novo Nonce
                </button>
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

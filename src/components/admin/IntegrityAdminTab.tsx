import { CheckCircle2, FileText, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  applyAdminIncidentDecision,
  computeIntegrityMetrics,
  fetchIncidentsFromServer,
} from '../../services/integrityStore';
import {
  INCIDENT_STATUS_LABELS,
  PARTNER_MEASURE_LABELS,
  USER_MEASURE_LABELS,
  type IncidentCategory,
  type IncidentStatus,
  type IntegrityOperationalMetrics,
  type OperationalIncident,
  type PartnerProgressiveMeasureLevel,
  type UserProgressiveMeasureLevel,
} from '../../types/integrity';

export function IntegrityAdminTab() {
  const [incidents, setIncidents] = useState<OperationalIncident[]>([]);
  const [metrics, setMetrics] = useState<IntegrityOperationalMetrics | null>(null);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | 'ALL'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [userMeasure, setUserMeasure] = useState<UserProgressiveMeasureLevel | ''>('');
  const [partnerMeasure, setPartnerMeasure] = useState<PartnerProgressiveMeasureLevel | ''>('');
  const [measureDays, setMeasureDays] = useState<number>(7);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAll = async () => {
    const res = await fetchIncidentsFromServer();
    setIncidents(res.incidents);
    setMetrics(computeIntegrityMetrics(res.incidents));
    if (!selectedId && res.incidents.length > 0) {
      setSelectedId(res.incidents[0].id);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const filtered = incidents.filter((inc) => {
    if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && inc.category !== categoryFilter) return false;
    return true;
  });

  const selectedIncident = filtered.find((i) => i.id === selectedId) || filtered[0] || null;

  const handleDecision = async (
    newStatus: IncidentStatus,
    options?: { confirmPostVisit?: boolean }
  ) => {
    if (!selectedIncident) return;
    if (!justification.trim()) {
      setFeedback('Justificativa obrigatória antes de registrar qualquer decisão.');
      return;
    }

    const res = await applyAdminIncidentDecision({
      incidentId: selectedIncident.id,
      newStatus,
      justification: justification.trim(),
      confirmPostVisit: options?.confirmPostVisit,
      userMeasureLevel: userMeasure || undefined,
      partnerMeasureLevel: partnerMeasure || undefined,
      measureExpiresDays: userMeasure || partnerMeasure ? measureDays : undefined,
    });

    setFeedback(res.message);
    if (res.ok) {
      setJustification('');
      setUserMeasure('');
      setPartnerMeasure('');
      await loadAll();
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-hairline)] pb-4 md:flex-row md:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-borario-ocean">
              <ShieldCheck className="h-4 w-4" />
              Integridade Operacional e Auditoria
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">
              Ocorrências, Confiabilidade e Conformidade
            </h2>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | 'ALL')}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-semibold"
            >
              <option value="ALL">Todos os estados</option>
              {(Object.keys(INCIDENT_STATUS_LABELS) as IncidentStatus[]).map((st) => (
                <option key={st} value={st}>
                  {INCIDENT_STATUS_LABELS[st]}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as IncidentCategory | 'ALL')}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 font-semibold"
            >
              <option value="ALL">Todas categorias</option>
              <option value="CONSUMER">Consumidor</option>
              <option value="PARTNER">Estabelecimento</option>
              <option value="TECHNICAL">Técnica</option>
            </select>
          </div>
        </div>

        {/* KPIs e Indicadores Operacionais */}
        {metrics && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-xs">
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3">
              <span className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Abertas / Análise</span>
              <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">
                {metrics.totalOpen + metrics.waitingPartner + metrics.waitingUser + metrics.underReview}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3">
              <span className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Check-in Sucesso</span>
              <p className="mt-1 text-lg font-extrabold text-emerald-600">{metrics.successfulCheckinRatePct}%</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3">
              <span className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Falha QR</span>
              <p className="mt-1 text-lg font-extrabold text-amber-600">{metrics.qrFailureRatePct}%</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3">
              <span className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Pós-Visita Recup.</span>
              <p className="mt-1 text-lg font-extrabold text-sky-600">{metrics.recoveredVisitsPostDispute}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3">
              <span className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Procedentes (%)</span>
              <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{metrics.upheldDisputesPct}%</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-3">
              <span className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">Possível Fraude</span>
              <p className="mt-1 text-lg font-extrabold text-rose-600">{metrics.possibleFraudCount}</p>
            </div>
          </div>
        )}

        {feedback && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Lista + Detalhe */}
        <div className="mt-5 grid gap-5 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-5">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-6 text-center text-xs text-[var(--text-secondary)]">
                Nenhuma ocorrência encontrada para os filtros selecionados.
              </div>
            ) : (
              filtered.map((inc) => {
                const active = selectedIncident?.id === inc.id;
                return (
                  <button
                    key={inc.id}
                    type="button"
                    onClick={() => setSelectedId(inc.id)}
                    className={`w-full text-left rounded-2xl border p-3.5 text-xs transition ${
                      active
                        ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-canvas)] hover:border-borario-ocean/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[var(--text-primary)]">{inc.title}</span>
                      <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                        {INCIDENT_STATUS_LABELS[inc.status] || inc.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                      {inc.restaurant_name || 'Sem estabelecimento'} · {inc.category} ·{' '}
                      {new Date(inc.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          <div className="lg:col-span-7">
            {selectedIncident ? (
              <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-5 space-y-4 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-hairline)] pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6B35]">
                      {selectedIncident.category} · {selectedIncident.subtype}
                    </span>
                    <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                      {selectedIncident.title}
                    </h3>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Estabelecimento: {selectedIncident.restaurant_name || 'N/A'} · Consumidor:{' '}
                      {selectedIncident.user_display_label || selectedIncident.user_id || 'N/A'}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                    {INCIDENT_STATUS_LABELS[selectedIncident.status]}
                  </span>
                </div>

                <p className="text-[var(--text-primary)] leading-relaxed">
                  {selectedIncident.description}
                </p>

                {/* Evidências */}
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-[var(--text-tertiary)] flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" /> Evidências ({selectedIncident.evidences?.length || 0})
                  </p>
                  {selectedIncident.evidences && selectedIncident.evidences.length > 0 ? (
                    selectedIncident.evidences.map((ev) => (
                      <div key={ev.id} className="text-[11px] text-[var(--text-secondary)]">
                        <strong>[{ev.submitted_by_role}]</strong> {ev.summary}
                        {ev.payload_url && (
                          <a
                            href={ev.payload_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-borario-ocean underline"
                          >
                            Ver anexo
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-[11px] text-[var(--text-tertiary)]">Nenhuma evidência anexada.</p>
                  )}
                </div>

                {/* Linha do tempo */}
                <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">
                    Linha do Tempo Auditável
                  </p>
                  {(selectedIncident.events || []).map((ev) => (
                    <div key={ev.id} className="text-[11px] text-[var(--text-secondary)]">
                      <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
                        {new Date(ev.created_at).toLocaleString('pt-BR')}
                      </span>{' '}
                      · <strong>[{ev.actor_role}]</strong> {ev.event_type}: {ev.justification}
                    </div>
                  ))}
                </div>

                {/* Ações Administrativas com Justificativa Obrigatória */}
                <div className="space-y-3 border-t border-[var(--border-hairline)] pt-3">
                  <label className="block font-bold text-[var(--text-primary)]">
                    Justificativa obrigatória da decisão administrativa
                  </label>
                  <textarea
                    rows={2}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Descreva os fundamentos e evidências que embasam esta decisão..."
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                  />

                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      value={userMeasure}
                      onChange={(e) =>
                        setUserMeasure(e.target.value as UserProgressiveMeasureLevel | '')
                      }
                      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-2 text-[11px]"
                    >
                      <option value="">Medida consumidor (nenhuma)</option>
                      {(Object.keys(USER_MEASURE_LABELS) as UserProgressiveMeasureLevel[]).map((m) => (
                        <option key={m} value={m}>
                          {USER_MEASURE_LABELS[m]}
                        </option>
                      ))}
                    </select>

                    <select
                      value={partnerMeasure}
                      onChange={(e) =>
                        setPartnerMeasure(e.target.value as PartnerProgressiveMeasureLevel | '')
                      }
                      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-2 text-[11px]"
                    >
                      <option value="">Medida parceiro (nenhuma)</option>
                      {(Object.keys(PARTNER_MEASURE_LABELS) as PartnerProgressiveMeasureLevel[]).map((m) => (
                        <option key={m} value={m}>
                          {PARTNER_MEASURE_LABELS[m]}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={measureDays}
                      onChange={(e) => setMeasureDays(Number(e.target.value) || 7)}
                      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-2 text-[11px]"
                      placeholder="Prazo (dias)"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDecision('WAITING_PARTNER')}
                      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 font-bold hover:border-borario-ocean"
                    >
                      Solicitar esclarec. parceiro
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision('WAITING_USER')}
                      className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 font-bold hover:border-borario-ocean"
                    >
                      Solicitar esclarec. consumidor
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision('RESOLVED_USER', { confirmPostVisit: true })}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700"
                    >
                      Confirmar Pós-Visita (Favor Consumidor)
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision('RESOLVED_PARTNER')}
                      className="rounded-xl bg-sky-600 px-3 py-1.5 font-bold text-white hover:bg-sky-700"
                    >
                      Resolver Favor Parceiro
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision('RESOLVED_TECHNICAL')}
                      className="rounded-xl bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700"
                    >
                      Classificar Falha Técnica
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision('UNFOUNDED')}
                      className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 font-bold text-rose-700 dark:text-rose-300"
                    >
                      Não confirmada
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDecision('CLOSED')}
                      className="rounded-xl bg-stone-700 px-3 py-1.5 font-bold text-white"
                    >
                      Encerrar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-8 text-center text-xs text-[var(--text-secondary)]">
                <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-[var(--text-tertiary)]" />
                Selecione uma ocorrência ao lado para inspecionar evidências, linha do tempo e aplicar decisões.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { CheckCircle2, FileText, MessageSquare, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  computePartnerComplianceProfile,
  fetchIncidentsFromServer,
  submitIncidentResponse,
} from '../../services/integrityStore';
import {
  INCIDENT_STATUS_LABELS,
  PARTNER_MEASURE_LABELS,
  type OperationalIncident,
  type PartnerComplianceProfile,
} from '../../types/integrity';

interface PartnerIntegritySectionProps {
  restaurantId: string;
  restaurantName: string;
}

export function PartnerIntegritySection({
  restaurantId,
  restaurantName,
}: PartnerIntegritySectionProps) {
  const [incidents, setIncidents] = useState<OperationalIncident[]>([]);
  const [compliance, setCompliance] = useState<PartnerComplianceProfile | null>(null);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [evidenceSummary, setEvidenceSummary] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    const res = await fetchIncidentsFromServer({ restaurantId });
    setIncidents(res.incidents);
    setCompliance(computePartnerComplianceProfile(restaurantId, restaurantName));
  };

  useEffect(() => {
    void loadData();
  }, [restaurantId]);

  const handleSubmitResponse = async (incidentId: string) => {
    if (!replyMessage.trim()) return;
    const res = await submitIncidentResponse({
      incidentId,
      actorRole: 'PARTNER',
      message: replyMessage.trim(),
      evidenceSummary: evidenceSummary.trim() || undefined,
      evidenceUrl: evidenceUrl.trim() || undefined,
    });
    setFeedback(res.message);
    setReplyId(null);
    setReplyMessage('');
    setEvidenceSummary('');
    setEvidenceUrl('');
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-4 md:flex-row md:items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-borario-ocean">
              <ShieldCheck className="h-4 w-4" />
              Ocorrências e Conformidade Operacional
            </p>
            <h2 className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">
              {restaurantName}
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Responda contestações, envie evidências de atendimento e acompanhe a decisão da plataforma. Contestações não podem ser encerradas unilateralmente pelo estabelecimento.
            </p>
          </div>

          {compliance && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-sky-500/15 px-3 py-1 font-bold text-sky-700 dark:text-sky-300">
                Pós-visitas confirmadas: {compliance.confirmed_post_visits}
              </span>
              <span
                className={`rounded-full px-3 py-1 font-bold ${
                  compliance.monitoring_active
                    ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {compliance.monitoring_active ? 'Em monitoramento' : 'Conformidade regular'}
              </span>
            </div>
          )}
        </div>

        {compliance && compliance.active_measures.length > 0 && (
          <div className="mt-4 space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
            <p className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4" />
              Orientações e medidas ativas
            </p>
            {compliance.active_measures.map((m) => (
              <div key={m.id} className="rounded-xl bg-[var(--bg-surface)] p-3 border border-[var(--border-hairline)]">
                <p className="font-bold text-[var(--text-primary)]">
                  {PARTNER_MEASURE_LABELS[m.measure_level] || m.measure_level}
                </p>
                <p className="mt-0.5 text-[var(--text-secondary)]">{m.reason}</p>
              </div>
            ))}
          </div>
        )}

        {feedback && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {incidents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-6 text-center text-xs text-[var(--text-secondary)]">
              Nenhuma ocorrência registrada para este estabelecimento.
            </div>
          ) : (
            incidents.map((inc) => (
              <div
                key={inc.id}
                className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 space-y-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-sm text-[var(--text-primary)]">{inc.title}</span>
                    <span className="ml-2 text-[var(--text-tertiary)]">
                      · {new Date(inc.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                    {INCIDENT_STATUS_LABELS[inc.status] || inc.status}
                  </span>
                </div>

                <p className="text-[var(--text-secondary)]">{inc.description}</p>

                {inc.evidences && inc.evidences.length > 0 && (
                  <div className="space-y-1 rounded-xl bg-[var(--bg-surface)] p-2.5 border border-[var(--border-hairline)]">
                    <p className="text-[10px] font-bold uppercase text-[var(--text-tertiary)] flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Evidências registradas ({inc.evidences.length})
                    </p>
                    {inc.evidences.map((ev) => (
                      <p key={ev.id} className="text-[11px] text-[var(--text-secondary)]">
                        [{ev.submitted_by_role}] {ev.summary}
                      </p>
                    ))}
                  </div>
                )}

                {inc.resolution_summary && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-800 dark:text-emerald-200">
                    <strong>Resolução da plataforma:</strong> {inc.resolution_summary}
                  </div>
                )}

                {!inc.status.startsWith('RESOLVED_') && inc.status !== 'CLOSED' && (
                  <div>
                    {replyId === inc.id ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          rows={2}
                          value={replyMessage}
                          onChange={(e) => setReplyMessage(e.target.value)}
                          placeholder="Informe a versão do estabelecimento e detalhes operacionais..."
                          className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                        />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            type="text"
                            value={evidenceSummary}
                            onChange={(e) => setEvidenceSummary(e.target.value)}
                            placeholder="Resumo da evidência (opcional)"
                            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                          />
                          <input
                            type="url"
                            value={evidenceUrl}
                            onChange={(e) => setEvidenceUrl(e.target.value)}
                            placeholder="URL do comprovante/comanda (opcional)"
                            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSubmitResponse(inc.id)}
                            className="rounded-xl bg-borario-ocean px-3.5 py-2 text-xs font-bold text-white"
                          >
                            Enviar resposta para análise
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyId(null)}
                            className="rounded-xl border border-[var(--border-hairline)] px-3 py-2 text-xs font-semibold"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReplyId(inc.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-borario-ocean/40 bg-borario-ocean/10 px-3 py-1.5 text-xs font-bold text-borario-ocean hover:bg-borario-ocean/20"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Responder contestação / Enviar evidência
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

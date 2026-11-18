import { CheckCircle2, Clock, MessageSquare, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  computeUserReliabilityProfile,
  fetchIncidentsFromServer,
  submitIncidentResponse,
} from '../services/integrityStore';
import {
  INCIDENT_STATUS_LABELS,
  USER_MEASURE_LABELS,
  type OperationalIncident,
  type UserReliabilityProfile,
} from '../types/integrity';

export function UserIncidentsSection() {
  const [incidents, setIncidents] = useState<OperationalIncident[]>([]);
  const [reliability, setReliability] = useState<UserReliabilityProfile | null>(null);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAll = async () => {
    const res = await fetchIncidentsFromServer();
    setIncidents(res.incidents);
    setReliability(computeUserReliabilityProfile());
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const handleReply = async (incidentId: string) => {
    if (!replyText.trim()) return;
    const res = await submitIncidentResponse({
      incidentId,
      actorRole: 'USER',
      message: replyText.trim(),
    });
    setFeedback(res.message);
    setReplyText('');
    setReplyTargetId(null);
    await loadAll();
  };

  return (
    <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
      <div className="flex flex-col justify-between gap-2 border-b border-[var(--border-hairline)] pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-borario-ocean">
            <ShieldCheck className="h-4 w-4" />
            Acompanhamento de Ocorrências e Integridade
          </p>
          <h3 className="mt-1 text-xl font-bold text-[var(--text-primary)]">
            Problemas relatados e contestações
          </h3>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            Acompanhe o andamento das suas solicitações, justificativas de análise e eventuais orientações operacionais.
          </p>
        </div>

        {reliability && (
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-bold text-emerald-700 dark:text-emerald-300">
              {reliability.confirmed_attendances} presenças confirmadas
            </span>
            <span className="rounded-full bg-sky-500/15 px-3 py-1 font-bold text-sky-700 dark:text-sky-300">
              {reliability.upheld_disputes} contestações procedentes
            </span>
          </div>
        )}
      </div>

      {reliability && reliability.active_restrictions.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 text-xs">
          <p className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
            <ShieldAlert className="h-4 w-4" />
            Restrições ou orientações ativas
          </p>
          {reliability.active_restrictions.map((r) => (
            <div key={r.id} className="rounded-xl bg-[var(--bg-surface)] p-3 border border-[var(--border-hairline)]">
              <p className="font-bold text-[var(--text-primary)]">
                {USER_MEASURE_LABELS[r.measure_level] || r.measure_level}
              </p>
              <p className="mt-0.5 text-[var(--text-secondary)]">{r.reason}</p>
              {r.expires_at && (
                <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                  Prazo para revisão: {new Date(r.expires_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {feedback && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {incidents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-6 text-center text-xs text-[var(--text-secondary)]">
          Nenhuma ocorrência registrada até o momento. Se tiver dificuldade no check-in, use a opção &ldquo;Tive um problema para fazer check-in&rdquo; no seu Passe VIP.
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div
              key={inc.id}
              className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4 space-y-2 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-sm text-[var(--text-primary)]">{inc.title}</span>
                  {inc.restaurant_name && (
                    <span className="ml-2 text-[var(--text-secondary)]">· {inc.restaurant_name}</span>
                  )}
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                  <Clock className="h-3 w-3" />
                  {INCIDENT_STATUS_LABELS[inc.status] || inc.status}
                </span>
              </div>

              <p className="text-[var(--text-secondary)]">{inc.description}</p>

              {inc.resolution_summary && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-800 dark:text-emerald-200">
                  <strong>Justificativa da decisão:</strong> {inc.resolution_summary}
                </div>
              )}

              {inc.status === 'WAITING_USER' && (
                <div className="pt-1">
                  {replyTargetId === inc.id ? (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Informe os detalhes solicitados pela análise..."
                        className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleReply(inc.id)}
                          className="rounded-xl bg-borario-ocean px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Enviar informações
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplyTargetId(null)}
                          className="rounded-xl border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-semibold"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReplyTargetId(inc.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-800 dark:text-amber-300"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Responder solicitação de informação
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

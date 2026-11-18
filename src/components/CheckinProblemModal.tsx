import { AlertTriangle, CheckCircle2, KeyRound, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import {
  openCheckinProblemIncident,
  validateTemporaryPinOnServer,
} from '../services/integrityStore';
import { completeReservationCheckin, getReservations } from '../services/superappStore';
import { CHECKIN_PROBLEM_OPTIONS, type CheckinProblemChoice } from '../types/integrity';
import type { ReservationRequest } from '../types/experience';

interface CheckinProblemModalProps {
  reservation: ReservationRequest;
  restaurantId: string;
  restaurantName: string;
  onClose: () => void;
  onPinValidated?: (updated: ReservationRequest) => void;
}

export function CheckinProblemModal({
  reservation,
  restaurantId,
  restaurantName,
  onClose,
  onPinValidated,
}: CheckinProblemModalProps) {
  const [mode, setMode] = useState<'REPORT' | 'PIN'>('REPORT');
  const [choice, setChoice] = useState<CheckinProblemChoice>('PARTNER_NO_QR');
  const [description, setDescription] = useState('');
  const [evidenceSummary, setEvidenceSummary] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [tempPin, setTempPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSubmitIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await openCheckinProblemIncident({
        choice,
        restaurantId,
        restaurantName,
        reservationId: reservation.id,
        offeringId: reservation.offering_id,
        description: description.trim() || 'Problema relatado pelo consumidor durante o check-in.',
        evidenceSummary: evidenceSummary.trim() || undefined,
        evidenceUrl: evidenceUrl.trim() || undefined,
      });
      setFeedback({ ok: res.ok, msg: res.message });
    } finally {
      setLoading(false);
    }
  };

  const handleValidatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const cleanPin = tempPin.trim().toUpperCase();
      const serverCheck = await validateTemporaryPinOnServer({
        reservationId: reservation.id,
        pinCode: cleanPin,
        hasGeo: true,
      });

      if (serverCheck.ok) {
        const localSync = completeReservationCheckin({
          reservationId: reservation.id,
          scannedCodeOrPin: cleanPin,
          actorContext: 'USER',
          hasGeolocationEvidence: true,
        });
        if (localSync.ok && localSync.reservation) {
          onPinValidated?.(localSync.reservation);
        } else {
          const refreshed = getReservations().find((r) => r.id === reservation.id);
          if (refreshed) onPinValidated?.(refreshed);
        }
        setFeedback({ ok: true, msg: serverCheck.message });
        return;
      }

      if (serverCheck.serverValidated) {
        setFeedback({ ok: false, msg: serverCheck.message });
        return;
      }

      // Fallback local estrito apenas se o PIN corresponder a um token ativo emitido pelo estabelecimento
      const localCheck = completeReservationCheckin({
        reservationId: reservation.id,
        scannedCodeOrPin: cleanPin,
        actorContext: 'USER',
        hasGeolocationEvidence: true,
      });
      if (localCheck.ok && localCheck.reservation) {
        onPinValidated?.(localCheck.reservation);
        setFeedback({ ok: true, msg: localCheck.message });
      } else {
        setFeedback({
          ok: false,
          msg: localCheck.message || 'PIN inválido, expirado ou não vinculado a este estabelecimento.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-lg rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 text-[var(--text-primary)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-1 pr-8">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <ShieldAlert className="h-4 w-4" />
            Integridade Operacional
          </p>
          <h3 className="text-lg font-extrabold">Problema no check-in · {restaurantName}</h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Registre o ocorrido para análise com preservação de evidências ou utilize um PIN temporário emitido pelo estabelecimento.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[var(--bg-subtle)] p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('REPORT');
              setFeedback(null);
            }}
            className={`rounded-xl py-2 transition ${
              mode === 'REPORT'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Relatar ocorrência
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('PIN');
              setFeedback(null);
            }}
            className={`rounded-xl py-2 transition ${
              mode === 'PIN'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Usar PIN temporário
          </button>
        </div>

        {mode === 'REPORT' ? (
          <form onSubmit={handleSubmitIncident} className="mt-4 space-y-3 text-xs">
            <div>
              <label className="block font-bold text-[var(--text-secondary)] mb-1">
                O que aconteceu?
              </label>
              <select
                value={choice}
                onChange={(e) => setChoice(e.target.value as CheckinProblemChoice)}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-xs font-semibold text-[var(--text-primary)]"
              >
                {CHECKIN_PROBLEM_OPTIONS.map((opt) => (
                  <option key={opt.choice} value={opt.choice}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[var(--text-secondary)] mb-1">
                Descrição adicional
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Conte brevemente o horário, nome do atendente ou o que foi informado no local..."
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)]"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">
                  Resumo da evidência (opcional)
                </label>
                <input
                  type="text"
                  value={evidenceSummary}
                  onChange={(e) => setEvidenceSummary(e.target.value)}
                  placeholder="Ex.: Foto do cupom ou tela"
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">
                  Link do comprovante/foto (opcional)
                </label>
                <input
                  type="url"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-200">
              O relato abre um protocolo para análise justa entre você e o estabelecimento, sem gerar pontos nem cobranças sem validação.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#FF4B2B] to-[#FF6B35] py-3 text-xs font-bold text-white shadow-md hover:brightness-110 disabled:opacity-50"
            >
              {loading ? 'Registrando ocorrência...' : 'Registrar ocorrência para análise'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleValidatePin} className="mt-4 space-y-3 text-xs">
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-3 text-[11px] text-sky-900 dark:text-sky-200">
              Se o QR falhar, solicite ao balcão o <strong>PIN temporário de 6 dígitos</strong> vinculado a este estabelecimento. Ele possui validade limitada e uso único.
            </div>
            <div>
              <label className="block font-bold text-[var(--text-secondary)] mb-1">
                PIN temporário do estabelecimento
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={tempPin}
                  onChange={(e) => setTempPin(e.target.value.toUpperCase())}
                  placeholder="Ex.: 482910"
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] pl-9 pr-3 py-2.5 font-mono text-sm font-bold tracking-widest text-[var(--text-primary)]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || tempPin.trim().length < 4}
              className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Validando PIN no servidor...' : 'Validar PIN temporário'}
            </button>
          </form>
        )}

        {feedback && (
          <div
            className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-xs font-semibold ${
              feedback.ok
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
            }`}
          >
            {feedback.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{feedback.msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}

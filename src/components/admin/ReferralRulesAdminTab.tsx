import { CheckCircle2, RefreshCw, Save, ShieldAlert, Sparkles, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  fetchActiveReferralProgramRule,
  getActiveReferralProgramRule,
  getPointEarningRules,
  savePointEarningRule,
  saveReferralProgramRuleOnServer,
} from '../../services/pointRulesStore';
import { supabase } from '../../services/supabaseClient';
import type { ReferralProgramRule } from '../../types/growth';
import type { PointEarningRule } from '../../types/rewards';

export function ReferralRulesAdminTab() {
  const [rule, setRule] = useState<ReferralProgramRule>(() => getActiveReferralProgramRule());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [earningRule, setEarningRule] = useState<PointEarningRule>(() => {
    const list = getPointEarningRules();
    return (
      list.find((r) => r.scope_type === 'DEFAULT') ||
      list[0] || {
        id: 'rule-default-checkin',
        rule_code: 'DEFAULT_CHECKIN',
        scope_type: 'DEFAULT',
        points_amount: 250,
        max_credits_per_user_day: 5,
        max_credits_per_user_venue_day: 1,
        max_credits_per_user_venue_month: 8,
        require_verified_checkin: true,
        active: true,
        notes: 'Regra padrão de acúmulo por check-in validado.',
        updated_at: new Date().toISOString(),
      }
    );
  });
  const [earningFeedback, setEarningFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    let active = true;
    void fetchActiveReferralProgramRule().then((loaded) => {
      if (active) {
        setRule(loaded);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    const res = await saveReferralProgramRuleOnServer(rule);
    if (res.ok && res.rule) {
      setRule(res.rule);
    }
    setFeedback({ ok: res.ok, msg: res.message });
    setSaving(false);
  };

  const handleReconcileLegacy = async () => {
    setReconciling(true);
    setFeedback(null);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!session?.access_token) {
        setFeedback({
          ok: false,
          msg: 'Sessão administrativa autenticada obrigatória para reconciliar indicações.',
        });
        setReconciling(false);
        return;
      }

      const res = await fetch('/api/referrals/reconcile', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = (await res.json()) as {
        ok?: boolean;
        message?: string;
        summary?: { released?: number; pending_or_unbacked?: number; cancelled?: number };
      };

      if (!res.ok || !json.ok) {
        setFeedback({
          ok: false,
          msg: json.message || 'Falha ao executar reconciliação no servidor.',
        });
      } else {
        const s = json.summary || {};
        setFeedback({
          ok: true,
          msg: `Reconciliação concluída: ${s.released ?? 0} liberadas com lastro, ${s.pending_or_unbacked ?? 0} pendentes/em auditoria, ${s.cancelled ?? 0} canceladas.`,
        });
      }
    } catch (err) {
      setFeedback({
        ok: false,
        msg: err instanceof Error ? err.message : 'Erro de rede ao reconciliar.',
      });
    } finally {
      setReconciling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              Governança Server-Side · Rio Points
            </span>
            <h2 className="mt-2 text-xl font-extrabold text-[var(--text-primary)]">
              Regras do Programa de Indicação
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Todos os valores, gatilhos e limites abaixo são gravados em{' '}
              <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 text-xs">
                referral_program_rules
              </code>{' '}
              e validados no servidor antes de qualquer crédito.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReconcileLegacy}
            disabled={reconciling}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)] transition hover:border-[#FF6B35] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${reconciling ? 'animate-spin' : ''}`} />
            {reconciling ? 'Reconciliando...' : 'Reconciliar Dados Antigos'}
          </button>
        </div>

        {feedback && (
          <div
            className={`mt-4 flex items-start gap-2.5 rounded-2xl border p-4 text-sm font-medium ${
              feedback.ok
                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
            }`}
          >
            {feedback.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
        )}

        {loading ? (
          <p className="mt-6 text-sm text-[var(--text-secondary)]">
            Carregando regras ativas do servidor...
          </p>
        ) : (
          <form onSubmit={handleSave} className="mt-6 space-y-6">
            <div className="flex items-center justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  Programa de Indicação Ativo
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Se desativado, novas indicações não geram créditos de Rio Points.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={rule.active}
                  onChange={(e) => setRule((prev) => ({ ...prev, active: e.target.checked }))}
                  className="h-5 w-5 accent-[#FF6B35]"
                />
                <span>{rule.active ? 'Ativo' : 'Pausado'}</span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Pontos p/ Indicador (RP)
                </span>
                <input
                  type="number"
                  min={0}
                  value={rule.referrer_points}
                  onChange={(e) =>
                    setRule((prev) => ({ ...prev, referrer_points: Number(e.target.value) || 0 }))
                  }
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Pontos p/ Convidado (RP)
                </span>
                <input
                  type="number"
                  min={0}
                  value={rule.referred_points}
                  onChange={(e) =>
                    setRule((prev) => ({ ...prev, referred_points: Number(e.target.value) || 0 }))
                  }
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Bônus Extra 1ª Visita (RP)
                </span>
                <input
                  type="number"
                  min={0}
                  value={rule.first_visit_bonus_points}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      first_visit_bonus_points: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Bônus Anfitrião na Mesa (RP)
                </span>
                <input
                  type="number"
                  min={0}
                  value={rule.host_table_bonus_points}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      host_table_bonus_points: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Máx. Acompanhantes c/ Bônus
                </span>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={rule.max_host_bonus_slots_per_booking}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      max_host_bonus_slots_per_booking: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Evento Gatilho de Liberação
                </span>
                <select
                  value={rule.trigger_event}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      trigger_event:
                        e.target.value === 'FIRST_VERIFIED_CONSUMPTION'
                          ? 'FIRST_VERIFIED_CONSUMPTION'
                          : 'FIRST_VERIFIED_CHECKIN',
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                >
                  <option value="FIRST_VERIFIED_CHECKIN">1º Check-in Validado (QR/PIN)</option>
                  <option value="FIRST_VERIFIED_CONSUMPTION">1º Consumo Verificado</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Limite Total por Indicador
                </span>
                <input
                  type="number"
                  min={1}
                  value={rule.max_rewards_per_user_total}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      max_rewards_per_user_total: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Limite por Período
                </span>
                <input
                  type="number"
                  min={1}
                  value={rule.max_rewards_per_user_period}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      max_rewards_per_user_period: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Período (dias) / Validade (dias)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    title="Duração do período em dias"
                    value={rule.period_days}
                    onChange={(e) =>
                      setRule((prev) => ({
                        ...prev,
                        period_days: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                  />
                  <input
                    type="number"
                    min={1}
                    title="Prazo de validação da indicação em dias"
                    value={rule.validation_window_days}
                    onChange={(e) =>
                      setRule((prev) => ({
                        ...prev,
                        validation_window_days: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)]"
                  />
                </div>
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
              <input
                type="checkbox"
                checked={rule.require_contact_verified}
                onChange={(e) =>
                  setRule((prev) => ({ ...prev, require_contact_verified: e.target.checked }))
                }
                className="h-5 w-5 accent-[#FF6B35]"
              />
              <span className="text-sm font-medium text-[var(--text-primary)]">
                Exigir contato validado (e-mail/telefone) do convidado antes da liberação dos pontos
              </span>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Notas da Regra / Governança
              </span>
              <textarea
                rows={2}
                value={rule.notes || ''}
                onChange={(e) => setRule((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm text-[var(--text-primary)]"
              />
            </label>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:brightness-105 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Salvando no servidor...' : 'Salvar Regras de Indicação'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Economia dos Pontos: Limites de Acúmulo por Check-in */}
      <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Economia dos Pontos
            </span>
            <h3 className="mt-2 font-sans text-lg font-extrabold text-[var(--text-primary)]">
              Limites de Acúmulo por Check-in Validado
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Configure a pontuação padrão de check-in presencial e os tetos diários/mensais por usuário e estabelecimento. Sem teto percentual fixo nem conversão monetária engessada.
            </p>
          </div>
          <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={earningRule.active}
              onChange={(e) =>
                setEarningRule((prev) => ({ ...prev, active: e.target.checked }))
              }
              className="h-4 w-4 accent-[#397B68]"
            />
            Regra Ativa
          </label>
        </div>

        {earningFeedback && (
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold ${
              earningFeedback.ok
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
            }`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{earningFeedback.msg}</span>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const saved = savePointEarningRule({
              id: earningRule.id,
              rule_code: earningRule.rule_code,
              scope_type: earningRule.scope_type,
              points_amount: earningRule.points_amount,
              max_credits_per_user_day: earningRule.max_credits_per_user_day,
              max_credits_per_user_venue_day: earningRule.max_credits_per_user_venue_day,
              max_credits_per_user_venue_month: earningRule.max_credits_per_user_venue_month,
              active: earningRule.active,
              notes: earningRule.notes,
            });
            const updated = saved.find((r) => r.id === earningRule.id) || saved[0];
            if (updated) setEarningRule(updated);
            setEarningFeedback({
              ok: true,
              msg: 'Limites de acúmulo e pontuação de check-in salvos com sucesso.',
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Pontos por Check-in (RP)
              </span>
              <input
                type="number"
                min={0}
                value={earningRule.points_amount}
                onChange={(e) =>
                  setEarningRule((prev) => ({
                    ...prev,
                    points_amount: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Limite / Usuário / Dia
              </span>
              <input
                type="number"
                min={1}
                value={earningRule.max_credits_per_user_day}
                onChange={(e) =>
                  setEarningRule((prev) => ({
                    ...prev,
                    max_credits_per_user_day: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Limite / Casa / Dia
              </span>
              <input
                type="number"
                min={1}
                value={earningRule.max_credits_per_user_venue_day}
                onChange={(e) =>
                  setEarningRule((prev) => ({
                    ...prev,
                    max_credits_per_user_venue_day: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Limite / Casa / Mês
              </span>
              <input
                type="number"
                min={1}
                value={earningRule.max_credits_per_user_venue_month}
                onChange={(e) =>
                  setEarningRule((prev) => ({
                    ...prev,
                    max_credits_per_user_venue_month: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2.5 text-sm font-bold text-[var(--text-primary)]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-[var(--text-secondary)]">
              Check-in presencial validado é obrigatório. Pontos pendentes e liberados permanecem separados no ledger.
            </p>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#123B56] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#102F46]"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar Limites de Acúmulo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

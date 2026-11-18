import { CheckCircle2, Gift, Save, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  fetchPartnerVipConfig,
  getCachedPartnerVipConfig,
  savePartnerVipConfigOnServer,
} from '../../services/vipInviteStore';

interface PartnerVipInviteSectionProps {
  restaurantId: string;
  restaurantName: string;
}

export function PartnerVipInviteSection({
  restaurantId,
  restaurantName,
}: PartnerVipInviteSectionProps) {
  const [enabled, setEnabled] = useState(false);
  const [benefitTitle, setBenefitTitle] = useState('');
  const [conditionsText, setConditionsText] = useState('');
  const [maxInvitesPerCheckin, setMaxInvitesPerCheckin] = useState(3);
  const [totalQuota, setTotalQuota] = useState<string>('');
  const [validDaysAfterCheckin, setValidDaysAfterCheckin] = useState(14);
  const [usedCount, setUsedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    let active = true;
    const cached = getCachedPartnerVipConfig(restaurantId);
    if (cached) {
      setEnabled(cached.enabled);
      setBenefitTitle(cached.benefit_title || '');
      setConditionsText(cached.conditions_text || '');
      setMaxInvitesPerCheckin(cached.max_invites_per_checkin || 3);
      setTotalQuota(cached.total_quota === null || cached.total_quota === undefined ? '' : String(cached.total_quota));
      setValidDaysAfterCheckin(cached.valid_days_after_checkin || 14);
      setUsedCount(cached.used_count || 0);
    }
    void fetchPartnerVipConfig(restaurantId).then((cfg) => {
      if (!active) return;
      if (cfg) {
        setEnabled(cfg.enabled);
        setBenefitTitle(cfg.benefit_title || '');
        setConditionsText(cfg.conditions_text || '');
        setMaxInvitesPerCheckin(cfg.max_invites_per_checkin || 3);
        setTotalQuota(cfg.total_quota === null || cfg.total_quota === undefined ? '' : String(cfg.total_quota));
        setValidDaysAfterCheckin(cfg.valid_days_after_checkin || 14);
        setUsedCount(cfg.used_count || 0);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [restaurantId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const parsedQuota =
      totalQuota.trim() === '' ? null : Math.max(0, Math.round(Number(totalQuota) || 0));

    const res = await savePartnerVipConfigOnServer({
      restaurantId,
      enabled,
      benefitTitle: benefitTitle.trim(),
      conditionsText: conditionsText.trim(),
      maxInvitesPerCheckin: Math.min(3, Math.max(1, maxInvitesPerCheckin)),
      totalQuota: parsedQuota,
      validDaysAfterCheckin: Math.max(1, validDaysAfterCheckin),
    });

    if (res.ok && res.config) {
      setUsedCount(res.config.used_count || 0);
    }
    setFeedback({ ok: res.ok, msg: res.message });
    setSaving(false);
  };

  return (
    <div className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
            <Gift className="h-3.5 w-3.5" />
            Indicação Pós-Visita Autorizada
          </span>
          <h3 className="mt-2 text-xl font-extrabold text-[var(--text-primary)]">
            Convites VIP Pós-Check-in — {restaurantName}
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-secondary)]">
            Opcional: autorize que clientes com check-in validado enviem até 3 convites VIP
            rastreáveis para amigos conhecerem o local em outra ocasião (sem exigir mesa conjunta).
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-2.5 text-sm">
          <span className="text-[var(--text-secondary)]">Emitidos: </span>
          <strong className="text-[var(--text-primary)]">
            {usedCount}
            {totalQuota.trim() !== '' ? ` / ${totalQuota}` : ''}
          </strong>
        </div>
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
        <p className="mt-5 text-sm text-[var(--text-secondary)]">Carregando configuração...</p>
      ) : (
        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                Autorizar Convites VIP após check-in validado
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Enquanto estiver desativado, nenhum convite VIP será exibido aos clientes deste
                estabelecimento.
              </p>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-emerald-600"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Benefício do Convite VIP para o Convidado
              </span>
              <input
                type="text"
                value={benefitTitle}
                onChange={(e) => setBenefitTitle(e.target.value)}
                placeholder="Ex: Drink de boas-vindas ou sobremesa cortesia na 1ª visita"
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-sm font-medium text-[var(--text-primary)]"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Convites por Check-in (máx. 3)
              </span>
              <select
                value={maxInvitesPerCheckin}
                onChange={(e) => setMaxInvitesPerCheckin(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-sm font-bold text-[var(--text-primary)]"
              >
                <option value={1}>1 convite por visita</option>
                <option value={2}>2 convites por visita</option>
                <option value={3}>3 convites por visita</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Validade (dias)
                </span>
                <input
                  type="number"
                  min={1}
                  value={validDaysAfterCheckin}
                  onChange={(e) =>
                    setValidDaysAfterCheckin(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-sm font-bold text-[var(--text-primary)]"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Cota Total (opcional)
                </span>
                <input
                  type="number"
                  min={0}
                  value={totalQuota}
                  onChange={(e) => setTotalQuota(e.target.value)}
                  placeholder="Ilimitado"
                  className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-sm font-bold text-[var(--text-primary)]"
                />
              </label>
            </div>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Condições de Utilização
              </span>
              <textarea
                rows={2}
                value={conditionsText}
                onChange={(e) => setConditionsText(e.target.value)}
                placeholder="Ex: Válido de terça a quinta mediante reserva no BoraRio. Uso individual em outra ocasião."
                className="w-full rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 py-3 text-sm text-[var(--text-primary)]"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Convites VIP'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

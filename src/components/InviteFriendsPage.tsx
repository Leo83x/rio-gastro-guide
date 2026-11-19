import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Gift,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { isUserAuthenticated } from '../services/authService';
import { fetchActiveReferralProgramRule } from '../services/pointRulesStore';
import {
  fetchReferralSummaryFromServer,
  getMyReferralCode,
  getMyReferralLink,
  getReferralAttributions,
} from '../services/referralStore';
import type {
  ReferralAttribution,
  ReferralFunnelStage,
  ReferralProgramRule,
} from '../types/growth';

interface InviteFriendsPageProps {
  onBack: () => void;
  onRequireAuth?: (reason: string, action: () => void) => void;
}

const STAGE_META: Record<
  ReferralFunnelStage,
  { label: string; badgeCls: string }
> = {
  INVITE_CREATED: {
    label: 'Convite enviado',
    badgeCls: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  },
  LINK_VISITED: {
    label: 'Link acessado (0 pts)',
    badgeCls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  SIGNUP_COMPLETED: {
    label: 'Cadastro concluído',
    badgeCls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  },
  CONTACT_VERIFIED: {
    label: 'Contato validado',
    badgeCls: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  },
  FIRST_VALID_ACTION: {
    label: 'Ação válida registrada',
    badgeCls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  FIRST_VERIFIED_VISIT: {
    label: '1ª visita verificada',
    badgeCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  REWARD_PENDING: {
    label: 'Recompensa pendente',
    badgeCls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  REWARD_RELEASED: {
    label: 'Recompensa liberada',
    badgeCls: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
  },
  REWARD_CANCELLED: {
    label: 'Cancelada / Estornada',
    badgeCls: 'bg-red-500/15 text-red-700 dark:text-red-300',
  },
};

function resolveStage(attr: ReferralAttribution): ReferralFunnelStage {
  if (attr.current_stage) return attr.current_stage;
  if (attr.status === 'CONVERTED') return 'REWARD_RELEASED';
  if (attr.status === 'REVERSED') return 'REWARD_CANCELLED';
  return 'REWARD_PENDING';
}

export function InviteFriendsPage({ onBack, onRequireAuth }: InviteFriendsPageProps) {
  const [loading, setLoading] = useState(true);
  const [serverSynced, setServerSynced] = useState(false);
  const [rule, setRule] = useState<ReferralProgramRule | null>(null);
  const [attributions, setAttributions] = useState<ReferralAttribution[]>(() =>
    getReferralAttributions()
  );
  const [copiedLink, setCopiedLink] = useState(false);

  const authenticated = isUserAuthenticated();
  const referralCode = getMyReferralCode();
  const referralLink = getMyReferralLink();
  const supportsNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetchActiveReferralProgramRule(),
      fetchReferralSummaryFromServer(),
    ]).then(([loadedRule, summary]) => {
      if (!active) return;
      setRule(loadedRule);
      if (summary.ok && summary.attributions) {
        setAttributions(summary.attributions);
        setServerSynced(true);
      } else {
        setAttributions(getReferralAttributions());
        setServerSynced(false);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [authenticated]);

  const stats = useMemo(() => {
    let sent = 0;
    let signups = 0;
    let valid = 0;
    let pendingPoints = 0;
    let releasedPoints = 0;

    for (const attr of attributions) {
      const st = resolveStage(attr);
      sent += 1;
      if (
        st === 'SIGNUP_COMPLETED' ||
        st === 'CONTACT_VERIFIED' ||
        st === 'FIRST_VALID_ACTION' ||
        st === 'FIRST_VERIFIED_VISIT' ||
        st === 'REWARD_PENDING' ||
        st === 'REWARD_RELEASED'
      ) {
        signups += 1;
      }
      if (st === 'FIRST_VERIFIED_VISIT' || st === 'REWARD_RELEASED') {
        valid += 1;
        releasedPoints += attr.referrer_points ?? attr.reward_points ?? 0;
      } else if (st !== 'REWARD_CANCELLED') {
        pendingPoints += attr.referrer_points ?? attr.reward_points ?? 0;
      }
    }

    return { sent, signups, valid, pendingPoints, releasedPoints };
  }, [attributions]);

  const ruleIsActive = Boolean(rule && rule.active);

  const buildInviteMessage = () => {
    const base =
      `Bora conhecer o BoraRio comigo? Descubra restaurantes, bares e eventos no Rio com vantagens exclusivas.` +
      `\n\nEntre pelo meu link:\n${referralLink}\nCódigo: ${referralCode}`;
    if (ruleIsActive && rule && rule.referred_points > 0) {
      return (
        `Bora conhecer o BoraRio comigo? Quando você validar seu 1º check-in presencial, você ganha +${rule.referred_points} Rio Points!` +
        `\n\nEntre pelo meu link:\n${referralLink}\nCódigo: ${referralCode}`
      );
    }
    return base;
  };

  const executeCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCopy = async () => {
    if (!authenticated && onRequireAuth) {
      onRequireAuth(
        'Entre com seu e-mail para vincular seu link individual de indicação à sua conta e receber seus pontos.',
        () => void executeCopy()
      );
      return;
    }
    await executeCopy();
  };

  const executeNativeShare = async () => {
    if (!supportsNativeShare) {
      await executeCopy();
      return;
    }
    try {
      await navigator.share({
        title: 'Convite BoraRio',
        text: buildInviteMessage(),
        url: referralLink,
      });
    } catch {
      // user cancelled share sheet
    }
  };

  const handleNativeShare = async () => {
    if (!authenticated && onRequireAuth) {
      onRequireAuth(
        'Entre com seu e-mail para gerar seu link individual e contabilizar suas indicações.',
        () => void executeNativeShare()
      );
      return;
    }
    await executeNativeShare();
  };

  const executeWhatsAppShare = () => {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(buildInviteMessage())}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleWhatsAppShare = () => {
    if (!authenticated && onRequireAuth) {
      onRequireAuth(
        'Entre com seu e-mail para enviar seu convite pessoal e receber os Rio Points quando seu amigo fizer check-in.',
        executeWhatsAppShare
      );
      return;
    }
    executeWhatsAppShare();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-24">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10 space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para o BoraRio
        </button>

        {!authenticated && onRequireAuth && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-xs">
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              Entre com seu e-mail para vincular seu link pessoal de indicação e receber Rio Points reais.
            </p>
            <button
              type="button"
              onClick={() =>
                onRequireAuth(
                  'Entre com seu e-mail para ativar seu link de indicação e acompanhar seus pontos.',
                  () => undefined
                )
              }
              className="shrink-0 rounded-xl bg-gradient-to-r from-[#FF4B2B] to-[#FF6B35] px-4 py-2 text-xs font-extrabold text-white shadow-sm"
            >
              Entrar / Cadastrar agora
            </button>
          </div>
        )}

        {/* Hero / Link Pessoal */}
        <section className="rounded-3xl border border-sky-400/25 bg-gradient-to-br from-[#0E2235] via-[#123B56] to-[#0077B6] p-6 sm:p-8 text-white shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider">
              <Gift className="h-3.5 w-3.5" />
              Convide e Ganhe
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold text-white/90">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              {serverSynced ? 'Sincronizado com servidor' : 'Identificação pendente'}
            </span>
          </div>

          <h1 className="mt-4 font-sans text-2xl sm:text-3xl font-black tracking-tight">
            Seus amigos também valem pontos.
          </h1>
          <p className="mt-2 max-w-2xl text-sm sm:text-base text-white/90 leading-relaxed">
            Convide alguém para descobrir o BoraRio. Quando seu amigo realizar uma ação válida
            prevista nas regras do programa, vocês poderão ganhar Rio Points.
          </p>

          {loading ? (
            <p className="mt-4 text-sm text-white/80">Carregando regras vigentes do programa...</p>
          ) : ruleIsActive && rule ? (
            <div className="mt-4 flex flex-wrap gap-2.5">
              {rule.referrer_points > 0 && (
                <span className="rounded-xl bg-white/15 px-3.5 py-2 text-sm font-bold">
                  +{rule.referrer_points} RP para você
                </span>
              )}
              {rule.referred_points > 0 && (
                <span className="rounded-xl bg-emerald-500/25 px-3.5 py-2 text-sm font-bold text-emerald-100">
                  +{rule.referred_points} RP para seu amigo
                </span>
              )}
              <span className="rounded-xl bg-black/25 px-3.5 py-2 text-xs font-medium text-white/90">
                Gatilho:{' '}
                {rule.trigger_event === 'FIRST_VERIFIED_CONSUMPTION'
                  ? '1º consumo verificado'
                  : '1º check-in presencial validado'}
              </span>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/20 bg-black/25 p-3.5 text-sm text-white/90">
              O programa de bônus em pontos não está ativo no momento. Você ainda pode compartilhar
              seu link para convidar amigos para o BoraRio.
            </div>
          )}

          {/* Link + Código + Ações */}
          <div className="mt-6 rounded-2xl border border-white/20 bg-black/25 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-white/75">
                  Seu link pessoal de indicação
                </p>
                <p className="mt-0.5 truncate font-mono text-sm font-semibold text-white">
                  {referralLink}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 font-mono text-xs font-bold">
                Código: {referralCode}
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4B2B] via-[#FF6B35] to-[#F7931E] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:brightness-105 transition"
              >
                <Share2 className="h-4 w-4" />
                Convidar no WhatsApp
              </button>

              {supportsNativeShare && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/25 transition"
                >
                  <Sparkles className="h-4 w-4" />
                  Compartilhar
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/25 transition"
              >
                {copiedLink ? (
                  <Check className="h-4 w-4 text-emerald-300" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copiedLink ? 'Link copiado!' : 'Copiar link'}
              </button>
            </div>
          </div>
        </section>

        {/* Contadores Reais do Funil */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Convites enviados</p>
            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{stats.sent}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Cadastros</p>
            <p className="mt-1 text-2xl font-black text-[var(--text-primary)]">{stats.signups}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Indicações válidas</p>
            <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.valid}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">RP Pendentes</p>
            <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
              {stats.pendingPoints}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">RP Liberados</p>
            <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {stats.releasedPoints}
            </p>
          </div>
        </section>

        {/* Aviso de Transparência */}
        <div className="rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--text-secondary)]">
          <strong className="text-[var(--text-primary)]">Transparência:</strong> abrir o link ou
          apenas criar uma conta não libera pontos. A recompensa é liberada somente após a ação
          válida configurada pelo BoraRio ser verificada no estabelecimento.
        </div>

        {/* Histórico de Indicações */}
        <section className="rounded-3xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
              <Users className="h-5 w-5 text-[#FF6B35]" />
              Histórico de Indicações e Recompensas
            </h2>
          </div>

          {attributions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-hairline)] p-6 text-center text-sm text-[var(--text-secondary)]">
              Nenhuma indicação registrada ainda. Compartilhe seu link acima para acompanhar cada
              etapa aqui.
            </div>
          ) : (
            <div className="space-y-3">
              {attributions.map((attr) => {
                const st = resolveStage(attr);
                const meta = STAGE_META[st] || STAGE_META.REWARD_PENDING;
                const pts = attr.referrer_points ?? attr.reward_points ?? 0;

                return (
                  <div
                    key={attr.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[var(--text-primary)]">
                          {attr.referred_label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.badgeCls}`}
                        >
                          {st === 'REWARD_RELEASED' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : st === 'REWARD_CANCELLED' ? (
                            <XCircle className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        Criado em {new Date(attr.created_at).toLocaleDateString('pt-BR')}
                        {attr.experience_name ? ` · ${attr.experience_name}` : ''}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-extrabold ${
                          st === 'REWARD_RELEASED'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : st === 'REWARD_CANCELLED'
                              ? 'text-red-500 line-through'
                              : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {st === 'REWARD_RELEASED'
                          ? `+${pts} RP liberados`
                          : st === 'REWARD_CANCELLED'
                            ? '0 RP'
                            : `${pts} RP pendentes`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

import type { MissionDefinition, MissionSummary } from '../types/growth';
import type { Restaurant } from '../types/restaurant';
import { getUserProfileIdentity } from './authService';
import { getBoraJuntoPlans } from './boraJuntoStore';
import { getTrustConnections } from './confiaStore';
import { getSavedItineraries } from './itineraryStore';
import { computePassportSummary } from './passportStore';
import { computeSavingsSummary } from './savingsLedgerStore';
import { isValidUuid, supabase } from './supabaseClient';
import { getVisitProofs } from './visitProofStore';

const MISSION_SNAPSHOT_KEY = 'borario_missions_progress_v1';

/**
 * Calcula Missões e Jornadas exclusivamente a partir de ações reais e comprovadas:
 * check-ins dinâmicos validados, provas de consumo pós-atendimento, conexões aceitas
 * na Rede Confia, roteiros/BoraJunto e economia comprovada no estabelecimento.
 * Nunca fabrica progresso fictício.
 */
export function computeMissionSummary(catalog: Restaurant[]): MissionSummary {
  const passport = computePassportSummary(catalog);
  const proofs = getVisitProofs();
  const savings = computeSavingsSummary();
  const acceptedConnections = getTrustConnections().filter((c) => c.status === 'ACCEPTED');
  const savedItineraries = getSavedItineraries();
  const boraJuntoPlans = getBoraJuntoPlans();

  const verifiedConsumptionsCount = proofs.filter(
    (p) => p.presence_level === 'VERIFIED_CONSUMPTION'
  ).length;
  const planActionsCount = savedItineraries.length + boraJuntoPlans.length;

  const missions: MissionDefinition[] = [
    {
      id: 'mis-verified-visit',
      category: 'VERIFICACAO',
      title: 'Primeira Visita Verificada',
      description: 'Realize 1 check-in via QR dinâmico ou PIN operacional no estabelecimento.',
      current: Math.min(1, passport.verified_checkins_count),
      target: 1,
      completed: passport.verified_checkins_count >= 1,
      reward_badge: 'Selo Presença Real',
      verification_rule: 'Somente check-in dinâmico validado',
    },
    {
      id: 'mis-verified-consumption',
      category: 'VERIFICACAO',
      title: 'Consumo Auditado no Local',
      description: 'Obtenha confirmação adicional de consumo pós-visita pelo estabelecimento.',
      current: Math.min(1, verifiedConsumptionsCount),
      target: 1,
      completed: verifiedConsumptionsCount >= 1,
      reward_badge: 'Selo Consumo Verificado',
      verification_rule: 'Exige confirmação do parceiro pós-atendimento',
    },
    {
      id: 'mis-three-neighborhoods',
      category: 'DESCOBERTA',
      title: 'Rota de 3 Bairros Cariocas',
      description: 'Acumule visitas validadas ou desejos concluídos em 3 bairros distintos.',
      current: Math.min(3, passport.unique_neighborhoods.length),
      target: 3,
      completed: passport.unique_neighborhoods.length >= 3,
      reward_badge: 'Explorador de Bairros',
      verification_rule: 'Bairros deduplicados por evidência real',
    },
    {
      id: 'mis-borajunto-plan',
      category: 'COMUNIDADE',
      title: 'Curador de Roteiros & BoraJunto',
      description: 'Salve 1 roteiro inteligente ou monte 1 plano colaborativo com amigos.',
      current: Math.min(1, planActionsCount),
      target: 1,
      completed: planActionsCount >= 1,
      reward_badge: 'Curador do Rolê',
      verification_rule: 'Roteiro salvo ou enquete BoraJunto real',
    },
    {
      id: 'mis-confia-circle',
      category: 'COMUNIDADE',
      title: 'Rede de Confiança Ativa',
      description: 'Aprove 1 conexão bilateral aceita dentro dos seus círculos privados.',
      current: Math.min(1, acceptedConnections.length),
      target: 1,
      completed: acceptedConnections.length >= 1,
      reward_badge: 'Rede Autenticada',
      verification_rule: 'Exige aceite explícito PENDING → ACCEPTED',
    },
    {
      id: 'mis-proven-savings',
      category: 'ECONOMIA',
      title: 'Primeira Economia Comprovada',
      description: 'Conclua 1 oferta ou voucher com check-in validado no estabelecimento.',
      current: Math.min(1, savings.proven_count),
      target: 1,
      completed: savings.proven_count >= 1,
      reward_badge: 'Economia Auditada',
      verification_rule: 'Calculada somente pós-check-in validado',
    },
  ];

  const completedCount = missions.filter((m) => m.completed).length;

  try {
    localStorage.setItem(
      MISSION_SNAPSHOT_KEY,
      JSON.stringify({
        updated_at: new Date().toISOString(),
        completed_count: completedCount,
        total_count: missions.length,
      })
    );
  } catch {
    // ignore storage quota issue
  }

  return {
    completed_count: completedCount,
    total_count: missions.length,
    missions,
  };
}

export function syncCompletedMissionsToCloud(summary: MissionSummary): void {
  const me = getUserProfileIdentity();
  if (!supabase || !isValidUuid(me.id)) return;
  for (const m of summary.missions) {
    if (!m.completed) continue;
    void supabase
      .from('user_mission_progress')
      .upsert({
        user_id: me.id,
        mission_code: m.id,
        current_value: m.current,
        target_value: m.target,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .then(() => undefined, () => undefined);
  }
}

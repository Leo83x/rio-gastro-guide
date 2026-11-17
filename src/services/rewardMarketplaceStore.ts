import type {
  PartnerLoyaltyEconomicsSummary,
  PartnerReward,
  PartnerRewardStatus,
  RewardReturnAttribution,
  RewardSegment,
  RewardType,
  RewardVoucher,
  RewardVoucherStatus,
} from '../types/rewards';
import { generateUUID } from '../utils/slug';
import { getUserProfileIdentity } from './authService';
import { appendLedgerTransaction, getPointTransactions, getWalletSummary } from './pointsLedger';
import { isValidUuid, supabase } from './supabaseClient';
import { recordVoucherAuditEvent } from './visitProofStore';

const KEYS = {
  REWARDS: 'borario_partner_rewards_v1',
  VOUCHERS: 'borario_reward_vouchers_v1',
  RETURN_ATTRIBUTIONS: 'borario_reward_return_attributions_v1',
  NOTIFICATIONS: 'rio_gastro_notifications_v1',
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

function pushInternalNotification(title: string, message: string): void {
  try {
    const existing = readJson<Array<Record<string, unknown>>>(KEYS.NOTIFICATIONS, []);
    const item = {
      id: generateUUID(),
      channel: 'internal',
      type: 'reward',
      title,
      message,
      read: false,
      created_at: new Date().toISOString(),
    };
    writeJson(KEYS.NOTIFICATIONS, [item, ...existing].slice(0, 30));
  } catch {
    // ignore storage limits
  }
}

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BR-REW-${suffix}`;
}

function buildStarterRewards(): PartnerReward[] {
  const nowIso = new Date().toISOString();
  return [
    // 1. GASTRONOMIA
    {
      id: 'rew-pilot-braz-sobremesa',
      restaurant_id: '11111111-1111-4111-8111-000000000009',
      restaurant_name: 'Bráz Pizzaria',
      neighborhood: 'Jardim Botânico',
      segment_category: 'Gastronomia',
      reward_type: 'SOBREMESA',
      title: 'Tiramisù della Nonna ou Torta Búlgara Artesanal',
      description:
        'Recompensa gastronômica para saborear no salão histórico após sua pizza clássica. Sem comissão cobrada da casa.',
      eligible_item: '1 Sobremesa Artesanal (Tiramisù ou Torta Búlgara)',
      points_cost: 1500,
      reference_price_brl: 15.0,
      estimated_cost_brl: 4.5,
      min_consumption_brl: 40.0,
      quantity_total: 25,
      quantity_available: 25,
      max_per_user: 2,
      valid_days_hours: 'Terça a Quinta · 18h30 às 22h30',
      rules_summary: 'Válido no consumo em salão apresentando o voucher BR-REW antes do fechamento da conta.',
      restrictions: 'Válido para consumo mínimo de R$ 40 na mesa. Não cumulativo com delivery.',
      voucher_validity_days: 45,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'rew-pilot-ct-entrada',
      restaurant_id: '11111111-1111-4111-8111-000000000004',
      restaurant_name: 'CT Boucherie',
      neighborhood: 'Leblon',
      segment_category: 'Gastronomia',
      reward_type: 'ENTRADA',
      title: 'Entrada Selecionada do Chef no Leblon (Carpaccio Clássico)',
      description:
        'Troque seus pontos acumulados em qualquer parceiro por uma entrada refinada na casa de carnes do Leblon.',
      eligible_item: '1 Entrada do Chef (Carpaccio Clássico ou Steak Tartare)',
      points_cost: 2400,
      reference_price_brl: 24.0,
      estimated_cost_brl: 7.0,
      min_consumption_brl: 60.0,
      quantity_total: 15,
      quantity_available: 15,
      max_per_user: 1,
      valid_days_hours: 'Segunda a Quinta · 12h às 15h30',
      rules_summary: 'Apresente o voucher no início da refeição. 1 voucher por mesa.',
      restrictions: 'Consumo mínimo de R$ 60 no local. Exceto feriados.',
      voucher_validity_days: 30,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },

    // 2. BARES & NOITE
    {
      id: 'rew-pilot-rioscenarium-chopp',
      restaurant_id: '22222222-2222-4222-8222-000000000008',
      restaurant_name: 'Rio Scenarium',
      neighborhood: 'Lapa',
      segment_category: 'Bares & Noite',
      reward_type: 'BEBIDA_NAO_ALCOOLICA',
      title: 'Chopp Artesanal Carioca ou Mocktail Autoral na Lapa',
      description:
        'Curta as noites vibrantes de samba e choro na Lapa aproveitando seus Rio Points acumulados durante o dia.',
      eligible_item: '1 Chopp Artesanal 350ml ou Mocktail Autoral',
      points_cost: 800,
      reference_price_brl: 8.0,
      estimated_cost_brl: 2.5,
      min_consumption_brl: 0,
      quantity_total: 30,
      quantity_available: 30,
      max_per_user: 2,
      valid_days_hours: 'Quarta a Sexta · 19h às 23h30',
      rules_summary: 'Valide o voucher no balcão do bar principal antes de pedir sua bebida.',
      restrictions: 'Entrada no casarão sujeita à bilheteria regular. Proibido para menores de 18 anos.',
      voucher_validity_days: 30,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'rew-pilot-rooftop-sunset-drink',
      restaurant_id: '22222222-2222-4222-8222-000000000007',
      restaurant_name: 'Rooftop Arpoador Lounge',
      neighborhood: 'Ipanema',
      segment_category: 'Bares & Noite',
      reward_type: 'EXPERIENCIA',
      title: 'Drink Autoral ao Pôr do Sol no Terraço Panorâmico',
      description:
        'Vista deslumbrante das praias do Arpoador e Ipanema acompanhada de coquetel autoral premiado.',
      eligible_item: '1 Drink Autoral da Carta Signature Sunset',
      points_cost: 1800,
      reference_price_brl: 18.0,
      estimated_cost_brl: 5.0,
      min_consumption_brl: 30.0,
      quantity_total: 20,
      quantity_available: 20,
      max_per_user: 1,
      valid_days_hours: 'Segunda a Quinta · 17h às 20h',
      rules_summary: 'Apresente o código do voucher na recepção do rooftop ao chegar.',
      restrictions: 'Sujeito à capacidade do terraço ao ar livre. Não cumulativo com happy hour.',
      voucher_validity_days: 30,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },

    // 3. PASSEIOS & TURISMO
    {
      id: 'rew-pilot-parque-lage',
      restaurant_id: '22222222-2222-4222-8222-000000000002',
      restaurant_name: 'Parque Lage & Trilha Botânica',
      neighborhood: 'Jardim Botânico',
      segment_category: 'Passeios & Turismo',
      reward_type: 'PASSEIO',
      title: 'Guia Ilustrado de Trilhas + Café Botânico Especial no Pátio',
      description:
        'Experiência completa no casarão histórico aos pés do Corcovado. Circulação cruzada com Rio Points.',
      eligible_item: '1 Café Especial com grãos selecionados + Mapa Físico Curado de Trilhas',
      points_cost: 1000,
      reference_price_brl: 10.0,
      estimated_cost_brl: 3.0,
      min_consumption_brl: 0,
      quantity_total: 20,
      quantity_available: 20,
      max_per_user: 1,
      valid_days_hours: 'Segunda a Sexta · 09h às 16h',
      rules_summary: 'Retire o kit de trilha e o café no quiosque de apoio do pátio interno.',
      restrictions: 'Não aplicável em feriados prolongados.',
      voucher_validity_days: 60,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'rew-pilot-forte-copacabana',
      restaurant_id: '22222222-2222-4222-8222-000000000005',
      restaurant_name: 'Forte de Copacabana & Café do Forte',
      neighborhood: 'Copacabana',
      segment_category: 'Passeios & Turismo',
      reward_type: 'PASSEIO',
      title: 'Acesso ao Mirante Histórico da Baía + Café Artesanal',
      description:
        'Aproveite a vista privilegiada de toda a orla de Copacabana enquanto saboreia um café passado na hora.',
      eligible_item: '1 Café Filtrado Especial + Acesso prioritário ao deque do forte',
      points_cost: 800,
      reference_price_brl: 8.0,
      estimated_cost_brl: 2.0,
      min_consumption_brl: 0,
      quantity_total: 25,
      quantity_available: 25,
      max_per_user: 2,
      valid_days_hours: 'Terça a Sexta · 10h às 17h',
      rules_summary: 'Valide seu voucher na entrada do deck cultural.',
      restrictions: 'Ingresso do Museu Histórico do Exército pago à parte na guarita militar.',
      voucher_validity_days: 45,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'rew-pilot-escuna-guanabara',
      restaurant_id: '22222222-2222-4222-8222-000000000006',
      restaurant_name: 'Passeios Náuticos Baía Carioca',
      neighborhood: 'Marina da Glória',
      segment_category: 'Passeios & Turismo',
      reward_type: 'PASSEIO',
      title: 'Passeio de Escuna na Baía de Guanabara (Pão de Açúcar & Ilha Fiscal)',
      description:
        'Navegação panorâmica com áudio-guia histórico pelos cartões postais mais célebres do Rio de Janeiro.',
      eligible_item: '1 Ingresso Individual de Escuna (Circuito Clássico 1h30)',
      points_cost: 2500,
      reference_price_brl: 25.0,
      estimated_cost_brl: 8.0,
      min_consumption_brl: 0,
      quantity_total: 10,
      quantity_available: 10,
      max_per_user: 1,
      valid_days_hours: 'Quinta a Domingo · Saídas 10h e 14h',
      rules_summary: 'Apresente o voucher no píer de embarque da Marina da Glória com 30min de antecedência.',
      restrictions: 'Embarque sujeito às condições meteorológicas e de maré da capitania dos portos.',
      voucher_validity_days: 60,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },

    // 4. HOSPEDAGEM
    {
      id: 'rew-pilot-hotel-santa-teresa',
      restaurant_id: '33333333-3333-4333-8333-000000000001',
      restaurant_name: 'Hotel Boutique Santa Teresa',
      neighborhood: 'Santa Teresa',
      segment_category: 'Hospedagem',
      reward_type: 'UPGRADE_HOTEL',
      title: 'Welcome Drink Especial + Late Checkout de 2 Horas',
      description:
        'Circulação cruzada com hospedagem charmosa no bairro boêmio com drink autoral e check-out estendido.',
      eligible_item: '1 Welcome Drink na Recepção + Late Check-out 2h garantido',
      points_cost: 1800,
      reference_price_brl: 18.0,
      estimated_cost_brl: 4.0,
      min_consumption_brl: 0,
      quantity_total: 12,
      quantity_available: 12,
      max_per_user: 1,
      valid_days_hours: 'Domingo a Quinta-feira · Diárias selecionadas',
      rules_summary: 'Válido para hóspedes com reserva ativa no hotel ao apresentar o voucher no check-in.',
      restrictions: 'Sujeito à disponibilidade no período de alta temporada e feriados.',
      voucher_validity_days: 90,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'rew-pilot-hotel-praia-ipanema',
      restaurant_id: '33333333-3333-4333-8333-000000000002',
      restaurant_name: 'Hotel Praia Ipanema',
      neighborhood: 'Ipanema',
      segment_category: 'Hospedagem',
      reward_type: 'UPGRADE_HOTEL',
      title: 'Day Use Piscina Panorâmica & Toalhas de Praia',
      description:
        'Aproveite o dia no terraço com vista de toda a praia de Ipanema utilizando pontos acumulados em restaurantes.',
      eligible_item: '1 Acesso Day Use Piscina do Rooftop + Serviço de Toalhas',
      points_cost: 2500,
      reference_price_brl: 25.0,
      estimated_cost_brl: 7.5,
      min_consumption_brl: 50.0,
      quantity_total: 8,
      quantity_available: 8,
      max_per_user: 1,
      valid_days_hours: 'Segunda a Quinta · 10h às 16h',
      rules_summary: 'Agendamento prévio com 24h de antecedência junto à gerência de hospedagem.',
      restrictions: 'Consumo mínimo de R$ 50 no bar da piscina. Válido apenas para dias úteis.',
      voucher_validity_days: 60,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },

    // 5. BEM-ESTAR
    {
      id: 'rew-pilot-arpoador-yoga',
      restaurant_id: '44444444-4444-4444-8444-000000000001',
      restaurant_name: 'Arpoador Yoga Club',
      neighborhood: 'Ipanema',
      segment_category: 'Bem-estar',
      reward_type: 'SERVICO_BEM_ESTAR',
      title: 'Day Pass Yoga ao Nascer do Sol na Pedra do Arpoador',
      description:
        'Prática guiada com instrutor certificado conectando corpo, mente e a vista deslumbrante do amanhecer carioca.',
      eligible_item: '1 Aula Coletiva Sunrise Yoga (Tapete incluso)',
      points_cost: 900,
      reference_price_brl: 9.0,
      estimated_cost_brl: 2.5,
      min_consumption_brl: 0,
      quantity_total: 18,
      quantity_available: 18,
      max_per_user: 2,
      valid_days_hours: 'Terça, Quinta e Sábado · 06h30 às 07h30',
      rules_summary: 'Compareça ao ponto de encontro na pedra do Arpoador 15min antes do início.',
      restrictions: 'Em caso de chuva a aula é transferida para o estúdio coberto.',
      voucher_validity_days: 45,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'rew-pilot-copa-massage',
      restaurant_id: '44444444-4444-4444-8444-000000000002',
      restaurant_name: 'Espaço Zen & Bem-Estar Copacabana',
      neighborhood: 'Copacabana',
      segment_category: 'Bem-estar',
      reward_type: 'SERVICO_BEM_ESTAR',
      title: 'Quick Massage Relaxante Pós-Praia (20 minutos)',
      description:
        'Alívio de tensões musculares com terapeutas especializados no coração de Copacabana.',
      eligible_item: '1 Sessão de Quick Massage Cervical e Lombar (20 min)',
      points_cost: 1600,
      reference_price_brl: 16.0,
      estimated_cost_brl: 5.0,
      min_consumption_brl: 0,
      quantity_total: 15,
      quantity_available: 15,
      max_per_user: 1,
      valid_days_hours: 'Segunda a Sexta · 11h às 19h',
      rules_summary: 'Apresente o voucher no check-in da clínica.',
      restrictions: 'Atendimento por ordem de chegada ou agendamento telefônico.',
      voucher_validity_days: 30,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },

    // 6. CULTURA & ENTRETENIMENTO
    {
      id: 'rew-pilot-museu-amanha',
      restaurant_id: '22222222-2222-4222-8222-000000000001',
      restaurant_name: 'Museu do Amanhã',
      neighborhood: 'Centro',
      segment_category: 'Cultura & Entretenimento',
      reward_type: 'INGRESSO',
      title: 'Ingresso Exposição Principal — Praça Mauá',
      description:
        'Troque pontos acumulados em qualquer parceiro BoraRio por acesso à exposição principal no Porto Maravilha.',
      eligible_item: '1 Ingresso Individual (Exposição Principal)',
      points_cost: 1000,
      reference_price_brl: 10.0,
      estimated_cost_brl: 3.0,
      min_consumption_brl: 0,
      quantity_total: 25,
      quantity_available: 25,
      max_per_user: 2,
      valid_days_hours: 'Quarta a Domingo · 10h às 17h',
      rules_summary: 'Apresente o código do voucher na bilheteria para validação digital antes de entrar.',
      restrictions: 'Não acumulável com gratuidade das terças ou eventos com bilheteria fechada.',
      voucher_validity_days: 60,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'rew-pilot-casa-choro',
      restaurant_id: '22222222-2222-4222-8222-000000000009',
      restaurant_name: 'Casa do Choro Tradicional',
      neighborhood: 'Centro',
      segment_category: 'Cultura & Entretenimento',
      reward_type: 'INGRESSO',
      title: 'Acesso à Roda de Choro Tradicional + Programa Cultural',
      description:
        'A melhor música instrumental brasileira em um dos casarões preservados mais encantadores da Rua da Carioca.',
      eligible_item: '1 Ingresso para Roda de Choro ao Vivo + Guia do Choro Carioca',
      points_cost: 1200,
      reference_price_brl: 12.0,
      estimated_cost_brl: 3.5,
      min_consumption_brl: 0,
      quantity_total: 16,
      quantity_available: 16,
      max_per_user: 2,
      valid_days_hours: 'Quinta e Sexta · 18h30 às 20h30',
      rules_summary: 'Apresente o código do voucher na bilheteria com 20min de antecedência da sessão.',
      restrictions: 'Sujeito à lotação do auditório histórico (80 lugares).',
      voucher_validity_days: 45,
      status: 'AVAILABLE',
      commission_rate: 0,
      redemption_fee_brl: 0,
      is_demonstrative: true,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];
}

function loadAndNormalizeRewards(): PartnerReward[] {
  let list = readJson<PartnerReward[]>(KEYS.REWARDS, []);
  // Migração transparente caso o catálogo esteja vazio ou usando escala antiga (< 500 RP)
  if (list.length === 0 || list.some((r) => r.is_demonstrative && r.points_cost < 500)) {
    list = buildStarterRewards();
    writeJson(KEYS.REWARDS, list);
  }
  const now = Date.now();
  let changed = false;
  const normalized = list.map((r) => {
    if (r.expires_at && new Date(r.expires_at).getTime() < now && r.status === 'AVAILABLE') {
      changed = true;
      return { ...r, status: 'CLOSED' as const };
    }
    return r;
  });
  if (changed) writeJson(KEYS.REWARDS, normalized);
  return normalized;
}

function loadAndNormalizeVouchers(): RewardVoucher[] {
  const list = readJson<RewardVoucher[]>(KEYS.VOUCHERS, []);
  const now = Date.now();
  let changed = false;
  const normalized = list.map((v) => {
    if (v.status === 'ISSUED' && new Date(v.expires_at).getTime() < now) {
      changed = true;
      return { ...v, status: 'EXPIRED' as const };
    }
    return v;
  });
  if (changed) writeJson(KEYS.VOUCHERS, normalized);
  return normalized;
}

export function getPartnerRewards(filters?: {
  restaurantId?: string;
  segment?: string;
  neighborhood?: string;
  maxPoints?: number;
  search?: string;
  includeInactive?: boolean;
}): PartnerReward[] {
  const all = loadAndNormalizeRewards();
  const q = filters?.search?.trim().toLowerCase() || '';

  return all.filter((r) => {
    if (!filters?.includeInactive && r.status === 'CLOSED') return false;
    if (filters?.restaurantId && r.restaurant_id !== filters.restaurantId) return false;
    if (filters?.segment && filters.segment !== 'ALL' && r.segment_category !== filters.segment) {
      return false;
    }
    if (filters?.neighborhood && r.neighborhood !== filters.neighborhood) return false;
    if (filters?.maxPoints != null && r.points_cost > filters.maxPoints) return false;
    if (q) {
      const haystack = `${r.title} ${r.restaurant_name} ${r.eligible_item} ${r.segment_category} ${r.neighborhood}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

export function createPartnerReward(payload: {
  restaurant_id: string;
  restaurant_name: string;
  neighborhood: string;
  segment_category: RewardSegment | string;
  reward_type: RewardType;
  title: string;
  description?: string;
  eligible_item: string;
  points_cost: number;
  reference_price_brl?: number;
  estimated_cost_brl?: number;
  min_consumption_brl?: number;
  quantity_total: number;
  max_per_user?: number;
  valid_days_hours: string;
  rules_summary: string;
  restrictions?: string;
  voucher_validity_days?: number;
  expires_at?: string;
  is_demonstrative?: boolean;
}): { ok: boolean; message: string; reward?: PartnerReward; rewards: PartnerReward[] } {
  const all = loadAndNormalizeRewards();

  if (!payload.title.trim() || !payload.eligible_item.trim()) {
    return {
      ok: false,
      message: 'Informe o título e o item/benefício elegível para a Recompensa BoraRio.',
      rewards: all,
    };
  }
  if (payload.points_cost < 10) {
    return {
      ok: false,
      message: 'O custo mínimo de uma recompensa é 10 Rio Points.',
      rewards: all,
    };
  }
  if (payload.quantity_total < 1) {
    return {
      ok: false,
      message: 'A quantidade disponível deve ser de pelo menos 1 unidade.',
      rewards: all,
    };
  }

  const now = new Date().toISOString();
  const totalQty = Math.max(1, Math.round(payload.quantity_total));
  const pointsCost = Math.round(payload.points_cost);
  const refPrice =
    payload.reference_price_brl != null
      ? Number(payload.reference_price_brl.toFixed(2))
      : Number((pointsCost / 100).toFixed(2));
  const estCost =
    payload.estimated_cost_brl != null
      ? Number(payload.estimated_cost_brl.toFixed(2))
      : Number((refPrice * 0.3).toFixed(2));
  const minConsumption =
    payload.min_consumption_brl != null ? Math.max(0, Number(payload.min_consumption_brl.toFixed(2))) : 0;

  const reward: PartnerReward = {
    id: generateUUID(),
    restaurant_id: payload.restaurant_id,
    restaurant_name: payload.restaurant_name,
    neighborhood: payload.neighborhood,
    segment_category: payload.segment_category,
    reward_type: payload.reward_type,
    title: payload.title.trim(),
    description: payload.description?.trim() || `Recompensa oficial em ${payload.restaurant_name} sem comissão por resgate.`,
    eligible_item: payload.eligible_item.trim(),
    points_cost: pointsCost,
    reference_price_brl: refPrice,
    estimated_cost_brl: estCost,
    min_consumption_brl: minConsumption,
    quantity_total: totalQty,
    quantity_available: totalQty,
    max_per_user: Math.max(1, Math.round(payload.max_per_user ?? 1)),
    valid_days_hours: payload.valid_days_hours.trim() || 'Conforme horário da casa',
    rules_summary:
      payload.rules_summary.trim() || 'Apresente o voucher no local para validação digital.',
    restrictions: payload.restrictions?.trim() || 'Sujeito à disponibilidade do estabelecimento.',
    voucher_validity_days: Math.max(1, Math.round(payload.voucher_validity_days ?? 30)),
    expires_at: payload.expires_at,
    status: 'AVAILABLE',
    commission_rate: 0,
    redemption_fee_brl: 0,
    is_demonstrative: payload.is_demonstrative ?? false,
    created_at: now,
    updated_at: now,
  };

  const next = [reward, ...all];
  writeJson(KEYS.REWARDS, next);

  return {
    ok: true,
    message:
      'Recompensa BoraRio publicada com sucesso (0% de comissão e R$ 0,00 de taxa por resgate)!',
    reward,
    rewards: next,
  };
}

export function updatePartnerReward(
  rewardId: string,
  patch: Partial<
    Pick<
      PartnerReward,
      | 'title'
      | 'eligible_item'
      | 'points_cost'
      | 'reference_price_brl'
      | 'estimated_cost_brl'
      | 'min_consumption_brl'
      | 'quantity_total'
      | 'quantity_available'
      | 'valid_days_hours'
      | 'rules_summary'
      | 'restrictions'
      | 'voucher_validity_days'
      | 'max_per_user'
    >
  >
): { ok: boolean; message: string; rewards: PartnerReward[] } {
  const all = loadAndNormalizeRewards();
  const target = all.find((r) => r.id === rewardId);
  if (!target) {
    return { ok: false, message: 'Recompensa não encontrada.', rewards: all };
  }

  const nextTotal = Math.max(
    1,
    Math.round(patch.quantity_total ?? target.quantity_total)
  );
  const nextAvail = Math.max(
    0,
    Math.min(
      nextTotal,
      Math.round(
        patch.quantity_available ??
          (patch.quantity_total !== undefined
            ? target.quantity_available + (nextTotal - target.quantity_total)
            : target.quantity_available)
      )
    )
  );

  let nextStatus: PartnerRewardStatus = target.status;
  if (target.status !== 'PAUSED' && target.status !== 'CLOSED') {
    nextStatus = nextAvail === 0 ? 'EXHAUSTED' : 'AVAILABLE';
  }

  const updated: PartnerReward = {
    ...target,
    ...patch,
    points_cost: Math.max(10, Math.round(patch.points_cost ?? target.points_cost)),
    reference_price_brl:
      patch.reference_price_brl !== undefined
        ? patch.reference_price_brl
        : target.reference_price_brl,
    estimated_cost_brl:
      patch.estimated_cost_brl !== undefined ? patch.estimated_cost_brl : target.estimated_cost_brl,
    min_consumption_brl:
      patch.min_consumption_brl !== undefined
        ? patch.min_consumption_brl
        : target.min_consumption_brl,
    quantity_total: nextTotal,
    quantity_available: nextAvail,
    voucher_validity_days: Math.max(
      1,
      Math.round(patch.voucher_validity_days ?? target.voucher_validity_days)
    ),
    max_per_user: Math.max(1, Math.round(patch.max_per_user ?? target.max_per_user)),
    status: nextStatus,
    commission_rate: 0,
    redemption_fee_brl: 0,
    updated_at: new Date().toISOString(),
  };

  const next = all.map((r) => (r.id === rewardId ? updated : r));
  writeJson(KEYS.REWARDS, next);

  return {
    ok: true,
    message:
      'Recompensa atualizada! Vouchers já emitidos mantêm integralmente suas condições e validade originais.',
    rewards: next,
  };
}

/**
 * Pausar ou encerrar uma recompensa bloqueia SOMENTE novos resgates.
 * Todos os vouchers previamente emitidos (ISSUED) permanecem integralmente válidos para uso.
 */
export function setPartnerRewardStatus(
  rewardId: string,
  status: 'AVAILABLE' | 'PAUSED' | 'CLOSED'
): { ok: boolean; message: string; rewards: PartnerReward[] } {
  const all = loadAndNormalizeRewards();
  const target = all.find((r) => r.id === rewardId);
  if (!target) {
    return { ok: false, message: 'Recompensa não encontrada.', rewards: all };
  }

  const effectiveStatus: PartnerRewardStatus =
    status === 'AVAILABLE' && target.quantity_available === 0 ? 'EXHAUSTED' : status;

  const next = all.map((r) =>
    r.id === rewardId
      ? {
          ...r,
          status: effectiveStatus,
          updated_at: new Date().toISOString(),
        }
      : r
  );
  writeJson(KEYS.REWARDS, next);

  const labelMap: Record<'AVAILABLE' | 'PAUSED' | 'CLOSED', string> = {
    AVAILABLE: 'Recompensa reativada para novos resgates no Marketplace.',
    PAUSED:
      'Recompensa pausada para novos resgates. Vouchers já emitidos continuam válidos para validação no balcão!',
    CLOSED:
      'Recompensa encerrada para novos resgates. Vouchers já emitidos antes do encerramento permanecem válidos!',
  };

  return { ok: true, message: labelMap[status], rewards: next };
}

export function getRewardVouchers(filters?: {
  restaurantId?: string;
  userId?: string;
  status?: RewardVoucherStatus;
}): RewardVoucher[] {
  const vouchers = loadAndNormalizeVouchers();
  return vouchers.filter((v) => {
    if (filters?.restaurantId && v.restaurant_id !== filters.restaurantId) return false;
    if (filters?.userId && v.user_id !== filters.userId) return false;
    if (filters?.status && v.status !== filters.status) return false;
    return true;
  });
}

/**
 * Resgata recompensa do Marketplace usando Rio Points reais com controle de estoque.
 * - Gera voucher único BR-REW-... em estado ISSUED.
 * - NUNCA cria entrada em partner_fee_ledger e NUNCA cobra comissão (R$ 0,00).
 */
export function redeemPartnerReward(rewardId: string): {
  ok: boolean;
  message: string;
  voucher?: RewardVoucher;
} {
  const allRewards = loadAndNormalizeRewards();
  const target = allRewards.find((r) => r.id === rewardId);

  if (!target) {
    return { ok: false, message: 'Recompensa não encontrada.' };
  }

  if (target.status !== 'AVAILABLE') {
    return {
      ok: false,
      message: 'Esta recompensa está pausada, encerrada ou esgotada para novos resgates.',
    };
  }

  if (target.expires_at && new Date(target.expires_at).getTime() < Date.now()) {
    return { ok: false, message: 'O prazo promocional desta recompensa expirou.' };
  }

  if (target.quantity_available < 1) {
    return { ok: false, message: 'Estoque esgotado para esta recompensa.' };
  }

  const me = getUserProfileIdentity();
  const allVouchers = loadAndNormalizeVouchers();
  const userRedemptionsCount = allVouchers.filter(
    (v) =>
      v.reward_id === target.id &&
      v.user_id === me.id &&
      v.status !== 'CANCELLED'
  ).length;

  if (userRedemptionsCount >= target.max_per_user) {
    return {
      ok: false,
      message: `Limite por usuário atingido: máximo de ${target.max_per_user} resgate(s) para esta recompensa.`,
    };
  }

  const wallet = getWalletSummary();
  if (wallet.available_balance < target.points_cost) {
    return {
      ok: false,
      message: `Saldo insuficiente (${wallet.available_balance} RP disponíveis; necessário ${target.points_cost} RP).`,
    };
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + Math.max(1, target.voucher_validity_days) * 24 * 3600 * 1000
  ).toISOString();
  const voucherCode = generateVoucherCode();

  const voucher: RewardVoucher = {
    id: generateUUID(),
    reward_id: target.id,
    restaurant_id: target.restaurant_id,
    restaurant_name: target.restaurant_name,
    user_id: me.id,
    voucher_code: voucherCode,
    status: 'ISSUED',
    points_spent: target.points_cost,
    issued_at: now.toISOString(),
    expires_at: expiresAt,
    redeemed_at: now.toISOString(),
    commission_charged_brl: 0,
    snapshot_rules: {
      title: target.title,
      restaurant_name: target.restaurant_name,
      neighborhood: target.neighborhood,
      eligible_item: target.eligible_item,
      segment_category: target.segment_category,
      reference_price_brl: target.reference_price_brl,
      estimated_cost_brl: target.estimated_cost_brl,
      min_consumption_brl: target.min_consumption_brl,
      valid_days_hours: target.valid_days_hours,
      rules_summary: target.rules_summary,
      restrictions: target.restrictions,
      commission_rate: 0,
      redemption_fee_brl: 0,
    },
    is_demonstrative: target.is_demonstrative,
  };

  writeJson(KEYS.VOUCHERS, [voucher, ...allVouchers]);

  appendLedgerTransaction({
    type: 'REDEEM',
    amount: target.points_cost,
    origin: 'reward_redeem',
    description: `Resgate em ${target.restaurant_name}: ${target.title} (${voucherCode})`,
    experience_id: target.restaurant_id,
    experience_name: target.restaurant_name,
    reward_voucher_id: voucher.id,
    validation_status: 'RELEASED',
  });

  const nextQty = target.quantity_available - 1;
  const nextRewards = allRewards.map((r) =>
    r.id === target.id
      ? {
          ...r,
          quantity_available: nextQty,
          status: nextQty === 0 ? ('EXHAUSTED' as const) : r.status,
          updated_at: now.toISOString(),
        }
      : r
  );
  writeJson(KEYS.REWARDS, nextRewards);

  pushInternalNotification(
    `Voucher emitido: ${voucherCode}`,
    `${target.title} em ${target.restaurant_name} (-${target.points_cost} RP). Apresente no estabelecimento antes de ${new Date(
      expiresAt
    ).toLocaleDateString('pt-BR')}.`
  );

  if (supabase && isValidUuid(target.id)) {
    void supabase
      .rpc('redeem_partner_reward', { p_reward_id: target.id })
      .then(() => undefined, () => undefined);
  }

  return {
    ok: true,
    message: `Voucher ${voucherCode} emitido com sucesso em ${target.restaurant_name}! Comissão ao parceiro: R$ 0,00.`,
    voucher,
  };
}

/**
 * Cancelamento transparente de voucher ISSUED não utilizado dentro do prazo.
 * - Devolve integralmente os pontos ao ledger (origin = 'reward_refund').
 * - Recompõe +1 unidade no estoque da recompensa (sem reabrir manualmente se estava PAUSED/CLOSED).
 */
export function cancelRewardVoucher(
  voucherId: string,
  reason = 'Cancelado pelo usuário antes do uso'
): { ok: boolean; message: string; voucher?: RewardVoucher } {
  const vouchers = loadAndNormalizeVouchers();
  const target = vouchers.find((v) => v.id === voucherId);
  if (!target) {
    return { ok: false, message: 'Voucher não encontrado.' };
  }
  if (target.status !== 'ISSUED') {
    return {
      ok: false,
      message: `Este voucher não pode ser cancelado (estado atual: ${target.status}).`,
    };
  }
  if (new Date(target.expires_at).getTime() < Date.now()) {
    return { ok: false, message: 'Voucher expirado não é elegível para cancelamento.' };
  }

  const refundTx = appendLedgerTransaction({
    type: 'CREDIT',
    amount: target.points_spent,
    origin: 'reward_refund',
    description: `Estorno integral por cancelamento do voucher ${target.voucher_code}`,
    experience_id: target.restaurant_id,
    experience_name: target.restaurant_name,
    reward_voucher_id: target.id,
    validation_status: 'RELEASED',
  });

  const updatedVoucher: RewardVoucher = {
    ...target,
    status: 'CANCELLED',
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason.trim() || 'Cancelado pelo usuário antes do uso',
    cancellation_refund_tx_id: refundTx.id,
  };

  writeJson(
    KEYS.VOUCHERS,
    vouchers.map((v) => (v.id === voucherId ? updatedVoucher : v))
  );

  const rewards = loadAndNormalizeRewards().map((r) => {
    if (r.id !== target.reward_id) return r;
    const restoredQty = Math.min(r.quantity_total, r.quantity_available + 1);
    return {
      ...r,
      quantity_available: restoredQty,
      status: r.status === 'EXHAUSTED' && restoredQty > 0 ? ('AVAILABLE' as const) : r.status,
      updated_at: new Date().toISOString(),
    };
  });
  writeJson(KEYS.REWARDS, rewards);

  recordVoucherAuditEvent({
    event_type: 'REWARD_VOUCHER_CANCELLED',
    restaurantId: target.restaurant_id,
    actorRole: 'USER',
    message: `Voucher ${target.voucher_code} cancelado com estorno integral de ${target.points_spent} RP e devolução de +1 unidade ao estoque.`,
  });

  if (supabase && isValidUuid(voucherId)) {
    void supabase
      .rpc('cancel_reward_voucher', { p_voucher_id: voucherId, p_reason: reason })
      .then(() => undefined, () => undefined);
  }

  return {
    ok: true,
    message: `Voucher ${target.voucher_code} cancelado! +${target.points_spent} Rio Points estornados para sua carteira e +1 unidade devolvida ao estoque.`,
    voucher: updatedVoucher,
  };
}

/**
 * Validação presencial do voucher no Painel do Parceiro (ISSUED -> USED).
 * - Funciona mesmo se a recompensa mãe foi PAUSED, CLOSED ou EXHAUSTED após a emissão!
 * - NUNCA cria cobrança ou comissão em partner_fee_ledger (Comissão R$ 0,00).
 */
export function partnerValidateRewardVoucher(params: {
  voucherCode: string;
  restaurantId: string;
  partnerLabel?: string;
}): { ok: boolean; message: string; voucher?: RewardVoucher } {
  const code = params.voucherCode.trim().toUpperCase();
  if (!code) {
    return { ok: false, message: 'Informe o código do voucher (ex: BR-REW-XXXXXX).' };
  }

  const vouchers = loadAndNormalizeVouchers();
  const target = vouchers.find((v) => v.voucher_code.toUpperCase() === code);
  if (!target) {
    return { ok: false, message: `Voucher "${code}" não encontrado.` };
  }

  if (target.restaurant_id !== params.restaurantId) {
    return {
      ok: false,
      message: `Este voucher pertence a ${target.restaurant_name} e não pode ser validado em outro estabelecimento.`,
    };
  }

  if (target.status !== 'ISSUED') {
    return {
      ok: false,
      message: `Voucher ${target.voucher_code} não está apto para validação (estado atual: ${target.status}).`,
    };
  }

  if (new Date(target.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      message: `Voucher ${target.voucher_code} expirou em ${new Date(
        target.expires_at
      ).toLocaleDateString('pt-BR')}.`,
    };
  }

  const nowIso = new Date().toISOString();
  const updated: RewardVoucher = {
    ...target,
    status: 'USED',
    used_at: nowIso,
    validated_by_label: params.partnerLabel?.trim() || 'Balcão do Parceiro',
    commission_charged_brl: 0,
  };

  writeJson(
    KEYS.VOUCHERS,
    vouchers.map((v) => (v.id === target.id ? updated : v))
  );

  recordVoucherAuditEvent({
    event_type: 'REWARD_VOUCHER_VALIDATED',
    restaurantId: target.restaurant_id,
    actorRole: 'PARTNER',
    message: `Voucher ${target.voucher_code} validado no local (${updated.snapshot_rules.title}) — Comissão sobre resgate: R$ 0,00 (0%).`,
  });

  pushInternalNotification(
    `Recompensa utilizada: ${target.voucher_code}`,
    `${updated.snapshot_rules.title} validado em ${target.restaurant_name}.`
  );

  if (supabase && isValidUuid(params.restaurantId)) {
    void supabase
      .rpc('partner_validate_reward_voucher', {
        p_voucher_code: code,
        p_restaurant_id: params.restaurantId,
      })
      .then(() => undefined, () => undefined);
  }

  return {
    ok: true,
    message: `Voucher ${target.voucher_code} validado com sucesso (estado USED)! Comissão por resgate: R$ 0,00.`,
    voucher: updated,
  };
}

/**
 * Registra atribuição informativa quando um usuário que já resgatou/utilizou recompensa no parceiro
 * retorna em uma nova visita ou nova reserva posterior (sem assumir causalidade automática).
 */
export function recordPostRewardReturnIfApplicable(params: {
  restaurantId: string;
  userId?: string;
  eventType: 'RETURN_VISIT' | 'SUBSEQUENT_BOOKING';
  subsequentBookingId?: string;
  subsequentFeeLedgerId?: string;
  indirectFeeBrl?: number;
}): RewardReturnAttribution | undefined {
  const uid = params.userId || getUserProfileIdentity().id;
  const vouchers = loadAndNormalizeVouchers().filter(
    (v) =>
      v.restaurant_id === params.restaurantId &&
      v.user_id === uid &&
      (v.status === 'USED' || v.status === 'ISSUED' || v.status === 'REDEEMED')
  );

  if (vouchers.length === 0) return undefined;

  const latestVoucher = vouchers[0];
  const current = readJson<RewardReturnAttribution[]>(KEYS.RETURN_ATTRIBUTIONS, []);

  // Deduplica por evento + reserva para não duplicar retorno
  if (
    params.subsequentBookingId &&
    current.some(
      (a) =>
        a.subsequent_booking_id === params.subsequentBookingId &&
        a.event_type === params.eventType
    )
  ) {
    return undefined;
  }

  const entry: RewardReturnAttribution = {
    id: generateUUID(),
    reward_voucher_id: latestVoucher.id,
    restaurant_id: params.restaurantId,
    user_id: uid,
    event_type: params.eventType,
    subsequent_booking_id: params.subsequentBookingId,
    subsequent_fee_ledger_id: params.subsequentFeeLedgerId,
    indirect_fee_brl: Number((params.indirectFeeBrl ?? 0).toFixed(2)),
    attribution_note:
      'Correlação observada após resgate de recompensa neste parceiro; métrica informativa sem causalidade automática.',
    created_at: new Date().toISOString(),
  };

  writeJson(KEYS.RETURN_ATTRIBUTIONS, [entry, ...current]);
  return entry;
}

export function getRewardReturnAttributions(restaurantId?: string): RewardReturnAttribution[] {
  const list = readJson<RewardReturnAttribution[]>(KEYS.RETURN_ATTRIBUTIONS, []);
  if (!restaurantId) return list;
  return list.filter((a) => a.restaurant_id === restaurantId);
}

/**
 * Agrega métricas de Fidelidade & Retorno separadas da receita contratual por reserva.
 * Comissão e taxa sobre resgates de recompensas são estruturalmente R$ 0,00 (0%).
 */
export function getPartnerLoyaltyEconomics(
  restaurantId: string
): PartnerLoyaltyEconomicsSummary {
  const rewards = getPartnerRewards({ restaurantId, includeInactive: true });
  const vouchers = getRewardVouchers({ restaurantId });
  const txs = getPointTransactions();
  const attributions = getRewardReturnAttributions(restaurantId);

  const pointsAwardedAtVenue = txs
    .filter(
      (tx) =>
        tx.type === 'CREDIT' &&
        tx.experience_id === restaurantId &&
        tx.validation_status !== 'REVERSED' &&
        (tx.origin === 'checkin_qr' ||
          tx.origin === 'verified_review' ||
          tx.origin === 'campaign_bonus')
    )
    .reduce((sum, tx) => sum + tx.amount, 0);

  const nonCancelledVouchers = vouchers.filter((v) => v.status !== 'CANCELLED');
  const pointsRedeemedOnVenue = nonCancelledVouchers.reduce(
    (sum, v) => sum + v.points_spent,
    0
  );

  const returnVisits = attributions.filter((a) => a.event_type === 'RETURN_VISIT').length;
  const subsequentBookings = attributions.filter(
    (a) => a.event_type === 'SUBSEQUENT_BOOKING'
  ).length;
  const indirectRevenue = attributions.reduce((sum, a) => sum + a.indirect_fee_brl, 0);

  const usedVouchers = vouchers.filter((v) => v.status === 'USED');
  const totalEstimatedCostBrl = usedVouchers.reduce(
    (sum, v) => sum + (v.snapshot_rules.estimated_cost_brl ?? 0),
    0
  );
  const totalReferenceValueBrl = usedVouchers.reduce(
    (sum, v) => sum + (v.snapshot_rules.reference_price_brl ?? Number((v.points_spent / 100).toFixed(2))),
    0
  );

  return {
    restaurant_id: restaurantId,
    registered_rewards_count: rewards.length,
    active_rewards_count: rewards.filter((r) => r.status === 'AVAILABLE').length,
    total_stock_available: rewards.reduce((sum, r) => sum + r.quantity_available, 0),
    points_awarded_at_venue: pointsAwardedAtVenue,
    points_redeemed_on_venue: pointsRedeemedOnVenue,
    vouchers_issued_count: nonCancelledVouchers.length,
    vouchers_used_count: usedVouchers.length,
    vouchers_expired_count: vouchers.filter((v) => v.status === 'EXPIRED').length,
    vouchers_cancelled_count: vouchers.filter((v) => v.status === 'CANCELLED').length,
    return_visits_post_redemption: returnVisits,
    subsequent_bookings_post_redemption: subsequentBookings,
    indirect_booking_revenue_brl: Number(indirectRevenue.toFixed(2)),
    total_estimated_cost_brl: Number(totalEstimatedCostBrl.toFixed(2)),
    total_reference_value_brl: Number(totalReferenceValueBrl.toFixed(2)),
    reward_commission_brl: 0,
    reward_redemption_fee_pct: 0,
    attribution_disclaimer:
      'Indicadores pós-resgate refletem apenas visitas e reservas posteriores cronologicamente observadas, sem atribuição causal automática. Comissão sobre resgates em Rio Points: R$ 0,00 (0%).',
  };
}

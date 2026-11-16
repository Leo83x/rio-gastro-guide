import type { ReservationRequest } from '../types/experience';
import type {
  DemandParticipation,
  PartnerOffering,
  PartnerOfferingStatus,
} from '../types/marketplace';
import type { CommercialModality } from '../types/partnerCommercial';
import {
  DIRECT_PAYMENT_NOTICE,
  MANDATORY_CHECKIN_INSTRUCTION,
} from '../types/verification';
import { generateUUID } from '../utils/slug';
import { getUserProfileIdentity } from './authService';
import {
  addNotification,
  createReservationRequest,
  getReservations,
  updateReservationStage,
} from './superappStore';

const KEYS = {
  OFFERINGS: 'borario_partner_offerings_v1',
  PARTICIPATIONS: 'borario_demand_participations_v1',
};

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getFutureIso(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

function buildStarterOfferings(): PartnerOffering[] {
  const today = getTodayIsoDate();
  const nowIso = new Date().toISOString();

  return [
    {
      id: 'off-trad-braz',
      restaurant_id: '11111111-1111-4111-8111-000000000009',
      restaurant_name: 'Bráz Pizzaria',
      neighborhood: 'Jardim Botânico',
      category: 'Pizzaria',
      price_range: '$$$',
      modality: 'TRADITIONAL_BOOKING',
      status: 'PUBLISHED',
      title: 'Mesa VIP no Forno a Lenha com Sobremesa Cortesia',
      description:
        'Mesa reservada no salão nobre com forno a lenha, 1 entrada especial da casa e sobremesa artesanal cortesia.',
      benefit_summary: '🍕 Pizza Especial da Casa + Sobremesa Cortesia do Forno',
      rules_summary: 'Válido para a janela das 20h. Apresente seu check-in BoraRio ao maitre na chegada.',
      eligibility_rules: 'Reserva garantida para mesas de até 4 pessoas.',
      cancellation_policy: 'Cancelamento sem ônus pelo app até 2 horas antes do horário marcado.',
      payment_instructions: DIRECT_PAYMENT_NOTICE,
      has_discount: true,
      condition_badge: '⏰ Hoje às 20:00',
      estimated_savings_brl: 45,
      service_date: today,
      time_slot_label: '20:00',
      starts_at: nowIso,
      ends_at: getFutureIso(72),
      capacity_total: 10,
      reserved_count: 7,
      eligible_item: 'Pizza especial + Sobremesa cortesia',
      offer_category: 'Gastronomia',
      valid_days_hours: 'Todos os dias · 19h às 22h',
      views_count: 0,
      partner_managed_active: true,
      is_demonstrative: true,
      image_url:
        'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=80',
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'off-indiv-ct',
      restaurant_id: '11111111-1111-4111-8111-000000000004',
      restaurant_name: 'CT Boucherie',
      neighborhood: 'Leblon',
      category: 'Carnes',
      price_range: '$$$$',
      modality: 'INDIVIDUAL_OFFER',
      status: 'PUBLISHED',
      title: 'Menu Executivo do Chef com Rodízio de Acompanhamentos',
      description:
        'Cortes nobres grelhados com rodízio contínuo de acompanhamentos franceses e taça de vinho cortesia.',
      benefit_summary: '🥩 Rodízio de Acompanhamentos do Chef + 1 Taça de Vinho',
      rules_summary: 'Válido para almoço na janela das 13h. Apresente o check-in QR antes do consumo.',
      eligibility_rules: 'Uso individual ou em grupo independente de quórum coletivo.',
      cancellation_policy: 'Alteração ou cancelamento livre até 2 horas antes da janela.',
      payment_instructions: DIRECT_PAYMENT_NOTICE,
      has_discount: true,
      condition_badge: '⏰ Almoço às 13:00',
      base_price_brl: 190,
      partner_condition_price_brl: 145,
      estimated_savings_brl: 45,
      service_date: today,
      time_slot_label: '13:00',
      starts_at: nowIso,
      ends_at: getFutureIso(48),
      capacity_total: 12,
      reserved_count: 9,
      eligible_item: 'Menu Executivo (Entrada + Prato Principal + Vinho)',
      offer_category: 'Gastronomia',
      valid_days_hours: 'Segunda a Sexta · 12h às 15h30',
      views_count: 0,
      partner_managed_active: true,
      is_demonstrative: true,
      image_url:
        'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80',
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'off-demand-gero',
      restaurant_id: '11111111-1111-4111-8111-000000000011',
      restaurant_name: 'Gero Ipanema',
      neighborhood: 'Ipanema',
      category: 'Italiana',
      price_range: '$$$$',
      modality: 'DEMAND_OFFER',
      status: 'CAPTURING',
      title: 'Menu Degustação em 3 Tempos com Welcome Drink',
      description:
        'Alta gastronomia italiana em 3 tempos (Entrada + Prato Principal + Sobremesa) com welcome drink do sommelier.',
      benefit_summary: '🔥 Menu Degustação em 3 Tempos + Welcome Drink Exclusivo',
      rules_summary:
        'Sua solicitação só se torna reserva confirmada após o alcance da meta e confirmação expressa do estabelecimento.',
      eligibility_rules: 'Participantes independentes na mesma data/janela de atendimento.',
      cancellation_policy: 'Sem cobrança no app; caso a meta não seja atingida, a solicitação é encerrada sem ônus.',
      payment_instructions: DIRECT_PAYMENT_NOTICE,
      has_discount: true,
      condition_badge: '⚡ Meta Quase Batida',
      base_price_brl: 310,
      partner_condition_price_brl: 235,
      estimated_savings_brl: 75,
      service_date: today,
      time_slot_label: '20:30',
      starts_at: nowIso,
      ends_at: getFutureIso(36),
      capacity_total: 20,
      reserved_count: 15,
      min_demand_goal: 20,
      eligible_item: 'Menu Degustação Completo em 3 Tempos',
      offer_category: 'Gastronomia',
      valid_days_hours: 'Terça e Quarta · 19h30 às 22h',
      views_count: 0,
      partner_managed_active: true,
      is_demonstrative: true,
      image_url:
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80',
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'off-last-urca',
      restaurant_id: '11111111-1111-4111-8111-000000000006',
      restaurant_name: 'Bar Urca',
      neighborhood: 'Urca',
      category: 'Brasileira',
      price_range: '$$',
      modality: 'LAST_MINUTE',
      status: 'PUBLISHED',
      title: 'Pôr do Sol no Salão Superior com Petiscos da Casa',
      description:
        'Mesas exclusivas na janela com vista panorâmica para a Baía de Guanabara, porção de empadas e chopp gelado.',
      benefit_summary: '🍺 Empadas de Camarão + Chopp Gelado no Pôr do Sol',
      rules_summary: 'Válido apenas para a janela de hoje descrita ao lado, mediante vagas remanescentes reais.',
      eligibility_rules: 'Solicitação sujeita à disponibilidade imediata da janela.',
      cancellation_policy: 'Avise caso não possa comparecer para liberar o lugar na fila.',
      payment_instructions: DIRECT_PAYMENT_NOTICE,
      has_discount: true,
      condition_badge: '🔥 Restam 2 mesas',
      estimated_savings_brl: 35,
      service_date: today,
      time_slot_label: '18:00',
      starts_at: nowIso,
      ends_at: getFutureIso(8),
      capacity_total: 8,
      reserved_count: 6,
      eligible_item: 'Empada de camarão cortesia + mesa no salão superior',
      offer_category: 'Gastronomia',
      valid_days_hours: 'Hoje · 17h30 às 19h30',
      views_count: 0,
      partner_managed_active: true,
      is_demonstrative: true,
      image_url:
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80',
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'off-rooftop-xian',
      restaurant_id: '22222222-2222-4222-8222-000000000010',
      restaurant_name: 'Xian Rio — Rooftop Bossa Nova Mall',
      neighborhood: 'Centro',
      category: 'Contemporâneo',
      price_range: '$$$',
      modality: 'INDIVIDUAL_OFFER',
      status: 'PUBLISHED',
      title: 'Sunset VIP no Deck com Coquetel Autoral',
      description:
        'Mesa reservada na área panorâmica de frente para o Pão de Açúcar com drink autoral de boas-vindas.',
      benefit_summary: '🍸 Drink Autoral de Boas-Vindas + Vista Panorâmica do Pão de Açúcar',
      rules_summary: 'Válido para happy hour na janela das 18h30. Acerto direto no local.',
      eligibility_rules: 'Mesas de 2 a 4 pessoas.',
      cancellation_policy: 'Cancelamento livre até 2 horas antes.',
      payment_instructions: DIRECT_PAYMENT_NOTICE,
      has_discount: true,
      condition_badge: '⏰ Sexta às 18:30',
      estimated_savings_brl: 50,
      service_date: today,
      time_slot_label: '18:30',
      starts_at: nowIso,
      ends_at: getFutureIso(56),
      capacity_total: 15,
      reserved_count: 11,
      eligible_item: 'Drink autoral da casa + mesa panorâmica',
      offer_category: 'Gastronomia',
      valid_days_hours: 'Hoje · 18h às 21h',
      views_count: 0,
      partner_managed_active: true,
      is_demonstrative: true,
      image_url:
        'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?auto=format&fit=crop&w=1000&q=80',
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];
}

const STARTER_ENRICHMENT_MAP: Record<string, Partial<PartnerOffering>> = {
  'off-trad-braz': {
    title: 'Mesa VIP no Forno a Lenha com Sobremesa Cortesia',
    benefit_summary: '🍕 Pizza Especial da Casa + Sobremesa Cortesia do Forno',
    condition_badge: '⏰ Hoje às 20:00',
    estimated_savings_brl: 45,
    capacity_total: 10,
    reserved_count: 7,
    time_slot_label: '20:00',
    image_url:
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1000&q=80',
  },
  'off-indiv-ct': {
    title: 'Menu Executivo do Chef com Rodízio de Guarnições',
    benefit_summary: '🥩 Rodízio de Acompanhamentos do Chef + 1 Taça de Vinho',
    condition_badge: '⏰ Almoço às 13:00',
    estimated_savings_brl: 45,
    capacity_total: 12,
    reserved_count: 9,
    time_slot_label: '13:00',
    image_url:
      'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=80',
  },
  'off-demand-gero': {
    title: 'Menu Degustação em 3 Tempos com Welcome Drink',
    benefit_summary: '🔥 Menu Degustação em 3 Tempos + Welcome Drink Exclusivo',
    condition_badge: '⚡ Meta Quase Batida',
    estimated_savings_brl: 75,
    capacity_total: 20,
    reserved_count: 15,
    min_demand_goal: 20,
    time_slot_label: '20:30',
    image_url:
      'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80',
  },
  'off-last-urca': {
    title: 'Pôr do Sol no Salão Superior com Petiscos da Casa',
    benefit_summary: '🍺 Empadas de Camarão + Chopp Gelado no Pôr do Sol',
    condition_badge: '🔥 Restam 2 mesas',
    estimated_savings_brl: 35,
    capacity_total: 8,
    reserved_count: 6,
    time_slot_label: '18:00',
    image_url:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1000&q=80',
  },
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getPartnerOfferings(filters?: {
  restaurantId?: string;
  modality?: CommercialModality | 'ALL';
  includeDrafts?: boolean;
}): PartnerOffering[] {
  let list = readJson<PartnerOffering[]>(KEYS.OFFERINGS, []);
  if (list.length === 0) {
    list = buildStarterOfferings();
    writeJson(KEYS.OFFERINGS, list);
  } else {
    // Enriquecimento automático de fotos e textos apetitosos para itens existentes
    let updated = false;
    list = list.map((item) => {
      const enrichment = STARTER_ENRICHMENT_MAP[item.id];
      if (enrichment && (!item.image_url || item.benefit_summary.includes('Mesa confirmada') || item.benefit_summary.includes('condição diferenciada'))) {
        updated = true;
        return {
          ...item,
          ...enrichment,
        };
      }
      return item;
    });

    // Se o Xian não estiver na lista inicial existente, adiciona
    if (!list.some((i) => i.id === 'off-rooftop-xian')) {
      const starterList = buildStarterOfferings();
      const xian = starterList.find((i) => i.id === 'off-rooftop-xian');
      if (xian) {
        list.push(xian);
        updated = true;
      }
    }

    if (updated) {
      writeJson(KEYS.OFFERINGS, list);
    }
  }
  return list.filter((o) => {
    if (!filters?.includeDrafts && o.status === 'DRAFT') return false;
    if (filters?.restaurantId && o.restaurant_id !== filters.restaurantId) return false;
    if (filters?.modality && filters.modality !== 'ALL' && o.modality !== filters.modality) {
      return false;
    }
    return true;
  });
}

export function getDemandParticipations(offeringId?: string): DemandParticipation[] {
  const list = readJson<DemandParticipation[]>(KEYS.PARTICIPATIONS, []);
  if (!offeringId) return list;
  return list.filter((p) => p.offering_id === offeringId);
}

export function incrementOfferingViews(offeringId: string): PartnerOffering[] {
  const all = getPartnerOfferings({ includeDrafts: true });
  let found = false;
  const next = all.map((o) => {
    if (o.id !== offeringId) return o;
    found = true;
    return {
      ...o,
      views_count: (o.views_count || 0) + 1,
    };
  });
  if (found) {
    writeJson(KEYS.OFFERINGS, next);
  }
  return next;
}

export function createPartnerOffering(
  payload: Omit<
    PartnerOffering,
    'id' | 'reserved_count' | 'created_at' | 'updated_at' | 'payment_instructions' | 'is_demonstrative'
  > & { is_demonstrative?: boolean }
): { ok: boolean; message: string; offering?: PartnerOffering; offerings: PartnerOffering[] } {
  if (!payload.title.trim()) {
    return {
      ok: false,
      message: 'Informe um título claro para a disponibilidade ou condição comercial.',
      offerings: getPartnerOfferings({ includeDrafts: true }),
    };
  }
  if (payload.capacity_total < 1) {
    return {
      ok: false,
      message: 'A capacidade disponível deve ser de pelo menos 1 lugar.',
      offerings: getPartnerOfferings({ includeDrafts: true }),
    };
  }
  if (
    payload.modality === 'DEMAND_OFFER' &&
    (!payload.min_demand_goal || payload.min_demand_goal < 2 || payload.min_demand_goal > payload.capacity_total)
  ) {
    return {
      ok: false,
      message:
        'Para Reserva Inteligente por Demanda, defina uma meta mínima de 2 pessoas até a capacidade total.',
      offerings: getPartnerOfferings({ includeDrafts: true }),
    };
  }

  const now = new Date().toISOString();
  const computedSavings =
    payload.estimated_savings_brl > 0
      ? payload.estimated_savings_brl
      : payload.base_price_brl != null && payload.partner_condition_price_brl != null
        ? Math.max(0, Number((payload.base_price_brl - payload.partner_condition_price_brl).toFixed(2)))
        : 0;

  const offering: PartnerOffering = {
    ...payload,
    eligible_item: payload.eligible_item?.trim() || payload.benefit_summary.trim(),
    offer_category: payload.offer_category || payload.category,
    valid_days_hours: payload.valid_days_hours?.trim() || `${payload.service_date} · ${payload.time_slot_label}`,
    views_count: payload.views_count ?? 0,
    estimated_savings_brl: computedSavings,
    id: generateUUID(),
    reserved_count: 0,
    payment_instructions: DIRECT_PAYMENT_NOTICE,
    is_demonstrative: payload.is_demonstrative ?? false,
    created_at: now,
    updated_at: now,
  };

  const next = [offering, ...getPartnerOfferings({ includeDrafts: true })];
  writeJson(KEYS.OFFERINGS, next);

  return {
    ok: true,
    message: 'Condição comercial publicada pelo estabelecimento com sucesso!',
    offering,
    offerings: next,
  };
}

/**
 * Imutabilidade retroativa: impede alterar preço, benefício ou regras de ofertas que já possuam reservas confirmadas.
 * O parceiro pode apenas pausar/encerrar novas entradas respeitando compromissos já assumidos.
 */
export function updatePartnerOffering(
  offeringId: string,
  patch: Partial<
    Pick<
      PartnerOffering,
      | 'title'
      | 'description'
      | 'benefit_summary'
      | 'rules_summary'
      | 'partner_condition_price_brl'
      | 'capacity_total'
      | 'eligible_item'
      | 'valid_days_hours'
      | 'partner_managed_active'
      | 'status'
    >
  >
): { ok: boolean; message: string; offerings: PartnerOffering[] } {
  const all = getPartnerOfferings({ includeDrafts: true });
  const target = all.find((o) => o.id === offeringId);
  if (!target) {
    return { ok: false, message: 'Oferta não encontrada.', offerings: all };
  }

  const confirmedBookingsForOffering = getReservations().filter(
    (r) =>
      r.offering_id === offeringId &&
      r.status === 'CONFIRMED' &&
      r.stage !== 'CANCELLED' &&
      r.stage !== 'ENDED_WITHOUT_GOAL'
  );

  const touchesCommercialTerms =
    (patch.benefit_summary !== undefined && patch.benefit_summary !== target.benefit_summary) ||
    (patch.rules_summary !== undefined && patch.rules_summary !== target.rules_summary) ||
    (patch.partner_condition_price_brl !== undefined &&
      patch.partner_condition_price_brl !== target.partner_condition_price_brl) ||
    (patch.title !== undefined && patch.title !== target.title) ||
    (patch.eligible_item !== undefined && patch.eligible_item !== target.eligible_item);

  if (confirmedBookingsForOffering.length > 0 && touchesCommercialTerms) {
    return {
      ok: false,
      message:
        `Bloqueado por proteção ao cliente: já existem ${confirmedBookingsForOffering.length} reserva(s) confirmada(s) com estes termos congelados. Você pode apenas pausar ou encerrar novas adesões ou criar uma nova oferta.`,
      offerings: all,
    };
  }

  const next = all.map((o) =>
    o.id === offeringId
      ? {
          ...o,
          ...patch,
          updated_at: new Date().toISOString(),
        }
      : o
  );
  writeJson(KEYS.OFFERINGS, next);

  return {
    ok: true,
    message: 'Configuração atualizada respeitando compromissos confirmados.',
    offerings: next,
  };
}

/**
 * Solicitação individual / manifestação de interesse pelo cliente (ZERO gateway de pagamento).
 * Para DEMAND_OFFER: registra apenas REQUESTED e atualiza meta da campanha; nunca confirma reserva antes do parceiro.
 */
export function submitOfferingRequest(params: {
  offeringId: string;
  guests: number;
  whatsappReminder?: boolean;
  attributionOrigin?: string;
  venueCoords?: { latitude: number; longitude: number };
}): {
  ok: boolean;
  message: string;
  reservation?: ReservationRequest;
  offering?: PartnerOffering;
} {
  const guests = Math.max(1, params.guests);
  const all = getPartnerOfferings({ includeDrafts: true });
  const target = all.find((o) => o.id === params.offeringId);

  if (!target) {
    return { ok: false, message: 'Disponibilidade não encontrada.' };
  }

  if (
    !target.partner_managed_active ||
    ['DRAFT', 'SOLD_OUT', 'ENDED_WITHOUT_GOAL', 'CANCELLED', 'COMPLETED'].includes(target.status)
  ) {
    return {
      ok: false,
      message: 'Esta condição não está aceitando novas solicitações no momento.',
    };
  }

  const nextReserved = target.reserved_count + guests;
  if (nextReserved > target.capacity_total) {
    const remaining = Math.max(0, target.capacity_total - target.reserved_count);
    return {
      ok: false,
      message:
        remaining === 0
          ? 'Capacidade esgotada para esta janela.'
          : `Restam apenas ${remaining} vaga(s) nesta janela.`,
    };
  }

  const computedSavings =
    target.estimated_savings_brl > 0
      ? target.estimated_savings_brl
      : target.base_price_brl != null && target.partner_condition_price_brl != null
        ? Math.max(0, Number((target.base_price_brl - target.partner_condition_price_brl).toFixed(2)))
        : 0;

  const req = createReservationRequest({
    experience_id: target.restaurant_id,
    experience_name: target.restaurant_name,
    neighborhood: target.neighborhood,
    latitude: params.venueCoords?.latitude ?? -22.966,
    longitude: params.venueCoords?.longitude ?? -43.185,
    date: target.service_date,
    time: target.time_slot_label,
    guests,
    stage: 'REQUESTED',
    modality: target.modality,
    offering_id: target.id,
    offering_title: target.title,
    payment_instruction: target.payment_instructions || DIRECT_PAYMENT_NOTICE,
    attribution_origin: params.attributionOrigin || 'club',
    snapshot_terms: {
      title: target.title,
      benefit_summary: target.benefit_summary,
      price_summary:
        target.partner_condition_price_brl != null
          ? `Condição parceiro: R$ ${target.partner_condition_price_brl.toFixed(2)} (pagamento direto no local)`
          : target.has_discount
            ? `${target.condition_badge} · Pagamento direto no local`
            : 'Reserva tradicional sem desconto · Pagamento direto no local',
      cancellation_policy: target.cancellation_policy,
      base_price_brl: target.base_price_brl,
      partner_condition_price_brl: target.partner_condition_price_brl,
      estimated_savings_brl: computedSavings,
    },
    whatsapp_reminder: params.whatsappReminder ?? true,
  });

  let nextStatus: PartnerOfferingStatus = target.status;
  if (target.modality === 'DEMAND_OFFER') {
    if (nextReserved >= target.capacity_total) {
      nextStatus = 'SOLD_OUT';
    } else if (target.min_demand_goal && nextReserved >= target.min_demand_goal) {
      nextStatus = 'GOAL_REACHED';
    } else {
      nextStatus = 'CAPTURING';
    }
  } else if (nextReserved >= target.capacity_total) {
    nextStatus = 'SOLD_OUT';
  }

  const updatedOffering: PartnerOffering = {
    ...target,
    reserved_count: nextReserved,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  writeJson(
    KEYS.OFFERINGS,
    all.map((o) => (o.id === target.id ? updatedOffering : o))
  );

  if (target.modality === 'DEMAND_OFFER') {
    const me = getUserProfileIdentity();
    const participations = readJson<DemandParticipation[]>(KEYS.PARTICIPATIONS, []);
    const part: DemandParticipation = {
      id: generateUUID(),
      offering_id: target.id,
      reservation_id: req.id,
      restaurant_id: target.restaurant_id,
      user_id: me.id,
      guests,
      stage: 'REQUESTED',
      created_at: new Date().toISOString(),
    };
    writeJson(KEYS.PARTICIPATIONS, [part, ...participations]);
  }

  return {
    ok: true,
    message:
      target.modality === 'DEMAND_OFFER'
        ? `Manifestação individual registrada! ${MANDATORY_CHECKIN_INSTRUCTION}`
        : `Solicitação enviada ao estabelecimento! ${MANDATORY_CHECKIN_INSTRUCTION}`,
    reservation: req,
    offering: updatedOffering,
  };
}

export function partnerConfirmSingleReservation(reservationId: string): ReservationRequest[] {
  const list = getReservations();
  const target = list.find((r) => r.id === reservationId);
  const next = updateReservationStage(reservationId, {
    status: 'CONFIRMED',
    stage: 'CONFIRMED',
  });

  if (target) {
    addNotification({
      channel: target.whatsapp_reminder ? 'whatsapp' : 'internal',
      type: 'reservation',
      title: `Reserva confirmada: ${target.experience_name}`,
      message: `${target.date} às ${target.time}. ${MANDATORY_CHECKIN_INSTRUCTION}`,
    });
  }
  return next;
}

/**
 * Parceiro confirma a demanda consolidada após atingir meta ou decidir honrar a condição.
 * Só neste momento as solicitações individuais dos participantes passam para CONFIRMED.
 */
export function partnerConfirmDemandOffering(offeringId: string): {
  ok: boolean;
  confirmedCount: number;
  message: string;
  offerings: PartnerOffering[];
} {
  const all = getPartnerOfferings({ includeDrafts: true });
  const target = all.find((o) => o.id === offeringId);
  if (!target) {
    return { ok: false, confirmedCount: 0, message: 'Oferta não encontrada.', offerings: all };
  }

  const nextOfferings = all.map((o) =>
    o.id === offeringId
      ? { ...o, status: 'CONFIRMED' as const, updated_at: new Date().toISOString() }
      : o
  );
  writeJson(KEYS.OFFERINGS, nextOfferings);

  const reservations = getReservations();
  let count = 0;
  for (const res of reservations) {
    if (res.offering_id === offeringId && (res.stage === 'REQUESTED' || res.status === 'PENDING_CONFIRMATION')) {
      updateReservationStage(res.id, { status: 'CONFIRMED', stage: 'CONFIRMED' });
      count++;
    }
  }

  const participations = readJson<DemandParticipation[]>(KEYS.PARTICIPATIONS, []).map((p) =>
    p.offering_id === offeringId && p.stage === 'REQUESTED'
      ? { ...p, stage: 'CONFIRMED' as const }
      : p
  );
  writeJson(KEYS.PARTICIPATIONS, participations);

  addNotification({
    channel: 'internal',
    type: 'offer',
    title: `Demanda confirmada pelo parceiro: ${target.restaurant_name}`,
    message: `${target.title} foi confirmada para ${target.service_date} às ${target.time_slot_label}. ${MANDATORY_CHECKIN_INSTRUCTION}`,
  });

  return {
    ok: true,
    confirmedCount: count,
    message: `Condição comercial confirmada! ${count} solicitação(ões) individuais passaram para Confirmada.`,
    offerings: nextOfferings,
  };
}

/**
 * Encerramento transparente quando a meta de demanda agregada não foi alcançada no prazo.
 */
export function partnerEndDemandWithoutGoal(offeringId: string): {
  ok: boolean;
  message: string;
  offerings: PartnerOffering[];
} {
  const all = getPartnerOfferings({ includeDrafts: true });
  const target = all.find((o) => o.id === offeringId);
  if (!target) {
    return { ok: false, message: 'Oferta não encontrada.', offerings: all };
  }

  const nextOfferings = all.map((o) =>
    o.id === offeringId
      ? {
          ...o,
          status: 'ENDED_WITHOUT_GOAL' as const,
          partner_managed_active: false,
          updated_at: new Date().toISOString(),
        }
      : o
  );
  writeJson(KEYS.OFFERINGS, nextOfferings);

  for (const res of getReservations()) {
    if (res.offering_id === offeringId && res.stage === 'REQUESTED') {
      updateReservationStage(res.id, {
        status: 'CANCELLED',
        stage: 'ENDED_WITHOUT_GOAL',
      });
    }
  }

  const participations = readJson<DemandParticipation[]>(KEYS.PARTICIPATIONS, []).map((p) =>
    p.offering_id === offeringId && p.stage === 'REQUESTED'
      ? { ...p, stage: 'ENDED_WITHOUT_GOAL' as const }
      : p
  );
  writeJson(KEYS.PARTICIPATIONS, participations);

  addNotification({
    channel: 'internal',
    type: 'offer',
    title: `Encerrada sem meta: ${target.restaurant_name}`,
    message: `${target.title} não atingiu a demanda mínima no prazo e foi encerrada sem cobrança nem reserva confirmada.`,
  });

  return {
    ok: true,
    message: 'Campanha encerrada sem atingir meta. Os interessados foram notificados sem ônus.',
    offerings: nextOfferings,
  };
}

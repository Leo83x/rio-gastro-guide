import type {
  ClubOffer,
  GroupDrop,
  GroupVoteSession,
  NotificationItem,
  PointTransaction,
  ReservationRequest,
  UserPreferences,
} from '../types/experience';
import { generateUUID } from '../utils/slug';

const KEYS = {
  PREFS: 'rio_gastro_prefs_v1',
  POINTS: 'rio_gastro_points_v1',
  RESERVATIONS: 'rio_gastro_reservations_v1',
  NOTIFICATIONS: 'rio_gastro_notifications_v1',
  GROUP_VOTES: 'rio_gastro_group_votes_v1',
  DROPS: 'rio_gastro_drops_v1',
  QR_USED_NONCES: 'rio_gastro_qr_nonces_v1',
};

const DEFAULT_PREFERENCES: UserPreferences = {
  favorite_macro_categories: ['Gastronomia', 'Cultura & Museus'],
  favorite_neighborhoods: ['Botafogo', 'Ipanema', 'Leblon'],
  preferred_moments: ['couple', 'friends'],
  budget_tier: '$$$',
  lgpd_consents: {
    location: true,
    personalization: true,
    whatsapp: false,
    notifications: true,
    calendar: true,
  },
};

export function getUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(KEYS.PREFS);
    if (!raw) return DEFAULT_PREFERENCES;
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<UserPreferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  localStorage.setItem(KEYS.PREFS, JSON.stringify(prefs));
}

// --- Transactional Rio Points Ledger (with Anti-Fraud rules) ---
export function getPointTransactions(): PointTransaction[] {
  try {
    const raw = localStorage.getItem(KEYS.POINTS);
    if (!raw) {
      const initial: PointTransaction[] = [
        {
          id: generateUUID(),
          type: 'CREDIT',
          amount: 100,
          origin: 'welcome_bonus',
          description: 'Bônus de boas-vindas ao Rio Gastro Club (Demonstrativo)',
          created_at: new Date().toISOString(),
        },
      ];
      localStorage.setItem(KEYS.POINTS, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as PointTransaction[];
  } catch {
    return [];
  }
}

export function getPointsBalance(): number {
  return getPointTransactions().reduce((acc, tx) => {
    if (tx.type === 'CREDIT') return acc + tx.amount;
    if (tx.type === 'DEBIT' || tx.type === 'REDEEM' || tx.type === 'REVERSAL') {
      return acc - tx.amount;
    }
    return acc;
  }, 0);
}

export function hasValidatedCheckinForVenue(experienceId: string): boolean {
  return getPointTransactions().some(
    (tx) => tx.origin === 'checkin_qr' && tx.experience_id === experienceId
  );
}

export function validateAndCreditQRCheckin(
  experienceId: string,
  experienceName: string,
  qrCodeToken: string
): { ok: boolean; message: string; transaction?: PointTransaction } {
  const trimmed = qrCodeToken.trim();
  if (!trimmed.startsWith('RGG-QR-')) {
    return {
      ok: false,
      message: 'QR Code inválido. Utilize um código dinâmico oficial no formato RGG-QR-...',
    };
  }

  // Anti-fraud: check nonce reuse
  const usedRaw = localStorage.getItem(KEYS.QR_USED_NONCES);
  const usedNonces: string[] = usedRaw ? (JSON.parse(usedRaw) as string[]) : [];
  if (usedNonces.includes(trimmed)) {
    return {
      ok: false,
      message: 'Este QR Code já foi utilizado anteriormente (proteção antifraude).',
    };
  }

  // Anti-fraud: 1 check-in per venue per calendar day
  const today = new Date().toISOString().slice(0, 10);
  const txs = getPointTransactions();
  const alreadyCheckedInToday = txs.some(
    (tx) =>
      tx.origin === 'checkin_qr' &&
      tx.experience_id === experienceId &&
      tx.created_at.slice(0, 10) === today
  );
  if (alreadyCheckedInToday) {
    return {
      ok: false,
      message: 'Você já realizou check-in neste estabelecimento hoje (limite diário atingido).',
    };
  }

  const tx: PointTransaction = {
    id: generateUUID(),
    type: 'CREDIT',
    amount: 50,
    origin: 'checkin_qr',
    description: `Check-in QR validado em ${experienceName}`,
    experience_id: experienceId,
    experience_name: experienceName,
    qr_nonce: trimmed,
    created_at: new Date().toISOString(),
  };

  localStorage.setItem(KEYS.POINTS, JSON.stringify([tx, ...txs]));
  localStorage.setItem(KEYS.QR_USED_NONCES, JSON.stringify([...usedNonces, trimmed]));

  addNotification({
    channel: 'internal',
    type: 'reward',
    title: '+50 Rio Points creditados!',
    message: `Check-in validado em ${experienceName}. Avaliação Verificada liberada.`,
  });

  return {
    ok: true,
    message: '+50 RP creditados e Avaliação Verificada liberada!',
    transaction: tx,
  };
}

export function creditVerifiedReview(
  experienceId: string,
  experienceName: string
): { ok: boolean; message: string } {
  if (!hasValidatedCheckinForVenue(experienceId)) {
    return {
      ok: false,
      message: 'Avaliação Verificada só pode ser liberada após um check-in validado via QR Code.',
    };
  }

  const txs = getPointTransactions();
  const alreadyReviewed = txs.some(
    (tx) => tx.origin === 'verified_review' && tx.experience_id === experienceId
  );
  if (alreadyReviewed) {
    return { ok: false, message: 'Você já recebeu os pontos de avaliação verificada para este local.' };
  }

  const tx: PointTransaction = {
    id: generateUUID(),
    type: 'CREDIT',
    amount: 30,
    origin: 'verified_review',
    description: `Avaliação Verificada publicada para ${experienceName}`,
    experience_id: experienceId,
    experience_name: experienceName,
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(KEYS.POINTS, JSON.stringify([tx, ...txs]));
  return { ok: true, message: '+30 RP creditados pela Avaliação Verificada!' };
}

export function creditReferralBonus(friendLabel: string): { ok: boolean; message: string } {
  const txs = getPointTransactions();
  const tx: PointTransaction = {
    id: generateUUID(),
    type: 'CREDIT',
    amount: 200,
    origin: 'referral',
    description: `Indicação validada: ${friendLabel} completou o 1º check-in (Demo)`,
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(KEYS.POINTS, JSON.stringify([tx, ...txs]));
  return { ok: true, message: '+200 RP creditados por indicação!' };
}

export function redeemReward(rewardTitle: string, cost: number): { ok: boolean; message: string } {
  const balance = getPointsBalance();
  if (balance < cost) {
    return { ok: false, message: `Saldo insuficiente (${balance} RP disponíveis, necessário ${cost} RP).` };
  }
  const txs = getPointTransactions();
  const tx: PointTransaction = {
    id: generateUUID(),
    type: 'REDEEM',
    amount: cost,
    origin: 'reward_redeem',
    description: `Resgate: ${rewardTitle}`,
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(KEYS.POINTS, JSON.stringify([tx, ...txs]));
  return { ok: true, message: `Recompensa "${rewardTitle}" resgatada com sucesso!` };
}

// --- Reservations ---
export function getReservations(): ReservationRequest[] {
  try {
    const raw = localStorage.getItem(KEYS.RESERVATIONS);
    return raw ? (JSON.parse(raw) as ReservationRequest[]) : [];
  } catch {
    return [];
  }
}

export function createReservationRequest(
  payload: Omit<ReservationRequest, 'id' | 'status' | 'created_at'>
): ReservationRequest {
  const req: ReservationRequest = {
    ...payload,
    id: generateUUID(),
    status: 'PENDING_CONFIRMATION',
    created_at: new Date().toISOString(),
  };
  const list = getReservations();
  localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify([req, ...list]));

  addNotification({
    channel: payload.whatsapp_reminder ? 'whatsapp' : 'internal',
    type: 'reservation',
    title: `Solicitação registrada: ${payload.experience_name}`,
    message: `${payload.date} às ${payload.time} (${payload.guests} pessoas) — Aguardando confirmação do estabelecimento.`,
  });

  return req;
}

export function cancelReservation(id: string): ReservationRequest[] {
  const next = getReservations().map((r) =>
    r.id === id ? { ...r, status: 'CANCELLED' as const } : r
  );
  localStorage.setItem(KEYS.RESERVATIONS, JSON.stringify(next));
  return next;
}

// --- Notifications ---
export function getNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(KEYS.NOTIFICATIONS);
    return raw ? (JSON.parse(raw) as NotificationItem[]) : [];
  } catch {
    return [];
  }
}

export function addNotification(
  payload: Omit<NotificationItem, 'id' | 'read' | 'created_at'>
): NotificationItem {
  const item: NotificationItem = {
    ...payload,
    id: generateUUID(),
    read: false,
    created_at: new Date().toISOString(),
  };
  const list = getNotifications();
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify([item, ...list].slice(0, 30)));
  return item;
}

export function markAllNotificationsRead(): NotificationItem[] {
  const next = getNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(next));
  return next;
}

// --- Group Voting ---
export function getGroupVoteSession(): GroupVoteSession | null {
  try {
    const raw = localStorage.getItem(KEYS.GROUP_VOTES);
    return raw ? (JSON.parse(raw) as GroupVoteSession) : null;
  } catch {
    return null;
  }
}

export function saveGroupVoteSession(session: GroupVoteSession): void {
  localStorage.setItem(KEYS.GROUP_VOTES, JSON.stringify(session));
}

// --- Demonstrative Club Offers & Group Drops (Clearly labeled DEMONSTRATIVE) ---
export const DEMONSTRATIVE_CLUB_OFFERS: ClubOffer[] = [
  {
    id: 'club-1',
    experience_id: '11111111-1111-4111-8111-000000000009',
    experience_name: 'Bráz Pizzaria',
    neighborhood: 'Jardim Botânico',
    title: '2º Chope ou Sobremesa Cortesia no Jantar',
    benefit_type: 'FREE_DESSERT',
    discount_label: 'Cortesia Membro',
    valid_window: 'Terça a Quinta · 18h30–20h30',
    reliability: 'DEMONSTRATIVE',
  },
  {
    id: 'club-2',
    experience_id: '11111111-1111-4111-8111-000000000004',
    experience_name: 'CT Boucherie',
    neighborhood: 'Leblon',
    title: 'Horário Off-Peak: 30% OFF no Menu Executivo',
    benefit_type: 'OFF_PEAK',
    discount_label: '30% OFF',
    valid_window: 'Seg a Qui · 12h–14h e 18h–19h30',
    reliability: 'DEMONSTRATIVE',
  },
  {
    id: 'club-3',
    experience_id: '11111111-1111-4111-8111-000000000010',
    experience_name: 'Confeitaria Colombo',
    neighborhood: 'Centro',
    title: '2 por 1 no Chá da Tarde Clássico',
    benefit_type: '2_FOR_1',
    discount_label: '2 por 1',
    valid_window: 'Segunda a Sexta · 15h–17h',
    reliability: 'DEMONSTRATIVE',
  },
];

export function getGroupDrops(): GroupDrop[] {
  const defaults: GroupDrop[] = [
    {
      id: 'drop-1',
      experience_id: '11111111-1111-4111-8111-000000000011',
      experience_name: 'Gero Ipanema',
      neighborhood: 'Ipanema',
      title: 'Noite Italiana Especial — Menu em 3 Tempos (30% OFF)',
      discount_label: '30% OFF',
      current_participants: 34,
      target_participants: 50,
      deadline_label: 'Expira em 48h (Demo)',
      joined: false,
      reliability: 'DEMONSTRATIVE',
    },
    {
      id: 'drop-2',
      experience_id: '11111111-1111-4111-8111-000000000006',
      experience_name: 'Bar Urca',
      neighborhood: 'Urca',
      title: 'Combo Mureta Pôr do Sol para 2 pessoas (25% OFF)',
      discount_label: '25% OFF',
      current_participants: 42,
      target_participants: 50,
      deadline_label: 'Restam 8 adesões (Demo)',
      joined: false,
      reliability: 'DEMONSTRATIVE',
    },
  ];
  try {
    const raw = localStorage.getItem(KEYS.DROPS);
    if (!raw) return defaults;
    return JSON.parse(raw) as GroupDrop[];
  } catch {
    return defaults;
  }
}

export function toggleJoinGroupDrop(dropId: string): GroupDrop[] {
  const current = getGroupDrops();
  const next = current.map((d) => {
    if (d.id !== dropId) return d;
    const joined = !d.joined;
    return {
      ...d,
      joined,
      current_participants: joined ? d.current_participants + 1 : Math.max(0, d.current_participants - 1),
    };
  });
  localStorage.setItem(KEYS.DROPS, JSON.stringify(next));
  return next;
}

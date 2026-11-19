import type { ReservationRequest } from '../types/experience';
import { generateUUID } from '../utils/slug';
import { getUserProfileIdentity } from './authService';
import { getCanonicalAppBaseUrl, getMyReferralCode } from './referralStore';

const TABLE_RSVPS_KEY = 'borario_table_rsvps_v1';

export interface TableInvitePayload {
  reservationId: string;
  venueId: string;
  venueName: string;
  neighborhood: string;
  date: string;
  time: string;
  hostName: string;
  offeringTitle?: string;
  referralCode?: string;
}

export interface TableRsvpRecord {
  id: string;
  reservation_id: string;
  guest_name: string;
  confirmed_at: string;
  has_account: boolean;
}

export function buildTableInviteUrl(res: ReservationRequest): string {
  const base = getCanonicalAppBaseUrl();
  const identity = getUserProfileIdentity();
  const hostName =
    identity.display_name && identity.display_name !== 'Explorador Carioca'
      ? identity.display_name
      : 'Um amigo';
  const refCode = getMyReferralCode();

  const params = new URLSearchParams();
  params.set('r', res.id);
  params.set('v', res.experience_id);
  params.set('vn', res.experience_name);
  params.set('nb', res.neighborhood);
  params.set('d', res.date);
  params.set('t', res.time);
  params.set('h', hostName);
  if (res.offering_title) {
    params.set('o', res.offering_title);
  }
  if (refCode) {
    params.set('ref', refCode);
  }
  return `${base}/mesa?${params.toString()}`;
}

export function parseTableInviteFromSearch(search: string): TableInvitePayload | null {
  try {
    const params = new URLSearchParams(search);
    const venueName = params.get('vn')?.trim();
    const date = params.get('d')?.trim();
    const time = params.get('t')?.trim();
    if (!venueName || !date || !time) return null;

    return {
      reservationId: params.get('r')?.trim() || 'mesa-convite',
      venueId: params.get('v')?.trim() || '',
      venueName,
      neighborhood: params.get('nb')?.trim() || 'Rio de Janeiro',
      date,
      time,
      hostName: params.get('h')?.trim() || 'Um amigo',
      offeringTitle: params.get('o')?.trim() || undefined,
      referralCode: params.get('ref')?.trim().toUpperCase() || undefined,
    };
  } catch {
    return null;
  }
}

export function getTableRsvps(reservationId?: string): TableRsvpRecord[] {
  try {
    const raw = localStorage.getItem(TABLE_RSVPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TableRsvpRecord[];
    if (!Array.isArray(parsed)) return [];
    return reservationId
      ? parsed.filter((item) => item.reservation_id === reservationId)
      : parsed;
  } catch {
    return [];
  }
}

export function confirmTableRsvpWithoutSignup(params: {
  reservationId: string;
  guestName: string;
  hasAccount?: boolean;
}): TableRsvpRecord {
  const cleanName = params.guestName.trim() || 'Convidado';
  const existing = getTableRsvps();
  const record: TableRsvpRecord = {
    id: generateUUID(),
    reservation_id: params.reservationId,
    guest_name: cleanName,
    confirmed_at: new Date().toISOString(),
    has_account: Boolean(params.hasAccount),
  };
  localStorage.setItem(TABLE_RSVPS_KEY, JSON.stringify([record, ...existing].slice(0, 100)));
  return record;
}

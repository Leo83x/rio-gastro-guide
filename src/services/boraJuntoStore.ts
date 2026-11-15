import type { BoraJuntoPlan } from '../types/growth';
import { generateUUID } from '../utils/slug';
import { getUserProfileIdentity } from './authService';
import { isValidUuid, supabase } from './supabaseClient';

const BORAJUNTO_STORAGE_KEY = 'borario_borajunto_plans_v1';

export function getBoraJuntoPlans(): BoraJuntoPlan[] {
  try {
    const raw = localStorage.getItem(BORAJUNTO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BoraJuntoPlan[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createBoraJuntoPlan(payload: {
  title: string;
  plannedDate: string;
  plannedTime: string;
  guests: number;
  invitedCircleIds: string[];
  invitedCircleNames: string[];
  invitedConnectionNames: string[];
  candidateVenueIds: string[];
  itineraryId?: string;
}): { plan: BoraJuntoPlan; all: BoraJuntoPlan[] } {
  const now = new Date().toISOString();
  const plan: BoraJuntoPlan = {
    id: generateUUID(),
    title: payload.title.trim() || 'BoraJunto no Rio',
    planned_date: payload.plannedDate || now.slice(0, 10),
    planned_time: payload.plannedTime || '19:30',
    guests: Math.max(1, payload.guests || 2),
    invited_circle_ids: payload.invitedCircleIds,
    invited_circle_names: payload.invitedCircleNames,
    invited_connection_names: payload.invitedConnectionNames,
    candidate_venue_ids: payload.candidateVenueIds,
    itinerary_id: payload.itineraryId,
    created_at: now,
    updated_at: now,
  };

  const next = [plan, ...getBoraJuntoPlans()].slice(0, 30);
  localStorage.setItem(BORAJUNTO_STORAGE_KEY, JSON.stringify(next));

  const me = getUserProfileIdentity();
  if (supabase && isValidUuid(me.id)) {
    void supabase
      .from('borajunto_plans')
      .upsert({
        id: plan.id,
        owner_id: me.id,
        title: plan.title,
        planned_date: plan.planned_date,
        planned_time: plan.planned_time,
        guests: plan.guests,
        invited_circle_ids: plan.invited_circle_ids.filter((id) => isValidUuid(id)),
        candidate_venue_ids: plan.candidate_venue_ids.filter((id) => isValidUuid(id)),
        created_at: plan.created_at,
        updated_at: plan.updated_at,
      })
      .then(() => undefined, () => undefined);
  }

  return { plan, all: next };
}

export function markBoraJuntoSelectedVenue(
  planId: string,
  venueId: string
): BoraJuntoPlan[] {
  const now = new Date().toISOString();
  const next = getBoraJuntoPlans().map((p) =>
    p.id === planId ? { ...p, selected_venue_id: venueId, updated_at: now } : p
  );
  localStorage.setItem(BORAJUNTO_STORAGE_KEY, JSON.stringify(next));

  const me = getUserProfileIdentity();
  if (supabase && isValidUuid(me.id) && isValidUuid(planId) && isValidUuid(venueId)) {
    void supabase
      .from('borajunto_plans')
      .update({ selected_venue_id: venueId, updated_at: now })
      .eq('id', planId)
      .then(() => undefined, () => undefined);
  }

  return next;
}

export function recordBoraJuntoVoteToCloud(
  planId: string | undefined,
  venueId: string,
  voteValue: 1 | -1
): void {
  if (!planId || !isValidUuid(planId) || !isValidUuid(venueId)) return;
  const me = getUserProfileIdentity();
  if (supabase && isValidUuid(me.id)) {
    void supabase
      .from('borajunto_votes')
      .upsert({
        plan_id: planId,
        voter_user_id: me.id,
        venue_id: venueId,
        vote_value: voteValue,
      })
      .then(() => undefined, () => undefined);
  }
}

export function deleteBoraJuntoPlan(planId: string): BoraJuntoPlan[] {
  const next = getBoraJuntoPlans().filter((p) => p.id !== planId);
  localStorage.setItem(BORAJUNTO_STORAGE_KEY, JSON.stringify(next));
  return next;
}

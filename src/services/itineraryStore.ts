import type { SavedItinerary } from '../types/experience';
import { generateUUID } from '../utils/slug';

const ITINERARY_STORAGE_KEY = 'borario_saved_itineraries_v1';

export function getSavedItineraries(): SavedItinerary[] {
  try {
    const raw = localStorage.getItem(ITINERARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedItinerary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveItinerary(
  payload: Omit<SavedItinerary, 'id' | 'created_at'>
): SavedItinerary[] {
  const entry: SavedItinerary = {
    ...payload,
    id: generateUUID(),
    created_at: new Date().toISOString(),
  };
  const next = [entry, ...getSavedItineraries()];
  localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteSavedItinerary(id: string): SavedItinerary[] {
  const next = getSavedItineraries().filter((i) => i.id !== id);
  localStorage.setItem(ITINERARY_STORAGE_KEY, JSON.stringify(next));
  return next;
}

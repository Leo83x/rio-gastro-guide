import type {
  ConfidenceLevel,
  DataSource,
  OperationalStatus,
  Restaurant,
  ValidationStatus,
} from '../types/restaurant';
import { slugify } from '../utils/slug';

export interface ValidationInput {
  data_source: DataSource;
  operational_status?: OperationalStatus;
  source_updated_at?: string;
  address?: string;
  phone?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  is_claimed?: boolean;
  explicit_closed?: boolean;
}

export interface ValidationOutput {
  validation_status: ValidationStatus;
  operational_status: OperationalStatus;
  confidence_level: ConfidenceLevel;
  last_verified_at: string;
}

export function evaluateRestaurantValidation(input: ValidationInput): ValidationOutput {
  const now = new Date().toISOString();

  if (input.explicit_closed || input.operational_status === 'FECHADO') {
    return {
      validation_status: 'FECHADO/INVÁLIDO',
      operational_status: 'FECHADO',
      confidence_level: 'ALTA',
      last_verified_at: now,
    };
  }

  let score = 0;
  if (input.address && input.address.length > 10 && !input.address.startsWith('Rio de Janeiro')) {
    score += 1;
  }
  if (input.phone) score += 1;
  if (input.website) score += 1;
  if (input.latitude && input.longitude) score += 1;

  if (input.source_updated_at) {
    const year = new Date(input.source_updated_at).getFullYear();
    if (year >= 2023) score += 2;
    else if (year >= 2020) score += 1;
  }

  // Regra: nunca considerar automaticamente CONFIRMADO apenas por constar como operacional
  // em uma consulta externa isolada. Somente proprietário/reivindicação ou revisão manual confirma.
  let validation_status: ValidationStatus = 'PENDENTE';
  if (input.data_source === 'owner_submitted' || input.is_claimed) {
    validation_status = 'CONFIRMADO';
  }

  const operational_status: OperationalStatus =
    input.operational_status || 'DESCONHECIDO';

  const confidence_level: ConfidenceLevel =
    score >= 4 ? 'ALTA' : score >= 2 ? 'MÉDIA' : 'BAIXA';

  return {
    validation_status,
    operational_status,
    confidence_level,
    last_verified_at: now,
  };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function findDuplicateInDatabase(
  candidate: Omit<Restaurant, 'id'>,
  existing: Restaurant[]
): Restaurant | null {
  const candSlug = candidate.slug || slugify(`${candidate.name}-${candidate.neighborhood}`);
  const candName = candidate.name.trim().toLowerCase();

  for (const item of existing) {
    if (candidate.external_id && item.external_id === candidate.external_id) {
      return item;
    }
    if (item.slug === candSlug) {
      return item;
    }
    if (item.name.trim().toLowerCase() === candName) {
      const dist = haversineMeters(
        candidate.latitude,
        candidate.longitude,
        item.latitude,
        item.longitude
      );
      if (dist < 150) {
        return item;
      }
    }
  }
  return null;
}

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  openstreetmap: 'OpenStreetMap (ODbL)',
  google_places_api: 'Google Places API (Oficial)',
  commercial_provider: 'Provedor Comercial Licenciado',
  official_website: 'Site Oficial do Estabelecimento',
  owner_submitted: 'Enviado pelo Proprietário',
  curated_seed: 'Curadoria Rio Gastro Guide',
  csv_import: 'Importação CSV / JSON',
};

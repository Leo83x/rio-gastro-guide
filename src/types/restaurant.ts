export type RestaurantCategory =
  | 'Italiano'
  | 'Japonês'
  | 'Boteco Carioca'
  | 'Churrascaria'
  | 'Bistrô'
  | 'Frutos do Mar'
  | 'Pizzaria'
  | 'Cafeteria'
  | 'Brasileiro'
  | 'Hamburgueria'
  | 'Contemporâneo';

export type PriceRange = '$' | '$$' | '$$$' | '$$$$';

export type DataSource =
  | 'openstreetmap'
  | 'google_places_api'
  | 'outscraper_api'
  | 'commercial_provider'
  | 'official_website'
  | 'owner_submitted'
  | 'curated_seed'
  | 'csv_import';

export type ValidationStatus = 'CONFIRMADO' | 'PENDENTE' | 'FECHADO/INVÁLIDO';

export type OperationalStatus = 'OPERACIONAL' | 'DESCONHECIDO' | 'FECHADO';

export type ConfidenceLevel = 'ALTA' | 'MÉDIA' | 'BAIXA';

export type ImageOrigin =
  | 'owner_authorized'
  | 'establishment_authorized'
  | 'commercial_licensed'
  | 'illustrative_editorial'
  | 'none';

export interface Restaurant {
  id: string;
  external_id: string;
  name: string;
  slug: string;
  category: RestaurantCategory;
  neighborhood: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  cover_image: string;
  gallery: string[];
  rating: number;
  reviews_count: number;
  price_range: PriceRange;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  website?: string;
  opening_hours?: string;
  is_claimed: boolean;
  is_featured: boolean;
  created_at?: string;
  source_updated_at?: string;

  // Procedência, validação e licenciamento (retrocompatível)
  data_source?: DataSource;
  is_redistribution_authorized?: boolean;
  validation_status?: ValidationStatus;
  operational_status?: OperationalStatus;
  confidence_level?: ConfidenceLevel;
  last_verified_at?: string;
  rating_source?: 'authorized_source' | 'seed_editorial' | 'none';
  image_origin?: ImageOrigin;
  image_license?: string;
  has_real_photo?: boolean;

  // Extensão unificada de experiências (Superapp)
  macro_category?: import('./experience').MacroCategory;
  moment_tags?: import('./experience').MomentMode[];
  attributes?: import('./experience').ExperienceAttributes;
  data_reliability?: import('./experience').DataReliability;
}

export interface ClaimRequest {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  owner_name: string;
  role: string;
  whatsapp: string;
  cnpj?: string;
  created_at: string;
}

export type StorageMode = 'supabase' | 'local';

export interface UpsertResult {
  inserted: number;
  updated: number;
  total: number;
}

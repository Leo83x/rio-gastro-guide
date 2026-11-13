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

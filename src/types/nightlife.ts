export type NightlifeSubArea =
  | 'SAMBA_PAGODE'
  | 'FESTAS_BALADAS'
  | 'SHOWS'
  | 'ROOFTOPS_EXPERIENCIAS';

export type NightlifeCurationStatus =
  | 'PENDENTE'
  | 'PROGRAMADO'
  | 'PUBLICADO'
  | 'REJEITADO'
  | 'CANCELADO'
  | 'EXPIRADO';

export type NightlifeAvailabilityStatus =
  | 'DISPONIVEL'
  | 'ULTIMOS_INGRESSOS'
  | 'ESGOTADO'
  | 'LISTA_AMIGA'
  | 'PORTA'
  | 'GRATUITO';

export type NightlifeSourcePlatform =
  | 'SYMPLA'
  | 'INGRESSE'
  | 'SHOTGUN'
  | 'EVENTBRITE'
  | 'EVENTIM'
  | 'TICKETMASTER'
  | 'TICKET360'
  | 'TA_SENDO'
  | 'RIO_NA_NOITE'
  | 'AGENDA_RIO'
  | 'PARTNER_PORTAL'
  | 'CSV_JSON'
  | 'MANUAL_ADMIN';

export type NightlifeImageOrigin =
  | 'PARTNER_AUTHORIZED'
  | 'PRODUCER_AUTHORIZED'
  | 'PRESS_KIT_LICENSED'
  | 'ILLUSTRATIVE_CATEGORY_FALLBACK'
  | 'NONE';

export type NightlifeDateFilter =
  | 'ALL'
  | 'TODAY'
  | 'TOMORROW'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'
  | 'FREE';

export interface AlternateTicketLink {
  source_platform: NightlifeSourcePlatform;
  ticket_url: string;
  price_label?: string;
  last_seen_at: string;
}

export interface NightlifeEvent {
  id: string;
  external_key: string;
  dedup_hash: string;
  source_platform: NightlifeSourcePlatform;
  source_external_id?: string;
  source_url?: string;
  alternate_ticket_urls?: AlternateTicketLink[];

  curation_status: NightlifeCurationStatus;
  scheduled_publish_at?: string;
  is_featured: boolean;
  featured_rank?: number;
  approved_by_label?: string;
  approved_at?: string;
  rejection_reason?: string;
  last_verified_at: string;

  sub_area: NightlifeSubArea;
  music_genres: string[];
  moment_tags: string[];
  age_rating: string;

  venue_id?: string;
  venue_name: string;
  neighborhood: string;
  address: string;
  latitude?: number;
  longitude?: number;

  event_date: string; // YYYY-MM-DD (America/Sao_Paulo)
  start_time: string; // HH:mm
  doors_open_time?: string;
  end_time?: string;
  starts_at: string; // ISO
  ends_at: string; // ISO
  recurrence_note?: string;

  is_free: boolean;
  price_min_brl?: number;
  price_max_brl?: number;
  price_display_label: string;
  ticket_url?: string;
  availability_status: NightlifeAvailabilityStatus;
  lineup: string[];

  title: string;
  slug: string;
  short_summary: string;
  cover_image: string;
  image_origin: NightlifeImageOrigin;
  image_license_note?: string;
  is_demonstrative: boolean;

  created_at: string;
  updated_at: string;
}

export type NightlifeEventDraft = Omit<
  NightlifeEvent,
  | 'id'
  | 'dedup_hash'
  | 'slug'
  | 'created_at'
  | 'updated_at'
  | 'curation_status'
  | 'last_verified_at'
> & {
  id?: string;
  curation_status?: NightlifeCurationStatus;
};

export interface NightlifeCompletenessCheck {
  complete: boolean;
  missing_fields: string[];
  warnings: string[];
}

export interface NightlifeIngestionRun {
  id: string;
  source_code: string;
  source_platform: NightlifeSourcePlatform;
  trigger_type: 'MANUAL' | 'CRON' | 'PARTNER_SUBMIT';
  fetched_count: number;
  queued_pending_count: number;
  deduped_count: number;
  updated_count: number;
  expired_count: number;
  error_count: number;
  summary: string;
  created_at: string;
}

export const NIGHTLIFE_SUBAREA_META: Record<
  NightlifeSubArea,
  {
    label: string;
    shortLabel: string;
    description: string;
    defaultGenres: string[];
    fallbackTint: string;
  }
> = {
  SAMBA_PAGODE: {
    label: 'Samba e pagode',
    shortLabel: 'Samba e pagode',
    description: 'Rodas de samba, terreiros musicais, gafieiras e pagodes pela cidade.',
    defaultGenres: ['Samba', 'Pagode', 'MPB'],
    fallbackTint: 'from-[#8B3E16] via-[#C65B25] to-[#123B56]',
  },
  FESTAS_BALADAS: {
    label: 'Festas e baladas',
    shortLabel: 'Festas e baladas',
    description: 'Pistas de música eletrônica, funk, afrobeat, disco e coletivos noturnos.',
    defaultGenres: ['Eletrônico', 'Funk', 'House'],
    fallbackTint: 'from-[#2A1B4E] via-[#562BB8] to-[#0D1E30]',
  },
  SHOWS: {
    label: 'Shows',
    shortLabel: 'Shows',
    description: 'Apresentações ao vivo em casas de show, palcos históricos e festivais.',
    defaultGenres: ['MPB', 'Rock', 'Rap'],
    fallbackTint: 'from-[#123B56] via-[#1C5579] to-[#0B1B2B]',
  },
  ROOFTOPS_EXPERIENCIAS: {
    label: 'Rooftops e experiências',
    shortLabel: 'Rooftops e experiências',
    description: 'Terraços, sunset sessions, audições de vinil, bares musicais e experiências.',
    defaultGenres: ['Jazz', 'Lounge', 'Sunset'],
    fallbackTint: 'from-[#1D4E42] via-[#2C6B5B] to-[#0D1E30]',
  },
};

export const NIGHTLIFE_SOURCE_LABELS: Record<NightlifeSourcePlatform, string> = {
  SYMPLA: 'Sympla',
  INGRESSE: 'Ingresse',
  SHOTGUN: 'Shotgun',
  EVENTBRITE: 'Eventbrite',
  EVENTIM: 'Eventim',
  TICKETMASTER: 'Ticketmaster',
  TICKET360: 'Ticket360',
  TA_SENDO: 'Tá Sendo',
  RIO_NA_NOITE: 'Rio na Noite',
  AGENDA_RIO: 'Agenda Rio',
  PARTNER_PORTAL: 'Estabelecimento Parceiro',
  CSV_JSON: 'Lote CSV / JSON',
  MANUAL_ADMIN: 'Cadastro Curatorial Admin',
};

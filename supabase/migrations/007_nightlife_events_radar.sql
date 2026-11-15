-- BoraRio Superapp — Migração Incremental 007
-- Vertical "A Noite Carioca" & Motor "BoraRio Nightlife Radar"
-- Separa estruturalmente estabelecimentos permanentes (public.restaurants) de eventos
-- e programações noturnas temporárias (public.nightlife_events), garantindo curadoria
-- obrigatória antes da publicação pública e rastreabilidade de fontes e expirações.
-- Preserva integralmente 001 a 006.

-- ============================================================================
-- 1. EVENTOS TEMPORÁRIOS & PROGRAMAÇÃO NOTURNA (public.nightlife_events)
-- ============================================================================
create table if not exists public.nightlife_events (
  id uuid primary key default gen_random_uuid(),
  external_key text unique not null,
  dedup_hash text not null,
  source_platform text not null check (
    source_platform in (
      'SYMPLA',
      'INGRESSE',
      'SHOTGUN',
      'EVENTBRITE',
      'EVENTIM',
      'TICKETMASTER',
      'TICKET360',
      'TA_SENDO',
      'RIO_NA_NOITE',
      'AGENDA_RIO',
      'PARTNER_PORTAL',
      'CSV_JSON',
      'MANUAL_ADMIN'
    )
  ),
  source_external_id text,
  source_url text,
  alternate_ticket_urls jsonb not null default '[]'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,

  -- Curadoria e ciclo de vida (nunca auto-publica evento capturado externamente)
  curation_status text not null default 'PENDENTE' check (
    curation_status in ('PENDENTE', 'PROGRAMADO', 'PUBLICADO', 'REJEITADO', 'CANCELADO', 'EXPIRADO')
  ),
  scheduled_publish_at timestamptz,
  is_featured boolean not null default false,
  featured_rank integer,
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_label text,
  approved_at timestamptz,
  rejection_reason text,
  last_verified_at timestamptz not null default now(),

  -- Classificação noturna
  sub_area text not null check (
    sub_area in ('SAMBA_PAGODE', 'FESTAS_BALADAS', 'SHOWS', 'ROOFTOPS_EXPERIENCIAS')
  ),
  music_genres text[] not null default '{}',
  moment_tags text[] not null default '{}',
  age_rating text not null default '18+',

  -- Local e vínculo opcional com estabelecimento permanente (public.restaurants)
  venue_id uuid references public.restaurants(id) on delete set null,
  venue_name text not null,
  neighborhood text not null,
  address text not null default '',
  latitude double precision,
  longitude double precision,

  -- Janela temporal
  event_date date not null,
  start_time text not null,
  doors_open_time text,
  end_time text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  recurrence_note text,

  -- Ingressos, preços e disponibilidade (sem cobrança dentro do app)
  is_free boolean not null default false,
  price_min_brl numeric(10,2) check (price_min_brl is null or price_min_brl >= 0),
  price_max_brl numeric(10,2) check (price_max_brl is null or price_max_brl >= 0),
  price_display_label text not null default 'Consultar valores na fonte oficial',
  ticket_url text,
  availability_status text not null default 'DISPONIVEL' check (
    availability_status in ('DISPONIVEL', 'ULTIMOS_INGRESSOS', 'ESGOTADO', 'LISTA_AMIGA', 'PORTA', 'GRATUITO')
  ),
  lineup text[] not null default '{}',

  -- Conteúdo editorial próprio e mídia licenciada/autorizada
  title text not null,
  slug text not null,
  short_summary text not null default '',
  cover_image text not null default '',
  image_origin text not null default 'NONE' check (
    image_origin in (
      'PARTNER_AUTHORIZED',
      'PRODUCER_AUTHORIZED',
      'PRESS_KIT_LICENSED',
      'ILLUSTRATIVE_CATEGORY_FALLBACK',
      'NONE'
    )
  ),
  image_license_note text,
  is_demonstrative boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nightlife_events_public_agenda
  on public.nightlife_events (curation_status, event_date, sub_area);

create index if not exists idx_nightlife_events_dedup_hash
  on public.nightlife_events (dedup_hash);

create index if not exists idx_nightlife_events_venue
  on public.nightlife_events (venue_id)
  where venue_id is not null;

-- ============================================================================
-- 2. FONTES DE INGESTÃO & HISTÓRICO DE EXECUÇÕES DO RADAR
-- ============================================================================
create table if not exists public.nightlife_ingestion_sources (
  id uuid primary key default gen_random_uuid(),
  source_code text unique not null,
  display_name text not null,
  source_platform text not null,
  mode text not null check (mode in ('API', 'URL_PARSER', 'BATCH_FILE', 'PARTNER_DIRECT')),
  is_enabled boolean not null default true,
  last_run_at timestamptz,
  last_status text not null default 'IDLE' check (last_status in ('IDLE', 'SUCCESS', 'PARTIAL', 'ERROR')),
  last_message text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.nightlife_ingestion_sources (source_code, display_name, source_platform, mode, last_message)
values
  ('sympla_api', 'Sympla Public API', 'SYMPLA', 'API', 'Pronta para sincronização com s_token.'),
  ('ingresse_api', 'Ingresse Partner API', 'INGRESSE', 'API', 'Pronta para sincronização com chave Ingresse.'),
  ('url_extractor', 'Extrator por URL Oficial', 'SYMPLA', 'URL_PARSER', 'Suporta Sympla, Ingresse, Shotgun, Eventbrite, Eventim e casas do Rio.'),
  ('batch_csv_json', 'Importador em Lote CSV / JSON', 'CSV_JSON', 'BATCH_FILE', 'Mapeamento automático de agenda noturna em lote.'),
  ('partner_portal', 'Envio Direto de Casas Parceiras', 'PARTNER_PORTAL', 'PARTNER_DIRECT', 'Casas parceiras submetem programação direto para fila de curadoria.')
on conflict (source_code) do nothing;

create table if not exists public.nightlife_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_code text not null,
  source_platform text not null,
  trigger_type text not null default 'MANUAL' check (trigger_type in ('MANUAL', 'CRON', 'PARTNER_SUBMIT')),
  fetched_count integer not null default 0,
  queued_pending_count integer not null default 0,
  deduped_count integer not null default 0,
  updated_count integer not null default 0,
  expired_count integer not null default 0,
  error_count integer not null default 0,
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================================
alter table public.nightlife_events enable row level security;
alter table public.nightlife_ingestion_sources enable row level security;
alter table public.nightlife_ingestion_runs enable row level security;

-- Público enxerga exclusivamente eventos PUBLICADO ainda vigentes (ends_at >= now())
drop policy if exists "Agenda noturna publica apenas eventos publicados vigentes" on public.nightlife_events;
create policy "Agenda noturna publica apenas eventos publicados vigentes" on public.nightlife_events
  for select using (
    (curation_status = 'PUBLICADO' and ends_at >= now())
    or (
      venue_id is not null and exists (
        select 1 from public.partner_memberships pm
        where pm.restaurant_id = nightlife_events.venue_id
          and pm.user_id = auth.uid()
          and pm.status = 'APPROVED'
      )
    )
  );

-- Parceiro aprovado pode submeter programação da própria casa apenas como PENDENTE
drop policy if exists "Parceiro aprovado envia evento pendente para curadoria" on public.nightlife_events;
create policy "Parceiro aprovado envia evento pendente para curadoria" on public.nightlife_events
  for insert with check (
    curation_status = 'PENDENTE'
    and venue_id is not null
    and exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = nightlife_events.venue_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

drop policy if exists "Parceiro aprovado atualiza rascunho pendente da casa" on public.nightlife_events;
create policy "Parceiro aprovado atualiza rascunho pendente da casa" on public.nightlife_events
  for update using (
    curation_status = 'PENDENTE'
    and venue_id is not null
    and exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = nightlife_events.venue_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  )
  with check (curation_status = 'PENDENTE');

drop policy if exists "Fontes de ingestao leitura autenticada" on public.nightlife_ingestion_sources;
create policy "Fontes de ingestao leitura autenticada" on public.nightlife_ingestion_sources
  for select using (auth.role() = 'authenticated');

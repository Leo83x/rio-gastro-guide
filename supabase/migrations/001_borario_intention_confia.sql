-- BoraRio Superapp — Schema PostgreSQL + Row Level Security (RLS)
-- Evolução: Inteligência de Intenção, Cofre de Intenções, Rede Confia, Roteiros, Bora Club e Passaporte Carioca
-- Compatível com Supabase Auth (auth.users) e preservação do catálogo existente (restaurants, claim_requests).

create extension if not exists "pgcrypto";

-- 1. Catálogo base preservado (caso ambiente Supabase seja inicializado do zero)
create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  external_id text unique not null,
  name text not null,
  slug text not null,
  category text not null,
  neighborhood text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  description text not null default '',
  cover_image text not null default '',
  gallery jsonb not null default '[]'::jsonb,
  rating double precision not null default 0,
  reviews_count integer not null default 0,
  price_range text not null default '$$',
  phone text,
  whatsapp text,
  instagram text,
  website text,
  opening_hours text,
  is_claimed boolean not null default false,
  is_featured boolean not null default false,
  data_source text,
  is_redistribution_authorized boolean default true,
  validation_status text default 'PENDENTE',
  operational_status text default 'DESCONHECIDO',
  confidence_level text default 'MÉDIA',
  last_verified_at timestamptz,
  rating_source text default 'none',
  image_origin text default 'none',
  image_license text,
  has_real_photo boolean default false,
  macro_category text default 'Gastronomia',
  moment_tags jsonb default '[]'::jsonb,
  attributes jsonb default '{}'::jsonb,
  data_reliability text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  restaurant_name text not null,
  owner_name text not null,
  role text not null,
  whatsapp text not null,
  cnpj text,
  created_at timestamptz not null default now()
);

-- 2. Perfil de Usuário & Consentimentos LGPD
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Explorador Carioca',
  avatar_initials text not null default 'EC',
  home_neighborhood text default 'Zona Sul',
  preferences jsonb not null default '{}'::jsonb,
  lgpd_consents jsonb not null default '{
    "location": false,
    "personalization": false,
    "whatsapp": false,
    "notifications": true,
    "calendar": false
  }'::jsonb,
  confia_privacy jsonb not null default '{
    "default_visibility": "PRIVATE_CIRCLES_ONLY",
    "allow_invites_by_code": true,
    "require_explicit_circle_approval": true,
    "auto_share_vault_to_feed": false,
    "show_verified_visit_badge": true
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Cofre de Intenções (STRICTLY PRIVATE: somente o dono acessa)
create table if not exists public.intent_vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  source_type text not null check (source_type in (
    'instagram_link', 'tiktok_link', 'youtube_link', 'web_link', 'screenshot', 'manual_note', 'catalog_bookmark'
  )),
  source_url text,
  image_storage_path text,
  notes text,
  category_tag text,
  neighborhood_tag text,
  moment_tag text,
  linked_venue_id uuid references public.restaurants(id) on delete set null,
  linked_venue_name text,
  status text not null default 'SAVED' check (status in ('SAVED', 'PLANNED', 'VISITED', 'ARCHIVED')),
  processing_status text not null default 'COMPLETED' check (processing_status in (
    'PROCESSING', 'COMPLETED', 'NEEDS_CONFIRMATION', 'UNIDENTIFIED', 'ERROR', 'UNAVAILABLE'
  )),
  processing_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Rede Confia: Círculos e Conexões Bilaterais de Confiança
create table if not exists public.trust_circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.trust_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REVOKED')),
  invite_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_self_connection check (requester_id <> addressee_id)
);

create table if not exists public.trust_circle_members (
  circle_id uuid not null references public.trust_circles(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (circle_id, member_user_id)
);

-- 5. Recomendações Voluntárias na Rede Confia (NUNCA feed público aberto)
create table if not exists public.confia_recommendations (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid references public.restaurants(id) on delete cascade,
  venue_name text not null,
  neighborhood text not null,
  category text not null,
  comment text not null,
  visibility_scope text not null default 'ALL_CONNECTIONS' check (visibility_scope in ('ALL_CONNECTIONS', 'SPECIFIC_CIRCLES')),
  circle_ids uuid[] not null default '{}',
  endorsement_origin text not null default 'PERSONAL_RECOMMENDATION' check (
    endorsement_origin in ('VERIFIED_CHECKIN', 'PERSONAL_RECOMMENDATION')
  ),
  verified_tx_id uuid,
  created_at timestamptz not null default now()
);

-- 6. Roteiros Salvos, Reservas, Resgates Bora Club e Ledger Rio Points
create table if not exists public.saved_itineraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  prompt text not null,
  rain_mode boolean not null default false,
  total_estimated_brl numeric not null default 0,
  sources_used text[] not null default '{}',
  steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  experience_id uuid references public.restaurants(id) on delete set null,
  experience_name text not null,
  neighborhood text not null,
  latitude double precision not null,
  longitude double precision not null,
  reservation_date date not null,
  reservation_time text not null,
  guests integer not null check (guests between 1 and 50),
  status text not null default 'PENDING_CONFIRMATION' check (status in ('PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED')),
  whatsapp_reminder boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.club_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  offer_id text not null,
  experience_id uuid references public.restaurants(id) on delete set null,
  experience_name text not null,
  offer_title text not null,
  discount_label text not null,
  voucher_code text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'USED', 'EXPIRED')),
  is_demonstrative boolean not null default true,
  redeemed_at timestamptz not null default now()
);

create table if not exists public.rio_point_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tx_type text not null check (tx_type in ('CREDIT', 'DEBIT', 'REDEEM', 'REVERSAL')),
  amount integer not null check (amount > 0),
  origin text not null,
  description text not null,
  experience_id uuid references public.restaurants(id) on delete set null,
  experience_name text,
  qr_nonce text unique,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) ESTRITO
-- ============================================================================
alter table public.restaurants enable row level security;
alter table public.claim_requests enable row level security;
alter table public.profiles enable row level security;
alter table public.intent_vault_items enable row level security;
alter table public.trust_circles enable row level security;
alter table public.trust_connections enable row level security;
alter table public.trust_circle_members enable row level security;
alter table public.confia_recommendations enable row level security;
alter table public.saved_itineraries enable row level security;
alter table public.reservations enable row level security;
alter table public.club_redemptions enable row level security;
alter table public.rio_point_transactions enable row level security;

-- Catálogo público de leitura
drop policy if exists "Catalogo publico leitura" on public.restaurants;
create policy "Catalogo publico leitura" on public.restaurants
  for select using (true);

-- Reivindicações: criação aberta para proprietários (sem expor leads a terceiros)
drop policy if exists "Inserir claim request" on public.claim_requests;
create policy "Inserir claim request" on public.claim_requests
  for insert with check (true);

-- Perfis: dono gerencia o próprio perfil; conexões aceitas leem nome/iniciais
drop policy if exists "Perfil proprio" on public.profiles;
create policy "Perfil proprio" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Perfil visivel para conexoes aceitas" on public.profiles;
create policy "Perfil visivel para conexoes aceitas" on public.profiles
  for select using (
    exists (
      select 1 from public.trust_connections tc
      where tc.status = 'ACCEPTED'
        and (
          (tc.requester_id = auth.uid() and tc.addressee_id = profiles.id)
          or (tc.addressee_id = auth.uid() and tc.requester_id = profiles.id)
        )
    )
  );

-- Cofre de Intenções: PRIVACIDADE ABSOLUTA (apenas o dono lê ou escreve)
drop policy if exists "Cofre estritamente pessoal" on public.intent_vault_items;
create policy "Cofre estritamente pessoal" on public.intent_vault_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Círculos de confiança
drop policy if exists "Circulos do proprietario" on public.trust_circles;
create policy "Circulos do proprietario" on public.trust_circles
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Conexoes envolvidas" on public.trust_connections;
create policy "Conexoes envolvidas" on public.trust_connections
  for all using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

drop policy if exists "Membros do circulo" on public.trust_circle_members;
drop policy if exists "Membros do circulo leitura" on public.trust_circle_members;
create policy "Membros do circulo leitura" on public.trust_circle_members
  for select using (
    exists (
      select 1 from public.trust_circles c
      where c.id = trust_circle_members.circle_id and c.owner_id = auth.uid()
    )
    or member_user_id = auth.uid()
  );

drop policy if exists "Membros do circulo escrita proprietario" on public.trust_circle_members;
create policy "Membros do circulo escrita proprietario" on public.trust_circle_members
  for all using (
    exists (
      select 1 from public.trust_circles c
      where c.id = trust_circle_members.circle_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trust_circles c
      where c.id = trust_circle_members.circle_id and c.owner_id = auth.uid()
    )
  );

-- Rede Confia Recomendações: somente autor OU conexão ACCEPTED respeitando circle_ids pertencentes ao autor
drop policy if exists "Rede Confia leitura privada" on public.confia_recommendations;
create policy "Rede Confia leitura privada" on public.confia_recommendations
  for select using (
    auth.uid() = author_id
    or (
      exists (
        select 1 from public.trust_connections tc
        where tc.status = 'ACCEPTED'
          and (
            (tc.requester_id = auth.uid() and tc.addressee_id = confia_recommendations.author_id)
            or (tc.addressee_id = auth.uid() and tc.requester_id = confia_recommendations.author_id)
          )
      )
      and (
        visibility_scope = 'ALL_CONNECTIONS'
        or exists (
          select 1
          from public.trust_circle_members tcm
          join public.trust_circles tc2 on tc2.id = tcm.circle_id
          where tcm.member_user_id = auth.uid()
            and tc2.owner_id = confia_recommendations.author_id
            and tcm.circle_id = any(confia_recommendations.circle_ids)
        )
      )
    )
  );

drop policy if exists "Rede Confia escrita apenas autor" on public.confia_recommendations;
create policy "Rede Confia escrita apenas autor" on public.confia_recommendations
  for insert with check (auth.uid() = author_id);

drop policy if exists "Rede Confia atualizacao/exclusao autor" on public.confia_recommendations;
create policy "Rede Confia atualizacao/exclusao autor" on public.confia_recommendations
  for delete using (auth.uid() = author_id);

-- Roteiros, Reservas, Bora Club e Rio Points: estritamente do usuário autenticado
drop policy if exists "Roteiros do usuario" on public.saved_itineraries;
create policy "Roteiros do usuario" on public.saved_itineraries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Reservas do usuario" on public.reservations;
create policy "Reservas do usuario" on public.reservations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Resgates Bora Club do usuario" on public.club_redemptions;
create policy "Resgates Bora Club do usuario" on public.club_redemptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Ledger Rio Points do usuario" on public.rio_point_transactions;
create policy "Ledger Rio Points do usuario" on public.rio_point_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

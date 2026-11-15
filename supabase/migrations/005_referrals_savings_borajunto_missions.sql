-- BoraRio Superapp — Migração Incremental 005
-- Fase 6 & 7: Recomende e Ganhe Antifraude, Economia Comprovada vs Potencial,
-- Planejamento Colaborativo BoraJunto e Missões / Jornadas Auditáveis.

-- 1. Atribuições Rastreáveis de Recomende e Ganhe (Antifraude)
create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  referral_code text not null,
  referred_label text not null,
  referred_identifier text,
  booking_id uuid references public.experience_bookings(id) on delete set null,
  visit_proof_id uuid references public.visit_proofs(id) on delete set null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  reward_points integer not null default 200 check (reward_points >= 0),
  status text not null default 'PENDING_CONVERSION' check (
    status in ('PENDING_CONVERSION', 'CONVERTED', 'REVERSED')
  ),
  reversal_reason text,
  converted_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint chk_no_self_referral check (
    referred_user_id is null or referrer_user_id <> referred_user_id
  )
);

-- Trava única: uma mesma reserva elegível só pode converter 1 recompensa de indicação
create unique index if not exists idx_referral_unique_booking_conversion
  on public.referral_attributions (booking_id)
  where booking_id is not null and status = 'CONVERTED';

-- 2. Livro Razão de Economia do Usuário (Comprovada vs Potencial estritamente separadas)
create table if not exists public.user_savings_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('PROVEN', 'POTENTIAL')),
  source_type text not null check (
    source_type in ('RESERVATION_CHECKIN', 'VERIFIED_VOUCHER', 'PENDING_RESERVATION', 'ACTIVE_VOUCHER')
  ),
  reference_id text not null,
  restaurant_id uuid references public.restaurants(id) on delete set null,
  title text not null,
  amount_brl numeric(10,2) not null default 0 check (amount_brl >= 0),
  visit_proof_id uuid references public.visit_proofs(id) on delete set null,
  is_demonstrative boolean not null default false,
  created_at timestamptz not null default now()
);

-- 3. Planos Colaborativos BoraJunto (Roteiros com Rede Confia)
create table if not exists public.borajunto_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  planned_date date not null default current_date,
  planned_time text not null default '19:30',
  guests integer not null default 2 check (guests >= 1),
  invited_circle_ids uuid[] not null default '{}',
  candidate_venue_ids uuid[] not null default '{}',
  selected_venue_id uuid references public.restaurants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.borajunto_votes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.borajunto_plans(id) on delete cascade,
  voter_user_id uuid not null references auth.users(id) on delete cascade,
  venue_id uuid not null references public.restaurants(id) on delete cascade,
  vote_value integer not null check (vote_value in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (plan_id, voter_user_id, venue_id)
);

-- 4. Progresso de Missões e Jornadas (somente ações verificadas)
create table if not exists public.user_mission_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_code text not null,
  current_value integer not null default 0 check (current_value >= 0),
  target_value integer not null default 1 check (target_value >= 1),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, mission_code)
);

-- RLS Policies
alter table public.referral_attributions enable row level security;
alter table public.user_savings_ledger enable row level security;
alter table public.borajunto_plans enable row level security;
alter table public.borajunto_votes enable row level security;
alter table public.user_mission_progress enable row level security;

drop policy if exists "Usuario gerencia proprias indicacoes" on public.referral_attributions;
create policy "Usuario gerencia proprias indicacoes" on public.referral_attributions
  for all using (auth.uid() = referrer_user_id)
  with check (auth.uid() = referrer_user_id and (referred_user_id is null or referred_user_id <> auth.uid()));

drop policy if exists "Usuario acessa propria economia" on public.user_savings_ledger;
create policy "Usuario acessa propria economia" on public.user_savings_ledger
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuario gerencia proprios planos borajunto" on public.borajunto_plans;
create policy "Usuario gerencia proprios planos borajunto" on public.borajunto_plans
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "Usuario vota em planos borajunto" on public.borajunto_votes;
create policy "Usuario vota em planos borajunto" on public.borajunto_votes
  for all using (
    auth.uid() = voter_user_id
    or exists (
      select 1 from public.borajunto_plans bp
      where bp.id = borajunto_votes.plan_id and bp.owner_id = auth.uid()
    )
  )
  with check (auth.uid() = voter_user_id);

drop policy if exists "Usuario acessa proprio progresso de missoes" on public.user_mission_progress;
create policy "Usuario acessa proprio progresso de missoes" on public.user_mission_progress
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

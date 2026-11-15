-- BoraRio Superapp — Migração Incremental 004
-- 4 Modalidades Comerciais Independentes (sem Gateway), Demanda Agregada com Confirmação do Parceiro,
-- Imutabilidade Retroativa de Condições Confirmadas e Livro Razão de Remuneração B2B Auditável (sem % sobre conta).

-- 1. Ofertas & Disponibilidades Comerciais dos Parceiros (4 Modalidades Independentes)
create table if not exists public.partner_offerings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  modality text not null check (
    modality in ('TRADITIONAL_BOOKING', 'INDIVIDUAL_OFFER', 'DEMAND_OFFER', 'LAST_MINUTE')
  ),
  status text not null default 'PUBLISHED' check (
    status in (
      'DRAFT',
      'PUBLISHED',
      'CAPTURING',
      'GOAL_REACHED',
      'CONFIRMED',
      'SOLD_OUT',
      'ENDED_WITHOUT_GOAL',
      'CANCELLED',
      'COMPLETED'
    )
  ),
  title text not null,
  description text not null default '',
  benefit_summary text not null default '',
  rules_summary text not null default '',
  eligibility_rules text not null default 'Aberto para solicitações elegíveis no aplicativo.',
  cancellation_policy text not null default 'Cancelamento gratuito pelo app até 2 horas antes do horário reservado.',
  payment_instructions text not null default 'Pagamento efetuado diretamente ao estabelecimento pelos meios aceitos no local. O BoraRio não realiza cobrança financeira.',
  has_discount boolean not null default false,
  discount_label text,
  base_price_brl numeric(10,2),
  partner_condition_price_brl numeric(10,2),
  estimated_savings_brl numeric(10,2) default 0,
  service_date date not null default current_date,
  time_slot_label text not null default '19:30',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default (now() + interval '48 hours'),
  capacity_total integer not null default 20 check (capacity_total >= 1),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  min_demand_goal integer check (min_demand_goal is null or min_demand_goal >= 2),
  partner_managed_active boolean not null default true,
  is_demonstrative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Reservas & Manifestações de Interesse Individuais (Imutabilidade Retroativa)
create table if not exists public.experience_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  offering_id uuid references public.partner_offerings(id) on delete set null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  booking_modality text not null check (
    booking_modality in ('TRADITIONAL_BOOKING', 'INDIVIDUAL_OFFER', 'DEMAND_OFFER', 'LAST_MINUTE')
  ),
  reservation_stage text not null default 'REQUESTED' check (
    reservation_stage in (
      'REQUESTED',
      'CONFIRMED',
      'CHECKED_IN',
      'VERIFIED_VISIT',
      'VERIFIED_CONSUMPTION',
      'CANCELLED',
      'NO_SHOW',
      'ENDED_WITHOUT_GOAL'
    )
  ),
  party_size integer not null default 2 check (party_size >= 1),
  booking_date date not null,
  booking_time text not null,
  snapshot_terms jsonb not null default '{}'::jsonb,
  payment_instruction text not null default 'Pagamento efetuado diretamente ao estabelecimento pelos meios aceitos no local. O BoraRio não realiza cobrança financeira.',
  attribution_origin text not null default 'catalog',
  referral_code_used text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger de Imutabilidade Retroativa: impede alterar snapshot_terms após confirmação da reserva
create or replace function public.enforce_booking_snapshot_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.confirmed_at is not null and new.snapshot_terms is distinct from old.snapshot_terms then
    raise exception 'Bloqueado: não é permitido alterar retroativamente as condições comerciais de uma reserva já confirmada.';
  end if;
  if new.reservation_stage = 'CONFIRMED' and old.confirmed_at is null then
    new.confirmed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_enforce_booking_snapshot_immutability on public.experience_bookings;
create trigger trg_enforce_booking_snapshot_immutability
  before update on public.experience_bookings
  for each row execute function public.enforce_booking_snapshot_immutability();

-- 3. Livro Razão Auditável de Remuneração B2B (Taxa fixa configurável por pessoa atendida — Zero % sobre consumo)
create table if not exists public.partner_fee_ledger (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.experience_bookings(id) on delete cascade,
  visit_proof_id uuid references public.visit_proofs(id) on delete set null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  plan_id uuid references public.partner_commercial_plans(id) on delete set null,
  billing_model text not null default 'PER_ATTENDED_GUEST',
  modality text not null,
  attended_guests integer not null check (attended_guests >= 1),
  unit_fee_brl numeric(10,2) not null check (unit_fee_brl >= 0),
  total_fee_brl numeric(10,2) not null check (total_fee_brl >= 0),
  attribution_origin text not null default 'catalog',
  status text not null default 'ACCRUED' check (status in ('ACCRUED', 'DISPUTED', 'WAIVED', 'INVOICED')),
  dispute_reason text,
  event_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (booking_id)
);

-- RLS Policies
alter table public.partner_offerings enable row level security;
alter table public.experience_bookings enable row level security;
alter table public.partner_fee_ledger enable row level security;

drop policy if exists "Ofertas ativas visiveis publicamente" on public.partner_offerings;
create policy "Ofertas ativas visiveis publicamente" on public.partner_offerings
  for select using (status <> 'DRAFT');

drop policy if exists "Parceiro aprovado gerencia ofertas" on public.partner_offerings;
create policy "Parceiro aprovado gerencia ofertas" on public.partner_offerings
  for all using (
    exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = partner_offerings.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

drop policy if exists "Usuario gerencia proprias bookings" on public.experience_bookings;
create policy "Usuario gerencia proprias bookings" on public.experience_bookings
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = experience_bookings.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

drop policy if exists "Usuario cria propria booking" on public.experience_bookings;
create policy "Usuario cria propria booking" on public.experience_bookings
  for insert with check (auth.uid() = user_id);

drop policy if exists "Parceiro visualiza e contesta ledger" on public.partner_fee_ledger;
create policy "Parceiro visualiza e contesta ledger" on public.partner_fee_ledger
  for select using (
    exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = partner_fee_ledger.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

-- 4. RPC Atômica: Manifestação de Interesse ou Solicitação Individual (Sem Gateway)
create or replace function public.submit_booking_or_interest(
  p_offering_id uuid,
  p_party_size integer,
  p_attribution_origin text default 'club',
  p_referral_code text default null
)
returns public.experience_bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_off public.partner_offerings;
  v_booking public.experience_bookings;
  v_next_reserved integer;
  v_next_status text;
begin
  if v_uid is null then
    raise exception 'Usuário autenticado obrigatório para registrar solicitação.';
  end if;

  select * into v_off from public.partner_offerings where id = p_offering_id for update;
  if not found then
    raise exception 'Disponibilidade ou oferta não encontrada.';
  end if;

  if not v_off.partner_managed_active or v_off.status in ('DRAFT', 'SOLD_OUT', 'ENDED_WITHOUT_GOAL', 'CANCELLED', 'COMPLETED') then
    raise exception 'Esta oferta não está recebendo novas solicitações no momento.';
  end if;

  v_next_reserved := v_off.reserved_count + greatest(1, p_party_size);
  if v_next_reserved > v_off.capacity_total then
    raise exception 'Capacidade insuficiente para a quantidade solicitada.';
  end if;

  -- Nunca confirma demanda agregada unilateralmente antes do parceiro
  insert into public.experience_bookings (
    user_id, offering_id, restaurant_id, booking_modality, reservation_stage,
    party_size, booking_date, booking_time, payment_instruction, attribution_origin, referral_code_used,
    snapshot_terms
  )
  values (
    v_uid, v_off.id, v_off.restaurant_id, v_off.modality, 'REQUESTED',
    greatest(1, p_party_size), v_off.service_date, v_off.time_slot_label, v_off.payment_instructions,
    coalesce(p_attribution_origin, 'club'), p_referral_code,
    jsonb_build_object(
      'title', v_off.title,
      'benefit_summary', v_off.benefit_summary,
      'rules_summary', v_off.rules_summary,
      'cancellation_policy', v_off.cancellation_policy,
      'has_discount', v_off.has_discount,
      'base_price_brl', v_off.base_price_brl,
      'partner_condition_price_brl', v_off.partner_condition_price_brl
    )
  )
  returning * into v_booking;

  v_next_status := v_off.status;
  if v_off.modality = 'DEMAND_OFFER' then
    if v_next_reserved >= v_off.capacity_total then
      v_next_status := 'SOLD_OUT';
    elsif v_off.min_demand_goal is not null and v_next_reserved >= v_off.min_demand_goal then
      v_next_status := 'GOAL_REACHED';
    else
      v_next_status := 'CAPTURING';
    end if;
  elsif v_next_reserved >= v_off.capacity_total then
    v_next_status := 'SOLD_OUT';
  end if;

  update public.partner_offerings
    set reserved_count = v_next_reserved,
        status = v_next_status,
        updated_at = now()
  where id = v_off.id;

  return v_booking;
end;
$$;

-- 5. RPC Atômica: Confirmação pelo Parceiro de Demanda Consolidada ou Reserva
create or replace function public.partner_confirm_booking_or_demand(
  p_offering_id uuid,
  p_booking_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_off public.partner_offerings;
  v_count integer := 0;
begin
  select * into v_off from public.partner_offerings where id = p_offering_id for update;
  if not found then
    raise exception 'Oferta não encontrada.';
  end if;

  if v_uid is null or not exists (
    select 1 from public.partner_memberships pm
    where pm.restaurant_id = v_off.restaurant_id
      and pm.user_id = v_uid
      and pm.status = 'APPROVED'
  ) then
    raise exception 'Somente o parceiro aprovado pode confirmar esta condição comercial.';
  end if;

  if p_booking_id is not null then
    update public.experience_bookings
      set reservation_stage = 'CONFIRMED',
          confirmed_at = now()
    where id = p_booking_id
      and restaurant_id = v_off.restaurant_id
      and reservation_stage = 'REQUESTED';
    get diagnostics v_count = row_count;
    return v_count;
  end if;

  update public.partner_offerings
    set status = 'CONFIRMED',
        updated_at = now()
  where id = v_off.id;

  update public.experience_bookings
    set reservation_stage = 'CONFIRMED',
        confirmed_at = now()
  where offering_id = v_off.id
    and reservation_stage = 'REQUESTED';
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

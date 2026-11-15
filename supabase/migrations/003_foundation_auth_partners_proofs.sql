-- BoraRio Superapp — Migração Incremental 003
-- Fundação: Auth/Parceiros multi-tenant, Planos Comerciais Configuráveis (sem % sobre conta),
-- QR Code Dinâmico Temporário, Prova de Visita em 4 Níveis, Auditoria de Check-in,
-- Rede Confia Tipada (9 entradas) e Endurecimento RLS de Storage.
-- Preserva integralmente todas as tabelas criadas em 001 e 002.

-- 1. Vínculo Multi-Tenant B2B (Parceiros ↔ Estabelecimentos)
create table if not exists public.partner_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  role text not null default 'OWNER' check (role in ('OWNER', 'MANAGER', 'STAFF')),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REVOKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);

-- 2. Planos Comerciais Configuráveis por Estabelecimento / Contrato
-- Taxa fixa por pessoa efetivamente atendida (sem % sobre consumo e sem mensalidade obrigatória no piloto)
create table if not exists public.partner_commercial_plans (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  plan_name text not null default 'Plano Piloto — Taxa Fixa por Pessoa Atendida',
  billing_model text not null default 'PER_ATTENDED_GUEST' check (
    billing_model in ('PER_ATTENDED_GUEST', 'PER_COMPLETED_BOOKING', 'PRO_SUBSCRIPTION')
  ),
  fixed_fee_per_guest_brl numeric(10,2) not null default 3.00 check (fixed_fee_per_guest_brl >= 0),
  fixed_fee_per_booking_brl numeric(10,2) not null default 0.00 check (fixed_fee_per_booking_brl >= 0),
  monthly_subscription_brl numeric(10,2) not null default 0.00 check (monthly_subscription_brl >= 0),
  requires_monthly_fee boolean not null default false,
  charge_on_cancelled boolean not null default false,
  charge_on_no_show boolean not null default false,
  currency text not null default 'BRL',
  policy_summary text not null default 'Remuneração fixa por pessoa efetivamente atendida via check-in validado. Zero comissão sobre o valor da conta e zero cobrança por clique, visualização ou reserva cancelada.',
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_partner_active_plan_unique
  on public.partner_commercial_plans (restaurant_id)
  where is_active = true;

-- 3. Tokens QR Dinâmicos Temporários emitidos pelo Estabelecimento
create table if not exists public.venue_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  issued_by_user_id uuid references auth.users(id) on delete set null,
  token_code text unique not null,
  contingency_pin text not null,
  max_uses integer not null default 1 check (max_uses >= 1),
  consumed_count integer not null default 0 check (consumed_count >= 0),
  revoked boolean not null default false,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- 4. Prova de Visita em 4 Níveis (QR isolado nunca equivale a consumo verificado)
create table if not exists public.visit_proofs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  qr_token_id uuid references public.venue_qr_tokens(id) on delete set null,
  qr_code_used text,
  presence_level text not null check (
    presence_level in ('CHECKIN_REGISTERED', 'PRESENCE_WITH_EVIDENCE', 'VERIFIED_VISIT', 'VERIFIED_CONSUMPTION')
  ),
  evidence_method text not null check (
    evidence_method in (
      'DYNAMIC_QR',
      'DYNAMIC_QR_GEO',
      'CONTINGENCY_PIN',
      'PARTNER_POST_CONSUMPTION',
      'POS_RECEIPT',
      'OFFLINE_CONTINGENCY_RECONCILED'
    )
  ),
  guests_count integer not null default 1 check (guests_count >= 1),
  presence_verified_at timestamptz not null default now(),
  consumption_verified_at timestamptz,
  consumption_reference text,
  partner_confirmed_by uuid references auth.users(id) on delete set null,
  is_demonstrative boolean not null default false,
  notes text,
  -- Trava estrutural: consumo verificado exige evidência complementar pós-consumo ou comprovante/PDV
  constraint chk_consumption_requires_additional_evidence check (
    presence_level <> 'VERIFIED_CONSUMPTION'
    or (
      evidence_method in ('PARTNER_POST_CONSUMPTION', 'POS_RECEIPT')
      and (partner_confirmed_by is not null or consumption_reference is not null)
    )
  )
);

-- Impede mais de 1 check-in ativo para a mesma reserva
create unique index if not exists idx_visit_proofs_unique_reservation
  on public.visit_proofs (reservation_id)
  where reservation_id is not null;

-- 5. Trilha Imutável de Auditoria de Check-in e Contestações
create table if not exists public.checkin_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  visit_proof_id uuid references public.visit_proofs(id) on delete set null,
  qr_token_id uuid references public.venue_qr_tokens(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null default 'SYSTEM' check (actor_role in ('USER', 'PARTNER', 'SYSTEM')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 6. Evolução Incremental de reservations, trust_connections e confia_recommendations
alter table public.reservations
  add column if not exists lifecycle_stage text not null default 'REQUESTED',
  add column if not exists modality text not null default 'TRADITIONAL_BOOKING',
  add column if not exists offering_id uuid,
  add column if not exists payment_instruction text not null default 'Pagamento efetuado diretamente ao estabelecimento pelos meios aceitos no local. O BoraRio não realiza cobrança financeira.',
  add column if not exists attribution_origin text default 'catalog',
  add column if not exists snapshot_terms jsonb not null default '{}'::jsonb;

alter table public.trust_connections
  add column if not exists peer_user_id uuid references auth.users(id) on delete set null;

alter table public.confia_recommendations
  add column if not exists entry_type text not null default 'PERSONAL_RECOMMENDATION' check (
    entry_type in (
      'PERSONAL_RECOMMENDATION',
      'LIVED_EXPERIENCE',
      'VERIFIED_VISIT',
      'VERIFIED_CONSUMPTION',
      'SAVED_PLACE',
      'INVITE',
      'SHARED_ITINERARY',
      'SHARED_OPPORTUNITY',
      'ACHIEVEMENT'
    )
  ),
  add column if not exists visit_proof_level text check (
    visit_proof_level is null or visit_proof_level in (
      'CHECKIN_REGISTERED', 'PRESENCE_WITH_EVIDENCE', 'VERIFIED_VISIT', 'VERIFIED_CONSUMPTION'
    )
  ),
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) INCREMENTAL
-- ============================================================================
alter table public.partner_memberships enable row level security;
alter table public.partner_commercial_plans enable row level security;
alter table public.venue_qr_tokens enable row level security;
alter table public.visit_proofs enable row level security;
alter table public.checkin_audit_events enable row level security;

drop policy if exists "Parceiro visualiza proprios vinculos" on public.partner_memberships;
create policy "Parceiro visualiza proprios vinculos" on public.partner_memberships
  for select using (auth.uid() = user_id);

drop policy if exists "Parceiro aprovado gerencia restaurante" on public.restaurants;
create policy "Parceiro aprovado gerencia restaurante" on public.restaurants
  for update using (
    exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = restaurants.id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
        and pm.role in ('OWNER', 'MANAGER')
    )
  );

drop policy if exists "Plano comercial visivel ao parceiro" on public.partner_commercial_plans;
create policy "Plano comercial visivel ao parceiro" on public.partner_commercial_plans
  for select using (
    exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = partner_commercial_plans.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

drop policy if exists "QR Tokens restritos ao parceiro autorizado" on public.venue_qr_tokens;
create policy "QR Tokens restritos ao parceiro autorizado" on public.venue_qr_tokens
  for all using (
    exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = venue_qr_tokens.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

drop policy if exists "Visit proofs visiveis ao usuario e parceiro do local" on public.visit_proofs;
create policy "Visit proofs visiveis ao usuario e parceiro do local" on public.visit_proofs
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = visit_proofs.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

-- Impede inserção direta arbitrária por cliente: check-ins válidos passam via RPC server-side
drop policy if exists "Auditoria visivel ao usuario e parceiro envolvido" on public.checkin_audit_events;
create policy "Auditoria visivel ao usuario e parceiro envolvido" on public.checkin_audit_events
  for select using (
    auth.uid() = actor_user_id
    or exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = checkin_audit_events.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

-- Endurecimento das políticas de Storage (002) para exigir usuário autenticado em escritas
drop policy if exists "Venue media upload" on storage.objects;
create policy "Venue media upload" on storage.objects
  for insert with check (bucket_id = 'venue-media' and auth.role() = 'authenticated');

drop policy if exists "Venue media update" on storage.objects;
create policy "Venue media update" on storage.objects
  for update using (bucket_id = 'venue-media' and auth.role() = 'authenticated')
  with check (bucket_id = 'venue-media' and auth.role() = 'authenticated');

-- ============================================================================
-- RPCs TRANSACIONAIS SERVER-SIDE PARA QR DINÂMICO & PROVA DE VISITA
-- ============================================================================

create or replace function public.issue_venue_qr_token(
  p_restaurant_id uuid,
  p_ttl_seconds integer default 300,
  p_max_uses integer default 1
)
returns public.venue_qr_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token public.venue_qr_tokens;
  v_code text;
  v_pin text;
begin
  if v_uid is null or not exists (
    select 1 from public.partner_memberships pm
    where pm.restaurant_id = p_restaurant_id
      and pm.user_id = v_uid
      and pm.status = 'APPROVED'
  ) then
    raise exception 'Acesso negado: usuário sem permissão aprovada neste estabelecimento.';
  end if;

  v_code := 'BR-QR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_pin := lpad((floor(random() * 900000 + 100000)::int)::text, 6, '0');

  insert into public.venue_qr_tokens (
    restaurant_id, issued_by_user_id, token_code, contingency_pin,
    max_uses, expires_at
  )
  values (
    p_restaurant_id, v_uid, v_code, v_pin,
    greatest(1, least(p_max_uses, 50)),
    now() + make_interval(secs => greatest(60, least(p_ttl_seconds, 1800)))
  )
  returning * into v_token;

  insert into public.checkin_audit_events (
    event_type, restaurant_id, qr_token_id, actor_user_id, actor_role, message
  )
  values (
    'QR_ISSUED', p_restaurant_id, v_token.id, v_uid, 'PARTNER',
    'QR dinâmico temporário emitido pelo estabelecimento.'
  );

  return v_token;
end;
$$;

create or replace function public.validate_dynamic_qr_checkin(
  p_reservation_id uuid,
  p_token_code text,
  p_evidence_method text default 'DYNAMIC_QR'
)
returns public.visit_proofs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_res public.reservations;
  v_tok public.venue_qr_tokens;
  v_proof public.visit_proofs;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória para validar check-in no servidor.';
  end if;

  select * into v_res
  from public.reservations
  where id = p_reservation_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'Reserva não encontrada para este usuário.';
  end if;

  if v_res.status = 'CANCELLED' or v_res.lifecycle_stage in ('CANCELLED', 'ENDED_WITHOUT_GOAL', 'NO_SHOW') then
    raise exception 'Esta reserva não está elegível para check-in.';
  end if;

  if exists (select 1 from public.visit_proofs vp where vp.reservation_id = p_reservation_id) then
    insert into public.checkin_audit_events (
      event_type, restaurant_id, reservation_id, actor_user_id, actor_role, message
    ) values (
      'CHECKIN_REJECTED_DUPLICATE', v_res.experience_id, p_reservation_id, v_uid, 'USER',
      'Tentativa de check-in duplicado bloqueada.'
    );
    raise exception 'Check-in já validado para esta reserva.';
  end if;

  select * into v_tok
  from public.venue_qr_tokens
  where restaurant_id = v_res.experience_id
    and (token_code = trim(p_token_code) or contingency_pin = trim(p_token_code))
  for update;

  if not found or v_tok.revoked then
    insert into public.checkin_audit_events (
      event_type, restaurant_id, reservation_id, actor_user_id, actor_role, message
    ) values (
      'CHECKIN_REJECTED_INVALID', v_res.experience_id, p_reservation_id, v_uid, 'USER',
      'Código QR ou PIN operacional inválido para este estabelecimento.'
    );
    raise exception 'QR Code ou código operacional inválido para este estabelecimento.';
  end if;

  if v_tok.expires_at < now() then
    insert into public.checkin_audit_events (
      event_type, restaurant_id, reservation_id, qr_token_id, actor_user_id, actor_role, message
    ) values (
      'CHECKIN_REJECTED_EXPIRED', v_res.experience_id, p_reservation_id, v_tok.id, v_uid, 'USER',
      'QR dinâmico expirado; solicite um novo código ao atendente.'
    );
    raise exception 'QR Code expirado. Solicite um novo código dinâmico ao atendente.';
  end if;

  if v_tok.consumed_count >= v_tok.max_uses then
    insert into public.checkin_audit_events (
      event_type, restaurant_id, reservation_id, qr_token_id, actor_user_id, actor_role, message
    ) values (
      'CHECKIN_REJECTED_DUPLICATE', v_res.experience_id, p_reservation_id, v_tok.id, v_uid, 'USER',
      'Limite de utilizações deste QR dinâmico já foi atingido.'
    );
    raise exception 'Este QR Code já foi utilizado. Solicite outro código ao atendente.';
  end if;

  update public.venue_qr_tokens
    set consumed_count = consumed_count + 1
  where id = v_tok.id;

  insert into public.visit_proofs (
    restaurant_id, reservation_id, user_id, qr_token_id, qr_code_used,
    presence_level, evidence_method, guests_count, presence_verified_at
  )
  values (
    v_res.experience_id,
    v_res.id,
    v_uid,
    v_tok.id,
    v_tok.token_code,
    case
      when p_evidence_method = 'DYNAMIC_QR_GEO' then 'PRESENCE_WITH_EVIDENCE'
      else 'VERIFIED_VISIT'
    end,
    case
      when p_evidence_method in ('DYNAMIC_QR', 'DYNAMIC_QR_GEO', 'CONTINGENCY_PIN') then p_evidence_method
      else 'DYNAMIC_QR'
    end,
    greatest(1, v_res.guests),
    now()
  )
  returning * into v_proof;

  update public.reservations
    set lifecycle_stage = 'VERIFIED_VISIT',
        status = 'CONFIRMED'
  where id = v_res.id;

  insert into public.checkin_audit_events (
    event_type, restaurant_id, reservation_id, visit_proof_id, qr_token_id, actor_user_id, actor_role, message
  )
  values (
    'CHECKIN_VALIDATED', v_res.experience_id, v_res.id, v_proof.id, v_tok.id, v_uid, 'USER',
    'Presença e visita verificadas via QR dinâmico temporário.'
  );

  return v_proof;
end;
$$;

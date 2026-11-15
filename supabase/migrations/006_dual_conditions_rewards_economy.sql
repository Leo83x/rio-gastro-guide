-- BoraRio Superapp — Migração Incremental 006
-- Duas Condições Comerciais por Parceiro (Oferta para Atrair + Recompensa BoraRio),
-- Regras Configuráveis de Pontuação, Regra Individual de Check-in em Grupo (guests > 1),
-- Marketplace Cross-Parceiro de Recompensas, Vouchers Rastreáveis e Regra Econômica de Comissão Zero.
-- Preserva integralmente todas as tabelas, dados e políticas criadas em 001 a 005.

-- ============================================================================
-- 1. EVOLUÇÃO COMPATÍVEL DE TABELAS EXISTENTES (ADD COLUMN IF NOT EXISTS)
-- ============================================================================

-- 1.1 Condição 1 (Oferta para Atrair): item elegível, categoria, janela de utilização e visualizações
alter table public.partner_offerings
  add column if not exists eligible_item text,
  add column if not exists offer_category text,
  add column if not exists valid_days_hours text,
  add column if not exists views_count integer not null default 0 check (views_count >= 0);

create or replace function public.increment_partner_offering_view(p_offering_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partner_offerings
    set views_count = views_count + 1
  where id = p_offering_id;
end;
$$;

-- 1.2 Prova de Visita: suporte a check-in individual por participante em reservas em grupo (guests > 1)
alter table public.visit_proofs
  add column if not exists participant_slot integer not null default 1 check (participant_slot >= 1),
  add column if not exists participant_label text,
  add column if not exists group_booking_owner_id uuid references auth.users(id) on delete set null;

-- Substitui índice único anterior de 1 prova por reserva por unicidade por slot e por usuário dentro da reserva
drop index if exists public.idx_visit_proofs_unique_reservation;

create unique index if not exists idx_visit_proofs_unique_reservation_slot
  on public.visit_proofs (reservation_id, participant_slot)
  where reservation_id is not null;

create unique index if not exists idx_visit_proofs_unique_reservation_user
  on public.visit_proofs (reservation_id, user_id)
  where reservation_id is not null;

-- 1.3 Ledger de Rio Points: rastreabilidade e imutabilidade no cliente (sem edição/exclusão direta)
alter table public.rio_point_transactions
  add column if not exists validation_status text not null default 'RELEASED' check (
    validation_status in ('RELEASED', 'PENDING_VALIDATION', 'REVERSED')
  ),
  add column if not exists reservation_id uuid references public.reservations(id) on delete set null,
  add column if not exists visit_proof_id uuid references public.visit_proofs(id) on delete set null,
  add column if not exists participant_slot integer default 1,
  add column if not exists reward_voucher_id uuid,
  add column if not exists rule_code text,
  add column if not exists expires_at timestamptz;

drop policy if exists "Ledger Rio Points do usuario" on public.rio_point_transactions;
drop policy if exists "Ledger Rio Points leitura do usuario" on public.rio_point_transactions;
create policy "Ledger Rio Points leitura do usuario" on public.rio_point_transactions
  for select using (auth.uid() = user_id);

-- 1.4 Remuneração B2B: trava estrutural garantindo receita apenas de reservas atendidas (nunca resgates)
alter table public.partner_fee_ledger
  add column if not exists fee_source_type text not null default 'ATTENDED_BOOKING' check (
    fee_source_type = 'ATTENDED_BOOKING'
  ),
  add column if not exists attributed_from_reward_voucher_id uuid;

-- ============================================================================
-- 2. NOVAS TABELAS INCREMENTAIS
-- ============================================================================

-- 2.1 Regras Configuráveis de Pontuação e Governança Antifraude
create table if not exists public.point_earning_rules (
  id uuid primary key default gen_random_uuid(),
  rule_code text unique not null,
  scope_type text not null check (scope_type in ('DEFAULT', 'CATEGORY', 'PARTNER', 'CAMPAIGN')),
  category_filter text,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  points_amount integer not null check (points_amount >= 0),
  max_credits_per_user_day integer not null default 3 check (max_credits_per_user_day >= 1),
  max_credits_per_user_venue_month integer not null default 8 check (max_credits_per_user_venue_month >= 1),
  require_verified_checkin boolean not null default true check (require_verified_checkin = true),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.point_earning_rules (
  rule_code, scope_type, points_amount, max_credits_per_user_day, max_credits_per_user_venue_month,
  require_verified_checkin, active, notes
)
values (
  'DEFAULT_CHECKIN_50',
  'DEFAULT',
  50,
  3,
  8,
  true,
  true,
  'Regra padrão por presença validada via QR dinâmico. Reserva sem comparecimento, cliques e visualizações geram 0 pontos.'
)
on conflict (rule_code) do nothing;

-- 2.2 Condição 2 — Recompensa BoraRio (Comissão Zero sobre Resgates)
create table if not exists public.partner_rewards (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  created_by_user_id uuid references auth.users(id) on delete set null,
  segment_category text not null,
  reward_type text not null check (
    reward_type in (
      'SOBREMESA',
      'ENTRADA',
      'BEBIDA_NAO_ALCOOLICA',
      'PASSEIO',
      'UPGRADE_HOTEL',
      'SERVICO_BEM_ESTAR',
      'INGRESSO',
      'EXPERIENCIA'
    )
  ),
  title text not null,
  description text not null default '',
  eligible_item text not null,
  points_cost integer not null check (points_cost >= 10),
  quantity_total integer not null check (quantity_total >= 1),
  quantity_available integer not null check (quantity_available >= 0 and quantity_available <= quantity_total),
  max_per_user integer not null default 1 check (max_per_user >= 1),
  valid_days_hours text not null,
  rules_summary text not null,
  restrictions text not null default '',
  voucher_validity_days integer not null default 30 check (voucher_validity_days >= 1),
  expires_at timestamptz,
  status text not null default 'AVAILABLE' check (
    status in ('AVAILABLE', 'PAUSED', 'CLOSED', 'EXHAUSTED')
  ),
  -- Garantia estrutural permanente: comissão e tarifa sobre resgates sempre zero
  commission_rate numeric(5,2) not null default 0 check (commission_rate = 0),
  redemption_fee_brl numeric(10,2) not null default 0 check (redemption_fee_brl = 0),
  is_demonstrative boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.3 Vouchers Únicos de Recompensa (Preservados mesmo se a recompensa mãe for pausada ou encerrada)
create table if not exists public.reward_vouchers (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.partner_rewards(id) on delete restrict,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  voucher_code text unique not null,
  status text not null default 'ISSUED' check (
    status in ('AVAILABLE', 'REDEEMED', 'ISSUED', 'USED', 'EXPIRED', 'CANCELLED')
  ),
  points_spent integer not null check (points_spent > 0),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz not null default now(),
  used_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  cancellation_refund_tx_id uuid references public.rio_point_transactions(id) on delete set null,
  validated_by_user_id uuid references auth.users(id) on delete set null,
  validated_by_label text,
  commission_charged_brl numeric(10,2) not null default 0 check (commission_charged_brl = 0),
  snapshot_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 2.4 Atribuição Informativa de Retorno e Novas Reservas Pós-Resgate (Sem Causalidade Automática)
create table if not exists public.reward_return_attributions (
  id uuid primary key default gen_random_uuid(),
  reward_voucher_id uuid not null references public.reward_vouchers(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('RETURN_VISIT', 'SUBSEQUENT_BOOKING')),
  subsequent_booking_id uuid references public.experience_bookings(id) on delete set null,
  subsequent_fee_ledger_id uuid references public.partner_fee_ledger(id) on delete set null,
  indirect_fee_brl numeric(10,2) not null default 0 check (indirect_fee_brl >= 0),
  attribution_note text not null default 'Correlação observada após resgate; não implica causalidade exclusiva.',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- 3. ROW LEVEL SECURITY (RLS) INCREMENTAL
-- ============================================================================
alter table public.point_earning_rules enable row level security;
alter table public.partner_rewards enable row level security;
alter table public.reward_vouchers enable row level security;
alter table public.reward_return_attributions enable row level security;

drop policy if exists "Regras de pontuacao visiveis" on public.point_earning_rules;
create policy "Regras de pontuacao visiveis" on public.point_earning_rules
  for select using (active = true);

drop policy if exists "Recompensas visiveis ao publico" on public.partner_rewards;
create policy "Recompensas visiveis ao publico" on public.partner_rewards
  for select using (
    status in ('AVAILABLE', 'PAUSED', 'EXHAUSTED')
    or exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = partner_rewards.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
    or exists (
      select 1 from public.reward_vouchers rv
      where rv.reward_id = partner_rewards.id
        and rv.user_id = auth.uid()
    )
  );

drop policy if exists "Parceiro aprovado gerencia recompensas" on public.partner_rewards;
create policy "Parceiro aprovado gerencia recompensas" on public.partner_rewards
  for insert with check (
    exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = partner_rewards.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

drop policy if exists "Parceiro aprovado atualiza recompensas" on public.partner_rewards;
create policy "Parceiro aprovado atualiza recompensas" on public.partner_rewards
  for update using (
    exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = partner_rewards.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  )
  with check (commission_rate = 0 and redemption_fee_brl = 0);

drop policy if exists "Vouchers visiveis ao titular e parceiro do local" on public.reward_vouchers;
create policy "Vouchers visiveis ao titular e parceiro do local" on public.reward_vouchers
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = reward_vouchers.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

drop policy if exists "Atribuicoes retorno visiveis ao parceiro" on public.reward_return_attributions;
create policy "Atribuicoes retorno visiveis ao parceiro" on public.reward_return_attributions
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.partner_memberships pm
      where pm.restaurant_id = reward_return_attributions.restaurant_id
        and pm.user_id = auth.uid()
        and pm.status = 'APPROVED'
    )
  );

-- ============================================================================
-- 4. RPCs TRANSACIONAIS ATÔMICAS SERVER-SIDE
-- ============================================================================

-- 4.1 Resgate de Recompensa BoraRio com estoque real, saldo real e comissão R$ 0,00
create or replace function public.redeem_partner_reward(p_reward_id uuid)
returns public.reward_vouchers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rew public.partner_rewards;
  v_balance integer := 0;
  v_user_redemptions integer := 0;
  v_code text;
  v_voucher public.reward_vouchers;
  v_voucher_expires timestamptz;
  v_next_qty integer;
  v_tx_id uuid;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória para resgatar recompensa.';
  end if;

  select * into v_rew
  from public.partner_rewards
  where id = p_reward_id
  for update;

  if not found then
    raise exception 'Recompensa não encontrada.';
  end if;

  if v_rew.status <> 'AVAILABLE' then
    raise exception 'Esta recompensa está pausada, encerrada ou esgotada para novos resgates.';
  end if;

  if v_rew.expires_at is not null and v_rew.expires_at < now() then
    raise exception 'O prazo desta recompensa expirou.';
  end if;

  if v_rew.quantity_available < 1 then
    update public.partner_rewards set status = 'EXHAUSTED', updated_at = now() where id = v_rew.id;
    raise exception 'Estoque esgotado para esta recompensa.';
  end if;

  select count(*) into v_user_redemptions
  from public.reward_vouchers
  where reward_id = v_rew.id
    and user_id = v_uid
    and status in ('ISSUED', 'USED', 'REDEEMED', 'EXPIRED');

  if v_user_redemptions >= v_rew.max_per_user then
    raise exception 'Você já atingiu o limite de % resgate(s) para esta recompensa.', v_rew.max_per_user;
  end if;

  select coalesce(sum(
    case
      when tx_type = 'CREDIT' and validation_status = 'RELEASED' then amount
      when tx_type in ('DEBIT', 'REDEEM', 'REVERSAL') and validation_status <> 'REVERSED' then -amount
      else 0
    end
  ), 0)
  into v_balance
  from public.rio_point_transactions
  where user_id = v_uid;

  if v_balance < v_rew.points_cost then
    raise exception 'Saldo insuficiente (% RP disponíveis; necessário % RP).', v_balance, v_rew.points_cost;
  end if;

  v_code := 'BR-REW-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_voucher_expires := now() + make_interval(days => greatest(1, v_rew.voucher_validity_days));
  v_next_qty := v_rew.quantity_available - 1;

  insert into public.reward_vouchers (
    reward_id, restaurant_id, user_id, voucher_code, status, points_spent,
    expires_at, commission_charged_brl, snapshot_rules
  )
  values (
    v_rew.id, v_rew.restaurant_id, v_uid, v_code, 'ISSUED', v_rew.points_cost,
    v_voucher_expires, 0,
    jsonb_build_object(
      'title', v_rew.title,
      'eligible_item', v_rew.eligible_item,
      'segment_category', v_rew.segment_category,
      'valid_days_hours', v_rew.valid_days_hours,
      'rules_summary', v_rew.rules_summary,
      'restrictions', v_rew.restrictions,
      'commission_rate', 0
    )
  )
  returning * into v_voucher;

  insert into public.rio_point_transactions (
    user_id, tx_type, amount, origin, description, experience_id, reward_voucher_id, validation_status
  )
  values (
    v_uid, 'REDEEM', v_rew.points_cost, 'reward_redeem',
    'Resgate de Recompensa BoraRio: ' || v_rew.title || ' (' || v_code || ')',
    v_rew.restaurant_id, v_voucher.id, 'RELEASED'
  )
  returning id into v_tx_id;

  update public.partner_rewards
    set quantity_available = v_next_qty,
        status = case when v_next_qty = 0 then 'EXHAUSTED' else status end,
        updated_at = now()
  where id = v_rew.id;

  -- Nota: Nenhuma linha é inserida em partner_fee_ledger (Comissão sobre resgates = R$ 0,00).
  return v_voucher;
end;
$$;

-- 4.2 Cancelamento de Voucher ISSUED com Estorno Atômico de Pontos e Devolução de Estoque
create or replace function public.cancel_reward_voucher(
  p_voucher_id uuid,
  p_reason text default null
)
returns public.reward_vouchers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_voucher public.reward_vouchers;
  v_rew public.partner_rewards;
  v_refund_tx_id uuid;
  v_updated public.reward_vouchers;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória para cancelar voucher.';
  end if;

  select * into v_voucher
  from public.reward_vouchers
  where id = p_voucher_id and user_id = v_uid
  for update;

  if not found then
    raise exception 'Voucher não encontrado para este usuário.';
  end if;

  if v_voucher.status <> 'ISSUED' then
    raise exception 'Somente vouchers emitidos e ainda não utilizados podem ser cancelados com estorno.';
  end if;

  if v_voucher.expires_at < now() then
    update public.reward_vouchers set status = 'EXPIRED' where id = v_voucher.id;
    raise exception 'Voucher expirado não é elegível para cancelamento.';
  end if;

  select * into v_rew
  from public.partner_rewards
  where id = v_voucher.reward_id
  for update;

  insert into public.rio_point_transactions (
    user_id, tx_type, amount, origin, description, experience_id, reward_voucher_id, validation_status
  )
  values (
    v_uid, 'CREDIT', v_voucher.points_spent, 'reward_refund',
    'Estorno automático por cancelamento do voucher ' || v_voucher.voucher_code,
    v_voucher.restaurant_id, v_voucher.id, 'RELEASED'
  )
  returning id into v_refund_tx_id;

  update public.reward_vouchers
    set status = 'CANCELLED',
        cancelled_at = now(),
        cancellation_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelado pelo usuário dentro do prazo'),
        cancellation_refund_tx_id = v_refund_tx_id
  where id = v_voucher.id
  returning * into v_updated;

  if found then
    update public.partner_rewards
      set quantity_available = least(quantity_total, quantity_available + 1),
          status = case when status = 'EXHAUSTED' then 'AVAILABLE' else status end,
          updated_at = now()
    where id = v_rew.id;
  end if;

  return v_updated;
end;
$$;

-- 4.3 Validação Presencial do Voucher pelo Parceiro (Preserva Vouchers Já Emitidos)
create or replace function public.partner_validate_reward_voucher(
  p_voucher_code text,
  p_restaurant_id uuid
)
returns public.reward_vouchers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_voucher public.reward_vouchers;
  v_updated public.reward_vouchers;
begin
  if v_uid is null or not exists (
    select 1 from public.partner_memberships pm
    where pm.restaurant_id = p_restaurant_id
      and pm.user_id = v_uid
      and pm.status = 'APPROVED'
  ) then
    raise exception 'Acesso negado: apenas o parceiro aprovado deste estabelecimento pode validar vouchers.';
  end if;

  select * into v_voucher
  from public.reward_vouchers
  where upper(voucher_code) = upper(trim(p_voucher_code))
  for update;

  if not found then
    raise exception 'Voucher não encontrado.';
  end if;

  if v_voucher.restaurant_id <> p_restaurant_id then
    raise exception 'Este voucher pertence a outro estabelecimento.';
  end if;

  if v_voucher.status <> 'ISSUED' then
    raise exception 'Este voucher não está disponível para validação (estado atual: %).', v_voucher.status;
  end if;

  if v_voucher.expires_at < now() then
    update public.reward_vouchers set status = 'EXPIRED' where id = v_voucher.id;
    raise exception 'Voucher expirado no prazo limite de validade.';
  end if;

  -- Nota: NÃO bloqueia caso a recompensa mãe em partner_rewards esteja PAUSED, CLOSED ou EXHAUSTED,
  -- respeitando integralmente o compromisso com vouchers já emitidos anteriormente.
  update public.reward_vouchers
    set status = 'USED',
        used_at = now(),
        validated_by_user_id = v_uid,
        commission_charged_brl = 0
  where id = v_voucher.id
  returning * into v_updated;

  insert into public.checkin_audit_events (
    event_type, restaurant_id, actor_user_id, actor_role, message, metadata
  )
  values (
    'REWARD_VOUCHER_VALIDATED',
    p_restaurant_id,
    v_uid,
    'PARTNER',
    'Voucher de recompensa validado no balcão (' || v_updated.voucher_code || ') — Comissão R$ 0,00.',
    jsonb_build_object('voucher_id', v_updated.id, 'commission_charged_brl', 0)
  );

  return v_updated;
end;
$$;

-- 4.4 Check-in Individual em Reserva de Grupo (guests >= 1) sem multiplicar pontos do titular
create or replace function public.validate_group_participant_checkin(
  p_reservation_id uuid,
  p_token_code text,
  p_participant_slot integer default 1,
  p_participant_label text default null,
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
  v_rule public.point_earning_rules;
  v_points integer := 50;
begin
  if v_uid is null then
    raise exception 'Autenticação obrigatória para validar check-in.';
  end if;

  select * into v_res
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found then
    raise exception 'Reserva não encontrada.';
  end if;

  if v_res.status = 'CANCELLED' or v_res.lifecycle_stage in ('CANCELLED', 'ENDED_WITHOUT_GOAL', 'NO_SHOW') then
    raise exception 'Esta reserva não está elegível para check-in.';
  end if;

  if p_participant_slot < 1 or p_participant_slot > greatest(1, v_res.guests) then
    raise exception 'Slot de participante inválido para esta reserva (% pessoa(s)).', v_res.guests;
  end if;

  if exists (
    select 1 from public.visit_proofs vp
    where vp.reservation_id = p_reservation_id
      and (vp.participant_slot = p_participant_slot or vp.user_id = v_uid)
  ) then
    raise exception 'Este participante ou slot já validou presença nesta reserva.';
  end if;

  select * into v_tok
  from public.venue_qr_tokens
  where restaurant_id = v_res.experience_id
    and (token_code = trim(p_token_code) or contingency_pin = trim(p_token_code))
  for update;

  if not found or v_tok.revoked or v_tok.expires_at < now() or v_tok.consumed_count >= v_tok.max_uses then
    raise exception 'QR Code inválido, expirado ou esgotado.';
  end if;

  update public.venue_qr_tokens
    set consumed_count = consumed_count + 1
  where id = v_tok.id;

  insert into public.visit_proofs (
    restaurant_id, reservation_id, user_id, group_booking_owner_id,
    participant_slot, participant_label, qr_token_id, qr_code_used,
    presence_level, evidence_method, guests_count, presence_verified_at
  )
  values (
    v_res.experience_id, v_res.id, v_uid, v_res.user_id,
    p_participant_slot,
    coalesce(nullif(trim(p_participant_label), ''), case when p_participant_slot = 1 then 'Titular' else 'Acompanhante #' || p_participant_slot end),
    v_tok.id, v_tok.token_code,
    case when p_evidence_method = 'DYNAMIC_QR_GEO' then 'PRESENCE_WITH_EVIDENCE' else 'VERIFIED_VISIT' end,
    case when p_evidence_method in ('DYNAMIC_QR', 'DYNAMIC_QR_GEO', 'CONTINGENCY_PIN') then p_evidence_method else 'DYNAMIC_QR' end,
    case when p_participant_slot = 1 then greatest(1, v_res.guests) else 1 end,
    now()
  )
  returning * into v_proof;

  if v_res.lifecycle_stage not in ('VERIFIED_VISIT', 'VERIFIED_CONSUMPTION') then
    update public.reservations
      set lifecycle_stage = 'VERIFIED_VISIT',
          status = 'CONFIRMED'
    where id = v_res.id;
  end if;

  -- Aplica regra ativa (NUNCA multiplica por guests para o usuário)
  select * into v_rule
  from public.point_earning_rules
  where active = true
    and (
      (scope_type = 'PARTNER' and restaurant_id = v_res.experience_id)
      or scope_type = 'DEFAULT'
    )
  order by case when scope_type = 'PARTNER' then 1 else 2 end
  limit 1;

  if found then
    v_points := greatest(0, v_rule.points_amount);
  end if;

  if v_points > 0 then
    insert into public.rio_point_transactions (
      user_id, tx_type, amount, origin, description,
      experience_id, experience_name, reservation_id, visit_proof_id,
      participant_slot, rule_code, validation_status
    )
    values (
      v_uid, 'CREDIT', v_points, 'checkin_qr',
      'Presença individual validada (Participante #' || p_participant_slot || ') em ' || v_res.experience_name,
      v_res.experience_id, v_res.experience_name, v_res.id, v_proof.id,
      p_participant_slot, coalesce(v_rule.rule_code, 'DEFAULT_CHECKIN_50'), 'RELEASED'
    );
  end if;

  return v_proof;
end;
$$;

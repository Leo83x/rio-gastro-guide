-- ============================================================================
-- MIGRATION 010: FUNDAÇÃO DE BACKEND PARA INDICAÇÕES, REGRAS CONFIGURÁVEIS,
-- HISTÓRICO DE EVENTOS, CONVITES VIP AUTORIZADOS E TRANSAÇÃO ATÔMICA DE CHECK-IN
-- ============================================================================
-- Preserva integralmente 001..009 e o ledger existente (rio_point_transactions).

BEGIN;

-- ============================================================================
-- 1. PROTEÇÃO DE PAPÉIS ADMINISTRATIVOS EM public.profiles
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'USER'
  CHECK (role IN ('USER', 'PARTNER', 'ADMIN'));

-- Impede alteração direta da coluna role por anon/authenticated via PostgREST
REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_profiles_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Somente service_role ou sessão privilegiada de banco (sem auth.uid() de cliente) pode alterar role
    IF auth.uid() IS NOT NULL AND current_setting('role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'Operação não autorizada: o papel (role) não pode ser alterado pelo usuário.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profiles_role ON public.profiles;
CREATE TRIGGER trg_protect_profiles_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_role_change();

-- ============================================================================
-- 2. SINCRONIZAÇÃO DE REGRAS DE PONTUAÇÃO DE CHECK-IN (250 RP OFICIAL)
-- ============================================================================
UPDATE public.point_earning_rules
  SET active = false,
      notes = COALESCE(notes, '') || ' [Substituída por DEFAULT_CHECKIN_250]',
      updated_at = now()
WHERE rule_code = 'DEFAULT_CHECKIN_50' AND active = true;

INSERT INTO public.point_earning_rules (
  rule_code,
  scope_type,
  points_amount,
  max_credits_per_user_day,
  max_credits_per_user_venue_month,
  require_verified_checkin,
  active,
  notes
)
VALUES (
  'DEFAULT_CHECKIN_250',
  'DEFAULT',
  250,
  5,
  8,
  true,
  true,
  'Regra oficial de 250 RP por visita individual validada via QR dinâmico ou PIN. Presenças não verificadas e no-show geram 0 pontos.'
)
ON CONFLICT (rule_code) DO UPDATE
  SET points_amount = EXCLUDED.points_amount,
      active = true,
      updated_at = now();

-- ============================================================================
-- 3. REGRAS CONFIGURÁVEIS DO PROGRAMA DE INDICAÇÃO (ADMIN)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.referral_program_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code text UNIQUE NOT NULL,
  referrer_points integer NOT NULL DEFAULT 300 CHECK (referrer_points >= 0),
  referred_points integer NOT NULL DEFAULT 250 CHECK (referred_points >= 0),
  host_table_bonus_points integer NOT NULL DEFAULT 100 CHECK (host_table_bonus_points >= 0),
  max_host_bonus_slots_per_booking integer NOT NULL DEFAULT 3 CHECK (max_host_bonus_slots_per_booking >= 0),
  first_visit_bonus_points integer NOT NULL DEFAULT 0 CHECK (first_visit_bonus_points >= 0),
  trigger_event text NOT NULL DEFAULT 'FIRST_VERIFIED_CHECKIN'
    CHECK (trigger_event IN ('FIRST_VERIFIED_CHECKIN', 'FIRST_VERIFIED_CONSUMPTION')),
  max_rewards_per_user_total integer NOT NULL DEFAULT 50 CHECK (max_rewards_per_user_total >= 1),
  max_rewards_per_user_period integer NOT NULL DEFAULT 10 CHECK (max_rewards_per_user_period >= 1),
  period_days integer NOT NULL DEFAULT 30 CHECK (period_days >= 1),
  validation_window_days integer NOT NULL DEFAULT 30 CHECK (validation_window_days >= 1),
  require_contact_verified boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  notes text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.referral_program_rules (
  rule_code,
  referrer_points,
  referred_points,
  host_table_bonus_points,
  max_host_bonus_slots_per_booking,
  first_visit_bonus_points,
  trigger_event,
  max_rewards_per_user_total,
  max_rewards_per_user_period,
  period_days,
  validation_window_days,
  require_contact_verified,
  active,
  notes
)
VALUES (
  'DEFAULT_REFERRAL_V1',
  300,
  250,
  100,
  3,
  0,
  'FIRST_VERIFIED_CHECKIN',
  50,
  10,
  30,
  30,
  false,
  true,
  'Regra padrão: indicador recebe 300 RP e convidado recebe 250 RP após o 1º check-in presencial validado.'
)
ON CONFLICT (rule_code) DO NOTHING;

ALTER TABLE public.referral_program_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica regras ativas de indicacao" ON public.referral_program_rules;
CREATE POLICY "Leitura publica regras ativas de indicacao"
  ON public.referral_program_rules
  FOR SELECT
  USING (active = true);

-- ============================================================================
-- 4. EVOLUÇÃO DE referral_attributions + NOVO HISTÓRICO referral_events
-- ============================================================================
ALTER TABLE public.referral_attributions
  ADD COLUMN IF NOT EXISTS current_stage text NOT NULL DEFAULT 'INVITE_CREATED'
    CHECK (current_stage IN (
      'INVITE_CREATED',
      'LINK_VISITED',
      'SIGNUP_COMPLETED',
      'CONTACT_VERIFIED',
      'FIRST_VALID_ACTION',
      'FIRST_VERIFIED_VISIT',
      'REWARD_PENDING',
      'REWARD_RELEASED',
      'REWARD_CANCELLED'
    )),
  ADD COLUMN IF NOT EXISTS referrer_points integer NOT NULL DEFAULT 0 CHECK (referrer_points >= 0),
  ADD COLUMN IF NOT EXISTS referred_points integer NOT NULL DEFAULT 0 CHECK (referred_points >= 0),
  ADD COLUMN IF NOT EXISTS trigger_event text NOT NULL DEFAULT 'FIRST_VERIFIED_CHECKIN',
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS risk_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS device_context_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS vip_invite_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_attributions_idempotency
  ON public.referral_attributions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Impede que o mesmo convidado (referred_user_id) gere múltiplas recompensas liberadas
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_unique_referred_user_released
  ON public.referral_attributions (referred_user_id)
  WHERE referred_user_id IS NOT NULL AND current_stage = 'REWARD_RELEASED';

-- Restringe RLS: cliente NÃO pode inserir, atualizar ou apagar referral_attributions diretamente
DROP POLICY IF EXISTS "Usuario gerencia proprias indicacoes" ON public.referral_attributions;
DROP POLICY IF EXISTS "Usuario le proprias indicacoes" ON public.referral_attributions;
CREATE POLICY "Usuario le proprias indicacoes"
  ON public.referral_attributions
  FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- Tabela imutável de histórico de eventos da indicação (separa estado atual do histórico)
CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_id uuid NOT NULL REFERENCES public.referral_attributions(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'INVITE_CREATED',
    'LINK_VISITED',
    'SIGNUP_COMPLETED',
    'CONTACT_VERIFIED',
    'FIRST_VALID_ACTION',
    'FIRST_VERIFIED_VISIT',
    'REWARD_PENDING',
    'REWARD_RELEASED',
    'REWARD_CANCELLED',
    'RISK_FLAGGED',
    'RECONCILED_LEGACY'
  )),
  source text NOT NULL DEFAULT 'system',
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  idempotency_key text UNIQUE,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_attribution_created
  ON public.referral_events (attribution_id, created_at DESC);

ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario le eventos de suas indicacoes" ON public.referral_events;
CREATE POLICY "Usuario le eventos de suas indicacoes"
  ON public.referral_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.referral_attributions ra
      WHERE ra.id = referral_events.attribution_id
        AND (ra.referrer_user_id = auth.uid() OR ra.referred_user_id = auth.uid())
    )
  );

-- ============================================================================
-- 5. CONVITES VIP AUTORIZADOS PELO ESTABELECIMENTO
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_vip_invite_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  offering_id uuid REFERENCES public.partner_offerings(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT false,
  benefit_title text NOT NULL,
  conditions_text text,
  max_invites_per_checkin integer NOT NULL DEFAULT 3 CHECK (max_invites_per_checkin BETWEEN 1 AND 3),
  total_quota integer CHECK (total_quota IS NULL OR total_quota >= 0),
  used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  valid_days_after_checkin integer NOT NULL DEFAULT 14 CHECK (valid_days_after_checkin >= 1),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id)
);

ALTER TABLE public.partner_vip_invite_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura publica config convite vip ativo" ON public.partner_vip_invite_configs;
CREATE POLICY "Leitura publica config convite vip ativo"
  ON public.partner_vip_invite_configs
  FOR SELECT
  USING (active = true);

CREATE TABLE IF NOT EXISTS public.vip_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.partner_vip_invite_configs(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  issuer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  source_visit_proof_id uuid REFERENCES public.visit_proofs(id) ON DELETE SET NULL,
  invite_code text UNIQUE NOT NULL,
  benefit_title text NOT NULL,
  conditions_text text,
  status text NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'CLAIMED', 'USED', 'EXPIRED', 'CANCELLED')),
  claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  claimed_at timestamptz,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vip_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario le proprios convites vip" ON public.vip_invites;
CREATE POLICY "Usuario le proprios convites vip"
  ON public.vip_invites
  FOR SELECT
  USING (auth.uid() = issuer_user_id OR auth.uid() = claimed_by_user_id);

-- ============================================================================
-- 6. IDEMPOTÊNCIA INTEGRAL + INTEGRIDADE OPERACIONAL (PRONTO P/ FASES FUTURAS)
-- ============================================================================
ALTER TABLE public.rio_point_transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rio_point_tx_idempotency
  ON public.rio_point_transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.visit_proofs
  ADD COLUMN IF NOT EXISTS is_commercially_eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'VALIDATED'
    CHECK (operational_status IN (
      'VALIDATED',
      'DISPUTED',
      'QR_FAILED_PENDING',
      'CONFIRMED_POST_VISIT',
      'CANCELLED_NO_SHOW'
    )),
  ADD COLUMN IF NOT EXISTS dispute_reason text;

ALTER TABLE public.partner_fee_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_fee_ledger_idempotency
  ON public.partner_fee_ledger (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- 7. FUNÇÃO DE RECONCILIAÇÃO DE DADOS ANTIGOS (SEM CONVERSÃO CEGA)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reconcile_legacy_referrals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row record;
  v_has_proof boolean;
  v_has_tx boolean;
  v_released_count integer := 0;
  v_pending_count integer := 0;
  v_cancelled_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM public.referral_attributions
  LOOP
    IF v_row.status = 'REVERSED' THEN
      UPDATE public.referral_attributions
        SET current_stage = 'REWARD_CANCELLED',
            updated_at = now()
      WHERE id = v_row.id AND current_stage <> 'REWARD_CANCELLED';

      INSERT INTO public.referral_events (attribution_id, event_type, source, idempotency_key, metadata)
      VALUES (
        v_row.id,
        'REWARD_CANCELLED',
        'reconcile_legacy',
        'reconcile:cancelled:' || v_row.id::text,
        jsonb_build_object('legacy_status', v_row.status)
      )
      ON CONFLICT (idempotency_key) DO NOTHING;

      v_cancelled_count := v_cancelled_count + 1;

    ELSIF v_row.status = 'CONVERTED' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.visit_proofs vp
        WHERE vp.id = v_row.visit_proof_id
          AND vp.is_commercially_eligible = true
          AND vp.operational_status IN ('VALIDATED', 'CONFIRMED_POST_VISIT')
      ) INTO v_has_proof;

      SELECT EXISTS (
        SELECT 1 FROM public.rio_point_transactions rpt
        WHERE rpt.user_id = v_row.referrer_user_id
          AND rpt.origin = 'referral'
          AND rpt.validation_status = 'RELEASED'
          AND (
            (v_row.visit_proof_id IS NOT NULL AND rpt.visit_proof_id = v_row.visit_proof_id)
            OR (v_row.booking_id IS NOT NULL AND rpt.reservation_id = v_row.booking_id)
          )
      ) INTO v_has_tx;

      IF v_has_proof AND v_has_tx THEN
        UPDATE public.referral_attributions
          SET current_stage = 'REWARD_RELEASED',
              referrer_points = GREATEST(referrer_points, reward_points),
              updated_at = now()
        WHERE id = v_row.id AND current_stage <> 'REWARD_RELEASED';

        INSERT INTO public.referral_events (attribution_id, event_type, source, idempotency_key, metadata)
        VALUES (
          v_row.id,
          'REWARD_RELEASED',
          'reconcile_legacy',
          'reconcile:released:' || v_row.id::text,
          jsonb_build_object('has_proof', true, 'has_tx', true)
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        v_released_count := v_released_count + 1;
      ELSE
        -- Sem lastro real comprovado: rebaixa para REWARD_PENDING para auditoria
        UPDATE public.referral_attributions
          SET current_stage = 'REWARD_PENDING',
              risk_flags = COALESCE(risk_flags, '[]'::jsonb) || jsonb_build_array('LEGACY_CONVERTED_WITHOUT_BACKING'),
              updated_at = now()
        WHERE id = v_row.id;

        INSERT INTO public.referral_events (attribution_id, event_type, source, idempotency_key, metadata)
        VALUES (
          v_row.id,
          'RECONCILED_LEGACY',
          'reconcile_legacy',
          'reconcile:unbacked:' || v_row.id::text,
          jsonb_build_object('has_proof', v_has_proof, 'has_tx', v_has_tx)
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        v_pending_count := v_pending_count + 1;
      END IF;

    ELSE
      UPDATE public.referral_attributions
        SET current_stage = 'REWARD_PENDING',
            updated_at = now()
      WHERE id = v_row.id AND current_stage = 'INVITE_CREATED';

      v_pending_count := v_pending_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'released', v_released_count,
    'pending_or_unbacked', v_pending_count,
    'cancelled', v_cancelled_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_legacy_referrals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_legacy_referrals() TO service_role;

-- ============================================================================
-- 8. RPC TRANSACIONAL ATÔMICA: CHECK-IN + PONTOS + INDICAÇÃO + TAXA B2B
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_verified_checkin_tx(
  p_reservation_id uuid,
  p_scanned_code_or_pin text,
  p_participant_slot integer DEFAULT 1,
  p_participant_user_id uuid DEFAULT NULL,
  p_participant_label text DEFAULT NULL,
  p_evidence_method text DEFAULT 'DYNAMIC_QR',
  p_has_geo boolean DEFAULT false,
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := COALESCE(auth.uid(), p_actor_user_id);
  v_is_service boolean := (current_setting('role', true) = 'service_role');
  v_res public.reservations;
  v_tok public.venue_qr_tokens;
  v_clean_code text := upper(trim(COALESCE(p_scanned_code_or_pin, '')));
  v_is_partner_member boolean := false;
  v_is_eligible boolean := false;
  v_existing_proof_id uuid;
  v_proof_id uuid;
  v_presence_level text;
  v_checkin_points integer := 0;
  v_checkin_rule_code text := 'DEFAULT_CHECKIN_250';
  v_ref_rule public.referral_program_rules;
  v_ref_attr public.referral_attributions;
  v_referrer_points integer := 0;
  v_referred_points integer := 0;
  v_period_count integer := 0;
  v_total_count integer := 0;
  v_tx_checkin_key text;
  v_tx_ref_key text;
  v_tx_referred_key text;
  v_fee_key text;
  v_vip_cfg public.partner_vip_invite_configs;
  v_vip_issued integer := 0;
  v_plan_fee numeric(10,2) := 10.00;
  v_is_first_visit boolean := false;
BEGIN
  IF p_reservation_id IS NULL OR v_clean_code = '' THEN
    RAISE EXCEPTION 'Reserva e código QR/PIN são obrigatórios.' USING ERRCODE = '22023';
  END IF;

  IF NOT v_is_service AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória para validar check-in.' USING ERRCODE = '42501';
  END IF;

  -- Lock na reserva para evitar corrida / dupla validação
  SELECT * INTO v_res
  FROM public.reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  -- Autorização: titular da reserva OU membro autorizado do estabelecimento OU service_role
  SELECT EXISTS (
    SELECT 1 FROM public.partner_memberships pm
    WHERE pm.restaurant_id = v_res.restaurant_id
      AND pm.user_id = v_caller_uid
      AND pm.is_active = true
  ) INTO v_is_partner_member;

  IF NOT v_is_service AND v_caller_uid IS DISTINCT FROM v_res.user_id AND NOT v_is_partner_member THEN
    RAISE EXCEPTION 'Sem permissão para validar check-in desta reserva.' USING ERRCODE = '42501';
  END IF;

  IF v_res.status = 'CANCELLED' OR v_res.lifecycle_stage IN ('CANCELLED', 'NO_SHOW', 'EXPIRED', 'ENDED_WITHOUT_GOAL') THEN
    RAISE EXCEPTION 'Reserva cancelada, expirada ou encerrada não pode receber check-in.' USING ERRCODE = '22023';
  END IF;

  -- Idempotência: se o slot já foi validado, retorna resultado sem duplicar crédito
  SELECT id INTO v_existing_proof_id
  FROM public.visit_proofs
  WHERE reservation_id = v_res.id
    AND participant_slot = p_participant_slot
  LIMIT 1;

  IF v_existing_proof_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent_replay', true,
      'visit_proof_id', v_existing_proof_id,
      'checkin_points_credited', 0,
      'referrer_points_credited', 0,
      'referred_points_credited', 0
    );
  END IF;

  -- Validação real do token QR dinâmico ou PIN de contingência no servidor
  SELECT * INTO v_tok
  FROM public.venue_qr_tokens
  WHERE restaurant_id = v_res.restaurant_id
    AND (upper(token_code) = v_clean_code OR upper(contingency_pin) = v_clean_code)
    AND revoked = false
    AND expires_at > now()
    AND consumed_count < max_uses
  ORDER BY issued_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.checkin_audit_events (
      event_type, restaurant_id, reservation_id, actor_user_id, actor_role, message
    ) VALUES (
      'CHECKIN_REJECTED_EXPIRED',
      v_res.restaurant_id,
      v_res.id,
      v_caller_uid,
      CASE WHEN v_is_partner_member THEN 'PARTNER' ELSE 'USER' END,
      'QR Code ou PIN inválido, expirado ou esgotado.'
    );
    RAISE EXCEPTION 'QR Code ou PIN inválido, expirado ou já utilizado.' USING ERRCODE = '22023';
  END IF;

  -- Consome 1 uso do token
  UPDATE public.venue_qr_tokens
    SET consumed_count = consumed_count + 1
  WHERE id = v_tok.id;

  -- Regra 4: Acompanhantes sem conta real (p_participant_user_id IS NULL e slot >= 2)
  -- registram presença física, mas NUNCA recebem pontos nem geram cobrança B2B.
  v_is_eligible := (p_participant_slot = 1 AND v_res.user_id IS NOT NULL)
                   OR (p_participant_slot >= 2 AND p_participant_user_id IS NOT NULL);

  v_presence_level := CASE
    WHEN p_has_geo THEN 'PRESENCE_WITH_EVIDENCE'
    ELSE 'CHECKIN_REGISTERED'
  END;

  INSERT INTO public.visit_proofs (
    restaurant_id,
    reservation_id,
    user_id,
    qr_token_id,
    qr_code_used,
    presence_level,
    evidence_method,
    guests_count,
    participant_slot,
    participant_label,
    group_booking_owner_id,
    is_commercially_eligible,
    operational_status,
    presence_verified_at
  ) VALUES (
    v_res.restaurant_id,
    v_res.id,
    COALESCE(p_participant_user_id, v_res.user_id),
    v_tok.id,
    v_clean_code,
    v_presence_level,
    CASE WHEN upper(v_tok.contingency_pin) = v_clean_code THEN 'CONTINGENCY_PIN' ELSE p_evidence_method END,
    1,
    p_participant_slot,
    COALESCE(p_participant_label, CASE WHEN p_participant_slot = 1 THEN 'Titular' ELSE 'Acompanhante #' || p_participant_slot END),
    v_res.user_id,
    v_is_eligible,
    'VALIDATED',
    now()
  )
  RETURNING id INTO v_proof_id;

  -- Atualiza estágio da reserva no slot 1
  IF p_participant_slot = 1 THEN
    UPDATE public.reservations
      SET status = 'CONFIRMED',
          lifecycle_stage = 'CHECKED_IN'
    WHERE id = v_res.id;
  END IF;

  IF v_is_eligible THEN
    -- Busca regra ativa de check-in
    SELECT points_amount, rule_code
      INTO v_checkin_points, v_checkin_rule_code
    FROM public.point_earning_rules
    WHERE active = true
      AND (
        (scope_type = 'PARTNER' AND restaurant_id = v_res.restaurant_id)
        OR scope_type = 'DEFAULT'
      )
    ORDER BY CASE WHEN scope_type = 'PARTNER' THEN 0 ELSE 1 END, updated_at DESC
    LIMIT 1;

    v_checkin_points := COALESCE(v_checkin_points, 250);
    v_tx_checkin_key := 'checkin:' || v_res.id::text || ':slot:' || p_participant_slot::text;

    INSERT INTO public.rio_point_transactions (
      user_id, amount, type, origin, description,
      experience_id, validation_status, reservation_id, visit_proof_id,
      participant_slot, rule_code, idempotency_key
    ) VALUES (
      COALESCE(p_participant_user_id, v_res.user_id),
      v_checkin_points,
      'CREDIT',
      'checkin_qr',
      'Check-in validado via QR/PIN (' || v_checkin_rule_code || ')',
      v_res.restaurant_id,
      'RELEASED',
      v_res.id,
      v_proof_id,
      p_participant_slot,
      v_checkin_rule_code,
      v_tx_checkin_key
    )
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

    -- Verifica se é o 1º check-in elegível do participante para conversão de indicação
    SELECT NOT EXISTS (
      SELECT 1 FROM public.visit_proofs vp
      WHERE vp.user_id = COALESCE(p_participant_user_id, v_res.user_id)
        AND vp.id <> v_proof_id
        AND vp.is_commercially_eligible = true
        AND vp.operational_status IN ('VALIDATED', 'CONFIRMED_POST_VISIT')
    ) INTO v_is_first_visit;

    IF v_is_first_visit THEN
      SELECT * INTO v_ref_rule
      FROM public.referral_program_rules
      WHERE active = true
      ORDER BY updated_at DESC
      LIMIT 1;

      SELECT * INTO v_ref_attr
      FROM public.referral_attributions
      WHERE referred_user_id = COALESCE(p_participant_user_id, v_res.user_id)
        AND current_stage NOT IN ('REWARD_RELEASED', 'REWARD_CANCELLED')
        AND (expires_at IS NULL OR expires_at > now())
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE;

      IF FOUND AND v_ref_attr.referrer_user_id <> COALESCE(p_participant_user_id, v_res.user_id) THEN
        -- Verifica limites por período e total do indicador
        SELECT count(*) INTO v_total_count
        FROM public.referral_attributions
        WHERE referrer_user_id = v_ref_attr.referrer_user_id
          AND current_stage = 'REWARD_RELEASED';

        SELECT count(*) INTO v_period_count
        FROM public.referral_attributions
        WHERE referrer_user_id = v_ref_attr.referrer_user_id
          AND current_stage = 'REWARD_RELEASED'
          AND converted_at >= now() - make_interval(days => COALESCE(v_ref_rule.period_days, 30));

        IF v_total_count < COALESCE(v_ref_rule.max_rewards_per_user_total, 50)
           AND v_period_count < COALESCE(v_ref_rule.max_rewards_per_user_period, 10) THEN

          v_referrer_points := COALESCE(v_ref_rule.referrer_points, 300) + COALESCE(v_ref_rule.first_visit_bonus_points, 0);
          v_referred_points := COALESCE(v_ref_rule.referred_points, 250);

          UPDATE public.referral_attributions
            SET status = 'CONVERTED',
                current_stage = 'REWARD_RELEASED',
                booking_id = COALESCE(booking_id, v_res.id),
                visit_proof_id = v_proof_id,
                restaurant_id = v_res.restaurant_id,
                reward_points = v_referrer_points,
                referrer_points = v_referrer_points,
                referred_points = v_referred_points,
                converted_at = now(),
                updated_at = now()
          WHERE id = v_ref_attr.id;

          INSERT INTO public.referral_events (attribution_id, event_type, source, actor_user_id, idempotency_key, metadata)
          VALUES
            (v_ref_attr.id, 'FIRST_VERIFIED_VISIT', 'checkin_tx', COALESCE(p_participant_user_id, v_res.user_id), 'ref_visit:' || v_ref_attr.id::text, jsonb_build_object('visit_proof_id', v_proof_id)),
            (v_ref_attr.id, 'REWARD_RELEASED', 'checkin_tx', COALESCE(p_participant_user_id, v_res.user_id), 'ref_release:' || v_ref_attr.id::text, jsonb_build_object('referrer_points', v_referrer_points, 'referred_points', v_referred_points))
          ON CONFLICT (idempotency_key) DO NOTHING;

          v_tx_ref_key := 'ref_referrer:' || v_ref_attr.id::text;
          INSERT INTO public.rio_point_transactions (
            user_id, amount, type, origin, description,
            experience_id, validation_status, reservation_id, visit_proof_id,
            rule_code, idempotency_key
          ) VALUES (
            v_ref_attr.referrer_user_id,
            v_referrer_points,
            'CREDIT',
            'referral',
            'Indicação convertida no 1º check-in validado do convidado',
            v_res.restaurant_id,
            'RELEASED',
            v_res.id,
            v_proof_id,
            COALESCE(v_ref_rule.rule_code, 'DEFAULT_REFERRAL_V1'),
            v_tx_ref_key
          )
          ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

          IF v_referred_points > 0 THEN
            v_tx_referred_key := 'ref_referred:' || v_ref_attr.id::text;
            INSERT INTO public.rio_point_transactions (
              user_id, amount, type, origin, description,
              experience_id, validation_status, reservation_id, visit_proof_id,
              rule_code, idempotency_key
            ) VALUES (
              COALESCE(p_participant_user_id, v_res.user_id),
              v_referred_points,
              'CREDIT',
              'referral',
              'Bônus de convidado pelo 1º check-in validado',
              v_res.restaurant_id,
              'RELEASED',
              v_res.id,
              v_proof_id,
              COALESCE(v_ref_rule.rule_code, 'DEFAULT_REFERRAL_V1'),
              v_tx_referred_key
            )
            ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
          END IF;
        END IF;
      END IF;
    END IF;

    -- Taxa B2B por participante elegível (idempotente por reserva + slot)
    SELECT COALESCE(pcp.fee_amount_brl, 10.00) INTO v_plan_fee
    FROM public.partner_commercial_plans pcp
    WHERE pcp.restaurant_id = v_res.restaurant_id
      AND pcp.is_active = true
    ORDER BY pcp.created_at DESC
    LIMIT 1;

    v_fee_key := 'fee:' || v_res.id::text || ':slot:' || p_participant_slot::text;
    -- Registra em partner_fee_ledger apenas se houver booking correspondente em experience_bookings
    IF EXISTS (SELECT 1 FROM public.experience_bookings eb WHERE eb.id = v_res.id) THEN
      INSERT INTO public.partner_fee_ledger (
        booking_id, visit_proof_id, restaurant_id, billing_model, modality,
        attended_guests, unit_fee_brl, total_fee_brl, participant_slot,
        participant_id, participant_label, gross_fee_brl, net_fee_brl,
        attribution_origin, status, idempotency_key
      ) VALUES (
        v_res.id, v_proof_id, v_res.restaurant_id, 'PER_ATTENDED_GUEST',
        COALESCE(v_res.modality, 'TRADITIONAL_BOOKING'),
        1, v_plan_fee, v_plan_fee, p_participant_slot,
        COALESCE(p_participant_user_id, v_res.user_id)::text,
        COALESCE(p_participant_label, 'Titular'),
        v_plan_fee, v_plan_fee,
        COALESCE(v_res.attribution_origin, 'catalog'),
        'ACCRUED',
        v_fee_key
      )
      ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
    END IF;

    -- Convites VIP pós-check-in somente se autorizados pelo estabelecimento
    SELECT * INTO v_vip_cfg
    FROM public.partner_vip_invite_configs
    WHERE restaurant_id = v_res.restaurant_id
      AND enabled = true
      AND active = true
    LIMIT 1
    FOR UPDATE;

    IF FOUND AND (v_vip_cfg.total_quota IS NULL OR v_vip_cfg.used_count < v_vip_cfg.total_quota) THEN
      FOR i IN 1..LEAST(v_vip_cfg.max_invites_per_checkin, COALESCE(v_vip_cfg.total_quota - v_vip_cfg.used_count, 3)) LOOP
        INSERT INTO public.vip_invites (
          config_id, restaurant_id, issuer_user_id, source_reservation_id,
          source_visit_proof_id, invite_code, benefit_title, conditions_text,
          status, expires_at
        ) VALUES (
          v_vip_cfg.id,
          v_res.restaurant_id,
          COALESCE(p_participant_user_id, v_res.user_id),
          v_res.id,
          v_proof_id,
          'VIP-' || upper(substr(md5(v_proof_id::text || ':' || i::text), 1, 8)),
          v_vip_cfg.benefit_title,
          v_vip_cfg.conditions_text,
          'ISSUED',
          now() + make_interval(days => v_vip_cfg.valid_days_after_checkin)
        )
        ON CONFLICT (invite_code) DO NOTHING;

        v_vip_issued := v_vip_issued + 1;
      END LOOP;

      IF v_vip_issued > 0 THEN
        UPDATE public.partner_vip_invite_configs
          SET used_count = used_count + v_vip_issued,
              updated_at = now()
        WHERE id = v_vip_cfg.id;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.checkin_audit_events (
    event_type, restaurant_id, reservation_id, visit_proof_id, qr_token_id,
    actor_user_id, actor_role, message
  ) VALUES (
    'CHECKIN_VALIDATED',
    v_res.restaurant_id,
    v_res.id,
    v_proof_id,
    v_tok.id,
    v_caller_uid,
    CASE WHEN v_is_partner_member THEN 'PARTNER' ELSE 'USER' END,
    'Check-in validado em transação atômica (elegível=' || v_is_eligible::text || ').'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent_replay', false,
    'visit_proof_id', v_proof_id,
    'is_commercially_eligible', v_is_eligible,
    'checkin_points_credited', v_checkin_points,
    'referrer_points_credited', v_referrer_points,
    'referred_points_credited', v_referred_points,
    'vip_invites_issued', v_vip_issued
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_verified_checkin_tx(uuid, text, integer, uuid, text, text, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_verified_checkin_tx(uuid, text, integer, uuid, text, text, boolean, uuid) TO authenticated, service_role;

-- ============================================================================
-- 9. RPC TRANSACIONAL DE ESTORNO (CANCELAMENTO / NO-SHOW / CONTESTAÇÃO)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reverse_checkin_and_referral_tx(
  p_reservation_id uuid,
  p_reason text DEFAULT 'CANCELLED_OR_NO_SHOW',
  p_actor_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid := COALESCE(auth.uid(), p_actor_user_id);
  v_is_service boolean := (current_setting('role', true) = 'service_role');
  v_res public.reservations;
  v_is_partner_member boolean := false;
  v_ref public.referral_attributions;
  v_tx record;
  v_reversed_tx_count integer := 0;
BEGIN
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada para estorno.' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.partner_memberships pm
    WHERE pm.restaurant_id = v_res.restaurant_id
      AND pm.user_id = v_caller_uid
      AND pm.is_active = true
  ) INTO v_is_partner_member;

  IF NOT v_is_service AND v_caller_uid IS DISTINCT FROM v_res.user_id AND NOT v_is_partner_member THEN
    RAISE EXCEPTION 'Sem permissão para estornar esta reserva.' USING ERRCODE = '42501';
  END IF;

  -- Estorna transações de pontos vinculadas a esta reserva
  FOR v_tx IN
    SELECT * FROM public.rio_point_transactions
    WHERE reservation_id = p_reservation_id
      AND type = 'CREDIT'
      AND validation_status = 'RELEASED'
  LOOP
    UPDATE public.rio_point_transactions
      SET validation_status = 'REVERSED'
    WHERE id = v_tx.id;

    INSERT INTO public.rio_point_transactions (
      user_id, amount, type, origin, description,
      experience_id, validation_status, reservation_id, visit_proof_id,
      idempotency_key
    ) VALUES (
      v_tx.user_id,
      v_tx.amount,
      'REVERSAL',
      v_tx.origin,
      'Estorno automático (' || p_reason || ')',
      v_tx.experience_id,
      'RELEASED',
      v_tx.reservation_id,
      v_tx.visit_proof_id,
      'reversal:' || v_tx.id::text
    )
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

    v_reversed_tx_count := v_reversed_tx_count + 1;
  END LOOP;

  -- Estorna indicação vinculada
  FOR v_ref IN
    SELECT * FROM public.referral_attributions
    WHERE booking_id = p_reservation_id
      AND current_stage <> 'REWARD_CANCELLED'
    FOR UPDATE
  LOOP
    UPDATE public.referral_attributions
      SET status = 'REVERSED',
          current_stage = 'REWARD_CANCELLED',
          reversal_reason = p_reason,
          reversed_at = now(),
          updated_at = now()
    WHERE id = v_ref.id;

    INSERT INTO public.referral_events (attribution_id, event_type, source, actor_user_id, idempotency_key, metadata)
    VALUES (
      v_ref.id,
      'REWARD_CANCELLED',
      'reverse_tx',
      v_caller_uid,
      'ref_cancel:' || v_ref.id::text || ':' || p_reservation_id::text,
      jsonb_build_object('reason', p_reason)
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'reversed_transactions', v_reversed_tx_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_checkin_and_referral_tx(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_checkin_and_referral_tx(uuid, text, uuid) TO authenticated, service_role;

COMMIT;

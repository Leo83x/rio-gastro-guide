-- ============================================================================
-- MIGRATION 011: MÓDULO DE INTEGRIDADE OPERACIONAL, OCORRÊNCIAS, EVIDÊNCIAS,
-- CONFIABILIDADE DO CONSUMIDOR E CONFORMIDADE DOS ESTABELECIMENTOS
-- ============================================================================
-- Reutiliza visit_proofs, venue_qr_tokens, checkin_audit_events,
-- rio_point_transactions, partner_fee_ledger, referral_attributions e
-- referral_events sem duplicar carteiras ou ledgers.
-- Não executar em produção sem validação explícita.

BEGIN;

-- ============================================================================
-- 1. TABELA DE OCORRÊNCIAS OPERACIONAIS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.operational_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text UNIQUE,
  category text NOT NULL CHECK (category IN ('CONSUMER', 'PARTNER', 'TECHNICAL')),
  subtype text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN (
    'OPEN',
    'WAITING_PARTNER',
    'WAITING_USER',
    'UNDER_REVIEW',
    'RESOLVED_USER',
    'RESOLVED_PARTNER',
    'RESOLVED_TECHNICAL',
    'UNFOUNDED',
    'CLOSED'
  )),
  severity text NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  offering_id uuid REFERENCES public.partner_offerings(id) ON DELETE SET NULL,
  visit_proof_id uuid REFERENCES public.visit_proofs(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  possible_fraud boolean NOT NULL DEFAULT false,
  assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_summary text,
  resolved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_incidents_status_created
  ON public.operational_incidents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_incidents_restaurant
  ON public.operational_incidents (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_incidents_user
  ON public.operational_incidents (user_id, created_at DESC);

ALTER TABLE public.operational_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consumidor le proprias ocorrencias" ON public.operational_incidents;
CREATE POLICY "Consumidor le proprias ocorrencias"
  ON public.operational_incidents
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Parceiro le ocorrencias do estabelecimento" ON public.operational_incidents;
CREATE POLICY "Parceiro le ocorrencias do estabelecimento"
  ON public.operational_incidents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_memberships pm
      WHERE pm.restaurant_id = operational_incidents.restaurant_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'APPROVED'
    )
  );

-- ============================================================================
-- 2. TRILHA IMUTÁVEL DE AUDITORIA E TRANSIÇÕES (incident_events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.operational_incidents(id) ON DELETE RESTRICT,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text NOT NULL CHECK (actor_role IN ('USER', 'PARTNER', 'ADMIN', 'SYSTEM')),
  event_type text NOT NULL CHECK (event_type IN (
    'INCIDENT_OPENED',
    'PARTNER_RESPONDED',
    'USER_RESPONDED',
    'EVIDENCE_ADDED',
    'STATUS_CHANGED',
    'POST_VISIT_CONFIRMED',
    'MEASURE_APPLIED',
    'TECHNICAL_CLASSIFIED',
    'CLOSED'
  )),
  previous_status text,
  new_status text,
  justification text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_events_incident_created
  ON public.incident_events (incident_id, created_at ASC);

ALTER TABLE public.incident_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partes vinculadas leem eventos da ocorrencia" ON public.incident_events;
CREATE POLICY "Partes vinculadas leem eventos da ocorrencia"
  ON public.incident_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.operational_incidents oi
      WHERE oi.id = incident_events.incident_id
        AND (
          oi.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.partner_memberships pm
            WHERE pm.restaurant_id = oi.restaurant_id
              AND pm.user_id = auth.uid()
              AND pm.status = 'APPROVED'
          )
        )
    )
  );

-- ============================================================================
-- 3. EVIDÊNCIAS DE OCORRÊNCIAS (incident_evidences)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.incident_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.operational_incidents(id) ON DELETE RESTRICT,
  submitted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_role text NOT NULL CHECK (submitted_by_role IN ('USER', 'PARTNER', 'ADMIN', 'SYSTEM')),
  evidence_type text NOT NULL CHECK (evidence_type IN (
    'TEXT_STATEMENT',
    'SCREENSHOT_URL',
    'RECEIPT_URL',
    'QR_DIAGNOSTIC',
    'GEO_SIGNAL',
    'SYSTEM_LOG'
  )),
  summary text NOT NULL,
  payload_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.incident_evidences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partes vinculadas leem evidencias da ocorrencia" ON public.incident_evidences;
CREATE POLICY "Partes vinculadas leem evidencias da ocorrencia"
  ON public.incident_evidences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.operational_incidents oi
      WHERE oi.id = incident_evidences.incident_id
        AND (
          oi.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.partner_memberships pm
            WHERE pm.restaurant_id = oi.restaurant_id
              AND pm.user_id = auth.uid()
              AND pm.status = 'APPROVED'
          )
        )
    )
  );

-- ============================================================================
-- 4. CONFIABILIDADE DO CONSUMIDOR E RESTRIÇÕES PROGRESSIVAS (NÃO PÚBLICAS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_reliability_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_reservations integer NOT NULL DEFAULT 0,
  confirmed_attendances integer NOT NULL DEFAULT 0,
  timely_cancellations integer NOT NULL DEFAULT 0,
  confirmed_no_shows integer NOT NULL DEFAULT 0,
  technical_incidents integer NOT NULL DEFAULT 0,
  upheld_disputes integer NOT NULL DEFAULT 0,
  proven_infractions integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_reliability_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario le proprio historico de confiabilidade" ON public.user_reliability_profiles;
CREATE POLICY "Usuario le proprio historico de confiabilidade"
  ON public.user_reliability_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.operational_incidents(id) ON DELETE SET NULL,
  measure_level text NOT NULL CHECK (measure_level IN (
    'EDUCATIONAL_NOTICE',
    'CANCELLATION_ATTENDANCE_GUIDANCE',
    'TEMP_PROMO_LIMIT',
    'EXTRA_CONFIRMATION_REQUIRED',
    'TEMP_FEATURE_SUSPENSION',
    'ACCOUNT_SUSPENSION'
  )),
  reason text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  review_eligible_at timestamptz,
  issued_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario le proprias restricoes" ON public.user_restrictions;
CREATE POLICY "Usuario le proprias restricoes"
  ON public.user_restrictions
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 5. CONFORMIDADE DOS ESTABELECIMENTOS E MEDIDAS PROGRESSIVAS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.partner_compliance_profiles (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  checkin_refusals integer NOT NULL DEFAULT 0,
  recurring_qr_failures integer NOT NULL DEFAULT 0,
  offer_complaints integer NOT NULL DEFAULT 0,
  valid_reservation_refusals integer NOT NULL DEFAULT 0,
  unhonored_benefits integer NOT NULL DEFAULT 0,
  attendance_divergences integer NOT NULL DEFAULT 0,
  confirmed_post_visits integer NOT NULL DEFAULT 0,
  manipulation_attempts integer NOT NULL DEFAULT 0,
  upheld_disputes_against_partner integer NOT NULL DEFAULT 0,
  monitoring_active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_compliance_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parceiro le propria conformidade" ON public.partner_compliance_profiles;
CREATE POLICY "Parceiro le propria conformidade"
  ON public.partner_compliance_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_memberships pm
      WHERE pm.restaurant_id = partner_compliance_profiles.restaurant_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'APPROVED'
    )
  );

CREATE TABLE IF NOT EXISTS public.partner_compliance_measures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  incident_id uuid REFERENCES public.operational_incidents(id) ON DELETE SET NULL,
  measure_level text NOT NULL CHECK (measure_level IN (
    'NOTICE_AND_GUIDANCE',
    'CLARIFICATION_REQUEST',
    'OPERATIONAL_TRAINING',
    'TEMPORARY_MONITORING',
    'OFFER_SUSPENSION',
    'TEMP_PARTNER_SUSPENSION',
    'PARTNER_DELISTING'
  )),
  reason text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  issued_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_compliance_measures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parceiro le proprias medidas" ON public.partner_compliance_measures;
CREATE POLICY "Parceiro le proprias medidas"
  ON public.partner_compliance_measures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_memberships pm
      WHERE pm.restaurant_id = partner_compliance_measures.restaurant_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'APPROVED'
    )
  );

-- ============================================================================
-- 6. RPC TRANSACIONAL: CONFIRMAÇÃO PÓS-VISITA EM CONTESTAÇÃO PROCEDENTE
-- ============================================================================
-- Executável exclusivamente por service_role após decisão administrativa.
-- Garante idempotência no ledger de pontos (rio_point_transactions) e na taxa
-- B2B (partner_fee_ledger), impedindo que o estabelecimento evite cobrança ao
-- recusar o QR ou que o consumidor receba pontos sem decisão comprovada.
CREATE OR REPLACE FUNCTION public.confirm_post_visit_incident_tx(
  p_incident_id uuid,
  p_admin_user_id uuid,
  p_justification text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inc public.operational_incidents;
  v_res public.reservations;
  v_proof_id uuid;
  v_checkin_points integer := 250;
  v_plan_fee numeric(10,2) := 10.00;
  v_tx_key text;
  v_fee_key text;
BEGIN
  IF current_setting('role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Operação restrita à autoridade administrativa do servidor.' USING ERRCODE = '42501';
  END IF;

  IF p_incident_id IS NULL OR trim(COALESCE(p_justification, '')) = '' THEN
    RAISE EXCEPTION 'Ocorrência e justificativa são obrigatórias.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_inc FROM public.operational_incidents WHERE id = p_incident_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ocorrência não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  IF v_inc.reservation_id IS NULL THEN
    RAISE EXCEPTION 'Ocorrência sem reserva vinculada para confirmação pós-visita.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_res FROM public.reservations WHERE id = v_inc.reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva vinculada não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  -- Atualiza ou cria visit_proof com operational_status = CONFIRMED_POST_VISIT
  SELECT id INTO v_proof_id
  FROM public.visit_proofs
  WHERE reservation_id = v_res.id
    AND participant_slot = 1
  LIMIT 1;

  IF v_proof_id IS NULL THEN
    INSERT INTO public.visit_proofs (
      restaurant_id, restaurant_name, reservation_id, user_id,
      participant_slot, participant_label, presence_level,
      evidence_method, guests_count, is_commercially_eligible,
      operational_status, dispute_reason, notes
    ) VALUES (
      v_res.restaurant_id, v_res.experience_name, v_res.id, v_res.user_id,
      1, 'Titular (Confirmado Pós-Visita)', 'VERIFIED_VISIT',
      'PARTNER_POST_CONSUMPTION', COALESCE(v_res.guests, 1), true,
      'CONFIRMED_POST_VISIT', p_justification,
      'Visita confirmada administrativamente após contestação #' || v_inc.id::text
    )
    RETURNING id INTO v_proof_id;
  ELSE
    UPDATE public.visit_proofs
      SET operational_status = 'CONFIRMED_POST_VISIT',
          is_commercially_eligible = true,
          dispute_reason = p_justification
    WHERE id = v_proof_id;
  END IF;

  UPDATE public.reservations
    SET lifecycle_stage = 'VERIFIED_VISIT',
        updated_at = now()
  WHERE id = v_res.id;

  -- Regra ativa de pontos de check-in
  SELECT COALESCE(per.points_amount, 250) INTO v_checkin_points
  FROM public.point_earning_rules per
  WHERE per.active = true AND per.scope_type = 'DEFAULT'
  ORDER BY per.updated_at DESC
  LIMIT 1;

  v_tx_key := 'post_visit_checkin:' || v_res.id::text || ':slot:1';
  INSERT INTO public.rio_point_transactions (
    user_id, amount, type, origin, description,
    experience_id, validation_status, reservation_id, visit_proof_id,
    idempotency_key
  ) VALUES (
    v_res.user_id, v_checkin_points, 'CREDIT', 'checkin',
    'Crédito pós-visita confirmado em análise de integridade (' || v_res.experience_name || ')',
    v_res.restaurant_id, 'RELEASED', v_res.id, v_proof_id, v_tx_key
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  -- Taxa B2B devida caso haja booking correspondente e elegível
  SELECT COALESCE(pcp.fee_amount_brl, 10.00) INTO v_plan_fee
  FROM public.partner_commercial_plans pcp
  WHERE pcp.restaurant_id = v_res.restaurant_id AND pcp.is_active = true
  ORDER BY pcp.created_at DESC
  LIMIT 1;

  v_fee_key := 'fee:' || v_res.id::text || ':slot:1';
  IF EXISTS (SELECT 1 FROM public.experience_bookings eb WHERE eb.id = v_res.id) THEN
    INSERT INTO public.partner_fee_ledger (
      booking_id, visit_proof_id, restaurant_id, billing_model, modality,
      attended_guests, unit_fee_brl, total_fee_brl, participant_slot,
      participant_id, participant_label, gross_fee_brl, net_fee_brl,
      attribution_origin, status, idempotency_key
    ) VALUES (
      v_res.id, v_proof_id, v_res.restaurant_id, 'PER_ATTENDED_GUEST',
      COALESCE(v_res.modality, 'TRADITIONAL_BOOKING'),
      1, v_plan_fee, v_plan_fee, 1,
      v_res.user_id::text, 'Titular (Pós-Visita)',
      v_plan_fee, v_plan_fee,
      COALESCE(v_res.attribution_origin, 'catalog'),
      'ACCRUED', v_fee_key
    )
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;
  END IF;

  INSERT INTO public.partner_compliance_profiles (restaurant_id, confirmed_post_visits, upheld_disputes_against_partner)
  VALUES (v_res.restaurant_id, 1, 1)
  ON CONFLICT (restaurant_id) DO UPDATE
    SET confirmed_post_visits = public.partner_compliance_profiles.confirmed_post_visits + 1,
        upheld_disputes_against_partner = public.partner_compliance_profiles.upheld_disputes_against_partner + 1,
        updated_at = now();

  INSERT INTO public.incident_events (
    incident_id, actor_user_id, actor_role, event_type,
    previous_status, new_status, justification, metadata
  ) VALUES (
    v_inc.id, p_admin_user_id, 'ADMIN', 'POST_VISIT_CONFIRMED',
    v_inc.status, 'RESOLVED_USER', p_justification,
    jsonb_build_object('visit_proof_id', v_proof_id, 'points_credited', v_checkin_points)
  );

  UPDATE public.operational_incidents
    SET status = 'RESOLVED_USER',
        visit_proof_id = v_proof_id,
        resolution_summary = p_justification,
        resolved_by_user_id = p_admin_user_id,
        resolved_at = now(),
        updated_at = now()
  WHERE id = v_inc.id;

  RETURN jsonb_build_object(
    'ok', true,
    'visit_proof_id', v_proof_id,
    'points_credited', v_checkin_points
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_post_visit_incident_tx(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_post_visit_incident_tx(uuid, uuid, text) TO service_role;

COMMIT;

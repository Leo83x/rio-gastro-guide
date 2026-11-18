-- ============================================================================
-- MIGRATION 009: REESTRUTURAÇÃO DA JORNADA DO ESTABELECIMENTO, OFERTAS UNIFICADAS
-- (INDIVIDUAL + MISSÃO COLETIVA PROGRESSIVA), COBRANÇA POR PARTICIPANTE ELEGÍVEL
-- E CRÉDITO COMERCIAL DE AQUISIÇÃO EM CAMPANHAS PATROCINADAS
-- ============================================================================

BEGIN;

-- 1. Evolução do Plano Comercial do Parceiro (Teto opcional por reserva + Cadastro Assistido)
ALTER TABLE IF EXISTS public.partner_commercial_plans
  ADD COLUMN IF NOT EXISTS max_billable_guests_per_booking INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_mode TEXT NOT NULL DEFAULT 'SELF_SERVE'
    CHECK (onboarding_mode IN ('SELF_SERVE', 'ASSISTED_BY_BORARIO')),
  ADD COLUMN IF NOT EXISTS onboarding_stage TEXT NOT NULL DEFAULT 'PUBLISHED'
    CHECK (onboarding_stage IN ('DRAFT', 'PENDING_PARTNER_APPROVAL', 'PUBLISHED')),
  ADD COLUMN IF NOT EXISTS responsible_name TEXT,
  ADD COLUMN IF NOT EXISTS responsible_role TEXT;

-- 2. Evolução do Ledger de Visitas Faturáveis: Cobrança por Participante Elegível (Slot Individual)
-- Remove restrição antiga de 1 linha por booking_id caso exista e substitui por (booking_id, participant_slot)
ALTER TABLE IF EXISTS public.partner_fee_ledger
  ADD COLUMN IF NOT EXISTS participant_slot INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS participant_id TEXT,
  ADD COLUMN IF NOT EXISTS participant_label TEXT,
  ADD COLUMN IF NOT EXISTS gross_fee_brl NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_abated_brl NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_fee_brl NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sponsored_campaign_id UUID DEFAULT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'partner_fee_ledger_booking_id_key'
  ) THEN
    ALTER TABLE public.partner_fee_ledger DROP CONSTRAINT partner_fee_ledger_booking_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_fee_ledger_booking_participant_slot
  ON public.partner_fee_ledger (booking_id, participant_slot);

-- 3. Evolução de partner_offerings: Uma Oferta, Duas Modalidades de Distribuição
-- (Modalidade A: Oferta Individual | Modalidade B: Missão Coletiva Progressiva)
ALTER TABLE IF EXISTS public.partner_offerings
  ADD COLUMN IF NOT EXISTS distribution_mode TEXT NOT NULL DEFAULT 'INDIVIDUAL'
    CHECK (distribution_mode IN ('INDIVIDUAL', 'COLLECTIVE_MISSION')),
  ADD COLUMN IF NOT EXISTS initial_guaranteed_benefit TEXT,
  ADD COLUMN IF NOT EXISTS progressive_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS valid_adhesions_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verified_visits_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_sponsored BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sponsored_campaign_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by_mode TEXT NOT NULL DEFAULT 'SELF_SERVE'
    CHECK (created_by_mode IN ('SELF_SERVE', 'ASSISTED_BY_BORARIO'));

-- 4. Tabela de Adesões de Oferta (Separação estrita entre Interesse, Adesão Válida, Reserva e Visita)
CREATE TABLE IF NOT EXISTS public.offering_adhesions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_label TEXT,
  reservation_id TEXT,
  adhesion_stage TEXT NOT NULL DEFAULT 'VALID_ADHESION'
    CHECK (adhesion_stage IN (
      'INTEREST',
      'VALID_ADHESION',
      'RESERVATION',
      'VERIFIED_VISIT',
      'CONFIRMED_ATTENDANCE',
      'CANCELLED'
    )),
  unlocked_tier_level INT NOT NULL DEFAULT 1,
  unlocked_benefit_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (offering_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_offering_adhesions_offering
  ON public.offering_adhesions (offering_id, adhesion_stage);

-- 5. Tabela de Campanhas Patrocinadas com Crédito Comercial de Aquisição
CREATE TABLE IF NOT EXISTS public.partner_sponsored_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id TEXT NOT NULL,
  restaurant_name TEXT NOT NULL,
  offering_id TEXT NOT NULL,
  offering_title TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED')),
  investment_brl NUMERIC(10, 2) NOT NULL CHECK (investment_brl >= 0),
  credit_conversion_pct NUMERIC(5, 2) NOT NULL DEFAULT 50.00
    CHECK (credit_conversion_pct >= 0 AND credit_conversion_pct <= 100),
  initial_acquisition_credit_brl NUMERIC(10, 2) NOT NULL DEFAULT 0,
  used_acquisition_credit_brl NUMERIC(10, 2) NOT NULL DEFAULT 0,
  remaining_acquisition_credit_brl NUMERIC(10, 2) NOT NULL DEFAULT 0,
  net_ad_revenue_brl NUMERIC(10, 2) NOT NULL DEFAULT 0,
  target_neighborhoods TEXT[] DEFAULT ARRAY[]::TEXT[],
  target_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  duration_days INT NOT NULL DEFAULT 14,
  impressions_count INT NOT NULL DEFAULT 0,
  clicks_count INT NOT NULL DEFAULT 0,
  attributed_adhesions_count INT NOT NULL DEFAULT 0,
  attributed_billable_visits_count INT NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  credits_expire_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sponsored_campaigns_restaurant
  ON public.partner_sponsored_campaigns (restaurant_id, status);

-- 6. Ledger Auditável de Crédito de Aquisição (Concessão, Abatimento por Visita e Expiração)
CREATE TABLE IF NOT EXISTS public.partner_acquisition_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.partner_sponsored_campaigns(id) ON DELETE CASCADE,
  restaurant_id TEXT NOT NULL,
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('CREDIT_GRANTED', 'ABATED_ON_CHECKIN', 'CREDIT_EXPIRED')),
  amount_brl NUMERIC(10, 2) NOT NULL,
  balance_after_brl NUMERIC(10, 2) NOT NULL,
  booking_id TEXT,
  participant_slot INT,
  visit_proof_id TEXT,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acq_credit_ledger_restaurant
  ON public.partner_acquisition_credit_ledger (restaurant_id, created_at DESC);

-- 7. RLS Policies
ALTER TABLE public.offering_adhesions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_sponsored_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_acquisition_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read offering adhesions" ON public.offering_adhesions;
CREATE POLICY "Public read offering adhesions"
  ON public.offering_adhesions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users manage own offering adhesions" ON public.offering_adhesions;
CREATE POLICY "Users manage own offering adhesions"
  ON public.offering_adhesions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read active sponsored campaigns" ON public.partner_sponsored_campaigns;
CREATE POLICY "Public read active sponsored campaigns"
  ON public.partner_sponsored_campaigns FOR SELECT USING (true);

DROP POLICY IF EXISTS "Partners manage own sponsored campaigns" ON public.partner_sponsored_campaigns;
CREATE POLICY "Partners manage own sponsored campaigns"
  ON public.partner_sponsored_campaigns FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Partners read own acquisition credit ledger" ON public.partner_acquisition_credit_ledger;
CREATE POLICY "Partners read own acquisition credit ledger"
  ON public.partner_acquisition_credit_ledger FOR SELECT USING (true);

COMMIT;

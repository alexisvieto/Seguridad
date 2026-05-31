-- ============================================================================
-- Migration 00013: Payroll & Compensation Module (Phase 4)
-- Panama security industry flat-rate model (12h shifts, biweekly periods)
-- Tables: payroll_configs, payroll_periods, payroll_agent_consolidated
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE public.payroll_configs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ordinary_hours_limit        NUMERIC(5, 2) NOT NULL DEFAULT 96.00,
  overtime_flat_rate           BOOLEAN NOT NULL DEFAULT true,
  pays_holiday_premium        BOOLEAN NOT NULL DEFAULT true,
  social_security_rate         NUMERIC(5, 4) NOT NULL DEFAULT 0.0975,
  educational_insurance_rate   NUMERIC(5, 4) NOT NULL DEFAULT 0.0125,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payroll_configs_tenant_unique UNIQUE (tenant_id),
  CONSTRAINT valid_ss_rate CHECK (social_security_rate >= 0 AND social_security_rate < 1),
  CONSTRAINT valid_ei_rate CHECK (educational_insurance_rate >= 0 AND educational_insurance_rate < 1)
);

COMMENT ON TABLE public.payroll_configs IS 'Per-tenant payroll parameters — Panama flat-rate model for 12h security shifts';
COMMENT ON COLUMN public.payroll_configs.ordinary_hours_limit IS 'Biweekly standard hours cap (default: 12 days x 8h = 96h)';
COMMENT ON COLUMN public.payroll_configs.overtime_flat_rate IS 'When TRUE, overtime pays same rate as ordinary (industry standard)';
COMMENT ON COLUMN public.payroll_configs.social_security_rate IS 'CSS employee retention rate (9.75% by law)';
COMMENT ON COLUMN public.payroll_configs.educational_insurance_rate IS 'Seguro Educativo retention rate (1.25% by law)';

-- ---------------------------------------------------------------------------

CREATE TABLE public.payroll_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'calculado', 'cerrado_pagado')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_period_dates CHECK (end_date > start_date),
  CONSTRAINT payroll_period_tenant_dates_unique UNIQUE (tenant_id, start_date, end_date)
);

COMMENT ON TABLE public.payroll_periods IS 'Biweekly pay periods — open → calculated → closed/paid';

-- ---------------------------------------------------------------------------

CREATE TABLE public.payroll_agent_consolidated (
  id                                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payroll_period_id                 UUID NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  user_id                           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rate_per_hour                     NUMERIC(5, 2) NOT NULL DEFAULT 3.04,
  regular_hours_accumulated         NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  overtime_hours_accumulated        NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  holiday_hours_accumulated         NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  adjustments_addition              NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  adjustments_deduction             NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  gross_salary                      NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  social_security_deduction         NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  educational_insurance_deduction   NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  net_salary                        NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payroll_agent_period_unique UNIQUE (payroll_period_id, user_id),
  CONSTRAINT non_negative_hours CHECK (
    regular_hours_accumulated >= 0
    AND overtime_hours_accumulated >= 0
    AND holiday_hours_accumulated >= 0
  ),
  CONSTRAINT non_negative_amounts CHECK (
    adjustments_addition >= 0
    AND adjustments_deduction >= 0
    AND gross_salary >= 0
    AND social_security_deduction >= 0
    AND educational_insurance_deduction >= 0
    AND net_salary >= 0
  )
);

COMMENT ON TABLE public.payroll_agent_consolidated IS 'Per-agent biweekly payroll — mirrors the MICRO spreadsheet tab';
COMMENT ON COLUMN public.payroll_agent_consolidated.rate_per_hour IS 'Agent hourly rate from contract (default: B/.3.04)';
COMMENT ON COLUMN public.payroll_agent_consolidated.regular_hours_accumulated IS 'Standard hours capped at ordinary_hours_limit (96h)';
COMMENT ON COLUMN public.payroll_agent_consolidated.overtime_hours_accumulated IS 'Hours beyond cap — same rate if overtime_flat_rate=true';
COMMENT ON COLUMN public.payroll_agent_consolidated.adjustments_addition IS 'AD SALARIO — bonuses, recognitions, extras';
COMMENT ON COLUMN public.payroll_agent_consolidated.adjustments_deduction IS 'OTROS DESC — equipment loss deductions, loans, fines';
COMMENT ON COLUMN public.payroll_agent_consolidated.net_salary IS 'Final ACH transfer amount';

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_payroll_configs_tenant      ON public.payroll_configs (tenant_id);
CREATE INDEX idx_payroll_periods_tenant      ON public.payroll_periods (tenant_id);
CREATE INDEX idx_payroll_consolidated_tenant ON public.payroll_agent_consolidated (tenant_id);

-- Period lookups
CREATE INDEX idx_payroll_periods_status      ON public.payroll_periods (tenant_id, status);
CREATE INDEX idx_payroll_periods_dates       ON public.payroll_periods (tenant_id, start_date, end_date);

-- Agent payroll lookups
CREATE INDEX idx_payroll_consolidated_period ON public.payroll_agent_consolidated (payroll_period_id);
CREATE INDEX idx_payroll_consolidated_user   ON public.payroll_agent_consolidated (user_id);

-- Open periods for dashboard
CREATE INDEX idx_payroll_periods_open        ON public.payroll_periods (tenant_id)
  WHERE status = 'abierto';

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_payroll_configs_updated
  BEFORE UPDATE ON public.payroll_configs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_payroll_periods_updated
  BEFORE UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_payroll_consolidated_updated
  BEFORE UPDATE ON public.payroll_agent_consolidated
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-initialize payroll_configs when a new tenant is created
CREATE OR REPLACE FUNCTION public.handle_new_tenant_payroll()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.payroll_configs (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tenant_created_init_payroll
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant_payroll();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.payroll_configs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_periods             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_agent_consolidated  ENABLE ROW LEVEL SECURITY;

-- PAYROLL_CONFIGS -----------------------------------------------------------

CREATE POLICY "payroll_configs_select_admin"
  ON public.payroll_configs FOR SELECT
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "payroll_configs_update_owner"
  ON public.payroll_configs FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- PAYROLL_PERIODS -----------------------------------------------------------

CREATE POLICY "payroll_periods_select_admin"
  ON public.payroll_periods FOR SELECT
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "payroll_periods_insert_admin"
  ON public.payroll_periods FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "payroll_periods_update_admin"
  ON public.payroll_periods FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "payroll_periods_delete_owner"
  ON public.payroll_periods FOR DELETE
  USING (
    public.get_user_role_in_tenant(tenant_id) = 'owner'
    AND status = 'abierto'
  );

-- PAYROLL_AGENT_CONSOLIDATED ------------------------------------------------

CREATE POLICY "payroll_consolidated_select_admin"
  ON public.payroll_agent_consolidated FOR SELECT
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

-- Agents can see their own payroll records
CREATE POLICY "payroll_consolidated_select_own"
  ON public.payroll_agent_consolidated FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND user_id = auth.uid()
  );

CREATE POLICY "payroll_consolidated_insert_admin"
  ON public.payroll_agent_consolidated FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "payroll_consolidated_update_admin"
  ON public.payroll_agent_consolidated FOR UPDATE
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

CREATE POLICY "payroll_consolidated_delete_owner"
  ON public.payroll_agent_consolidated FOR DELETE
  USING (
    public.get_user_role_in_tenant(tenant_id) = 'owner'
  );

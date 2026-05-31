-- ============================================================================
-- Migration 00007: HR Module — Agent Profiles, Contracts, Disciplinary (Phase 3)
-- Tables: hr_agent_profiles, hr_contracts, hr_disciplinary_records
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE public.hr_agent_profiles (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  css_number                TEXT CHECK (char_length(css_number) <= 50),
  life_insurance_policy     TEXT CHECK (char_length(life_insurance_policy) <= 100),
  security_carnet_number    TEXT CHECK (char_length(security_carnet_number) <= 100),
  carnet_expiry_date        DATE,
  hire_date                 DATE NOT NULL DEFAULT CURRENT_DATE,
  emergency_contact_name    TEXT CHECK (char_length(emergency_contact_name) <= 200),
  emergency_contact_phone   TEXT CHECK (char_length(emergency_contact_phone) <= 30),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT hr_profile_tenant_user_unique UNIQUE (tenant_id, user_id)
);

COMMENT ON TABLE public.hr_agent_profiles IS 'Extended HR profile per agent — social security, insurance, carnet';
COMMENT ON COLUMN public.hr_agent_profiles.css_number IS 'Caja de Seguro Social number';
COMMENT ON COLUMN public.hr_agent_profiles.security_carnet_number IS 'Official security regulator carnet ID';

-- ---------------------------------------------------------------------------

CREATE TABLE public.hr_contracts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_type         TEXT NOT NULL CHECK (contract_type IN ('definido', 'indefinido')),
  start_date            DATE NOT NULL,
  end_date              DATE,
  base_salary           NUMERIC(10, 2) NOT NULL CHECK (base_salary > 0),
  status                TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'vencido', 'terminado')),
  termination_reason    TEXT CHECK (char_length(termination_reason) <= 1000),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT contract_end_date_required CHECK (
    contract_type = 'indefinido' OR end_date IS NOT NULL
  )
);

COMMENT ON TABLE public.hr_contracts IS 'Employment contracts with salary, type, and termination tracking';
COMMENT ON COLUMN public.hr_contracts.end_date IS 'Required for definido contracts, NULL for indefinido';

-- ---------------------------------------------------------------------------

CREATE TABLE public.hr_disciplinary_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  record_type       TEXT NOT NULL CHECK (record_type IN ('llamado_atencion', 'falta', 'suspension')),
  description       TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 5000),
  start_date        DATE NOT NULL,
  end_date          DATE,
  registered_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hr_disciplinary_records IS 'Disciplinary actions — warnings, faults, suspensions';
COMMENT ON COLUMN public.hr_disciplinary_records.registered_by IS 'HR supervisor who applied the action';

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_hr_profiles_tenant        ON public.hr_agent_profiles (tenant_id);
CREATE INDEX idx_hr_contracts_tenant       ON public.hr_contracts (tenant_id);
CREATE INDEX idx_hr_disciplinary_tenant    ON public.hr_disciplinary_records (tenant_id);

-- User lookups
CREATE INDEX idx_hr_profiles_user          ON public.hr_agent_profiles (user_id);
CREATE INDEX idx_hr_contracts_user         ON public.hr_contracts (user_id);
CREATE INDEX idx_hr_disciplinary_user      ON public.hr_disciplinary_records (user_id);

-- HR dashboard alerts: expiring carnets
CREATE INDEX idx_hr_carnet_expiry          ON public.hr_agent_profiles (carnet_expiry_date)
  WHERE carnet_expiry_date IS NOT NULL;

-- HR dashboard alerts: contracts ending soon or expired
CREATE INDEX idx_hr_contracts_end_status   ON public.hr_contracts (end_date, status)
  WHERE end_date IS NOT NULL;

-- Active contracts per agent
CREATE INDEX idx_hr_contracts_active       ON public.hr_contracts (tenant_id, user_id, status)
  WHERE status = 'activo';

-- Disciplinary by type for reports
CREATE INDEX idx_hr_disciplinary_type      ON public.hr_disciplinary_records (tenant_id, record_type);

-- Disciplinary by registrant
CREATE INDEX idx_hr_disciplinary_registered ON public.hr_disciplinary_records (registered_by)
  WHERE registered_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_hr_agent_profiles_updated
  BEFORE UPDATE ON public.hr_agent_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_hr_contracts_updated
  BEFORE UPDATE ON public.hr_contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_hr_disciplinary_updated
  BEFORE UPDATE ON public.hr_disciplinary_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.hr_agent_profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_contracts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_disciplinary_records ENABLE ROW LEVEL SECURITY;

-- HR_AGENT_PROFILES ---------------------------------------------------------

CREATE POLICY "hr_profiles_select_member"
  ON public.hr_agent_profiles FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "hr_profiles_insert_admin"
  ON public.hr_agent_profiles FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "hr_profiles_update_admin"
  ON public.hr_agent_profiles FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "hr_profiles_delete_owner"
  ON public.hr_agent_profiles FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- HR_CONTRACTS --------------------------------------------------------------

CREATE POLICY "hr_contracts_select_member"
  ON public.hr_contracts FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "hr_contracts_insert_admin"
  ON public.hr_contracts FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "hr_contracts_update_admin"
  ON public.hr_contracts FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "hr_contracts_delete_owner"
  ON public.hr_contracts FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- HR_DISCIPLINARY_RECORDS ---------------------------------------------------

CREATE POLICY "hr_disciplinary_select_member"
  ON public.hr_disciplinary_records FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "hr_disciplinary_insert_admin"
  ON public.hr_disciplinary_records FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "hr_disciplinary_update_admin"
  ON public.hr_disciplinary_records FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "hr_disciplinary_delete_owner"
  ON public.hr_disciplinary_records FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

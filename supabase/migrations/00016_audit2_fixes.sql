-- ============================================================================
-- Migration 00016: Audit 2 Fixes
-- RLS tightening, gps_device_id per-tenant, contract default status
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A1: hr_employee_vault — restrict SELECT to admin + own docs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "vault_select_member" ON public.hr_employee_vault;

CREATE POLICY "vault_select_admin"
  ON public.hr_employee_vault FOR SELECT
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "vault_select_own"
  ON public.hr_employee_vault FOR SELECT
  USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT public.get_user_tenant_ids())
  );

-- ---------------------------------------------------------------------------
-- A2: hr_agent_profiles — restrict SELECT to admin + own profile
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "hr_profiles_select_member" ON public.hr_agent_profiles;

CREATE POLICY "hr_profiles_select_admin"
  ON public.hr_agent_profiles FOR SELECT
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "hr_profiles_select_own"
  ON public.hr_agent_profiles FOR SELECT
  USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT public.get_user_tenant_ids())
  );

-- ---------------------------------------------------------------------------
-- A3: hr_disciplinary_records — restrict SELECT to admin + own records
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "hr_disciplinary_select_member" ON public.hr_disciplinary_records;

CREATE POLICY "hr_disciplinary_select_admin"
  ON public.hr_disciplinary_records FOR SELECT
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "hr_disciplinary_select_own"
  ON public.hr_disciplinary_records FOR SELECT
  USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT public.get_user_tenant_ids())
  );

-- ---------------------------------------------------------------------------
-- A5: gps_device_id — change from global UNIQUE to per-tenant UNIQUE
-- ---------------------------------------------------------------------------

ALTER TABLE public.fleet_vehicles DROP CONSTRAINT IF EXISTS fleet_vehicles_gps_device_id_key;

CREATE UNIQUE INDEX idx_fleet_gps_device_tenant
  ON public.fleet_vehicles (tenant_id, gps_device_id)
  WHERE gps_device_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- A6: hr_contracts — change default status to pendiente_sello
-- ---------------------------------------------------------------------------

ALTER TABLE public.hr_contracts ALTER COLUMN status SET DEFAULT 'pendiente_sello';

-- ---------------------------------------------------------------------------
-- Remove redundant GPS index (R3 from audit)
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_gps_logs_vehicle_time;

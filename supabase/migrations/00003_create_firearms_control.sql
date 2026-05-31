-- ============================================================================
-- Migration 00003: Firearms Control Module (Phase 2)
-- Tables: firearms_inventory, agent_compliance, firearms_assignments
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE public.firearms_inventory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  serial_number       TEXT NOT NULL,
  type                TEXT NOT NULL CHECK (type IN ('revolver', 'pistola', 'escopeta')),
  brand               TEXT NOT NULL CHECK (char_length(brand) BETWEEN 1 AND 100),
  model               TEXT NOT NULL CHECK (char_length(model) BETWEEN 1 AND 100),
  status              TEXT NOT NULL DEFAULT 'operativa' CHECK (status IN ('operativa', 'mantenimiento', 'retirada')),
  permit_number       TEXT NOT NULL CHECK (char_length(permit_number) BETWEEN 1 AND 100),
  permit_expiry_date  DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT firearms_serial_tenant_unique UNIQUE (tenant_id, serial_number)
);

COMMENT ON TABLE public.firearms_inventory IS 'Registered firearms per tenant with permit tracking';
COMMENT ON COLUMN public.firearms_inventory.permit_expiry_date IS 'Permit expiration — drives alert semaphore';

-- ---------------------------------------------------------------------------

CREATE TABLE public.agent_compliance (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shooting_test_expiry    DATE NOT NULL,
  psych_test_expiry       DATE NOT NULL,
  doping_test_expiry      DATE NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT agent_compliance_tenant_user_unique UNIQUE (tenant_id, user_id)
);

COMMENT ON TABLE public.agent_compliance IS 'Agent certification expiry tracking — one record per agent per tenant';

-- ---------------------------------------------------------------------------

CREATE TABLE public.firearms_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  firearm_id          UUID NOT NULL REFERENCES public.firearms_inventory(id) ON DELETE CASCADE,
  work_station_id     UUID REFERENCES public.work_stations(id) ON DELETE SET NULL,
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at         TIMESTAMPTZ,
  notes               TEXT CHECK (char_length(notes) <= 1000),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT assignment_must_have_target CHECK (
    work_station_id IS NOT NULL OR user_id IS NOT NULL
  )
);

COMMENT ON TABLE public.firearms_assignments IS 'Tracks which firearm is assigned to which station or agent';

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_firearms_inv_tenant        ON public.firearms_inventory (tenant_id);
CREATE INDEX idx_agent_compliance_tenant    ON public.agent_compliance (tenant_id);
CREATE INDEX idx_firearms_assign_tenant     ON public.firearms_assignments (tenant_id);

-- Alert semaphore queries (expiry dates)
CREATE INDEX idx_firearms_permit_expiry     ON public.firearms_inventory (permit_expiry_date);
CREATE INDEX idx_compliance_shooting_expiry ON public.agent_compliance (shooting_test_expiry);
CREATE INDEX idx_compliance_psych_expiry    ON public.agent_compliance (psych_test_expiry);
CREATE INDEX idx_compliance_doping_expiry   ON public.agent_compliance (doping_test_expiry);

-- Assignment lookups
CREATE INDEX idx_firearms_assign_firearm    ON public.firearms_assignments (firearm_id);
CREATE INDEX idx_firearms_assign_station    ON public.firearms_assignments (work_station_id);
CREATE INDEX idx_firearms_assign_user       ON public.firearms_assignments (user_id);
CREATE INDEX idx_firearms_assign_active     ON public.firearms_assignments (firearm_id)
  WHERE returned_at IS NULL;

-- Status filtering
CREATE INDEX idx_firearms_inv_status        ON public.firearms_inventory (tenant_id, status);

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS (updated_at)
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_firearms_inventory_updated
  BEFORE UPDATE ON public.firearms_inventory
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_agent_compliance_updated
  BEFORE UPDATE ON public.agent_compliance
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_firearms_assignments_updated
  BEFORE UPDATE ON public.firearms_assignments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.firearms_inventory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_compliance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firearms_assignments ENABLE ROW LEVEL SECURITY;

-- FIREARMS_INVENTORY --------------------------------------------------------

CREATE POLICY "firearms_inv_select_member"
  ON public.firearms_inventory FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "firearms_inv_insert_admin"
  ON public.firearms_inventory FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

CREATE POLICY "firearms_inv_update_admin"
  ON public.firearms_inventory FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "firearms_inv_delete_owner"
  ON public.firearms_inventory FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- AGENT_COMPLIANCE ----------------------------------------------------------

CREATE POLICY "compliance_select_member"
  ON public.agent_compliance FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "compliance_insert_admin"
  ON public.agent_compliance FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

CREATE POLICY "compliance_update_admin"
  ON public.agent_compliance FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "compliance_delete_owner"
  ON public.agent_compliance FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- FIREARMS_ASSIGNMENTS ------------------------------------------------------

CREATE POLICY "firearms_assign_select_member"
  ON public.firearms_assignments FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "firearms_assign_insert_admin"
  ON public.firearms_assignments FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

CREATE POLICY "firearms_assign_update_admin"
  ON public.firearms_assignments FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "firearms_assign_delete_owner"
  ON public.firearms_assignments FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

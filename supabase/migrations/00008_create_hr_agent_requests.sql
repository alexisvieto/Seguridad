-- ============================================================================
-- Migration 00008: HR Agent Requests — internal request portal (Phase 3)
-- Table: hr_agent_requests
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLE
-- ---------------------------------------------------------------------------

CREATE TABLE public.hr_agent_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type    TEXT NOT NULL CHECK (request_type IN ('nuevo_uniforme', 'vacaciones', 'carta_trabajo', 'permiso_remunerado')),
  details         TEXT NOT NULL CHECK (char_length(details) BETWEEN 1 AND 5000),
  status          TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
  reviewed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_notes    TEXT CHECK (char_length(review_notes) <= 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hr_agent_requests IS 'Agent self-service portal — uniform, vacation, letter, and leave requests';

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX idx_hr_requests_tenant      ON public.hr_agent_requests (tenant_id);
CREATE INDEX idx_hr_requests_user        ON public.hr_agent_requests (user_id);
CREATE INDEX idx_hr_requests_pending     ON public.hr_agent_requests (tenant_id, status)
  WHERE status = 'pendiente';
CREATE INDEX idx_hr_requests_type        ON public.hr_agent_requests (tenant_id, request_type);

-- ---------------------------------------------------------------------------
-- 3. TRIGGER
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_hr_agent_requests_updated
  BEFORE UPDATE ON public.hr_agent_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (strict agent isolation)
-- ---------------------------------------------------------------------------

ALTER TABLE public.hr_agent_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: agents see only their own, admins see all in tenant
CREATE POLICY "hr_requests_select_own"
  ON public.hr_agent_requests FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      user_id = auth.uid()
      OR public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
    )
  );

-- INSERT: any tenant member can create their own request
CREATE POLICY "hr_requests_insert_own"
  ON public.hr_agent_requests FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND user_id = auth.uid()
  );

-- UPDATE: only admin/owner can review (approve/reject)
CREATE POLICY "hr_requests_update_admin"
  ON public.hr_agent_requests FOR UPDATE
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

-- DELETE: only owner
CREATE POLICY "hr_requests_delete_owner"
  ON public.hr_agent_requests FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

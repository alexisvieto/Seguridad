-- ============================================================================
-- Migration 00017: Medical leaves / incapacidades
-- ============================================================================

CREATE TABLE public.hr_medical_leaves (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date      DATE NOT NULL,
  days            INT NOT NULL CHECK (days > 0),
  reason          TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  clinic          TEXT CHECK (char_length(clinic) <= 200),
  doctor          TEXT CHECK (char_length(doctor) <= 200),
  certificate_url TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_medical_leaves_tenant ON public.hr_medical_leaves (tenant_id);
CREATE INDEX idx_medical_leaves_user ON public.hr_medical_leaves (user_id);

CREATE TRIGGER on_medical_leaves_updated BEFORE UPDATE ON public.hr_medical_leaves FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.hr_medical_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medical_leaves_select_admin" ON public.hr_medical_leaves FOR SELECT
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));
CREATE POLICY "medical_leaves_select_own" ON public.hr_medical_leaves FOR SELECT
  USING (user_id = auth.uid() AND tenant_id IN (SELECT public.get_user_tenant_ids()));
CREATE POLICY "medical_leaves_insert_admin" ON public.hr_medical_leaves FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));
CREATE POLICY "medical_leaves_update_admin" ON public.hr_medical_leaves FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));
CREATE POLICY "medical_leaves_delete_owner" ON public.hr_medical_leaves FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- ============================================================================
-- Migration 00018: Station consignas (standing orders per post)
-- ============================================================================

CREATE TABLE public.station_consignas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_station_id UUID NOT NULL REFERENCES public.work_stations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 300),
  description     TEXT CHECK (char_length(description) <= 2000),
  priority        TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta', 'critica')),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.station_consignas IS 'Standing orders per work station — tasks agents must complete each shift';

CREATE INDEX idx_consignas_tenant ON public.station_consignas (tenant_id);
CREATE INDEX idx_consignas_station ON public.station_consignas (work_station_id);
CREATE INDEX idx_consignas_active ON public.station_consignas (work_station_id, is_active) WHERE is_active = true;

CREATE TRIGGER on_consignas_updated BEFORE UPDATE ON public.station_consignas FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.station_consignas ENABLE ROW LEVEL SECURITY;

-- All tenant members can read (agents need to see their tasks)
CREATE POLICY "consignas_select_member" ON public.station_consignas FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "consignas_insert_admin" ON public.station_consignas FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "consignas_update_admin" ON public.station_consignas FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "consignas_delete_admin" ON public.station_consignas FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

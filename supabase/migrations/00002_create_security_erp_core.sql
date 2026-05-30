-- ============================================================================
-- Migration 00002: Security ERP Core (Phase 1)
-- Tables: properties_ph, work_stations, agent_shifts, incidents_log
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------------

CREATE TYPE public.incident_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- ---------------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------------

-- Properties (PHs / Clients) -----------------------------------------------
CREATE TABLE public.properties_ph (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 200),
  address             TEXT NOT NULL CHECK (char_length(address) BETWEEN 5 AND 500),
  contact_emergency   JSONB NOT NULL DEFAULT '[]',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.properties_ph IS 'Client properties (PHs) managed by the security company';
COMMENT ON COLUMN public.properties_ph.contact_emergency IS 'Array of {name, phone, role} emergency contacts';

-- Work Stations -------------------------------------------------------------
CREATE TABLE public.work_stations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id         UUID NOT NULL REFERENCES public.properties_ph(id) ON DELETE CASCADE,
  name                TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  qr_code_token       TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.work_stations IS 'Guard posts within a property, each with a unique QR for check-in';
COMMENT ON COLUMN public.work_stations.qr_code_token IS 'Unique token embedded in QR code for attendance scanning';

-- Agent Shifts (Attendance) -------------------------------------------------
CREATE TABLE public.agent_shifts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_station_id     UUID NOT NULL REFERENCES public.work_stations(id) ON DELETE CASCADE,
  clock_in            TIMESTAMPTZ NOT NULL DEFAULT now(),
  clock_out           TIMESTAMPTZ,
  clock_in_gps        JSONB NOT NULL DEFAULT '{}',
  clock_out_gps       JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_shifts IS 'Guard attendance records with QR scan and GPS verification';
COMMENT ON COLUMN public.agent_shifts.clock_in_gps IS '{lat: number, lng: number, accuracy: number}';
COMMENT ON COLUMN public.agent_shifts.clock_out_gps IS '{lat: number, lng: number, accuracy: number}';

-- Incidents Log -------------------------------------------------------------
CREATE TABLE public.incidents_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_station_id     UUID NOT NULL REFERENCES public.work_stations(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_text            TEXT NOT NULL CHECK (char_length(raw_text) BETWEEN 1 AND 5000),
  ai_refined_text     TEXT,
  status              public.incident_status NOT NULL DEFAULT 'open',
  am_report_sent      BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.incidents_log IS 'Incident logbook — raw guard input refined by AI for the 8AM report';
COMMENT ON COLUMN public.incidents_log.raw_text IS 'Original text written by the guard';
COMMENT ON COLUMN public.incidents_log.ai_refined_text IS 'AI-processed professional version for reports';

-- ---------------------------------------------------------------------------
-- 3. INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX idx_properties_tenant       ON public.properties_ph (tenant_id);
CREATE INDEX idx_work_stations_tenant    ON public.work_stations (tenant_id);
CREATE INDEX idx_work_stations_property  ON public.work_stations (property_id);
CREATE INDEX idx_agent_shifts_tenant     ON public.agent_shifts (tenant_id);
CREATE INDEX idx_agent_shifts_user       ON public.agent_shifts (user_id);
CREATE INDEX idx_agent_shifts_station    ON public.agent_shifts (work_station_id);
CREATE INDEX idx_agent_shifts_clock_in   ON public.agent_shifts (clock_in);
CREATE INDEX idx_incidents_tenant        ON public.incidents_log (tenant_id);
CREATE INDEX idx_incidents_station       ON public.incidents_log (work_station_id);
CREATE INDEX idx_incidents_user          ON public.incidents_log (user_id);
CREATE INDEX idx_incidents_status        ON public.incidents_log (status);
CREATE INDEX idx_incidents_created       ON public.incidents_log (created_at);
CREATE INDEX idx_incidents_am_report     ON public.incidents_log (am_report_sent) WHERE am_report_sent = false;

-- ---------------------------------------------------------------------------
-- 4. TRIGGERS (updated_at)
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_properties_ph_updated
  BEFORE UPDATE ON public.properties_ph
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_work_stations_updated
  BEFORE UPDATE ON public.work_stations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_agent_shifts_updated
  BEFORE UPDATE ON public.agent_shifts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_incidents_log_updated
  BEFORE UPDATE ON public.incidents_log
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.properties_ph  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_stations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_shifts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents_log  ENABLE ROW LEVEL SECURITY;

-- PROPERTIES_PH -------------------------------------------------------------

CREATE POLICY "properties_select_member"
  ON public.properties_ph FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "properties_insert_admin"
  ON public.properties_ph FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

CREATE POLICY "properties_update_admin"
  ON public.properties_ph FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "properties_delete_owner"
  ON public.properties_ph FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- WORK_STATIONS --------------------------------------------------------------

CREATE POLICY "stations_select_member"
  ON public.work_stations FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "stations_insert_admin"
  ON public.work_stations FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

CREATE POLICY "stations_update_admin"
  ON public.work_stations FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "stations_delete_admin"
  ON public.work_stations FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

-- AGENT_SHIFTS ---------------------------------------------------------------

CREATE POLICY "shifts_select_member"
  ON public.agent_shifts FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "shifts_insert_editor"
  ON public.agent_shifts FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin', 'editor')
    AND user_id = auth.uid()
  );

CREATE POLICY "shifts_update_own_or_admin"
  ON public.agent_shifts FOR UPDATE
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
    OR user_id = auth.uid()
  );

CREATE POLICY "shifts_delete_admin"
  ON public.agent_shifts FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

-- INCIDENTS_LOG --------------------------------------------------------------

CREATE POLICY "incidents_select_member"
  ON public.incidents_log FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "incidents_insert_editor"
  ON public.incidents_log FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin', 'editor')
    AND user_id = auth.uid()
  );

CREATE POLICY "incidents_update_own_or_admin"
  ON public.incidents_log FOR UPDATE
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
    OR user_id = auth.uid()
  );

CREATE POLICY "incidents_delete_admin"
  ON public.incidents_log FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

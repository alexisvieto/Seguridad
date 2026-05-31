-- ============================================================================
-- Migration 00011: Training & Certifications Module (Phase 3)
-- Tables: training_courses, agent_training_logs, station_required_trainings
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE public.training_courses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  course_name       TEXT NOT NULL CHECK (char_length(course_name) BETWEEN 2 AND 300),
  description       TEXT CHECK (char_length(description) <= 5000),
  validity_months   INT NOT NULL DEFAULT 12 CHECK (validity_months > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.training_courses IS 'Catalog of training courses — DIASP, first aid, client service, etc.';
COMMENT ON COLUMN public.training_courses.validity_months IS 'Months before certification expires and agent must re-certify';

-- ---------------------------------------------------------------------------

CREATE TABLE public.agent_training_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id             UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  completion_date       DATE NOT NULL,
  expiry_date           DATE NOT NULL,
  grade                 TEXT CHECK (char_length(grade) <= 50),
  certificate_pdf_url   TEXT CHECK (char_length(certificate_pdf_url) <= 1000),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_training_dates CHECK (expiry_date > completion_date)
);

COMMENT ON TABLE public.agent_training_logs IS 'Agent certification records with expiry tracking';
COMMENT ON COLUMN public.agent_training_logs.expiry_date IS 'Computed from completion_date + course.validity_months';
COMMENT ON COLUMN public.agent_training_logs.certificate_pdf_url IS 'Link to certificate in hr-documents storage bucket';

-- ---------------------------------------------------------------------------

CREATE TABLE public.station_required_trainings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_station_id   UUID NOT NULL REFERENCES public.work_stations(id) ON DELETE CASCADE,
  course_id         UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT station_course_unique UNIQUE (work_station_id, course_id)
);

COMMENT ON TABLE public.station_required_trainings IS 'Mandatory certifications per work station — drives shift eligibility checks';

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_training_courses_tenant       ON public.training_courses (tenant_id);
CREATE INDEX idx_training_logs_tenant          ON public.agent_training_logs (tenant_id);
CREATE INDEX idx_station_req_training_tenant   ON public.station_required_trainings (tenant_id);

-- Shift eligibility: "does agent X have valid cert for course Y?"
CREATE INDEX idx_training_logs_user_expiry     ON public.agent_training_logs (user_id, expiry_date DESC);

-- Course-based lookups
CREATE INDEX idx_training_logs_course          ON public.agent_training_logs (course_id);
CREATE INDEX idx_training_logs_user_course     ON public.agent_training_logs (user_id, course_id, expiry_date DESC);

-- Station requirement lookups
CREATE INDEX idx_station_req_station           ON public.station_required_trainings (work_station_id);
CREATE INDEX idx_station_req_course            ON public.station_required_trainings (course_id);

-- Expiring certifications alert query optimization
CREATE INDEX idx_training_logs_expiring        ON public.agent_training_logs (tenant_id, expiry_date);

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_training_courses_updated
  BEFORE UPDATE ON public.training_courses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_training_logs_updated
  BEFORE UPDATE ON public.agent_training_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.training_courses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_training_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_required_trainings ENABLE ROW LEVEL SECURITY;

-- TRAINING_COURSES ----------------------------------------------------------

CREATE POLICY "courses_select_member"
  ON public.training_courses FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "courses_insert_admin"
  ON public.training_courses FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "courses_update_admin"
  ON public.training_courses FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "courses_delete_owner"
  ON public.training_courses FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- AGENT_TRAINING_LOGS -------------------------------------------------------

CREATE POLICY "training_logs_select_member"
  ON public.agent_training_logs FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "training_logs_insert_admin"
  ON public.agent_training_logs FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "training_logs_update_admin"
  ON public.agent_training_logs FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "training_logs_delete_owner"
  ON public.agent_training_logs FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- STATION_REQUIRED_TRAININGS ------------------------------------------------

CREATE POLICY "station_req_select_member"
  ON public.station_required_trainings FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "station_req_insert_admin"
  ON public.station_required_trainings FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "station_req_update_admin"
  ON public.station_required_trainings FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "station_req_delete_admin"
  ON public.station_required_trainings FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

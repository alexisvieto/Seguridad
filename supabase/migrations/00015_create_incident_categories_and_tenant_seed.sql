-- ============================================================================
-- Migration 00015: Incident categories catalog + tenant auto-seed trigger
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. INCIDENT CATEGORIES CATALOG
-- ---------------------------------------------------------------------------

CREATE TABLE public.incident_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code          TEXT NOT NULL CHECK (char_length(code) BETWEEN 2 AND 50),
  label         TEXT NOT NULL CHECK (char_length(label) BETWEEN 2 AND 200),
  severity      TEXT NOT NULL DEFAULT 'media' CHECK (severity IN ('baja', 'media', 'alta', 'critica')),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT incident_cat_tenant_code_unique UNIQUE (tenant_id, code)
);

COMMENT ON TABLE public.incident_categories IS 'Per-tenant incident type catalog — seeded on tenant creation';

CREATE INDEX idx_incident_categories_tenant ON public.incident_categories (tenant_id);

ALTER TABLE public.incident_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incident_cat_select_member"
  ON public.incident_categories FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "incident_cat_insert_admin"
  ON public.incident_categories FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "incident_cat_update_admin"
  ON public.incident_categories FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "incident_cat_delete_owner"
  ON public.incident_categories FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- ---------------------------------------------------------------------------
-- 2. UNIFIED TENANT SEED TRIGGER
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_tenant_seed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Payroll config (already created by handle_new_tenant_payroll, but safe with ON CONFLICT)
  INSERT INTO public.payroll_configs (tenant_id)
  VALUES (NEW.id)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Training courses catalog
  INSERT INTO public.training_courses (tenant_id, course_name, description, validity_months) VALUES
    (NEW.id, 'Uso y Manejo de Armas de Fuego (Aval DIASP)', 'Certificación obligatoria de la DIASP para portar arma de fuego en servicio de seguridad privada', 12),
    (NEW.id, 'Protocolo de Seguridad y Atención al Cliente en PH', 'Formación en protocolos de seguridad perimetral, control de acceso y servicio al cliente en propiedades horizontales', 12),
    (NEW.id, 'Primeros Auxilios y Respuesta a Emergencias', 'Capacitación en primeros auxilios, RCP, manejo de extintores y evacuación de emergencia', 24);

  -- Incident categories
  INSERT INTO public.incident_categories (tenant_id, code, label, severity) VALUES
    (NEW.id, 'falla_infraestructura', 'Falla de infraestructura o equipamiento', 'alta'),
    (NEW.id, 'asalto_intrusion', 'Asalto o intrusión no autorizada', 'critica'),
    (NEW.id, 'abandono_puesto', 'Abandono de puesto de vigilancia', 'critica'),
    (NEW.id, 'marcado_irregular', 'Marcado irregular de asistencia (GPS/QR)', 'alta'),
    (NEW.id, 'novedad_rutinaria', 'Novedad de rutina sin riesgo', 'baja'),
    (NEW.id, 'accidente_laboral', 'Accidente laboral del agente en servicio', 'critica'),
    (NEW.id, 'queja_residente', 'Queja de residente sobre el servicio', 'media'),
    (NEW.id, 'vehiculo_sospechoso', 'Vehículo sospechoso detectado en perímetro', 'alta');

  RETURN NEW;
END;
$$;

-- Replace the old single-purpose trigger with the unified one
DROP TRIGGER IF EXISTS on_tenant_created_init_payroll ON public.tenants;

CREATE TRIGGER on_tenant_created_seed
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_tenant_seed();

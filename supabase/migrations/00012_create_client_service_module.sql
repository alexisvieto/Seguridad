-- ============================================================================
-- Migration 00012: Client Service Module — Tickets & Damage Reports (Phase 3)
-- Tables: client_tickets, client_damage_reports
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE public.client_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id     UUID NOT NULL REFERENCES public.properties_ph(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN ('queja_personal', 'solicitud_refuerzo', 'falla_servicio', 'otros')),
  subject         TEXT NOT NULL CHECK (char_length(subject) BETWEEN 2 AND 300),
  description     TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 5000),
  priority        TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta', 'critica')),
  status          TEXT NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  created_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_tickets IS 'PQR system — complaints, reinforcement requests, service failures from PH clients';

-- ---------------------------------------------------------------------------

CREATE TABLE public.client_damage_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id         UUID NOT NULL REFERENCES public.properties_ph(id) ON DELETE CASCADE,
  work_station_id     UUID REFERENCES public.work_stations(id) ON DELETE SET NULL,
  item_damaged        TEXT NOT NULL CHECK (char_length(item_damaged) BETWEEN 2 AND 300),
  responsible_party   TEXT NOT NULL CHECK (responsible_party IN ('agente_seguridad', 'residente', 'proveedor_externo', 'desconocido')),
  description         TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 5000),
  cost_estimate       NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (cost_estimate >= 0),
  evidence_urls       TEXT[] NOT NULL DEFAULT '{}',
  status              TEXT NOT NULL DEFAULT 'bajo_investigacion' CHECK (status IN ('bajo_investigacion', 'aceptado_empresa', 'rechazado_con_pruebas', 'reparado')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_damage_reports IS 'Property damage reports with evidence, cost estimation, and insurance tracking';

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_client_tickets_tenant         ON public.client_tickets (tenant_id);
CREATE INDEX idx_client_damage_tenant          ON public.client_damage_reports (tenant_id);

-- Property-scoped access (for client_admin queries)
CREATE INDEX idx_client_tickets_property       ON public.client_tickets (property_id);
CREATE INDEX idx_client_damage_property        ON public.client_damage_reports (property_id);

-- Status filtering for dashboards
CREATE INDEX idx_client_tickets_status         ON public.client_tickets (tenant_id, status);
CREATE INDEX idx_client_damage_status          ON public.client_damage_reports (tenant_id, status);

-- Priority escalation
CREATE INDEX idx_client_tickets_priority       ON public.client_tickets (tenant_id, priority)
  WHERE status IN ('abierto', 'en_proceso');

-- Assignment tracking
CREATE INDEX idx_client_tickets_assigned       ON public.client_tickets (assigned_to)
  WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_client_tickets_created_by     ON public.client_tickets (created_by);

-- Damage by responsible party for analytics
CREATE INDEX idx_client_damage_responsible     ON public.client_damage_reports (tenant_id, responsible_party);

-- Damage by station for pattern detection
CREATE INDEX idx_client_damage_station         ON public.client_damage_reports (work_station_id)
  WHERE work_station_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_client_tickets_updated
  BEFORE UPDATE ON public.client_tickets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_client_damage_reports_updated
  BEFORE UPDATE ON public.client_damage_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.client_tickets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_damage_reports ENABLE ROW LEVEL SECURITY;

-- CLIENT_TICKETS ------------------------------------------------------------

-- Tenant admins: full visibility within tenant
CREATE POLICY "tickets_select_tenant_admin"
  ON public.client_tickets FOR SELECT
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

-- PH client users: see only their property's tickets
CREATE POLICY "tickets_select_property_member"
  ON public.client_tickets FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      created_by = auth.uid()
      OR property_id IN (
        SELECT ws.property_id FROM public.work_stations ws
        INNER JOIN public.agent_shifts ash ON ash.work_station_id = ws.id
        WHERE ash.user_id = auth.uid() AND ash.clock_out IS NULL
      )
    )
  );

-- Any authenticated tenant member can create tickets for their properties
CREATE POLICY "tickets_insert_member"
  ON public.client_tickets FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND created_by = auth.uid()
  );

-- Only admin/owner can update (assign, change status)
CREATE POLICY "tickets_update_admin"
  ON public.client_tickets FOR UPDATE
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

-- Only owner can delete
CREATE POLICY "tickets_delete_owner"
  ON public.client_tickets FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- CLIENT_DAMAGE_REPORTS -----------------------------------------------------

-- Tenant admins: full visibility within tenant
CREATE POLICY "damage_select_tenant_admin"
  ON public.client_damage_reports FOR SELECT
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

-- Members: can see damage reports for properties they're connected to
CREATE POLICY "damage_select_member"
  ON public.client_damage_reports FOR SELECT
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
  );

-- Members with editor+ can create damage reports
CREATE POLICY "damage_insert_editor"
  ON public.client_damage_reports FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin', 'editor')
  );

-- Only admin/owner can update (change status, add cost estimates)
CREATE POLICY "damage_update_admin"
  ON public.client_damage_reports FOR UPDATE
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
  );

-- Only owner can delete
CREATE POLICY "damage_delete_owner"
  ON public.client_damage_reports FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

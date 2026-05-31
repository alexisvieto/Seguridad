-- ============================================================================
-- Migration 00004: Inventory & Equipment Custody Module (Phase 2)
-- Tables: inventory_items, station_asset_custody, agent_equipment_loans
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE public.inventory_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  item_name         TEXT NOT NULL CHECK (char_length(item_name) BETWEEN 2 AND 200),
  category          TEXT NOT NULL CHECK (category IN ('uniforme', 'calzado', 'comunicacion', 'defensa', 'otros')),
  size_or_model     TEXT CHECK (char_length(size_or_model) <= 100),
  current_stock     INT NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  min_stock_alert   INT NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory_items IS 'Operational inventory catalog — uniforms, radios, gear';
COMMENT ON COLUMN public.inventory_items.min_stock_alert IS 'Threshold that triggers low-stock alerts';

-- ---------------------------------------------------------------------------

CREATE TABLE public.station_asset_custody (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  work_station_id     UUID NOT NULL REFERENCES public.work_stations(id) ON DELETE CASCADE,
  asset_name          TEXT NOT NULL CHECK (char_length(asset_name) BETWEEN 2 AND 200),
  imei_or_serial      TEXT UNIQUE,
  status              TEXT NOT NULL DEFAULT 'bueno' CHECK (status IN ('bueno', 'dañado', 'en_reparacion')),
  last_inspection_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  damage_report_notes TEXT CHECK (char_length(damage_report_notes) <= 2000),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.station_asset_custody IS 'Fixed assets assigned to stations — phones, radios, keys';
COMMENT ON COLUMN public.station_asset_custody.imei_or_serial IS 'Unique device identifier for traceability';

-- ---------------------------------------------------------------------------

CREATE TABLE public.agent_equipment_loans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id       UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity      INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  loan_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  status        TEXT NOT NULL DEFAULT 'entregado' CHECK (status IN ('entregado', 'devuelto', 'descontado_por_perdida')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_equipment_loans IS 'Equipment loans to agents — tracks delivery, return, or loss';

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_inventory_items_tenant      ON public.inventory_items (tenant_id);
CREATE INDEX idx_station_assets_tenant       ON public.station_asset_custody (tenant_id);
CREATE INDEX idx_equipment_loans_tenant      ON public.agent_equipment_loans (tenant_id);

-- Stock shortage detection: items WHERE current_stock <= min_stock_alert
CREATE INDEX idx_inventory_stock_level       ON public.inventory_items (tenant_id, current_stock, min_stock_alert);

-- Category filtering
CREATE INDEX idx_inventory_category          ON public.inventory_items (tenant_id, category);

-- Station asset lookups
CREATE INDEX idx_station_assets_station      ON public.station_asset_custody (work_station_id);
CREATE INDEX idx_station_assets_status       ON public.station_asset_custody (tenant_id, status);

-- Loan lookups
CREATE INDEX idx_equipment_loans_user        ON public.agent_equipment_loans (user_id);
CREATE INDEX idx_equipment_loans_item        ON public.agent_equipment_loans (item_id);
CREATE INDEX idx_equipment_loans_active      ON public.agent_equipment_loans (tenant_id, status)
  WHERE status = 'entregado';

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS (updated_at)
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_inventory_items_updated
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_station_asset_custody_updated
  BEFORE UPDATE ON public.station_asset_custody
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_agent_equipment_loans_updated
  BEFORE UPDATE ON public.agent_equipment_loans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.station_asset_custody  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_equipment_loans  ENABLE ROW LEVEL SECURITY;

-- INVENTORY_ITEMS -----------------------------------------------------------

CREATE POLICY "inventory_select_member"
  ON public.inventory_items FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "inventory_insert_admin"
  ON public.inventory_items FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "inventory_update_admin"
  ON public.inventory_items FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "inventory_delete_owner"
  ON public.inventory_items FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- STATION_ASSET_CUSTODY -----------------------------------------------------

CREATE POLICY "station_assets_select_member"
  ON public.station_asset_custody FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "station_assets_insert_admin"
  ON public.station_asset_custody FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "station_assets_update_admin"
  ON public.station_asset_custody FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "station_assets_delete_owner"
  ON public.station_asset_custody FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- AGENT_EQUIPMENT_LOANS -----------------------------------------------------

CREATE POLICY "loans_select_member"
  ON public.agent_equipment_loans FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "loans_insert_admin"
  ON public.agent_equipment_loans FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "loans_update_admin"
  ON public.agent_equipment_loans FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "loans_delete_owner"
  ON public.agent_equipment_loans FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

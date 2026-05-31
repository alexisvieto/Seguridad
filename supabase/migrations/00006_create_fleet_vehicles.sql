-- ============================================================================
-- Migration 00006: Fleet Vehicles & GPS Telemetry Module (Phase 2)
-- Tables: fleet_vehicles, vehicle_gps_logs, geofence_violations
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE public.fleet_vehicles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plate_number                TEXT NOT NULL CHECK (char_length(plate_number) BETWEEN 2 AND 20),
  vehicle_type                TEXT NOT NULL CHECK (vehicle_type IN ('auto', 'moto', 'scooter', 'bicicleta')),
  brand_model                 TEXT NOT NULL CHECK (char_length(brand_model) BETWEEN 2 AND 150),
  gps_device_id               TEXT UNIQUE,
  current_odometer            INT NOT NULL DEFAULT 0 CHECK (current_odometer >= 0),
  next_maintenance_odometer   INT NOT NULL CHECK (next_maintenance_odometer > 0),
  status                      TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'taller', 'siniestrado')),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT fleet_plate_tenant_unique UNIQUE (tenant_id, plate_number)
);

COMMENT ON TABLE public.fleet_vehicles IS 'Fleet inventory with GPS device binding and maintenance tracking';
COMMENT ON COLUMN public.fleet_vehicles.gps_device_id IS 'External GPS provider device identifier';
COMMENT ON COLUMN public.fleet_vehicles.next_maintenance_odometer IS 'Odometer reading that triggers maintenance alert';

-- ---------------------------------------------------------------------------

CREATE TABLE public.vehicle_gps_logs (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id        UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  latitude          NUMERIC(10, 7) NOT NULL,
  longitude         NUMERIC(10, 7) NOT NULL,
  speed_kmh         NUMERIC(5, 2) NOT NULL DEFAULT 0,
  odometer_reading  INT,
  recorded_at       TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vehicle_gps_logs IS 'High-frequency GPS telemetry ingestion — append-only';
COMMENT ON COLUMN public.vehicle_gps_logs.recorded_at IS 'Satellite timestamp from GPS provider';

-- ---------------------------------------------------------------------------

CREATE TABLE public.geofence_violations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id        UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
  property_id       UUID REFERENCES public.properties_ph(id) ON DELETE SET NULL,
  violation_type    TEXT NOT NULL CHECK (violation_type IN ('salida_de_zona', 'exceso_velocidad', 'parada_prolongada_no_autorizada')),
  description       TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  status            TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'justificado', 'notificado')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.geofence_violations IS 'Geofence and speed policy violations for fleet oversight';

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- ---------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_fleet_vehicles_tenant       ON public.fleet_vehicles (tenant_id);
CREATE INDEX idx_gps_logs_tenant             ON public.vehicle_gps_logs (tenant_id);
CREATE INDEX idx_geofence_violations_tenant  ON public.geofence_violations (tenant_id);

-- High-frequency telemetry: composite for time-range queries per vehicle
CREATE INDEX idx_gps_logs_vehicle_time       ON public.vehicle_gps_logs (vehicle_id, recorded_at DESC);

-- Telemetry ingestion lookup by device
CREATE INDEX idx_fleet_gps_device            ON public.fleet_vehicles (gps_device_id) WHERE gps_device_id IS NOT NULL;

-- Vehicle status filtering
CREATE INDEX idx_fleet_vehicles_status       ON public.fleet_vehicles (tenant_id, status);

-- Maintenance alert: vehicles approaching service threshold
CREATE INDEX idx_fleet_maintenance           ON public.fleet_vehicles (tenant_id, current_odometer, next_maintenance_odometer);

-- Geofence lookups
CREATE INDEX idx_geofence_vehicle            ON public.geofence_violations (vehicle_id);
CREATE INDEX idx_geofence_property           ON public.geofence_violations (property_id) WHERE property_id IS NOT NULL;
CREATE INDEX idx_geofence_pending            ON public.geofence_violations (tenant_id, status) WHERE status = 'pendiente';
CREATE INDEX idx_geofence_created            ON public.geofence_violations (created_at DESC);

-- Latest position per vehicle (covers "where is vehicle X now?" queries)
CREATE INDEX idx_gps_logs_latest             ON public.vehicle_gps_logs (vehicle_id, recorded_at DESC)
  INCLUDE (latitude, longitude, speed_kmh);

-- ---------------------------------------------------------------------------
-- 3. TRIGGERS
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_fleet_vehicles_updated
  BEFORE UPDATE ON public.fleet_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_geofence_violations_updated
  BEFORE UPDATE ON public.geofence_violations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update vehicle odometer when telemetry arrives
CREATE OR REPLACE FUNCTION public.handle_gps_odometer_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.odometer_reading IS NOT NULL THEN
    UPDATE public.fleet_vehicles
    SET current_odometer = GREATEST(current_odometer, NEW.odometer_reading),
        updated_at = now()
    WHERE id = NEW.vehicle_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_gps_log_inserted
  AFTER INSERT ON public.vehicle_gps_logs
  FOR EACH ROW EXECUTE FUNCTION public.handle_gps_odometer_sync();

-- ---------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.fleet_vehicles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_gps_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_violations  ENABLE ROW LEVEL SECURITY;

-- FLEET_VEHICLES ------------------------------------------------------------

CREATE POLICY "fleet_select_member"
  ON public.fleet_vehicles FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "fleet_insert_admin"
  ON public.fleet_vehicles FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "fleet_update_admin"
  ON public.fleet_vehicles FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "fleet_delete_owner"
  ON public.fleet_vehicles FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

-- VEHICLE_GPS_LOGS ----------------------------------------------------------

CREATE POLICY "gps_logs_select_member"
  ON public.vehicle_gps_logs FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "gps_logs_insert_admin"
  ON public.vehicle_gps_logs FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

-- GEOFENCE_VIOLATIONS -------------------------------------------------------

CREATE POLICY "geofence_select_member"
  ON public.geofence_violations FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "geofence_insert_admin"
  ON public.geofence_violations FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "geofence_update_admin"
  ON public.geofence_violations FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "geofence_delete_owner"
  ON public.geofence_violations FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

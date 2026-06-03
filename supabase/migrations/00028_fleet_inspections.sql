-- Migration: Fleet inspections with image support

CREATE TABLE IF NOT EXISTS fleet_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES fleet_vehicles(id) ON DELETE CASCADE,
  inspection_date DATE NOT NULL,
  mileage INTEGER NOT NULL DEFAULT 0,
  chassis_paint TEXT DEFAULT '',
  rims_tires TEXT DEFAULT '',
  image_urls TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fleet_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON fleet_inspections FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids()));
CREATE INDEX idx_fleet_inspections_vehicle ON fleet_inspections(vehicle_id, inspection_date DESC);

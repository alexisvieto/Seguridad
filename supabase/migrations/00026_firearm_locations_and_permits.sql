-- Migration: Firearm locations (armerías) + permit docs + assignment signatures

CREATE TABLE IF NOT EXISTS firearm_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE firearm_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON firearm_locations FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids()));

ALTER TABLE firearms_inventory ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES firearm_locations(id);
ALTER TABLE firearms_inventory ADD COLUMN IF NOT EXISTS permit_document_url TEXT;

ALTER TABLE firearms_assignments ADD COLUMN IF NOT EXISTS return_location_id UUID REFERENCES firearm_locations(id);
ALTER TABLE firearms_assignments ADD COLUMN IF NOT EXISTS signature_data TEXT;

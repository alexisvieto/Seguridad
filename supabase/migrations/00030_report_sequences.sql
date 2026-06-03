-- Migration: Report numbering sequences

CREATE TABLE IF NOT EXISTS report_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  prefix TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT unique_sequence UNIQUE (tenant_id, prefix)
);

ALTER TABLE report_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON report_sequences FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE OR REPLACE FUNCTION next_report_number(p_tenant_id UUID, p_prefix TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_num INTEGER;
BEGIN
  INSERT INTO report_sequences (tenant_id, prefix, last_number)
  VALUES (p_tenant_id, p_prefix, 1)
  ON CONFLICT (tenant_id, prefix)
  DO UPDATE SET last_number = report_sequences.last_number + 1
  RETURNING last_number INTO v_num;
  RETURN p_prefix || '-' || LPAD(v_num::text, 4, '0');
END;
$$;

ALTER TABLE agent_equipment_loans ADD COLUMN IF NOT EXISTS report_number TEXT;
ALTER TABLE firearms_assignments ADD COLUMN IF NOT EXISTS report_number TEXT;
ALTER TABLE shift_change_reports ADD COLUMN IF NOT EXISTS report_number TEXT;

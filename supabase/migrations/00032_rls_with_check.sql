-- Migration: Add WITH CHECK to RLS policies for INSERT safety

DROP POLICY IF EXISTS "Tenant isolation" ON fleet_inspections;
CREATE POLICY "Tenant isolation" ON fleet_inspections
  FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Tenant isolation" ON report_sequences;
CREATE POLICY "Tenant isolation" ON report_sequences
  FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

DROP POLICY IF EXISTS "Tenant isolation" ON operative_paysheet;
CREATE POLICY "Tenant isolation" ON operative_paysheet
  FOR ALL
  USING (tenant_id IN (SELECT get_user_tenant_ids()))
  WITH CHECK (tenant_id IN (SELECT get_user_tenant_ids()));

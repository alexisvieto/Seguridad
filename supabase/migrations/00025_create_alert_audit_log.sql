-- Migration: Alert Audit Log
-- Tracks every status change with operator notes for full traceability

CREATE TABLE IF NOT EXISTS alert_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('incident', 'ticket', 'damage')),
  source_id UUID NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  action_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE alert_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON alert_audit_log FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids()));
CREATE INDEX idx_audit_source ON alert_audit_log(source_type, source_id);
CREATE INDEX idx_audit_tenant ON alert_audit_log(tenant_id, created_at DESC);

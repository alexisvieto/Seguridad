-- Migration: Shift Alerts (No-show detection)
-- Persistent alerts that remain active until resolved by QR scan

CREATE TABLE IF NOT EXISTS shift_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_station_id UUID NOT NULL REFERENCES work_stations(id),
  programmed_agent_id UUID REFERENCES auth.users(id),
  shift_type TEXT NOT NULL CHECK (shift_type IN ('diurno', 'nocturno')),
  alert_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  resolved_by_shift_id UUID REFERENCES agent_shifts(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_alert_per_station UNIQUE (tenant_id, work_station_id, alert_date, shift_type)
);

ALTER TABLE shift_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON shift_alerts FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids()));
CREATE INDEX idx_shift_alerts_active ON shift_alerts(tenant_id, status, alert_date);
ALTER PUBLICATION supabase_realtime ADD TABLE shift_alerts;

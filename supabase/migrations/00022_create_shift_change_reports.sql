-- Migration: Shift Change Reports
-- Operator documents shift change events, then sends report to management.

CREATE TABLE IF NOT EXISTS shift_change_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('diurno', 'nocturno')),
  report_date DATE NOT NULL,
  general_observations TEXT DEFAULT '',
  free_personnel TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'enviado')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  sent_to TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_report_per_shift UNIQUE (tenant_id, report_date, shift_type)
);

CREATE TABLE IF NOT EXISTS shift_change_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES shift_change_reports(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  work_station_id UUID NOT NULL REFERENCES work_stations(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('ausencia', 'tardanza', 'suspension', 'permiso', 'licencia', 'induccion', 'incapacidad', 'turno_especial')),
  programmed_agent_id UUID REFERENCES auth.users(id),
  actual_agent_id UUID REFERENCES auth.users(id),
  narrative TEXT DEFAULT '',
  arrival_time TIME,
  waiting_agent_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shift_change_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_change_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON shift_change_reports
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids()));
CREATE POLICY "Tenant isolation" ON shift_change_events
  FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids()));

CREATE INDEX idx_scr_tenant_date ON shift_change_reports(tenant_id, report_date);
CREATE INDEX idx_sce_report ON shift_change_events(report_id);

ALTER PUBLICATION supabase_realtime ADD TABLE shift_change_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE shift_change_events;

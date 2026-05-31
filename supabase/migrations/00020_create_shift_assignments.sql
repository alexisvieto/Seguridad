-- Migration: Shift Assignments (Programación de Turnos)
-- Supports: fijo (indefinido), temporal (rango), mensual (rotación)
-- Overlap validation handled in application layer (service)

CREATE TABLE IF NOT EXISTS shift_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_station_id UUID NOT NULL REFERENCES work_stations(id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL DEFAULT 'temporal' CHECK (assignment_type IN ('fijo', 'temporal', 'mensual')),
  start_date DATE NOT NULL,
  end_date DATE, -- NULL = indefinido (fijo)
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_time_range CHECK (end_time != start_time),
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT fijo_no_end_date CHECK (assignment_type != 'fijo' OR end_date IS NULL),
  CONSTRAINT temporal_requires_end CHECK (assignment_type != 'temporal' OR end_date IS NOT NULL),
  CONSTRAINT mensual_requires_end CHECK (assignment_type != 'mensual' OR end_date IS NOT NULL)
);

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- RLS
ALTER TABLE shift_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON shift_assignments
  FOR ALL USING (
    tenant_id IN (SELECT get_user_tenant_ids())
  );

-- Indexes
CREATE INDEX idx_shift_assignments_tenant ON shift_assignments(tenant_id);
CREATE INDEX idx_shift_assignments_user_dates ON shift_assignments(user_id, start_date, end_date);
CREATE INDEX idx_shift_assignments_station_dates ON shift_assignments(work_station_id, start_date, end_date);
CREATE INDEX idx_shift_assignments_type ON shift_assignments(tenant_id, assignment_type);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE shift_assignments;

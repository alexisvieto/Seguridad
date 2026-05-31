-- Migration: Incident Justification System
-- Allows supervisors to justify/resolve incidents with notes and audit trail.

ALTER TYPE incident_status ADD VALUE IF NOT EXISTS 'justified' AFTER 'resolved';

ALTER TABLE incidents_log
  ADD COLUMN IF NOT EXISTS notas_resolucion TEXT,
  ADD COLUMN IF NOT EXISTS justified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS justified_at TIMESTAMPTZ;

-- Migration: Operational upgrades
-- 1. Manual check-in mode per station
-- 2. Action taken field for incidents

ALTER TABLE work_stations ADD COLUMN IF NOT EXISTS check_in_mode TEXT NOT NULL DEFAULT 'qr' CHECK (check_in_mode IN ('qr', 'manual'));
ALTER TABLE incidents_log ADD COLUMN IF NOT EXISTS action_taken TEXT;

-- Migration: Add work_station_id to operative_paysheet
ALTER TABLE operative_paysheet ADD COLUMN IF NOT EXISTS work_station_id UUID REFERENCES work_stations(id);
CREATE INDEX IF NOT EXISTS idx_paysheet_station ON operative_paysheet(work_station_id);

-- Migration: Add admin_contact to commercial_clients
ALTER TABLE commercial_clients ADD COLUMN IF NOT EXISTS admin_contact TEXT;

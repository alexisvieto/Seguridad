-- Migration: Add photo_url to hr_agent_profiles
ALTER TABLE hr_agent_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT;

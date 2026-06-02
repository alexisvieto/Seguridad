-- Migration: Polygraph, agent status, termination

ALTER TABLE hr_agent_profiles ADD COLUMN IF NOT EXISTS polygraph_date DATE;
ALTER TABLE hr_agent_profiles ADD COLUMN IF NOT EXISTS polygraph_result TEXT CHECK (polygraph_result IN ('aprobado', 'no_aprobado', 'pendiente'));
ALTER TABLE hr_agent_profiles ADD COLUMN IF NOT EXISTS polygraph_document_url TEXT;
ALTER TABLE hr_agent_profiles ADD COLUMN IF NOT EXISTS agent_status TEXT NOT NULL DEFAULT 'activo' CHECK (agent_status IN ('activo', 'baja', 'suspendido'));
ALTER TABLE hr_agent_profiles ADD COLUMN IF NOT EXISTS termination_date DATE;
ALTER TABLE hr_agent_profiles ADD COLUMN IF NOT EXISTS termination_reason TEXT;

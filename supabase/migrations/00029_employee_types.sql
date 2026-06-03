-- Migration: Employee types for granular module access

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS employee_type TEXT DEFAULT 'agente' CHECK (employee_type IN ('agente', 'conductor', 'supervisor', 'operador', 'administrativo', 'gerente', 'cliente'));

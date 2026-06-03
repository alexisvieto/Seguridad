-- Migration: Operative paysheet (planilla operativa tipo Excel)

CREATE TABLE IF NOT EXISTS operative_paysheet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  shift_date DATE NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'completo' CHECK (entry_type IN ('completo', 'tardanza', 'falta_sin_aviso', 'falta_con_aviso', 'dia_libre', 'relevo', 'relevo_por_falto')),
  hours NUMERIC(5,2) NOT NULL DEFAULT 12,
  bonus NUMERIC(8,2) NOT NULL DEFAULT 0,
  penalty NUMERIC(8,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_paysheet_entry UNIQUE (tenant_id, user_id, shift_date)
);

ALTER TABLE operative_paysheet ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON operative_paysheet FOR ALL USING (tenant_id IN (SELECT get_user_tenant_ids()));
CREATE INDEX idx_paysheet_tenant_date ON operative_paysheet(tenant_id, shift_date);
CREATE INDEX idx_paysheet_user ON operative_paysheet(user_id, shift_date);

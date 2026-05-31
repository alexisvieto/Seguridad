-- ============================================================================
-- Migration 00019: Commercial clients & contracts
-- ============================================================================

CREATE TABLE public.commercial_clients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  company_name        TEXT NOT NULL CHECK (char_length(company_name) BETWEEN 2 AND 300),
  ruc                 TEXT CHECK (char_length(ruc) <= 30),
  legal_rep           TEXT CHECK (char_length(legal_rep) <= 200),
  contact_email       TEXT CHECK (char_length(contact_email) <= 200),
  contact_phone       TEXT CHECK (char_length(contact_phone) <= 30),
  status              TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'suspendido', 'inactivo')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commercial_clients IS 'Corporate clients that contract security services';

CREATE TABLE public.commercial_contracts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id           UUID NOT NULL REFERENCES public.commercial_clients(id) ON DELETE CASCADE,
  start_date          DATE NOT NULL,
  end_date            DATE,
  monthly_amount      NUMERIC(12, 2) NOT NULL CHECK (monthly_amount >= 0),
  agents_required     INT NOT NULL DEFAULT 1 CHECK (agents_required > 0),
  contract_pdf_url    TEXT,
  status              TEXT NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente', 'vencido', 'cancelado')),
  notes               TEXT CHECK (char_length(notes) <= 2000),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commercial_contracts IS 'Service contracts linking clients to properties and agent quotas';

-- Link contracts to properties (a contract covers one or more properties)
CREATE TABLE public.contract_properties (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contract_id     UUID NOT NULL REFERENCES public.commercial_contracts(id) ON DELETE CASCADE,
  property_id     UUID NOT NULL REFERENCES public.properties_ph(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contract_property_unique UNIQUE (contract_id, property_id)
);

-- INDEXES
CREATE INDEX idx_comm_clients_tenant ON public.commercial_clients (tenant_id);
CREATE INDEX idx_comm_contracts_tenant ON public.commercial_contracts (tenant_id);
CREATE INDEX idx_comm_contracts_client ON public.commercial_contracts (client_id);
CREATE INDEX idx_comm_contracts_status ON public.commercial_contracts (tenant_id, status) WHERE status = 'vigente';
CREATE INDEX idx_contract_props_tenant ON public.contract_properties (tenant_id);
CREATE INDEX idx_contract_props_contract ON public.contract_properties (contract_id);

-- TRIGGERS
CREATE TRIGGER on_comm_clients_updated BEFORE UPDATE ON public.commercial_clients FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER on_comm_contracts_updated BEFORE UPDATE ON public.commercial_contracts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.commercial_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comm_clients_select" ON public.commercial_clients FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));
CREATE POLICY "comm_clients_insert" ON public.commercial_clients FOR INSERT WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));
CREATE POLICY "comm_clients_update" ON public.commercial_clients FOR UPDATE USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));
CREATE POLICY "comm_clients_delete" ON public.commercial_clients FOR DELETE USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

CREATE POLICY "comm_contracts_select" ON public.commercial_contracts FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));
CREATE POLICY "comm_contracts_insert" ON public.commercial_contracts FOR INSERT WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));
CREATE POLICY "comm_contracts_update" ON public.commercial_contracts FOR UPDATE USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));
CREATE POLICY "comm_contracts_delete" ON public.commercial_contracts FOR DELETE USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

CREATE POLICY "contract_props_select" ON public.contract_properties FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));
CREATE POLICY "contract_props_insert" ON public.contract_properties FOR INSERT WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));
CREATE POLICY "contract_props_delete" ON public.contract_properties FOR DELETE USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

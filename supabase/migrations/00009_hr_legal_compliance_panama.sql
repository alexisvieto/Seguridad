-- ============================================================================
-- Migration 00009: HR Legal Compliance — Panama (MITRADEL/CSS/DIASP)
-- Adds document management columns and employee vault table
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ALTER hr_contracts — add MITRADEL seal tracking
-- ---------------------------------------------------------------------------

ALTER TABLE public.hr_contracts
  ADD COLUMN mitradel_sealed_pdf_url TEXT;

-- Drop existing status constraint and replace with expanded enum
ALTER TABLE public.hr_contracts
  DROP CONSTRAINT IF EXISTS hr_contracts_status_check;

ALTER TABLE public.hr_contracts
  ADD CONSTRAINT hr_contracts_status_check
  CHECK (status IN ('pendiente_sello', 'activo', 'vencido', 'terminado'));

COMMENT ON COLUMN public.hr_contracts.mitradel_sealed_pdf_url IS 'URL of MITRADEL-stamped physical contract PDF';

-- ---------------------------------------------------------------------------
-- 2. ALTER hr_disciplinary_records — add legal evidence fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.hr_disciplinary_records
  ADD COLUMN signed_ammendment_pdf_url TEXT,
  ADD COLUMN photographic_evidence_urls TEXT[] DEFAULT '{}',
  ADD COLUMN legal_validity_flag BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.hr_disciplinary_records.signed_ammendment_pdf_url IS 'PDF of signed written warning delivered to agent';
COMMENT ON COLUMN public.hr_disciplinary_records.photographic_evidence_urls IS 'Array of photo URLs — evidence for litigation support';
COMMENT ON COLUMN public.hr_disciplinary_records.legal_validity_flag IS 'TRUE if record has full documentary support for legal proceedings';

-- ---------------------------------------------------------------------------
-- 3. CREATE hr_employee_vault — critical document storage
-- ---------------------------------------------------------------------------

CREATE TABLE public.hr_employee_vault (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type     TEXT NOT NULL CHECK (document_type IN (
    'ficha_css',
    'record_policial',
    'prueba_antidopaje',
    'evaluacion_psicologica',
    'certificacion_diasp',
    'paz_y_salvo_equipos'
  )),
  document_url      TEXT NOT NULL CHECK (char_length(document_url) BETWEEN 1 AND 1000),
  expiration_date   DATE,
  uploaded_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.hr_employee_vault IS 'Indexed document vault — CSS, police records, DIASP certifications, drug tests';
COMMENT ON COLUMN public.hr_employee_vault.document_type IS 'Panama regulatory document categories';
COMMENT ON COLUMN public.hr_employee_vault.expiration_date IS 'Expiry for DIASP certs, psych evals, drug tests';

-- ---------------------------------------------------------------------------
-- 4. INDEXES
-- ---------------------------------------------------------------------------

-- Vault: fast document lookup by agent + type
CREATE INDEX idx_vault_user_type       ON public.hr_employee_vault (user_id, document_type);
CREATE INDEX idx_vault_tenant          ON public.hr_employee_vault (tenant_id);

-- Vault: expiring documents alert
CREATE INDEX idx_vault_expiry          ON public.hr_employee_vault (expiration_date)
  WHERE expiration_date IS NOT NULL;

-- Disciplinary: historical search by agent
CREATE INDEX idx_disciplinary_user_date ON public.hr_disciplinary_records (user_id, created_at DESC);

-- Disciplinary: legal validity filter
CREATE INDEX idx_disciplinary_legal     ON public.hr_disciplinary_records (tenant_id, legal_validity_flag)
  WHERE legal_validity_flag = true;

-- Contracts: MITRADEL pending seal
CREATE INDEX idx_contracts_pending_seal ON public.hr_contracts (tenant_id, status)
  WHERE status = 'pendiente_sello';

-- ---------------------------------------------------------------------------
-- 5. TRIGGER
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_hr_employee_vault_updated
  BEFORE UPDATE ON public.hr_employee_vault
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.hr_employee_vault ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vault_select_member"
  ON public.hr_employee_vault FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "vault_insert_admin"
  ON public.hr_employee_vault FOR INSERT
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "vault_update_admin"
  ON public.hr_employee_vault FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "vault_delete_owner"
  ON public.hr_employee_vault FOR DELETE
  USING (public.get_user_role_in_tenant(tenant_id) = 'owner');

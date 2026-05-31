-- ============================================================================
-- Migration 00010: Supabase Storage — hr-documents private bucket
-- RLS: agents read own files, admins full CRUD within their tenant
-- Path convention: {tenant_id}/{user_id}/{document_type}/{filename}
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CREATE BUCKET
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hr-documents',
  'hr-documents',
  false,
  10485760, -- 10 MB max per file
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. HELPER: extract tenant_id from storage path
--    Path format: {tenant_id}/{user_id}/{document_type}/{filename}
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.storage_extract_tenant_id(path TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (string_to_array(path, '/'))[1]::UUID;
$$;

CREATE OR REPLACE FUNCTION public.storage_extract_user_id(path TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (string_to_array(path, '/'))[2]::UUID;
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS POLICIES — storage.objects (bucket: hr-documents)
-- ---------------------------------------------------------------------------

-- AGENTS: can only read files in their own folder
CREATE POLICY "hr_docs_agent_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'hr-documents'
    AND public.storage_extract_user_id(name) = auth.uid()
    AND public.storage_extract_tenant_id(name) IN (
      SELECT public.get_user_tenant_ids()
    )
  );

-- ADMINS: can read all files within their tenant
CREATE POLICY "hr_docs_admin_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'hr-documents'
    AND public.storage_extract_tenant_id(name) IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ADMINS: can upload files within their tenant path
CREATE POLICY "hr_docs_admin_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'hr-documents'
    AND public.storage_extract_tenant_id(name) IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ADMINS: can update (overwrite) files within their tenant path
CREATE POLICY "hr_docs_admin_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'hr-documents'
    AND public.storage_extract_tenant_id(name) IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ADMINS: can delete files within their tenant path
CREATE POLICY "hr_docs_admin_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'hr-documents'
    AND public.storage_extract_tenant_id(name) IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

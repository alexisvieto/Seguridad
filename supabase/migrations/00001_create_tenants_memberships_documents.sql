-- ============================================================================
-- Migration 00001: Core multi-tenant schema
-- Tables: tenants, profiles, memberships, documents
-- Includes: RLS policies, indices, triggers
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ---------------------------------------------------------------------------

CREATE TYPE public.membership_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
CREATE TYPE public.tenant_plan AS ENUM ('free', 'pro', 'enterprise');

-- ---------------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------------

-- Tenants ------------------------------------------------------------------
CREATE TABLE public.tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  slug       TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$'),
  plan       public.tenant_plan NOT NULL DEFAULT 'free',
  settings   JSONB NOT NULL DEFAULT '{}',
  logo_url   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenants IS 'Each tenant represents a security company using the platform';
COMMENT ON COLUMN public.tenants.slug IS 'URL-safe identifier used for subdomain routing';

-- Profiles -----------------------------------------------------------------
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 200),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Extended user profile, 1:1 with auth.users';

-- Memberships --------------------------------------------------------------
CREATE TABLE public.memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.membership_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT memberships_tenant_user_unique UNIQUE (tenant_id, user_id)
);

COMMENT ON TABLE public.memberships IS 'Links users to tenants with a specific role';

-- Documents ----------------------------------------------------------------
CREATE TABLE public.documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Sin título' CHECK (char_length(title) <= 500),
  content    JSONB NOT NULL DEFAULT '[]',
  icon       TEXT,
  cover_url  TEXT,
  is_pinned  BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.documents IS 'Hierarchical documents with JSONB block content';
COMMENT ON COLUMN public.documents.parent_id IS 'Self-referencing FK for tree structure';
COMMENT ON COLUMN public.documents.content IS 'Block-based content stored as JSONB array';

-- ---------------------------------------------------------------------------
-- 3. INDEXES
-- ---------------------------------------------------------------------------

CREATE INDEX idx_memberships_tenant  ON public.memberships (tenant_id);
CREATE INDEX idx_memberships_user    ON public.memberships (user_id);
CREATE INDEX idx_documents_tenant    ON public.documents (tenant_id);
CREATE INDEX idx_documents_parent    ON public.documents (parent_id);
CREATE INDEX idx_documents_created_by ON public.documents (created_by);
CREATE INDEX idx_tenants_slug        ON public.tenants (slug);

-- GIN index for fast JSONB queries on document content
CREATE INDEX idx_documents_content ON public.documents USING GIN (content jsonb_path_ops);

-- ---------------------------------------------------------------------------
-- 4. HELPER FUNCTIONS
-- ---------------------------------------------------------------------------

-- Returns the tenant_ids the current authenticated user belongs to
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.memberships
  WHERE user_id = auth.uid();
$$;

-- Returns the role of the current user in a specific tenant
CREATE OR REPLACE FUNCTION public.get_user_role_in_tenant(p_tenant_id UUID)
RETURNS public.membership_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.memberships
  WHERE user_id = auth.uid()
    AND tenant_id = p_tenant_id
  LIMIT 1;
$$;

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Usuario')
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. TRIGGERS
-- ---------------------------------------------------------------------------

CREATE TRIGGER on_tenants_updated
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_memberships_updated
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_documents_updated
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.tenants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents   ENABLE ROW LEVEL SECURITY;

-- TENANTS -------------------------------------------------------------------

CREATE POLICY "tenants_select_member"
  ON public.tenants FOR SELECT
  USING (id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenants_insert_authenticated"
  ON public.tenants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tenants_update_admin"
  ON public.tenants FOR UPDATE
  USING (public.get_user_role_in_tenant(id) IN ('owner', 'admin'));

CREATE POLICY "tenants_delete_owner"
  ON public.tenants FOR DELETE
  USING (public.get_user_role_in_tenant(id) = 'owner');

-- PROFILES ------------------------------------------------------------------

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_select_same_tenant"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT m.user_id FROM public.memberships m
      WHERE m.tenant_id IN (SELECT public.get_user_tenant_ids())
    )
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- MEMBERSHIPS ---------------------------------------------------------------

CREATE POLICY "memberships_select_same_tenant"
  ON public.memberships FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "memberships_insert_admin"
  ON public.memberships FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
    OR (
      -- Allow the creator of a new tenant to add themselves as owner
      user_id = auth.uid()
      AND role = 'owner'
      AND NOT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE tenant_id = memberships.tenant_id
      )
    )
  );

CREATE POLICY "memberships_update_admin"
  ON public.memberships FOR UPDATE
  USING (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'))
  WITH CHECK (public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin'));

CREATE POLICY "memberships_delete_admin"
  ON public.memberships FOR DELETE
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
    OR user_id = auth.uid()
  );

-- DOCUMENTS -----------------------------------------------------------------

CREATE POLICY "documents_select_member"
  ON public.documents FOR SELECT
  USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "documents_insert_editor"
  ON public.documents FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin', 'editor')
    AND created_by = auth.uid()
  );

CREATE POLICY "documents_update_editor"
  ON public.documents FOR UPDATE
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin', 'editor')
  );

CREATE POLICY "documents_delete_admin"
  ON public.documents FOR DELETE
  USING (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
    OR created_by = auth.uid()
  );

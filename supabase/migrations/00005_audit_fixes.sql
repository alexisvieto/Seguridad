-- ============================================================================
-- Migration 00005: Audit fixes
-- Partial unique indices, RLS policy fix, atomic stock function
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PARTIAL UNIQUE INDICES (prevent race conditions)
-- ---------------------------------------------------------------------------

-- C3: Only one active shift per agent
CREATE UNIQUE INDEX idx_agent_shifts_one_active
  ON public.agent_shifts (user_id)
  WHERE clock_out IS NULL;

-- C2: Only one active assignment per firearm
CREATE UNIQUE INDEX idx_firearms_assign_one_active
  ON public.firearms_assignments (firearm_id)
  WHERE returned_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. FIX RLS POLICY: documents_delete_admin (C4)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "documents_delete_admin" ON public.documents;

CREATE POLICY "documents_delete_admin"
  ON public.documents FOR DELETE
  USING (
    tenant_id IN (SELECT public.get_user_tenant_ids())
    AND (
      public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
      OR created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. FIX RLS POLICY: memberships_insert_admin ambiguity
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "memberships_insert_admin" ON public.memberships;

CREATE POLICY "memberships_insert_admin"
  ON public.memberships FOR INSERT
  WITH CHECK (
    public.get_user_role_in_tenant(tenant_id) IN ('owner', 'admin')
    OR (
      user_id = auth.uid()
      AND role = 'owner'
      AND NOT EXISTS (
        SELECT 1 FROM public.memberships m2
        WHERE m2.tenant_id = memberships.tenant_id
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. ATOMIC STOCK FUNCTIONS (C1)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decrement_stock(
  p_item_id UUID,
  p_quantity INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_stock INT;
BEGIN
  UPDATE public.inventory_items
  SET current_stock = current_stock - p_quantity,
      updated_at = now()
  WHERE id = p_item_id
    AND current_stock >= p_quantity
  RETURNING current_stock INTO v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  RETURN v_new_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_stock(
  p_item_id UUID,
  p_quantity INT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_stock INT;
BEGIN
  UPDATE public.inventory_items
  SET current_stock = current_stock + p_quantity,
      updated_at = now()
  WHERE id = p_item_id
  RETURNING current_stock INTO v_new_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  RETURN v_new_stock;
END;
$$;

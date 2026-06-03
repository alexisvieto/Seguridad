import { headers } from 'next/headers';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors/app-error';
import type { Tenant } from '@/shared/types/database';

/**
 * Resolves the current tenant from the route param or the x-tenant-slug header
 * set by the middleware. Use in Server Components and Server Actions within
 * the [tenant] route segment.
 */
export async function getCurrentTenant(
  slugParam?: string,
): Promise<Tenant> {
  const slug = slugParam ?? (await headers()).get('x-tenant-slug');

  if (!slug) {
    throw new AppError('TENANT_NOT_FOUND', 'No se pudo determinar el tenant actual');
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    throw new AppError('TENANT_NOT_FOUND', `Tenant "${slug}" no encontrado`);
  }

  return data;
}

/**
 * Returns the current authenticated user's role within a tenant.
 */
export async function getCurrentUserRole(tenantId: string) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  return data?.role ?? null;
}

export async function getCurrentUserMembership(tenantId: string) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('memberships')
    .select('role, employee_type')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  return data ?? null;
}

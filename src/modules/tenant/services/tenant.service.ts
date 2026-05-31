import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TenantPlan } from '@/shared/types/database';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

export async function createTenant(
  client: Client,
  input: { name: string; slug: string; plan?: string },
  userId: string,
) {
  const { data: tenant, error: tenantError } = await client
    .from('tenants')
    .insert({
      name: input.name,
      slug: input.slug,
      plan: (input.plan ?? 'free') as TenantPlan,
    })
    .select()
    .single();

  if (tenantError || !tenant) {
    if (tenantError?.code === '23505') {
      throw new AppError('TENANT_SLUG_TAKEN', `El slug "${input.slug}" ya está en uso`);
    }
    throw new AppError('INTERNAL_ERROR', 'Error al crear el tenant');
  }

  const { error: memberError } = await client.from('memberships').insert({
    tenant_id: tenant.id,
    user_id: userId,
    role: 'owner',
  });

  if (memberError) {
    throw new AppError('INTERNAL_ERROR', 'Error al asignar membresía de owner');
  }

  return tenant;
}

export async function getTenantBySlug(client: Client, slug: string) {
  const { data, error } = await client
    .from('tenants')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    throw new AppError('TENANT_NOT_FOUND', `Tenant "${slug}" no encontrado`);
  }

  return data;
}

export async function getUserTenants(client: Client, userId: string) {
  const { data, error } = await client
    .from('memberships')
    .select('role, tenants(*)')
    .eq('user_id', userId);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener los tenants del usuario');
  }

  return data ?? [];
}

export async function updateTenant(
  client: Client,
  tenantId: string,
  input: { name?: string; logo_url?: string | null; settings?: Record<string, unknown> },
) {
  const { data, error } = await client
    .from('tenants')
    .update(input)
    .eq('id', tenantId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar el tenant');
  }

  return data;
}

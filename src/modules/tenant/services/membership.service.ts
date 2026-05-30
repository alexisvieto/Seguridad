import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, MembershipRole } from '@/shared/types/database';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

export async function getTenantMembers(client: Client, tenantId: string) {
  const { data, error } = await client
    .from('memberships')
    .select('*, profiles(full_name, avatar_url)')
    .eq('tenant_id', tenantId);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener los miembros');
  }

  return data ?? [];
}

export async function getUserRoleInTenant(
  client: Client,
  tenantId: string,
  userId: string,
): Promise<MembershipRole | null> {
  const { data } = await client
    .from('memberships')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  return data?.role ?? null;
}

export async function addMember(
  client: Client,
  tenantId: string,
  userId: string,
  role: MembershipRole,
) {
  const { data: existing } = await client
    .from('memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    throw new AppError('MEMBERSHIP_EXISTS', 'El usuario ya es miembro de este tenant');
  }

  const { data, error } = await client
    .from('memberships')
    .insert({ tenant_id: tenantId, user_id: userId, role })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al agregar el miembro');
  }

  return data;
}

export async function updateMemberRole(
  client: Client,
  membershipId: string,
  role: MembershipRole,
) {
  const { data, error } = await client
    .from('memberships')
    .update({ role })
    .eq('id', membershipId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar el rol');
  }

  return data;
}

export async function removeMember(client: Client, membershipId: string) {
  const { error } = await client
    .from('memberships')
    .delete()
    .eq('id', membershipId);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al eliminar el miembro');
  }
}

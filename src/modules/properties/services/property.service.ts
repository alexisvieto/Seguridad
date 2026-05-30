import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, EmergencyContact } from '@/shared/types/database';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

export async function createProperty(
  client: Client,
  input: {
    tenant_id: string;
    name: string;
    address: string;
    contact_emergency: EmergencyContact[];
  },
) {
  const { data, error } = await client
    .from('properties_ph')
    .insert({
      tenant_id: input.tenant_id,
      name: input.name,
      address: input.address,
      contact_emergency: input.contact_emergency,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al crear la propiedad');
  }

  return data;
}

export async function getPropertiesByTenant(client: Client, tenantId: string) {
  const { data, error } = await client
    .from('properties_ph')
    .select('*, work_stations(id, name, qr_code_token, is_active)')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener las propiedades');
  }

  return data ?? [];
}

export async function getPropertyById(client: Client, propertyId: string) {
  const { data, error } = await client
    .from('properties_ph')
    .select('*, work_stations(*)')
    .eq('id', propertyId)
    .single();

  if (error || !data) {
    throw new AppError('NOT_FOUND', 'Propiedad no encontrada');
  }

  return data;
}

export async function updateProperty(
  client: Client,
  propertyId: string,
  input: {
    name?: string;
    address?: string;
    contact_emergency?: EmergencyContact[];
    is_active?: boolean;
  },
) {
  const { data, error } = await client
    .from('properties_ph')
    .update(input)
    .eq('id', propertyId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar la propiedad');
  }

  return data;
}

export async function createWorkStation(
  client: Client,
  input: { tenant_id: string; property_id: string; name: string },
) {
  const { data, error } = await client
    .from('work_stations')
    .insert({
      tenant_id: input.tenant_id,
      property_id: input.property_id,
      name: input.name,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al crear el puesto de trabajo');
  }

  return data;
}

export async function getWorkStationByQr(client: Client, qrToken: string) {
  const { data, error } = await client
    .from('work_stations')
    .select('*, properties_ph(id, name, tenant_id)')
    .eq('qr_code_token', qrToken)
    .single();

  if (error || !data) {
    throw new AppError('NOT_FOUND', 'Puesto de trabajo no encontrado');
  }

  return data;
}

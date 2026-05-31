import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, GpsCoordinates } from '@/shared/types/database';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

export async function clockIn(
  client: Client,
  input: {
    tenant_id: string;
    work_station_id: string;
    clock_in_gps: GpsCoordinates;
  },
  userId: string,
) {
  const { data, error } = await client
    .from('agent_shifts')
    .insert({
      tenant_id: input.tenant_id,
      user_id: userId,
      work_station_id: input.work_station_id,
      clock_in_gps: input.clock_in_gps,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('CONFLICT', 'Ya tienes un turno activo. Registra la salida primero.');
    }
    throw new AppError('INTERNAL_ERROR', 'Error al registrar entrada');
  }

  return data;
}

export async function clockOut(
  client: Client,
  shiftId: string,
  clockOutGps: GpsCoordinates,
  userId: string,
) {
  const { data: shift } = await client
    .from('agent_shifts')
    .select('id, user_id, clock_out')
    .eq('id', shiftId)
    .maybeSingle();

  if (!shift) {
    throw new AppError('NOT_FOUND', 'Turno no encontrado');
  }

  if (shift.user_id !== userId) {
    throw new AppError('FORBIDDEN', 'No puedes cerrar un turno que no es tuyo');
  }

  if (shift.clock_out) {
    throw new AppError('CONFLICT', 'Este turno ya fue cerrado');
  }

  const { data, error } = await client
    .from('agent_shifts')
    .update({
      clock_out: new Date().toISOString(),
      clock_out_gps: clockOutGps,
    })
    .eq('id', shiftId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al registrar salida');
  }

  return data;
}

export async function getActiveShift(client: Client, userId: string) {
  const { data } = await client
    .from('agent_shifts')
    .select('*, work_stations(name, properties_ph(name))')
    .eq('user_id', userId)
    .is('clock_out', null)
    .maybeSingle();

  return data;
}

export async function getShiftsByTenant(
  client: Client,
  tenantId: string,
  dateFrom: string,
  dateTo: string,
) {
  const { data, error } = await client
    .from('agent_shifts')
    .select('*, profiles(full_name), work_stations(name, properties_ph(name))')
    .eq('tenant_id', tenantId)
    .gte('clock_in', dateFrom)
    .lte('clock_in', dateTo)
    .order('clock_in', { ascending: false });

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener los turnos');
  }

  return data ?? [];
}

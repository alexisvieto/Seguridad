import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, IncidentStatus } from '@/shared/types/database';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

export async function createIncident(
  client: Client,
  input: {
    tenant_id: string;
    work_station_id: string;
    raw_text: string;
  },
  userId: string,
) {
  const { data, error } = await client
    .from('incidents_log')
    .insert({
      tenant_id: input.tenant_id,
      work_station_id: input.work_station_id,
      user_id: userId,
      raw_text: input.raw_text,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al registrar la novedad');
  }

  return data;
}

export async function getIncidentsByTenant(
  client: Client,
  tenantId: string,
  filters?: { status?: IncidentStatus; am_report_sent?: boolean },
) {
  let query = client
    .from('incidents_log')
    .select('*, profiles(full_name), work_stations(name, properties_ph(name))')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.am_report_sent !== undefined) {
    query = query.eq('am_report_sent', filters.am_report_sent);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener las novedades');
  }

  return data ?? [];
}

export async function getPendingAmReportIncidents(client: Client, tenantId: string) {
  const { data, error } = await client
    .from('incidents_log')
    .select('*, profiles(full_name), work_stations(name, properties_ph(name))')
    .eq('tenant_id', tenantId)
    .eq('am_report_sent', false)
    .order('created_at', { ascending: true });

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener novedades pendientes del reporte');
  }

  return data ?? [];
}

export async function updateIncident(
  client: Client,
  incidentId: string,
  input: {
    raw_text?: string;
    ai_refined_text?: string | null;
    status?: IncidentStatus;
    am_report_sent?: boolean;
  },
) {
  const { data, error } = await client
    .from('incidents_log')
    .update(input)
    .eq('id', incidentId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar la novedad');
  }

  return data;
}

export async function markIncidentsAsReported(client: Client, incidentIds: string[]) {
  const { error } = await client
    .from('incidents_log')
    .update({ am_report_sent: true })
    .in('id', incidentIds);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al marcar novedades como reportadas');
  }
}

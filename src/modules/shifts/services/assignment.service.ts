import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;
type AssignmentType = 'fijo' | 'temporal' | 'mensual';

export interface OverlapConflict {
  stationName: string;
  startDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  agentName: string;
  assignmentType: AssignmentType;
}

// ---------------------------------------------------------------------------
// Time overlap helper
// Handles both normal (06:00-18:00) and nocturnal (18:00-06:00) shifts.
// Two time ranges overlap if they share any minute in a 24h cycle.
// ---------------------------------------------------------------------------

function timeRangesOverlap(
  aStart: string, aEnd: string,
  bStart: string, bEnd: string,
): boolean {
  const isNocturnal = (s: string, e: string) => e <= s;

  if (!isNocturnal(aStart, aEnd) && !isNocturnal(bStart, bEnd)) {
    return aStart < bEnd && aEnd > bStart;
  }

  // If either is nocturnal, check if they DON'T overlap and negate
  // Non-overlapping: one ends before the other starts in the "gap"
  if (!isNocturnal(aStart, aEnd) && isNocturnal(bStart, bEnd)) {
    return !(aEnd <= bStart && aStart >= bEnd);
  }
  if (isNocturnal(aStart, aEnd) && !isNocturnal(bStart, bEnd)) {
    return !(bEnd <= aStart && bStart >= aEnd);
  }
  // Both nocturnal: always overlap (they both cover midnight)
  return true;
}

// ---------------------------------------------------------------------------
// Overlap detection
// ---------------------------------------------------------------------------

export async function checkAgentOverlap(
  client: Client,
  params: {
    tenantId: string;
    userId: string;
    startDate: string;
    endDate: string | null;
    startTime: string;
    endTime: string;
    excludeId?: string;
  },
): Promise<OverlapConflict | null> {
  let query = client
    .from('shift_assignments')
    .select('id, start_date, end_date, start_time, end_time, assignment_type, work_stations(name)')
    .eq('tenant_id', params.tenantId)
    .eq('user_id', params.userId)
    .lte('start_date', params.endDate ?? '9999-12-31')
    .or(`end_date.gte.${params.startDate},end_date.is.null`);

  if (params.excludeId) {
    query = query.neq('id', params.excludeId);
  }

  const { data } = await query;

  if (!data || data.length === 0) return null;

  const conflict = data.find((row) =>
    timeRangesOverlap(params.startTime, params.endTime, row.start_time.slice(0, 5), row.end_time.slice(0, 5)),
  );

  if (!conflict) return null;

  return {
    stationName: (conflict.work_stations as { name: string } | null)?.name ?? 'Puesto desconocido',
    startDate: conflict.start_date,
    endDate: conflict.end_date,
    startTime: conflict.start_time,
    endTime: conflict.end_time,
    agentName: '',
    assignmentType: conflict.assignment_type as AssignmentType,
  };
}

export async function checkStationOverlap(
  client: Client,
  params: {
    tenantId: string;
    workStationId: string;
    startDate: string;
    endDate: string | null;
    startTime: string;
    endTime: string;
    excludeId?: string;
  },
): Promise<OverlapConflict | null> {
  let query = client
    .from('shift_assignments')
    .select('id, start_date, end_date, start_time, end_time, assignment_type, user_id')
    .eq('tenant_id', params.tenantId)
    .eq('work_station_id', params.workStationId)
    .lte('start_date', params.endDate ?? '9999-12-31')
    .or(`end_date.gte.${params.startDate},end_date.is.null`);

  if (params.excludeId) {
    query = query.neq('id', params.excludeId);
  }

  const { data } = await query;

  if (!data || data.length === 0) return null;

  const conflict = data.find((row) =>
    timeRangesOverlap(params.startTime, params.endTime, row.start_time.slice(0, 5), row.end_time.slice(0, 5)),
  );

  if (!conflict) return null;

  const { data: profile } = await client
    .from('profiles')
    .select('full_name')
    .eq('id', conflict.user_id)
    .maybeSingle();

  return {
    stationName: '',
    startDate: conflict.start_date,
    endDate: conflict.end_date,
    startTime: conflict.start_time,
    endTime: conflict.end_time,
    agentName: profile?.full_name ?? 'Agente',
    assignmentType: conflict.assignment_type as AssignmentType,
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createAssignment(
  client: Client,
  input: {
    tenantId: string;
    userId: string;
    workStationId: string;
    assignmentType: AssignmentType;
    startDate: string;
    endDate: string | null;
    startTime: string;
    endTime: string;
    notes?: string;
  },
  createdBy: string,
) {
  const agentConflict = await checkAgentOverlap(client, {
    tenantId: input.tenantId,
    userId: input.userId,
    startDate: input.startDate,
    endDate: input.endDate,
    startTime: input.startTime,
    endTime: input.endTime,
  });

  if (agentConflict) {
    const dateRange = agentConflict.endDate
      ? `del ${agentConflict.startDate} al ${agentConflict.endDate}`
      : `desde ${agentConflict.startDate} (fijo)`;
    throw new AppError(
      'CONFLICT',
      `Conflicto de Asignación: Este agente ya se encuentra asignado al puesto '${agentConflict.stationName}' en el horario de ${agentConflict.startTime.slice(0, 5)} a ${agentConflict.endTime.slice(0, 5)}, ${dateRange}.`,
    );
  }

  const stationConflict = await checkStationOverlap(client, {
    tenantId: input.tenantId,
    workStationId: input.workStationId,
    startDate: input.startDate,
    endDate: input.endDate,
    startTime: input.startTime,
    endTime: input.endTime,
  });

  if (stationConflict) {
    const dateRange = stationConflict.endDate
      ? `del ${stationConflict.startDate} al ${stationConflict.endDate}`
      : `desde ${stationConflict.startDate} (fijo)`;
    throw new AppError(
      'CONFLICT',
      `Conflicto de Puesto: Este puesto ya tiene asignado a '${stationConflict.agentName}' en el horario de ${stationConflict.startTime.slice(0, 5)} a ${stationConflict.endTime.slice(0, 5)}, ${dateRange}.`,
    );
  }

  const { data, error } = await client
    .from('shift_assignments')
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      work_station_id: input.workStationId,
      assignment_type: input.assignmentType,
      start_date: input.startDate,
      end_date: input.endDate,
      start_time: input.startTime,
      end_time: input.endTime,
      notes: input.notes ?? '',
      created_by: createdBy,
    })
    .select('*, work_stations(name)')
    .maybeSingle();

  if (error || !data) {
    if (error?.code === '23514') {
      throw new AppError('VALIDATION_ERROR', 'Los datos no cumplen las restricciones: verificar tipo, fechas y horarios.');
    }
    throw new AppError('INTERNAL_ERROR', 'Error al crear la asignación');
  }

  return data;
}

export async function getAssignmentsByDate(
  client: Client,
  tenantId: string,
  date: string,
) {
  const { data, error } = await client
    .from('shift_assignments')
    .select('*, work_stations(name, properties_ph(name))')
    .eq('tenant_id', tenantId)
    .lte('start_date', date)
    .or(`end_date.gte.${date},end_date.is.null`)
    .order('start_time');

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener asignaciones');
  }

  const userIds = [...new Set((data ?? []).map((d) => d.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await client.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (data ?? []).map((d) => ({
    ...d,
    profiles: { full_name: profileMap.get(d.user_id) ?? 'Agente' },
  }));
}

export async function getAvailableAgents(
  client: Client,
  tenantId: string,
  date: string,
  startTime: string,
  endTime: string,
) {
  const { data: members } = await client
    .from('memberships')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .in('role', ['editor', 'admin']);

  const memberIds = (members ?? []).map((m) => m.user_id);

  const { data: profiles } = memberIds.length > 0
    ? await client.from('profiles').select('id, full_name').in('id', memberIds)
    : { data: [] };

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name]),
  );

  // Find agents with date-overlapping assignments
  const { data: occupied } = await client
    .from('shift_assignments')
    .select('user_id, start_time, end_time, work_stations(name)')
    .eq('tenant_id', tenantId)
    .lte('start_date', date)
    .or(`end_date.gte.${date},end_date.is.null`);

  // Filter by time overlap client-side (handles nocturnal)
  const occupiedMap = new Map<string, string>();
  for (const o of occupied ?? []) {
    if (timeRangesOverlap(startTime, endTime, o.start_time.slice(0, 5), o.end_time.slice(0, 5))) {
      occupiedMap.set(o.user_id, (o.work_stations as { name: string } | null)?.name ?? 'Puesto');
    }
  }

  return memberIds.map((userId) => ({
    userId,
    fullName: profileMap.get(userId) ?? 'Agente',
    occupied: occupiedMap.has(userId),
    occupiedAt: occupiedMap.get(userId) ?? null,
  }));
}

export async function deleteAssignment(client: Client, id: string) {
  const { error } = await client
    .from('shift_assignments')
    .delete()
    .eq('id', id);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al eliminar la asignación');
  }
}

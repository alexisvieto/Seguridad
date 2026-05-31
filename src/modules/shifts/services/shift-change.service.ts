import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

export type ShiftType = 'diurno' | 'nocturno';
export type EventType = 'ausencia' | 'tardanza' | 'suspension' | 'permiso' | 'licencia' | 'induccion' | 'incapacidad' | 'turno_especial';

export interface StationStatus {
  workStationId: string;
  stationName: string;
  propertyName: string;
  programmedAgentId: string | null;
  programmedAgentName: string | null;
  actualAgentId: string | null;
  actualAgentName: string | null;
  clockIn: string | null;
  status: 'on_time' | 'late' | 'no_show' | 'relief' | 'unassigned';
  lateMinutes: number;
  waitingAgentId: string | null;
  waitingAgentName: string | null;
}

export interface ShiftChangeData {
  reportId: string | null;
  reportStatus: string;
  shiftType: ShiftType;
  reportDate: string;
  stations: StationStatus[];
  events: EventRecord[];
  generalObservations: string;
  freePersonnel: string;
}

export interface EventRecord {
  id: string;
  workStationId: string;
  stationName: string;
  propertyName: string;
  eventType: EventType;
  programmedAgentName: string | null;
  actualAgentName: string | null;
  narrative: string;
  arrivalTime: string | null;
  waitingAgentName: string | null;
}

function getShiftTimes(type: ShiftType): { start: string; end: string } {
  return type === 'diurno'
    ? { start: '06:00', end: '18:00' }
    : { start: '18:00', end: '06:00' };
}

export async function getShiftChangeStatus(
  client: Client,
  tenantId: string,
  date: string,
  shiftType: ShiftType,
): Promise<ShiftChangeData> {
  const shift = getShiftTimes(shiftType);
  const dateFrom = `${date}T${shift.start}:00`;
  const dateTo = shiftType === 'diurno'
    ? `${date}T${shift.end}:00`
    : (() => { const d = new Date(date); d.setDate(d.getDate() + 1); return `${d.toISOString().split('T')[0]}T${shift.end}:00`; })();

  // 1. Get all active stations
  const { data: stations } = await client
    .from('work_stations')
    .select('id, name, properties_ph(name)')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name');

  // 2. Get programmed assignments for this date/shift
  const { data: assignments } = await client
    .from('shift_assignments')
    .select('user_id, work_station_id')
    .eq('tenant_id', tenantId)
    .lte('start_date', date)
    .or(`end_date.gte.${date},end_date.is.null`)
    .lte('start_time', shift.start === '18:00' ? '18:00' : '06:00')
    .gte('end_time', shift.end === '06:00' ? '06:00' : '18:00');

  // 3. Get actual clock-ins for this shift window
  const { data: shifts } = await client
    .from('agent_shifts')
    .select('user_id, work_station_id, clock_in, clock_out')
    .eq('tenant_id', tenantId)
    .gte('clock_in', dateFrom)
    .lte('clock_in', dateTo);

  // 4. Get previous shift agents still on post (no clock_out)
  const { data: waitingShifts } = await client
    .from('agent_shifts')
    .select('user_id, work_station_id')
    .eq('tenant_id', tenantId)
    .lt('clock_in', dateFrom)
    .is('clock_out', null);

  // 5. Collect all user IDs for name resolution
  const allUserIds = new Set<string>();
  for (const a of assignments ?? []) allUserIds.add(a.user_id);
  for (const s of shifts ?? []) allUserIds.add(s.user_id);
  for (const w of waitingShifts ?? []) allUserIds.add(w.user_id);

  const { data: profiles } = allUserIds.size > 0
    ? await client.from('profiles').select('id, full_name').in('id', [...allUserIds])
    : { data: [] };
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // 6. Build maps
  const assignmentMap = new Map(
    (assignments ?? []).map((a) => [a.work_station_id, a.user_id]),
  );
  const clockInMap = new Map(
    (shifts ?? []).map((s) => [s.work_station_id, { userId: s.user_id, clockIn: s.clock_in }]),
  );
  const waitingMap = new Map(
    (waitingShifts ?? []).map((w) => [w.work_station_id, w.user_id]),
  );

  const shiftStartHour = shiftType === 'diurno' ? 6 : 18;

  // 7. Compare
  const stationStatuses: StationStatus[] = (stations ?? []).map((ws) => {
    const programmedUserId = assignmentMap.get(ws.id) ?? null;
    const clockIn = clockInMap.get(ws.id);
    const waitingUserId = waitingMap.get(ws.id) ?? null;

    let status: StationStatus['status'] = 'unassigned';
    let lateMinutes = 0;

    if (programmedUserId && clockIn) {
      if (clockIn.userId === programmedUserId) {
        const clockInDate = new Date(clockIn.clockIn);
        const minutesPast = (clockInDate.getHours() - shiftStartHour) * 60 + clockInDate.getMinutes();
        if (minutesPast > 15) {
          status = 'late';
          lateMinutes = minutesPast;
        } else {
          status = 'on_time';
        }
      } else {
        status = 'relief';
      }
    } else if (programmedUserId && !clockIn) {
      status = 'no_show';
    } else if (!programmedUserId && clockIn) {
      status = 'on_time';
    }

    return {
      workStationId: ws.id,
      stationName: ws.name,
      propertyName: (ws.properties_ph as { name: string } | null)?.name ?? '',
      programmedAgentId: programmedUserId,
      programmedAgentName: programmedUserId ? (nameMap.get(programmedUserId) ?? 'Agente') : null,
      actualAgentId: clockIn?.userId ?? null,
      actualAgentName: clockIn ? (nameMap.get(clockIn.userId) ?? 'Agente') : null,
      clockIn: clockIn?.clockIn ?? null,
      status,
      lateMinutes,
      waitingAgentId: waitingUserId,
      waitingAgentName: waitingUserId ? (nameMap.get(waitingUserId) ?? 'Agente') : null,
    };
  });

  // 8. Get or create report draft
  let { data: report } = await client
    .from('shift_change_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('report_date', date)
    .eq('shift_type', shiftType)
    .maybeSingle();

  if (!report) {
    const { data: { user } } = await client.auth.getUser();
    if (user) {
      const { data: newReport } = await client
        .from('shift_change_reports')
        .insert({
          tenant_id: tenantId,
          shift_type: shiftType,
          report_date: date,
          created_by: user.id,
        })
        .select()
        .maybeSingle();
      report = newReport;
    }
  }

  // 9. Get existing events for this report
  const { data: events } = report
    ? await client
        .from('shift_change_events')
        .select('*')
        .eq('report_id', report.id)
        .order('created_at')
    : { data: [] };

  const eventRecords: EventRecord[] = (events ?? []).map((e) => {
    const ws = (stations ?? []).find((s) => s.id === e.work_station_id);
    return {
      id: e.id,
      workStationId: e.work_station_id,
      stationName: ws?.name ?? '',
      propertyName: (ws?.properties_ph as { name: string } | null)?.name ?? '',
      eventType: e.event_type as EventType,
      programmedAgentName: e.programmed_agent_id ? (nameMap.get(e.programmed_agent_id) ?? 'Agente') : null,
      actualAgentName: e.actual_agent_id ? (nameMap.get(e.actual_agent_id) ?? 'Agente') : null,
      narrative: e.narrative,
      arrivalTime: e.arrival_time,
      waitingAgentName: e.waiting_agent_id ? (nameMap.get(e.waiting_agent_id) ?? 'Agente') : null,
    };
  });

  return {
    reportId: report?.id ?? null,
    reportStatus: report?.status ?? 'borrador',
    shiftType,
    reportDate: date,
    stations: stationStatuses,
    events: eventRecords,
    generalObservations: report?.general_observations ?? '',
    freePersonnel: report?.free_personnel ?? '',
  };
}

export async function saveEvent(
  client: Client,
  input: {
    reportId: string;
    tenantId: string;
    workStationId: string;
    eventType: EventType;
    programmedAgentId: string | null;
    actualAgentId: string | null;
    narrative: string;
    arrivalTime: string | null;
    waitingAgentId: string | null;
  },
) {
  // Check if event already exists for this station in this report
  const { data: existing } = await client
    .from('shift_change_events')
    .select('id')
    .eq('report_id', input.reportId)
    .eq('work_station_id', input.workStationId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await client
      .from('shift_change_events')
      .update({
        event_type: input.eventType,
        actual_agent_id: input.actualAgentId,
        narrative: input.narrative,
        arrival_time: input.arrivalTime,
        waiting_agent_id: input.waitingAgentId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .maybeSingle();

    if (error) throw new AppError('INTERNAL_ERROR', 'Error al actualizar evento');
    return data;
  }

  const { data, error } = await client
    .from('shift_change_events')
    .insert({
      report_id: input.reportId,
      tenant_id: input.tenantId,
      work_station_id: input.workStationId,
      event_type: input.eventType,
      programmed_agent_id: input.programmedAgentId,
      actual_agent_id: input.actualAgentId,
      narrative: input.narrative,
      arrival_time: input.arrivalTime,
      waiting_agent_id: input.waitingAgentId,
    })
    .select()
    .maybeSingle();

  if (error) throw new AppError('INTERNAL_ERROR', 'Error al crear evento');
  return data;
}

export async function updateReportFields(
  client: Client,
  reportId: string,
  fields: { general_observations?: string; free_personnel?: string },
) {
  const { error } = await client
    .from('shift_change_reports')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', reportId);

  if (error) throw new AppError('INTERNAL_ERROR', 'Error al actualizar reporte');
}

export async function markReportSent(
  client: Client,
  reportId: string,
  sentTo: string,
) {
  const { error } = await client
    .from('shift_change_reports')
    .update({
      status: 'enviado',
      sent_at: new Date().toISOString(),
      sent_to: sentTo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId);

  if (error) throw new AppError('INTERNAL_ERROR', 'Error al marcar reporte como enviado');
}

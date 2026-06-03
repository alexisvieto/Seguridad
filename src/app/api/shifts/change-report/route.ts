import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';
import {
  getShiftChangeStatus,
  saveEvent,
  updateReportFields,
  markReportSent,
} from '@/modules/shifts/services/shift-change.service';
import type { ShiftType, EventType } from '@/modules/shifts/services/shift-change.service';

// GET: Fetch shift change status for a date/shift
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id');
    const date = searchParams.get('date');
    const shiftType = searchParams.get('shift_type') as ShiftType | null;

    if (!tenantId || !date || !shiftType) {
      throw new AppError('VALIDATION_ERROR', 'tenant_id, date y shift_type son requeridos');
    }

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) throw new AppError('FORBIDDEN', 'Sin acceso a este tenant');

    const result = await getShiftChangeStatus(supabase, tenantId, date, shiftType);
    return NextResponse.json({ data: result });
  } catch (error) {
    return handleApiError(error);
  }
}

// PATCH: Save event narrative or update report fields
const eventSchema = z.object({
  action: z.literal('save_event'),
  report_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  work_station_id: z.string().uuid(),
  event_type: z.enum(['ausencia', 'tardanza', 'suspension', 'permiso', 'licencia', 'induccion', 'incapacidad', 'turno_especial']),
  programmed_agent_id: z.string().uuid().nullable(),
  actual_agent_id: z.string().uuid().nullable().optional(),
  narrative: z.string().max(2000),
  arrival_time: z.string().nullable().optional(),
  waiting_agent_id: z.string().uuid().nullable().optional(),
});

const fieldsSchema = z.object({
  action: z.literal('update_fields'),
  report_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  general_observations: z.string().max(2000).optional(),
  free_personnel: z.string().max(2000).optional(),
});

const sendSchema = z.object({
  action: z.literal('send_report'),
  report_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
});

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = body['action'];

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    if (action === 'save_event') {
      const input = validate(eventSchema, body);

      const { data: membership } = await supabase
        .from('memberships')
        .select('role')
        .eq('tenant_id', input.tenant_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        throw new AppError('FORBIDDEN', 'Solo administradores pueden documentar eventos');
      }

      const result = await saveEvent(supabase, {
        reportId: input.report_id,
        tenantId: input.tenant_id,
        workStationId: input.work_station_id,
        eventType: input.event_type as EventType,
        programmedAgentId: input.programmed_agent_id,
        actualAgentId: input.actual_agent_id ?? null,
        narrative: input.narrative,
        arrivalTime: input.arrival_time ?? null,
        waitingAgentId: input.waiting_agent_id ?? null,
      });

      return NextResponse.json({ data: result });
    }

    if (action === 'update_fields') {
      const input = validate(fieldsSchema, body);

      const { data: fieldsMembership } = await supabase
        .from('memberships').select('role')
        .eq('tenant_id', input.tenant_id).eq('user_id', user.id).maybeSingle();
      if (!fieldsMembership || !['owner', 'admin'].includes(fieldsMembership.role)) {
        throw new AppError('FORBIDDEN', 'Solo administradores pueden actualizar campos');
      }

      await updateReportFields(supabase, input.report_id, {
        general_observations: input.general_observations,
        free_personnel: input.free_personnel,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'send_report') {
      const input = validate(sendSchema, body);

      const { data: membership } = await supabase
        .from('memberships')
        .select('role')
        .eq('tenant_id', input.tenant_id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        throw new AppError('FORBIDDEN', 'Solo administradores pueden enviar reportes');
      }

      // Get tenant owner email
      const { data: ownerMembership } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('tenant_id', input.tenant_id)
        .eq('role', 'owner')
        .maybeSingle();

      const sentTo = ownerMembership?.user_id ?? user.id;

      await markReportSent(supabase, input.report_id, String(sentTo));

      return NextResponse.json({ success: true, message: 'Reporte marcado como enviado' });
    }

    throw new AppError('VALIDATION_ERROR', 'Acción no reconocida');
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';
import {
  createAssignment,
  getAssignmentsByDate,
  getAvailableAgents,
  deleteAssignment,
} from '@/modules/shifts/services/assignment.service';

const timeSchema = z.string().min(5).transform((val) => val.slice(0, 5)).pipe(z.string().regex(/^\d{2}:\d{2}$/));

const createSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  work_station_id: z.string().uuid(),
  assignment_type: z.enum(['fijo', 'temporal', 'mensual']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  start_time: timeSchema,
  end_time: timeSchema,
  notes: z.string().max(500).optional(),
}).refine((d) => d.end_time !== d.start_time, {
  message: 'La hora de fin no puede ser igual a la hora de inicio',
}).refine((d) => {
  if (d.assignment_type === 'fijo') return d.end_date === null;
  return d.end_date !== null;
}, {
  message: 'Asignación fija no lleva fecha fin; temporal y mensual requieren fecha fin',
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const input = validate(createSchema, body);

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: membership } = await supabase
      .from('memberships')
      .select('role, tenant_id')
      .eq('tenant_id', input.tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new AppError('FORBIDDEN', 'Solo administradores pueden asignar turnos');
    }

    const assignment = await createAssignment(
      supabase,
      {
        tenantId: membership.tenant_id,
        userId: input.user_id,
        workStationId: input.work_station_id,
        assignmentType: input.assignment_type,
        startDate: input.start_date,
        endDate: input.end_date,
        startTime: input.start_time,
        endTime: input.end_time,
        notes: input.notes,
      },
      user.id,
    );

    return NextResponse.json({ data: assignment }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenant_id');
    const date = searchParams.get('date');
    const mode = searchParams.get('mode');

    if (!tenantId || !date) {
      throw new AppError('VALIDATION_ERROR', 'tenant_id y date son requeridos');
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

    if (!membership) {
      throw new AppError('FORBIDDEN', 'Sin acceso a este tenant');
    }

    if (mode === 'available_agents') {
      const startTime = searchParams.get('start_time') ?? '06:00';
      const endTime = searchParams.get('end_time') ?? '18:00';
      const agents = await getAvailableAgents(supabase, tenantId, date, startTime, endTime);
      return NextResponse.json({ data: agents });
    }

    const assignments = await getAssignmentsByDate(supabase, tenantId, date);
    return NextResponse.json({ data: assignments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) throw new AppError('VALIDATION_ERROR', 'id requerido');

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: assignment } = await supabase
      .from('shift_assignments')
      .select('tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (!assignment) throw new AppError('NOT_FOUND', 'Asignación no encontrada');

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('tenant_id', assignment.tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new AppError('FORBIDDEN', 'Solo administradores pueden eliminar asignaciones');
    }

    await deleteAssignment(supabase, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

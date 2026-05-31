import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';

const justifySchema = z.object({
  incident_id: z.string().uuid(),
  notas_resolucion: z.string().min(10, 'La justificación debe tener al menos 10 caracteres').max(2000),
});

export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const input = validate(justifySchema, body);

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    // Fetch the incident to validate tenant membership
    const { data: incident } = await supabase
      .from('incidents_log')
      .select('id, tenant_id, status')
      .eq('id', input.incident_id)
      .maybeSingle();

    if (!incident) {
      throw new AppError('NOT_FOUND', 'Incidencia no encontrada');
    }

    // Verify user has admin/owner role in the incident's tenant
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('tenant_id', incident.tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new AppError('FORBIDDEN', 'Solo administradores pueden justificar incidencias');
    }

    if (incident.status === 'justified' || incident.status === 'closed') {
      throw new AppError('CONFLICT', 'Esta incidencia ya fue justificada o cerrada');
    }

    // Update the incident
    const { data: updated, error } = await supabase
      .from('incidents_log')
      .update({
        status: 'justified',
        notas_resolucion: input.notas_resolucion,
        justified_by: user.id,
        justified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.incident_id)
      .select('id, status, notas_resolucion, justified_at')
      .maybeSingle();

    if (error || !updated) {
      throw new AppError('INTERNAL_ERROR', 'Error al justificar la incidencia');
    }

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';

const actionSchema = z.object({
  source_type: z.enum(['incident', 'ticket', 'damage']),
  source_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  new_status: z.string().min(1),
  notes: z.string().min(1, 'Debe ingresar una nota describiendo la acción tomada'),
});

export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const input = validate(actionSchema, body);

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('tenant_id', input.tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new AppError('FORBIDDEN', 'Solo administradores pueden gestionar alertas');
    }

    let oldStatus = '';

    if (input.source_type === 'incident') {
      const { data: row } = await supabase.from('incidents_log').select('status').eq('id', input.source_id).eq('tenant_id', input.tenant_id).maybeSingle();
      if (!row) throw new AppError('NOT_FOUND', 'Incidencia no encontrada');
      oldStatus = row.status;

      await supabase.from('incidents_log').update({
        status: input.new_status as 'open' | 'in_progress' | 'resolved' | 'justified' | 'closed',
        action_taken: input.notes,
        updated_at: new Date().toISOString(),
      }).eq('id', input.source_id).eq('tenant_id', input.tenant_id);
    }

    if (input.source_type === 'ticket') {
      const { data: row } = await supabase.from('client_tickets').select('status').eq('id', input.source_id).eq('tenant_id', input.tenant_id).maybeSingle();
      if (!row) throw new AppError('NOT_FOUND', 'Ticket no encontrado');
      oldStatus = row.status;

      await supabase.from('client_tickets').update({
        status: input.new_status as 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado',
        updated_at: new Date().toISOString(),
      }).eq('id', input.source_id).eq('tenant_id', input.tenant_id);
    }

    if (input.source_type === 'damage') {
      const { data: row } = await supabase.from('client_damage_reports').select('status').eq('id', input.source_id).eq('tenant_id', input.tenant_id).maybeSingle();
      if (!row) throw new AppError('NOT_FOUND', 'Reporte de daño no encontrado');
      oldStatus = row.status;

      await supabase.from('client_damage_reports').update({
        status: input.new_status as 'bajo_investigacion' | 'aceptado_empresa' | 'rechazado_con_pruebas' | 'reparado',
        updated_at: new Date().toISOString(),
      }).eq('id', input.source_id).eq('tenant_id', input.tenant_id);
    }

    // Log the audit trail
    await supabase.from('alert_audit_log').insert({
      tenant_id: input.tenant_id,
      source_type: input.source_type,
      source_id: input.source_id,
      old_status: oldStatus,
      new_status: input.new_status,
      notes: input.notes,
      action_by: user.id,
    });

    return NextResponse.json({ success: true, old_status: oldStatus, new_status: input.new_status });
  } catch (error) {
    return handleApiError(error);
  }
}

// GET audit trail for a specific item
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sourceType = searchParams.get('source_type');
    const sourceId = searchParams.get('source_id');
    const tenantId = searchParams.get('tenant_id');

    if (!sourceType || !sourceId || !tenantId) {
      throw new AppError('VALIDATION_ERROR', 'source_type, source_id y tenant_id requeridos');
    }

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: membership } = await supabase
      .from('memberships').select('role')
      .eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      throw new AppError('FORBIDDEN', 'Sin acceso');
    }

    const { data: logs } = await supabase
      .from('alert_audit_log')
      .select('id, old_status, new_status, notes, action_by, created_at')
      .eq('tenant_id', tenantId)
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .order('created_at', { ascending: true });

    const userIds = [...new Set((logs ?? []).map((l) => l.action_by))];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const trail = (logs ?? []).map((l) => ({
      ...l,
      action_by_name: nameMap.get(l.action_by) ?? 'Operador',
    }));

    return NextResponse.json({ data: trail });
  } catch (error) {
    return handleApiError(error);
  }
}

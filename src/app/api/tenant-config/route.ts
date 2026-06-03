import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenant_id');
    if (!tenantId) throw new AppError('VALIDATION_ERROR', 'tenant_id requerido');

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: tenant } = await supabase.from('tenants').select('id, name, settings, logo_url').eq('id', tenantId).maybeSingle();
    if (!tenant) throw new AppError('NOT_FOUND', 'Tenant no encontrado');

    return NextResponse.json({ data: tenant });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const tenantId = String(body['tenant_id'] ?? '');
    if (!tenantId) throw new AppError('VALIDATION_ERROR', 'tenant_id requerido');

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: membership } = await supabase
      .from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
    if (!membership || membership.role !== 'owner') {
      throw new AppError('FORBIDDEN', 'Solo el gerente puede modificar la configuración');
    }

    const { data: tenant } = await supabase.from('tenants').select('settings').eq('id', tenantId).maybeSingle();
    const currentSettings = (tenant?.settings ?? {}) as Record<string, unknown>;

    const newSettings = { ...currentSettings };

    // Branding
    if (body['branding']) {
      newSettings['branding'] = body['branding'];
    }

    // Regional
    if (body['regional']) {
      newSettings['regional'] = body['regional'];
    }

    // Payroll config
    if (body['payroll']) {
      newSettings['payroll'] = body['payroll'];
    }

    // Firearms config
    if (body['firearms']) {
      newSettings['firearms'] = body['firearms'];
    }

    // Update name if provided
    const updates: Record<string, unknown> = { settings: newSettings };
    if (body['name']) updates['name'] = String(body['name']).trim();
    if (body['logo_url'] !== undefined) updates['logo_url'] = body['logo_url'];

    const { error } = await supabase.from('tenants').update({
      settings: newSettings,
      name: updates['name'] as string | undefined,
      logo_url: (updates['logo_url'] as string | null | undefined) ?? undefined,
    }).eq('id', tenantId);
    if (error) throw new AppError('INTERNAL_ERROR', 'Error al guardar configuración');

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';
import { processFortnightPayroll } from '@/lib/payroll/engine';

const calculateSchema = z.object({
  tenant_id: z.string().uuid(),
  period_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const input = validate(calculateSchema, body);

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AppError('UNAUTHORIZED', 'No autenticado');
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('tenant_id', input.tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      throw new AppError('FORBIDDEN', 'Solo administradores pueden calcular la nomina');
    }

    await processFortnightPayroll(input.tenant_id, input.period_id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

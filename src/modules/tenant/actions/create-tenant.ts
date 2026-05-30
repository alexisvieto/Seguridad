'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleActionError } from '@/lib/errors/error-handler';
import { createTenantSchema } from '../schemas';
import { createTenant } from '../services/tenant.service';
import type { ActionResult } from '@/shared/types/action-result';
import type { Tenant } from '@/shared/types/database';

export async function createTenantAction(
  formData: FormData,
): Promise<ActionResult<Tenant>> {
  try {
    const input = validate(createTenantSchema, {
      name: formData.get('name'),
      slug: formData.get('slug'),
      plan: formData.get('plan') ?? 'free',
    });

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'No autenticado', code: 'UNAUTHORIZED' };
    }

    const tenant = await createTenant(supabase, input, user.id);
    return { success: true, data: tenant };
  } catch (error) {
    return { success: false, ...handleActionError(error) };
  }
}

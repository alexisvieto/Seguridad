'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleActionError } from '@/lib/errors/error-handler';
import { signUpSchema } from '../schemas';
import type { ActionResult } from '@/shared/types/action-result';

export async function signUpAction(
  formData: FormData,
): Promise<ActionResult<{ userId: string }>> {
  try {
    const input = validate(signUpSchema, {
      email: formData.get('email'),
      password: formData.get('password'),
      full_name: formData.get('full_name'),
    });

    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { full_name: input.full_name },
      },
    });

    if (error || !data.user) {
      return { success: false, error: error?.message ?? 'Error al registrar usuario', code: 'UNAUTHORIZED' };
    }

    return { success: true, data: { userId: data.user.id } };
  } catch (error) {
    return { success: false, ...handleActionError(error) };
  }
}

'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleActionError } from '@/lib/errors/error-handler';
import { signInSchema } from '../schemas';
import type { ActionResult } from '@/shared/types/action-result';

export async function signInAction(
  formData: FormData,
): Promise<ActionResult<{ userId: string }>> {
  try {
    const input = validate(signInSchema, {
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const supabase = await getSupabaseServerClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) {
      return { success: false, error: 'Credenciales inválidas', code: 'UNAUTHORIZED' };
    }

    return { success: true, data: { userId: data.user.id } };
  } catch (error) {
    return { success: false, ...handleActionError(error) };
  }
}

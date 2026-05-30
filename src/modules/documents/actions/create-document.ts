'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleActionError } from '@/lib/errors/error-handler';
import { createDocumentSchema } from '../schemas';
import { createDocument } from '../services/document.service';
import type { ActionResult } from '@/shared/types/action-result';
import type { Document } from '@/shared/types/database';

export async function createDocumentAction(
  formData: FormData,
): Promise<ActionResult<Document>> {
  try {
    const input = validate(createDocumentSchema, {
      tenant_id: formData.get('tenant_id'),
      title: formData.get('title') ?? undefined,
      parent_id: formData.get('parent_id') ?? null,
    });

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'No autenticado', code: 'UNAUTHORIZED' };
    }

    const document = await createDocument(supabase, input, user.id);
    return { success: true, data: document };
  } catch (error) {
    return { success: false, ...handleActionError(error) };
  }
}

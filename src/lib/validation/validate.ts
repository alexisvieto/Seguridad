import { ZodSchema, ZodError } from 'zod';
import { AppError } from '@/lib/errors/app-error';

export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Datos de entrada inválidos',
      result.error.flatten().fieldErrors,
    );
  }

  return result.data;
}

export function safeValidate<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: ZodError } {
  const result = schema.safeParse(data);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: result.data };
}

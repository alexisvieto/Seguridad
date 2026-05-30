import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError } from './app-error';

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode });
  }

  if (error instanceof ZodError) {
    const appError = new AppError(
      'VALIDATION_ERROR',
      'Datos de entrada inválidos',
      error.flatten().fieldErrors,
    );
    return NextResponse.json(appError.toJSON(), { status: 400 });
  }

  console.error('[API Error]', error);

  const fallback = new AppError('INTERNAL_ERROR', 'Error interno del servidor');
  return NextResponse.json(fallback.toJSON(), { status: 500 });
}

export function handleActionError(error: unknown): { error: string; code: string } {
  if (error instanceof AppError) {
    return { error: error.message, code: error.code };
  }

  if (error instanceof ZodError) {
    return {
      error: 'Datos de entrada inválidos',
      code: 'VALIDATION_ERROR',
    };
  }

  console.error('[Action Error]', error);
  return { error: 'Error interno del servidor', code: 'INTERNAL_ERROR' };
}

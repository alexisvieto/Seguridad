import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres'),
  slug: z
    .string()
    .min(3, 'El slug debe tener al menos 3 caracteres')
    .max(64, 'El slug no puede superar 64 caracteres')
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      'El slug solo puede contener letras minúsculas, números y guiones',
    ),
  plan: z.enum(['free', 'pro', 'enterprise']).optional().default('free'),
});

export const updateTenantSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede superar 100 caracteres')
    .optional(),
  logo_url: z.string().url('URL de logo inválida').nullish(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['admin', 'editor', 'viewer'], {
    message: 'Rol inválido',
  }),
});

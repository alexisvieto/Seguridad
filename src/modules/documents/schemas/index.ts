import { z } from 'zod';

export const createDocumentSchema = z.object({
  tenant_id: z.string().uuid('ID de tenant inválido'),
  title: z.string().max(500, 'El título no puede superar 500 caracteres').optional().default('Sin título'),
  parent_id: z.string().uuid('ID de documento padre inválido').nullish(),
  content: z.array(z.record(z.string(), z.unknown())).optional().default([]),
});

export const updateDocumentSchema = z.object({
  title: z.string().max(500, 'El título no puede superar 500 caracteres').optional(),
  content: z.array(z.record(z.string(), z.unknown())).optional(),
  icon: z.string().nullish(),
  cover_url: z.string().url('URL de portada inválida').nullish(),
  is_pinned: z.boolean().optional(),
  parent_id: z.string().uuid('ID de documento padre inválido').nullish(),
});

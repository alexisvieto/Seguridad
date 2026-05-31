import { z } from 'zod';

export const createFirearmSchema = z.object({
  tenant_id: z.string().uuid(),
  serial_number: z.string().min(1, 'Número de serie requerido'),
  type: z.enum(['revolver', 'pistola', 'escopeta']),
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  permit_number: z.string().min(1, 'Número de permiso requerido').max(100),
  permit_expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
});

export const updateFirearmSchema = z.object({
  serial_number: z.string().min(1).optional(),
  type: z.enum(['revolver', 'pistola', 'escopeta']).optional(),
  brand: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  status: z.enum(['operativa', 'mantenimiento', 'retirada']).optional(),
  permit_number: z.string().min(1).max(100).optional(),
  permit_expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const upsertComplianceSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  shooting_test_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  psych_test_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  doping_test_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const assignFirearmSchema = z.object({
  tenant_id: z.string().uuid(),
  firearm_id: z.string().uuid(),
  work_station_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => data.work_station_id ?? data.user_id,
  { message: 'Debe asignar a un puesto o a un agente' },
);

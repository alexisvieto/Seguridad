import { z } from 'zod';

export const createIncidentSchema = z.object({
  tenant_id: z.string().uuid('ID de tenant inválido'),
  work_station_id: z.string().uuid('ID de puesto inválido'),
  raw_text: z
    .string()
    .min(1, 'El texto de la novedad es requerido')
    .max(5000, 'El texto no puede superar 5000 caracteres'),
});

export const updateIncidentSchema = z.object({
  raw_text: z.string().min(1).max(5000).optional(),
  ai_refined_text: z.string().nullish(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  am_report_sent: z.boolean().optional(),
});

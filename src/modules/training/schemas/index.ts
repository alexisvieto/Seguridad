import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createCourseSchema = z.object({
  tenant_id: z.string().uuid(),
  course_name: z.string().min(2, 'Nombre requerido').max(300),
  description: z.string().max(5000).nullish(),
  validity_months: z.number().int().positive().optional().default(12),
});

export const logTrainingSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  course_id: z.string().uuid(),
  completion_date: z.string().regex(dateRegex, 'Formato YYYY-MM-DD'),
  grade: z.string().max(50).nullish(),
  certificate_pdf_url: z.string().url().max(1000).nullish(),
});

export const assignRequiredTrainingSchema = z.object({
  tenant_id: z.string().uuid(),
  work_station_id: z.string().uuid(),
  course_id: z.string().uuid(),
});

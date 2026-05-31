import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createPeriodSchema = z.object({
  tenant_id: z.string().uuid(),
  start_date: z.string().regex(dateRegex, 'Formato YYYY-MM-DD'),
  end_date: z.string().regex(dateRegex, 'Formato YYYY-MM-DD'),
});

export const updatePayrollConfigSchema = z.object({
  ordinary_hours_limit: z.number().min(1).max(999).optional(),
  overtime_flat_rate: z.boolean().optional(),
  pays_holiday_premium: z.boolean().optional(),
  social_security_rate: z.number().min(0).max(0.9999).optional(),
  educational_insurance_rate: z.number().min(0).max(0.9999).optional(),
});

export const adjustAgentPayrollSchema = z.object({
  consolidated_id: z.string().uuid(),
  adjustments_addition: z.number().min(0).optional(),
  adjustments_deduction: z.number().min(0).optional(),
});

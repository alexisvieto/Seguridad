import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const upsertHrProfileSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  css_number: z.string().max(50).nullish(),
  life_insurance_policy: z.string().max(100).nullish(),
  security_carnet_number: z.string().max(100).nullish(),
  carnet_expiry_date: z.string().regex(dateRegex).nullish(),
  hire_date: z.string().regex(dateRegex).optional(),
  emergency_contact_name: z.string().max(200).nullish(),
  emergency_contact_phone: z.string().max(30).nullish(),
});

export const createContractSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  contract_type: z.enum(['definido', 'indefinido']),
  start_date: z.string().regex(dateRegex, 'Formato YYYY-MM-DD'),
  end_date: z.string().regex(dateRegex).nullish(),
  base_salary: z.number().positive('El salario debe ser mayor a 0'),
}).refine(
  (data) => data.contract_type === 'indefinido' || data.end_date,
  { message: 'Contratos definidos requieren fecha de fin', path: ['end_date'] },
);

export const terminateContractSchema = z.object({
  status: z.enum(['vencido', 'terminado']),
  termination_reason: z.string().min(1).max(1000).optional(),
});

export const createDisciplinarySchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  record_type: z.enum(['llamado_atencion', 'falta', 'suspension']),
  description: z.string().min(1, 'Descripción requerida').max(5000),
  start_date: z.string().regex(dateRegex),
  end_date: z.string().regex(dateRegex).nullish(),
  registered_by: z.string().uuid().optional(),
});

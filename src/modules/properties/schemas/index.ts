import { z } from 'zod';

const emergencyContactSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(200),
  phone: z.string().min(5, 'Teléfono inválido').max(30),
  role: z.string().min(1, 'Rol requerido').max(100),
});

export const createPropertySchema = z.object({
  tenant_id: z.string().uuid('ID de tenant inválido'),
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(200, 'El nombre no puede superar 200 caracteres'),
  address: z
    .string()
    .min(5, 'La dirección debe tener al menos 5 caracteres')
    .max(500, 'La dirección no puede superar 500 caracteres'),
  contact_emergency: z.array(emergencyContactSchema).optional().default([]),
});

export const updatePropertySchema = z.object({
  name: z.string().min(2).max(200).optional(),
  address: z.string().min(5).max(500).optional(),
  contact_emergency: z.array(emergencyContactSchema).optional(),
  is_active: z.boolean().optional(),
});

export const createWorkStationSchema = z.object({
  tenant_id: z.string().uuid('ID de tenant inválido'),
  property_id: z.string().uuid('ID de propiedad inválido'),
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(200, 'El nombre no puede superar 200 caracteres'),
});

export const updateWorkStationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  is_active: z.boolean().optional(),
});

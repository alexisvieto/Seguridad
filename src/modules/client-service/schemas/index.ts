import { z } from 'zod';

export const createTicketSchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  category: z.enum(['queja_personal', 'solicitud_refuerzo', 'falla_servicio', 'otros']),
  subject: z.string().min(2, 'Asunto requerido').max(300),
  description: z.string().min(1, 'Descripción requerida').max(5000),
  priority: z.enum(['baja', 'media', 'alta', 'critica']).optional().default('media'),
});

export const updateTicketSchema = z.object({
  category: z.enum(['queja_personal', 'solicitud_refuerzo', 'falla_servicio', 'otros']).optional(),
  subject: z.string().min(2).max(300).optional(),
  description: z.string().min(1).max(5000).optional(),
  priority: z.enum(['baja', 'media', 'alta', 'critica']).optional(),
  status: z.enum(['abierto', 'en_proceso', 'resuelto', 'cerrado']).optional(),
  assigned_to: z.string().uuid().nullish(),
});

export const createDamageReportSchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  work_station_id: z.string().uuid().optional(),
  item_damaged: z.string().min(2, 'Debe describir el elemento dañado').max(300),
  responsible_party: z.enum(['agente_seguridad', 'residente', 'proveedor_externo', 'desconocido']),
  description: z.string().min(1, 'Descripción requerida').max(5000),
  cost_estimate: z.number().min(0).optional().default(0),
  evidence_urls: z.array(z.string().url()).optional().default([]),
});

export const updateDamageReportSchema = z.object({
  item_damaged: z.string().min(2).max(300).optional(),
  responsible_party: z.enum(['agente_seguridad', 'residente', 'proveedor_externo', 'desconocido']).optional(),
  description: z.string().min(1).max(5000).optional(),
  cost_estimate: z.number().min(0).optional(),
  evidence_urls: z.array(z.string().url()).optional(),
  status: z.enum(['bajo_investigacion', 'aceptado_empresa', 'rechazado_con_pruebas', 'reparado']).optional(),
});

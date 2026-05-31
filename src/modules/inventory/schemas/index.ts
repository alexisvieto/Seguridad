import { z } from 'zod';

export const createInventoryItemSchema = z.object({
  tenant_id: z.string().uuid(),
  item_name: z.string().min(2, 'Nombre requerido').max(200),
  category: z.enum(['uniforme', 'calzado', 'comunicacion', 'defensa', 'otros']),
  size_or_model: z.string().max(100).nullish(),
  current_stock: z.number().int().min(0).optional().default(0),
  min_stock_alert: z.number().int().min(0).optional().default(5),
});

export const updateInventoryItemSchema = z.object({
  item_name: z.string().min(2).max(200).optional(),
  category: z.enum(['uniforme', 'calzado', 'comunicacion', 'defensa', 'otros']).optional(),
  size_or_model: z.string().max(100).nullish(),
  current_stock: z.number().int().min(0).optional(),
  min_stock_alert: z.number().int().min(0).optional(),
});

export const createStationAssetSchema = z.object({
  tenant_id: z.string().uuid(),
  work_station_id: z.string().uuid(),
  asset_name: z.string().min(2, 'Nombre requerido').max(200),
  imei_or_serial: z.string().nullish(),
});

export const updateStationAssetSchema = z.object({
  asset_name: z.string().min(2).max(200).optional(),
  imei_or_serial: z.string().nullish(),
  status: z.enum(['bueno', 'dañado', 'en_reparacion']).optional(),
  damage_report_notes: z.string().max(2000).nullish(),
});

export const createLoanSchema = z.object({
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  item_id: z.string().uuid(),
  quantity: z.number().int().min(1, 'Cantidad mínima: 1'),
});

export const updateLoanStatusSchema = z.object({
  status: z.enum(['entregado', 'devuelto', 'descontado_por_perdida']),
});

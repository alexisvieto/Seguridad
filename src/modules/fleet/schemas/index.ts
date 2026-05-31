import { z } from 'zod';

export const createVehicleSchema = z.object({
  tenant_id: z.string().uuid(),
  plate_number: z.string().min(2, 'Placa requerida').max(20),
  vehicle_type: z.enum(['auto', 'moto', 'scooter', 'bicicleta']),
  brand_model: z.string().min(2).max(150),
  gps_device_id: z.string().nullish(),
  next_maintenance_odometer: z.number().int().positive('Debe ser mayor a 0'),
});

export const updateVehicleSchema = z.object({
  plate_number: z.string().min(2).max(20).optional(),
  vehicle_type: z.enum(['auto', 'moto', 'scooter', 'bicicleta']).optional(),
  brand_model: z.string().min(2).max(150).optional(),
  gps_device_id: z.string().nullish(),
  current_odometer: z.number().int().min(0).optional(),
  next_maintenance_odometer: z.number().int().positive().optional(),
  status: z.enum(['activo', 'taller', 'siniestrado']).optional(),
});

export const gpsLogSchema = z.object({
  tenant_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed_kmh: z.number().min(0).optional().default(0),
  odometer_reading: z.number().int().min(0).optional(),
  recorded_at: z.string().datetime(),
});

export const gpsLogBatchSchema = z.object({
  entries: z.array(gpsLogSchema).min(1).max(500),
});

export const createViolationSchema = z.object({
  tenant_id: z.string().uuid(),
  vehicle_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  violation_type: z.enum(['salida_de_zona', 'exceso_velocidad', 'parada_prolongada_no_autorizada']),
  description: z.string().min(1).max(2000),
});

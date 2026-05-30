import { z } from 'zod';

const gpsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
});

export const clockInSchema = z.object({
  tenant_id: z.string().uuid('ID de tenant inválido'),
  work_station_id: z.string().uuid('ID de puesto inválido'),
  clock_in_gps: gpsSchema,
});

export const clockOutSchema = z.object({
  shift_id: z.string().uuid('ID de turno inválido'),
  clock_out_gps: gpsSchema,
});

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';
import { clockIn } from '@/modules/shifts/services/shift.service';
import { validateGpsProximity } from '@/lib/geo/validate-proximity';

const clockInApiSchema = z.object({
  work_station_id: z.string().uuid('ID de puesto inválido'),
  qr_code_token: z.string().min(1, 'Token QR requerido'),
  gps: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const input = validate(clockInApiSchema, body);

    // 1. Authenticate
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AppError('UNAUTHORIZED', 'Debes iniciar sesión para registrar entrada');
    }

    // 2. Validate QR token matches the work station
    const { data: station, error: stationError } = await supabase
      .from('work_stations')
      .select('id, tenant_id, qr_code_token, is_active, properties_ph(id, name, tenant_id)')
      .eq('id', input.work_station_id)
      .maybeSingle();

    if (stationError || !station) {
      throw new AppError('NOT_FOUND', 'Puesto de trabajo no encontrado');
    }

    // 2b. Validate user is member of the station's tenant
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('tenant_id', station.tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      throw new AppError('FORBIDDEN', 'No tienes acceso a este tenant');
    }

    if (station.qr_code_token !== input.qr_code_token) {
      throw new AppError('VALIDATION_ERROR', 'El código QR no coincide con el puesto de trabajo');
    }

    if (!station.is_active) {
      throw new AppError('VALIDATION_ERROR', 'Este puesto de trabajo está desactivado');
    }

    // 3. Validate GPS proximity (placeholder — returns true until property GPS is added)
    const gpsCoordinates = { lat: input.gps.latitude, lng: input.gps.longitude };
    const proximity = validateGpsProximity(gpsCoordinates, null);

    if (!proximity.valid) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Estás a ${Math.round(proximity.distance)}m del puesto. Debes estar a menos de 200m.`,
      );
    }

    // 4. Register clock-in via service layer
    const shift = await clockIn(
      supabase,
      {
        tenant_id: station.tenant_id,
        work_station_id: station.id,
        clock_in_gps: gpsCoordinates,
      },
      user.id,
    );

    return NextResponse.json(
      {
        data: {
          shift_id: shift.id,
          clock_in: shift.clock_in,
          work_station_id: shift.work_station_id,
          gps_validated: proximity.valid,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

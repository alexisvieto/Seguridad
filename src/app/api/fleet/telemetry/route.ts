import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/supabase/server';

const SPEED_LIMIT_KMH = 80;

const pointSchema = z.object({
  gps_device_id: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed_kmh: z.number().min(0).default(0),
  odometer: z.number().int().min(0).optional(),
  timestamp: z.string().datetime(),
});

const bodySchema = z.union([
  pointSchema,
  z.array(pointSchema).min(1).max(500),
]);

export async function POST(request: NextRequest) {
  // 1. Auth — validate provider token
  const token = request.headers.get('x-gps-auth-token');
  const secret = process.env.GPS_PROVIDER_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Invalid or missing x-gps-auth-token' },
      { status: 401 },
    );
  }

  // 2. Parse body
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const points = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

  // 3. Resolve vehicles — batch lookup all unique device IDs
  const supabase = await getSupabaseAdminClient();
  const deviceIds = [...new Set(points.map((p) => p.gps_device_id))];

  const { data: vehicles } = await supabase
    .from('fleet_vehicles')
    .select('id, tenant_id, gps_device_id, current_odometer, next_maintenance_odometer, status')
    .in('gps_device_id', deviceIds);

  const vehicleMap = new Map(
    (vehicles ?? []).map((v) => [v.gps_device_id, v]),
  );

  // Identify unknown devices
  const unknownDevices = deviceIds.filter((d) => !vehicleMap.has(d));
  if (unknownDevices.length === deviceIds.length) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'No vehicles found for provided device IDs', unknown_devices: unknownDevices },
      { status: 404 },
    );
  }

  // 4. Build GPS log inserts + collect side effects
  const gpsRows: {
    tenant_id: string;
    vehicle_id: string;
    latitude: number;
    longitude: number;
    speed_kmh: number;
    odometer_reading: number | null;
    recorded_at: string;
  }[] = [];

  const speedViolations: {
    tenant_id: string;
    vehicle_id: string;
    violation_type: 'exceso_velocidad';
    description: string;
  }[] = [];

  const maintenanceFlags: { vehicleId: string; plateOrDevice: string }[] = [];

  let processedCount = 0;
  let skippedCount = 0;

  for (const point of points) {
    const vehicle = vehicleMap.get(point.gps_device_id);
    if (!vehicle) {
      skippedCount++;
      continue;
    }

    gpsRows.push({
      tenant_id: vehicle.tenant_id,
      vehicle_id: vehicle.id,
      latitude: point.latitude,
      longitude: point.longitude,
      speed_kmh: point.speed_kmh,
      odometer_reading: point.odometer ?? null,
      recorded_at: point.timestamp,
    });

    processedCount++;

    // Speed violation
    if (point.speed_kmh > SPEED_LIMIT_KMH) {
      speedViolations.push({
        tenant_id: vehicle.tenant_id,
        vehicle_id: vehicle.id,
        violation_type: 'exceso_velocidad',
        description: `Velocidad de ${point.speed_kmh.toFixed(1)} km/h detectada (límite: ${SPEED_LIMIT_KMH} km/h). Ubicación: ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}. Hora: ${point.timestamp}`,
      });
    }

    // Maintenance alert check
    if (
      point.odometer !== undefined &&
      point.odometer >= vehicle.next_maintenance_odometer &&
      vehicle.status === 'activo'
    ) {
      maintenanceFlags.push({
        vehicleId: vehicle.id,
        plateOrDevice: vehicle.gps_device_id ?? vehicle.id,
      });
    }
  }

  // 5. Execute all writes in parallel for speed
  const operations: PromiseLike<unknown>[] = [];

  if (gpsRows.length > 0) {
    operations.push(
      supabase.from('vehicle_gps_logs').insert(gpsRows).then(() => {}),
    );
  }

  if (speedViolations.length > 0) {
    operations.push(
      supabase.from('geofence_violations').insert(speedViolations).then(() => {}),
    );
  }

  if (maintenanceFlags.length > 0) {
    const flagIds = maintenanceFlags.map((f) => f.vehicleId);
    operations.push(
      supabase
        .from('fleet_vehicles')
        .update({ status: 'taller' as const })
        .in('id', flagIds)
        .eq('status', 'activo')
        .then(() => {}),
    );
  }

  await Promise.all(operations);

  // 6. Respond fast
  return NextResponse.json({
    ok: true,
    processed: processedCount,
    skipped: skippedCount,
    violations: speedViolations.length,
    maintenance_flagged: maintenanceFlags.length,
    unknown_devices: unknownDevices.length > 0 ? unknownDevices : undefined,
  });
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, VehicleType, VehicleStatus, ViolationType, ViolationStatus } from '@/shared/types/database';
import type { MaintenanceAlert } from '../types';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Fleet Vehicles
// ---------------------------------------------------------------------------

export async function createVehicle(
  client: Client,
  input: {
    tenant_id: string;
    plate_number: string;
    vehicle_type: VehicleType;
    brand_model: string;
    gps_device_id?: string | null;
    next_maintenance_odometer: number;
  },
) {
  const { data, error } = await client
    .from('fleet_vehicles')
    .insert({
      tenant_id: input.tenant_id,
      plate_number: input.plate_number,
      vehicle_type: input.vehicle_type,
      brand_model: input.brand_model,
      gps_device_id: input.gps_device_id ?? null,
      next_maintenance_odometer: input.next_maintenance_odometer,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('CONFLICT', 'Ya existe un vehículo con esa placa o dispositivo GPS');
    }
    throw new AppError('INTERNAL_ERROR', 'Error al registrar el vehículo');
  }

  return data;
}

export async function getVehiclesByTenant(client: Client, tenantId: string) {
  const { data, error } = await client
    .from('fleet_vehicles')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('plate_number');

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener la flota');
  }

  return data ?? [];
}

export async function updateVehicle(
  client: Client,
  vehicleId: string,
  input: Partial<{
    plate_number: string;
    vehicle_type: VehicleType;
    brand_model: string;
    gps_device_id: string | null;
    current_odometer: number;
    next_maintenance_odometer: number;
    status: VehicleStatus;
  }>,
) {
  const { data, error } = await client
    .from('fleet_vehicles')
    .update(input)
    .eq('id', vehicleId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar el vehículo');
  }

  return data;
}

export async function getVehicleByDeviceId(client: Client, gpsDeviceId: string) {
  const { data } = await client
    .from('fleet_vehicles')
    .select('id, tenant_id')
    .eq('gps_device_id', gpsDeviceId)
    .maybeSingle();

  return data;
}

// ---------------------------------------------------------------------------
// GPS Telemetry
// ---------------------------------------------------------------------------

export async function ingestGpsLogs(
  client: Client,
  entries: {
    tenant_id: string;
    vehicle_id: string;
    latitude: number;
    longitude: number;
    speed_kmh: number;
    odometer_reading?: number | null;
    recorded_at: string;
  }[],
) {
  const { error } = await client
    .from('vehicle_gps_logs')
    .insert(entries);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al ingestar datos GPS');
  }
}

export async function getLatestPosition(client: Client, vehicleId: string) {
  const { data } = await client
    .from('vehicle_gps_logs')
    .select('latitude, longitude, speed_kmh, odometer_reading, recorded_at')
    .eq('vehicle_id', vehicleId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function getVehicleTrack(
  client: Client,
  vehicleId: string,
  from: string,
  to: string,
) {
  const { data, error } = await client
    .from('vehicle_gps_logs')
    .select('latitude, longitude, speed_kmh, recorded_at')
    .eq('vehicle_id', vehicleId)
    .gte('recorded_at', from)
    .lte('recorded_at', to)
    .order('recorded_at');

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener el recorrido');
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Geofence Violations
// ---------------------------------------------------------------------------

export async function createViolation(
  client: Client,
  input: {
    tenant_id: string;
    vehicle_id: string;
    property_id?: string | null;
    violation_type: ViolationType;
    description: string;
  },
) {
  const { data, error } = await client
    .from('geofence_violations')
    .insert({
      tenant_id: input.tenant_id,
      vehicle_id: input.vehicle_id,
      property_id: input.property_id ?? null,
      violation_type: input.violation_type,
      description: input.description,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al registrar la violación');
  }

  return data;
}

export async function getViolationsByTenant(
  client: Client,
  tenantId: string,
  status?: ViolationStatus,
) {
  let query = client
    .from('geofence_violations')
    .select('*, fleet_vehicles(plate_number, brand_model), properties_ph(name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener las violaciones');
  }

  return data ?? [];
}

export async function updateViolationStatus(
  client: Client,
  violationId: string,
  status: ViolationStatus,
) {
  const { data, error } = await client
    .from('geofence_violations')
    .update({ status })
    .eq('id', violationId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar la violación');
  }

  return data;
}

// ---------------------------------------------------------------------------
// Maintenance Alerts
// ---------------------------------------------------------------------------

export async function getMaintenanceAlerts(
  client: Client,
  tenantId: string,
): Promise<MaintenanceAlert[]> {
  const { data } = await client
    .from('fleet_vehicles')
    .select('id, plate_number, brand_model, current_odometer, next_maintenance_odometer')
    .eq('tenant_id', tenantId)
    .neq('status', 'siniestrado');

  return (data ?? [])
    .filter((v) => v.current_odometer >= v.next_maintenance_odometer - 500)
    .map((v) => ({
      vehicleId: v.id,
      plateNumber: v.plate_number,
      brandModel: v.brand_model,
      currentOdometer: v.current_odometer,
      nextMaintenance: v.next_maintenance_odometer,
      remainingKm: v.next_maintenance_odometer - v.current_odometer,
    }));
}

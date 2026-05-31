export type {
  FleetVehicle,
  VehicleGpsLog,
  GeofenceViolation,
  VehicleType,
  VehicleStatus,
  ViolationType,
  ViolationStatus,
} from '@/shared/types/database';

export interface CreateVehicleInput {
  tenant_id: string;
  plate_number: string;
  vehicle_type: 'auto' | 'moto' | 'scooter' | 'bicicleta';
  brand_model: string;
  gps_device_id?: string;
  next_maintenance_odometer: number;
}

export interface GpsLogEntry {
  tenant_id: string;
  vehicle_id: string;
  latitude: number;
  longitude: number;
  speed_kmh?: number;
  odometer_reading?: number;
  recorded_at: string;
}

export interface MaintenanceAlert {
  vehicleId: string;
  plateNumber: string;
  brandModel: string;
  currentOdometer: number;
  nextMaintenance: number;
  remainingKm: number;
}

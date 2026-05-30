export type { AgentShift, GpsCoordinates } from '@/shared/types/database';

export interface ClockInInput {
  tenant_id: string;
  work_station_id: string;
  clock_in_gps: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
}

export interface ClockOutInput {
  shift_id: string;
  clock_out_gps: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
}

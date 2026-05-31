export type {
  FirearmInventory,
  AgentCompliance,
  FirearmAssignment,
  FirearmType,
  FirearmStatus,
} from '@/shared/types/database';

export interface CreateFirearmInput {
  tenant_id: string;
  serial_number: string;
  type: 'revolver' | 'pistola' | 'escopeta';
  brand: string;
  model: string;
  permit_number: string;
  permit_expiry_date: string;
}

export interface UpdateFirearmInput {
  serial_number?: string;
  type?: 'revolver' | 'pistola' | 'escopeta';
  brand?: string;
  model?: string;
  status?: 'operativa' | 'mantenimiento' | 'retirada';
  permit_number?: string;
  permit_expiry_date?: string;
}

export interface UpsertComplianceInput {
  tenant_id: string;
  user_id: string;
  shooting_test_expiry: string;
  psych_test_expiry: string;
  doping_test_expiry: string;
}

export interface AssignFirearmInput {
  tenant_id: string;
  firearm_id: string;
  work_station_id?: string;
  user_id?: string;
  notes?: string;
}

export type AlertLevel = 'green' | 'yellow' | 'red';

export interface ExpiryAlert {
  label: string;
  expiryDate: string;
  daysRemaining: number;
  level: AlertLevel;
}

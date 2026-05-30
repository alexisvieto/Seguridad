export type {
  PropertyPh,
  WorkStation,
  EmergencyContact,
} from '@/shared/types/database';

export interface CreatePropertyInput {
  tenant_id: string;
  name: string;
  address: string;
  contact_emergency?: EmergencyContact[];
}

export interface UpdatePropertyInput {
  name?: string;
  address?: string;
  contact_emergency?: EmergencyContact[];
  is_active?: boolean;
}

export interface CreateWorkStationInput {
  tenant_id: string;
  property_id: string;
  name: string;
}

export interface UpdateWorkStationInput {
  name?: string;
  is_active?: boolean;
}

import type { EmergencyContact } from '@/shared/types/database';

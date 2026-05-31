export type {
  HrAgentProfile,
  HrContract,
  HrDisciplinaryRecord,
  HrAgentRequest,
  ContractType,
  ContractStatus,
  DisciplinaryType,
  AgentRequestType,
  AgentRequestStatus,
} from '@/shared/types/database';

export interface UpsertHrProfileInput {
  tenant_id: string;
  user_id: string;
  css_number?: string;
  life_insurance_policy?: string;
  security_carnet_number?: string;
  carnet_expiry_date?: string;
  hire_date?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface CreateContractInput {
  tenant_id: string;
  user_id: string;
  contract_type: 'definido' | 'indefinido';
  start_date: string;
  end_date?: string;
  base_salary: number;
}

export interface CreateDisciplinaryInput {
  tenant_id: string;
  user_id: string;
  record_type: 'llamado_atencion' | 'falta' | 'suspension';
  description: string;
  start_date: string;
  end_date?: string;
  registered_by?: string;
}

export interface CarnetAlert {
  agentName: string;
  userId: string;
  carnetNumber: string;
  expiryDate: string;
  daysRemaining: number;
}

export interface ContractAlert {
  agentName: string;
  userId: string;
  contractType: string;
  endDate: string;
  daysRemaining: number;
  status: string;
}

export interface CreateAgentRequestInput {
  tenant_id: string;
  user_id: string;
  request_type: 'nuevo_uniforme' | 'vacaciones' | 'carta_trabajo' | 'permiso_remunerado';
  details: string;
}

export interface ReviewRequestInput {
  status: 'aprobado' | 'rechazado';
  reviewed_by: string;
  review_notes?: string;
}

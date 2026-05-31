import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ContractType, ContractStatus, DisciplinaryType, AgentRequestType, AgentRequestStatus, VaultDocumentType } from '@/shared/types/database';
import type { CarnetAlert, ContractAlert, VaultExpiryAlert } from '../types';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// HR Agent Profiles
// ---------------------------------------------------------------------------

export async function upsertHrProfile(
  client: Client,
  input: {
    tenant_id: string;
    user_id: string;
    css_number?: string | null;
    life_insurance_policy?: string | null;
    security_carnet_number?: string | null;
    carnet_expiry_date?: string | null;
    hire_date?: string;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
  },
) {
  const { data, error } = await client
    .from('hr_agent_profiles')
    .upsert(input, { onConflict: 'tenant_id,user_id' })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al guardar el perfil HR');
  }

  return data;
}

export async function getHrProfilesByTenant(client: Client, tenantId: string) {
  const { data, error } = await client
    .from('hr_agent_profiles')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener perfiles HR');
  }

  return data ?? [];
}

export async function getHrProfile(client: Client, tenantId: string, userId: string) {
  const { data } = await client
    .from('hr_agent_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle();

  return data;
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export async function createContract(
  client: Client,
  input: {
    tenant_id: string;
    user_id: string;
    contract_type: ContractType;
    start_date: string;
    end_date?: string | null;
    base_salary: number;
  },
) {
  const { data, error } = await client
    .from('hr_contracts')
    .insert({
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      contract_type: input.contract_type,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      base_salary: input.base_salary,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al crear el contrato');
  }

  return data;
}

export async function getContractsByTenant(
  client: Client,
  tenantId: string,
  status?: ContractStatus,
) {
  let query = client
    .from('hr_contracts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('start_date', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener contratos');
  }

  return data ?? [];
}

export async function terminateContract(
  client: Client,
  contractId: string,
  status: 'vencido' | 'terminado',
  reason?: string,
) {
  const { data, error } = await client
    .from('hr_contracts')
    .update({
      status,
      termination_reason: reason ?? null,
      end_date: new Date().toISOString().split('T')[0],
    })
    .eq('id', contractId)
    .eq('status', 'activo')
    .select()
    .single();

  if (error || !data) {
    throw new AppError('NOT_FOUND', 'Contrato activo no encontrado');
  }

  return data;
}

// ---------------------------------------------------------------------------
// Disciplinary Records
// ---------------------------------------------------------------------------

export async function createDisciplinaryRecord(
  client: Client,
  input: {
    tenant_id: string;
    user_id: string;
    record_type: DisciplinaryType;
    description: string;
    start_date: string;
    end_date?: string | null;
    registered_by?: string | null;
  },
) {
  const { data, error } = await client
    .from('hr_disciplinary_records')
    .insert({
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      record_type: input.record_type,
      description: input.description,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      registered_by: input.registered_by ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al registrar la medida disciplinaria');
  }

  return data;
}

export async function getDisciplinaryByUser(
  client: Client,
  tenantId: string,
  userId: string,
) {
  const { data, error } = await client
    .from('hr_disciplinary_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('start_date', { ascending: false });

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener registros disciplinarios');
  }

  return data ?? [];
}

export async function getDisciplinaryByTenant(
  client: Client,
  tenantId: string,
  recordType?: DisciplinaryType,
) {
  let query = client
    .from('hr_disciplinary_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('start_date', { ascending: false });

  if (recordType) {
    query = query.eq('record_type', recordType);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener registros disciplinarios');
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// HR Alerts
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export async function getCarnetAlerts(
  client: Client,
  tenantId: string,
): Promise<CarnetAlert[]> {
  const { data } = await client
    .from('hr_agent_profiles')
    .select('user_id, security_carnet_number, carnet_expiry_date')
    .eq('tenant_id', tenantId)
    .not('carnet_expiry_date', 'is', null);

  const userIds = (data ?? []).map((p) => p.user_id);
  const { data: profiles } = userIds.length > 0
    ? await client.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] };
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (data ?? [])
    .filter((p) => p.carnet_expiry_date && daysUntil(p.carnet_expiry_date) <= 30)
    .map((p) => ({
      agentName: nameMap.get(p.user_id) ?? 'Agente',
      userId: p.user_id,
      carnetNumber: p.security_carnet_number ?? '',
      expiryDate: p.carnet_expiry_date!,
      daysRemaining: daysUntil(p.carnet_expiry_date!),
    }));
}

export async function getContractAlerts(
  client: Client,
  tenantId: string,
): Promise<ContractAlert[]> {
  const { data } = await client
    .from('hr_contracts')
    .select('user_id, contract_type, end_date, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'activo')
    .not('end_date', 'is', null);

  const userIds = (data ?? []).map((c) => c.user_id);
  const { data: profiles } = userIds.length > 0
    ? await client.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] };
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (data ?? [])
    .filter((c) => c.end_date && daysUntil(c.end_date) <= 30)
    .map((c) => ({
      agentName: nameMap.get(c.user_id) ?? 'Agente',
      userId: c.user_id,
      contractType: c.contract_type,
      endDate: c.end_date!,
      daysRemaining: daysUntil(c.end_date!),
      status: c.status,
    }));
}

// ---------------------------------------------------------------------------
// Agent Requests
// ---------------------------------------------------------------------------

export async function createAgentRequest(
  client: Client,
  input: {
    tenant_id: string;
    user_id: string;
    request_type: AgentRequestType;
    details: string;
  },
) {
  const { data, error } = await client
    .from('hr_agent_requests')
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al crear la solicitud');
  }

  return data;
}

export async function getMyRequests(client: Client, userId: string) {
  const { data, error } = await client
    .from('hr_agent_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener solicitudes');
  }

  return data ?? [];
}

export async function getRequestsByTenant(
  client: Client,
  tenantId: string,
  status?: AgentRequestStatus,
) {
  let query = client
    .from('hr_agent_requests')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener solicitudes');
  }

  return data ?? [];
}

export async function reviewRequest(
  client: Client,
  requestId: string,
  input: {
    status: 'aprobado' | 'rechazado';
    reviewed_by: string;
    review_notes?: string;
  },
) {
  const { data, error } = await client
    .from('hr_agent_requests')
    .update({
      status: input.status,
      reviewed_by: input.reviewed_by,
      review_notes: input.review_notes ?? null,
    })
    .eq('id', requestId)
    .eq('status', 'pendiente')
    .select()
    .single();

  if (error || !data) {
    throw new AppError('NOT_FOUND', 'Solicitud pendiente no encontrada');
  }

  return data;
}

export async function getPendingRequestCount(client: Client, tenantId: string): Promise<number> {
  const { count, error } = await client
    .from('hr_agent_requests')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'pendiente');

  if (error) return 0;

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Employee Vault
// ---------------------------------------------------------------------------

export async function uploadVaultDocument(
  client: Client,
  input: {
    tenant_id: string;
    user_id: string;
    document_type: VaultDocumentType;
    document_url: string;
    expiration_date?: string | null;
  },
) {
  const { data, error } = await client
    .from('hr_employee_vault')
    .insert({
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      document_type: input.document_type,
      document_url: input.document_url,
      expiration_date: input.expiration_date ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al subir documento a la bóveda');
  }

  return data;
}

export async function getVaultByUser(
  client: Client,
  tenantId: string,
  userId: string,
) {
  const { data, error } = await client
    .from('hr_employee_vault')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener documentos');
  }

  return data ?? [];
}

export async function getVaultExpiryAlerts(
  client: Client,
  tenantId: string,
): Promise<VaultExpiryAlert[]> {
  const { data } = await client
    .from('hr_employee_vault')
    .select('user_id, document_type, expiration_date')
    .eq('tenant_id', tenantId)
    .not('expiration_date', 'is', null);

  const userIds = (data ?? []).map((d) => d.user_id);
  const { data: profiles } = userIds.length > 0
    ? await client.from('profiles').select('id, full_name').in('id', [...new Set(userIds)])
    : { data: [] };
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (data ?? [])
    .filter((d) => d.expiration_date && daysUntil(d.expiration_date) <= 30)
    .map((d) => ({
      agentName: nameMap.get(d.user_id) ?? 'Agente',
      userId: d.user_id,
      documentType: d.document_type,
      expiryDate: d.expiration_date!,
      daysRemaining: daysUntil(d.expiration_date!),
    }));
}

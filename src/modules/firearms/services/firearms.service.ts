import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, FirearmType, FirearmStatus } from '@/shared/types/database';
import type { AlertLevel, ExpiryAlert } from '../types';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Firearms Inventory
// ---------------------------------------------------------------------------

export async function createFirearm(
  client: Client,
  input: {
    tenant_id: string;
    serial_number: string;
    type: FirearmType;
    brand: string;
    model: string;
    permit_number: string;
    permit_expiry_date: string;
  },
) {
  const { data, error } = await client
    .from('firearms_inventory')
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('CONFLICT', 'Ya existe un arma con ese número de serie en este tenant');
    }
    throw new AppError('INTERNAL_ERROR', 'Error al registrar el arma');
  }

  return data;
}

export async function getFirearmsByTenant(client: Client, tenantId: string) {
  const { data, error } = await client
    .from('firearms_inventory')
    .select('*, firearms_assignments(id, work_station_id, user_id, assigned_at, returned_at, work_stations(name), profiles(full_name))')
    .eq('tenant_id', tenantId)
    .order('serial_number');

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener el inventario');
  }

  return data ?? [];
}

export async function updateFirearm(
  client: Client,
  firearmId: string,
  input: Partial<{
    serial_number: string;
    type: FirearmType;
    brand: string;
    model: string;
    status: FirearmStatus;
    permit_number: string;
    permit_expiry_date: string;
  }>,
) {
  const { data, error } = await client
    .from('firearms_inventory')
    .update(input)
    .eq('id', firearmId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar el arma');
  }

  return data;
}

// ---------------------------------------------------------------------------
// Agent Compliance
// ---------------------------------------------------------------------------

export async function upsertCompliance(
  client: Client,
  input: {
    tenant_id: string;
    user_id: string;
    shooting_test_expiry: string;
    psych_test_expiry: string;
    doping_test_expiry: string;
  },
) {
  const { data, error } = await client
    .from('agent_compliance')
    .upsert(input, { onConflict: 'tenant_id,user_id' })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar cumplimiento del agente');
  }

  return data;
}

export async function getComplianceByTenant(client: Client, tenantId: string) {
  const { data, error } = await client
    .from('agent_compliance')
    .select('*')
    .eq('tenant_id', tenantId);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener registros de cumplimiento');
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

export async function assignFirearm(
  client: Client,
  input: {
    tenant_id: string;
    firearm_id: string;
    work_station_id?: string | null;
    user_id?: string | null;
    notes?: string | null;
  },
) {
  const { data: active } = await client
    .from('firearms_assignments')
    .select('id')
    .eq('firearm_id', input.firearm_id)
    .is('returned_at', null)
    .maybeSingle();

  if (active) {
    throw new AppError('CONFLICT', 'Esta arma ya tiene una asignación activa');
  }

  const { data, error } = await client
    .from('firearms_assignments')
    .insert({
      tenant_id: input.tenant_id,
      firearm_id: input.firearm_id,
      work_station_id: input.work_station_id ?? null,
      user_id: input.user_id ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al asignar el arma');
  }

  return data;
}

export async function returnFirearm(client: Client, assignmentId: string) {
  const { data, error } = await client
    .from('firearms_assignments')
    .update({ returned_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .is('returned_at', null)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('NOT_FOUND', 'Asignación no encontrada o ya devuelta');
  }

  return data;
}

// ---------------------------------------------------------------------------
// Alert Semaphore
// ---------------------------------------------------------------------------

function getAlertLevel(expiryDate: string): AlertLevel {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) return 'red';
  if (daysRemaining <= 30) return 'yellow';
  return 'green';
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export async function getPermitAlerts(client: Client, tenantId: string): Promise<ExpiryAlert[]> {
  const { data } = await client
    .from('firearms_inventory')
    .select('serial_number, brand, model, permit_expiry_date')
    .eq('tenant_id', tenantId)
    .neq('status', 'retirada')
    .order('permit_expiry_date');

  return (data ?? []).map((f) => ({
    label: `${f.brand} ${f.model} (${f.serial_number})`,
    expiryDate: f.permit_expiry_date,
    daysRemaining: daysUntil(f.permit_expiry_date),
    level: getAlertLevel(f.permit_expiry_date),
  }));
}

export async function getComplianceAlerts(
  client: Client,
  tenantId: string,
): Promise<{ agentName: string; alerts: ExpiryAlert[] }[]> {
  const { data } = await client
    .from('agent_compliance')
    .select('user_id, shooting_test_expiry, psych_test_expiry, doping_test_expiry')
    .eq('tenant_id', tenantId);

  const userIds = (data ?? []).map((c) => c.user_id);
  const { data: profiles } = userIds.length > 0
    ? await client.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] };

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (data ?? []).map((c) => ({
    agentName: profileMap.get(c.user_id) ?? 'Agente',
    alerts: [
      {
        label: 'Prueba de tiro',
        expiryDate: c.shooting_test_expiry,
        daysRemaining: daysUntil(c.shooting_test_expiry),
        level: getAlertLevel(c.shooting_test_expiry),
      },
      {
        label: 'Evaluación psicológica',
        expiryDate: c.psych_test_expiry,
        daysRemaining: daysUntil(c.psych_test_expiry),
        level: getAlertLevel(c.psych_test_expiry),
      },
      {
        label: 'Prueba de dopaje',
        expiryDate: c.doping_test_expiry,
        daysRemaining: daysUntil(c.doping_test_expiry),
        level: getAlertLevel(c.doping_test_expiry),
      },
    ],
  }));
}

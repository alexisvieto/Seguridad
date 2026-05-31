import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  DamageResponsible,
  DamageStatus,
} from '@/shared/types/database';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Client Tickets
// ---------------------------------------------------------------------------

export async function createTicket(
  client: Client,
  input: {
    tenant_id: string;
    property_id: string;
    category: TicketCategory;
    subject: string;
    description: string;
    priority?: TicketPriority;
  },
  userId: string,
) {
  const { data, error } = await client
    .from('client_tickets')
    .insert({
      tenant_id: input.tenant_id,
      property_id: input.property_id,
      category: input.category,
      subject: input.subject,
      description: input.description,
      priority: input.priority ?? 'media',
      created_by: userId,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al crear el ticket');
  }

  return data;
}

export async function getTicketsByTenant(
  client: Client,
  tenantId: string,
  filters?: { status?: TicketStatus; priority?: TicketPriority; propertyId?: string },
) {
  let query = client
    .from('client_tickets')
    .select('*, properties_ph(name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.priority) query = query.eq('priority', filters.priority);
  if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);

  const { data, error } = await query;
  if (error) throw new AppError('INTERNAL_ERROR', 'Error al obtener tickets');
  return data ?? [];
}

export async function updateTicket(
  client: Client,
  ticketId: string,
  input: Partial<{
    category: TicketCategory;
    subject: string;
    description: string;
    priority: TicketPriority;
    status: TicketStatus;
    assigned_to: string | null;
  }>,
) {
  const { data, error } = await client
    .from('client_tickets')
    .update(input)
    .eq('id', ticketId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar el ticket');
  }

  return data;
}

export async function getOpenTicketCount(client: Client, tenantId: string): Promise<number> {
  const { count, error } = await client
    .from('client_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .in('status', ['abierto', 'en_proceso']);

  if (error) return 0;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Client Damage Reports
// ---------------------------------------------------------------------------

export async function createDamageReport(
  client: Client,
  input: {
    tenant_id: string;
    property_id: string;
    work_station_id?: string | null;
    item_damaged: string;
    responsible_party: DamageResponsible;
    description: string;
    cost_estimate?: number;
    evidence_urls?: string[];
  },
) {
  const { data, error } = await client
    .from('client_damage_reports')
    .insert({
      tenant_id: input.tenant_id,
      property_id: input.property_id,
      work_station_id: input.work_station_id ?? null,
      item_damaged: input.item_damaged,
      responsible_party: input.responsible_party,
      description: input.description,
      cost_estimate: input.cost_estimate ?? 0,
      evidence_urls: input.evidence_urls ?? [],
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al crear el reporte de daños');
  }

  return data;
}

export async function getDamageReportsByTenant(
  client: Client,
  tenantId: string,
  filters?: { status?: DamageStatus; propertyId?: string; responsible?: DamageResponsible },
) {
  let query = client
    .from('client_damage_reports')
    .select('*, properties_ph(name), work_stations(name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
  if (filters?.responsible) query = query.eq('responsible_party', filters.responsible);

  const { data, error } = await query;
  if (error) throw new AppError('INTERNAL_ERROR', 'Error al obtener reportes de daños');
  return data ?? [];
}

export async function updateDamageReport(
  client: Client,
  reportId: string,
  input: Partial<{
    item_damaged: string;
    responsible_party: DamageResponsible;
    description: string;
    cost_estimate: number;
    evidence_urls: string[];
    status: DamageStatus;
  }>,
) {
  const { data, error } = await client
    .from('client_damage_reports')
    .update(input)
    .eq('id', reportId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar el reporte de daños');
  }

  return data;
}

export async function getPendingDamageCount(client: Client, tenantId: string): Promise<number> {
  const { count, error } = await client
    .from('client_damage_reports')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'bajo_investigacion');

  if (error) return 0;
  return count ?? 0;
}

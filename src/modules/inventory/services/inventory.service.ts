import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, InventoryCategory, AssetStatus, LoanStatus } from '@/shared/types/database';
import type { StockAlert } from '../types';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Inventory Items
// ---------------------------------------------------------------------------

export async function createInventoryItem(
  client: Client,
  input: {
    tenant_id: string;
    item_name: string;
    category: InventoryCategory;
    size_or_model?: string | null;
    current_stock?: number;
    min_stock_alert?: number;
  },
) {
  const { data, error } = await client
    .from('inventory_items')
    .insert({
      tenant_id: input.tenant_id,
      item_name: input.item_name,
      category: input.category,
      size_or_model: input.size_or_model ?? null,
      current_stock: input.current_stock ?? 0,
      min_stock_alert: input.min_stock_alert ?? 5,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al crear el artículo');
  }

  return data;
}

export async function getInventoryByTenant(
  client: Client,
  tenantId: string,
  category?: InventoryCategory,
) {
  let query = client
    .from('inventory_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('category')
    .order('item_name');

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener el inventario');
  }

  return data ?? [];
}

export async function updateInventoryItem(
  client: Client,
  itemId: string,
  input: Partial<{
    item_name: string;
    category: InventoryCategory;
    size_or_model: string | null;
    current_stock: number;
    min_stock_alert: number;
  }>,
) {
  const { data, error } = await client
    .from('inventory_items')
    .update(input)
    .eq('id', itemId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar el artículo');
  }

  return data;
}

export async function getStockAlerts(client: Client, tenantId: string): Promise<StockAlert[]> {
  const { data } = await client
    .from('inventory_items')
    .select('id, item_name, category, current_stock, min_stock_alert')
    .eq('tenant_id', tenantId)
    .order('current_stock');

  return (data ?? [])
    .filter((item) => item.current_stock <= item.min_stock_alert)
    .map((item) => ({
      itemId: item.id,
      itemName: item.item_name,
      category: item.category,
      currentStock: item.current_stock,
      minAlert: item.min_stock_alert,
      deficit: item.min_stock_alert - item.current_stock,
    }));
}

// ---------------------------------------------------------------------------
// Station Asset Custody
// ---------------------------------------------------------------------------

export async function createStationAsset(
  client: Client,
  input: {
    tenant_id: string;
    work_station_id: string;
    asset_name: string;
    imei_or_serial?: string | null;
  },
) {
  const { data, error } = await client
    .from('station_asset_custody')
    .insert({
      tenant_id: input.tenant_id,
      work_station_id: input.work_station_id,
      asset_name: input.asset_name,
      imei_or_serial: input.imei_or_serial ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('CONFLICT', 'Ya existe un activo con ese IMEI/serial');
    }
    throw new AppError('INTERNAL_ERROR', 'Error al registrar el activo');
  }

  return data;
}

export async function getAssetsByStation(client: Client, stationId: string) {
  const { data, error } = await client
    .from('station_asset_custody')
    .select('*')
    .eq('work_station_id', stationId)
    .order('asset_name');

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener los activos');
  }

  return data ?? [];
}

export async function getAssetsByTenant(client: Client, tenantId: string) {
  const { data, error } = await client
    .from('station_asset_custody')
    .select('*, work_stations(name, properties_ph(name))')
    .eq('tenant_id', tenantId)
    .order('asset_name');

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener los activos');
  }

  return data ?? [];
}

export async function updateStationAsset(
  client: Client,
  assetId: string,
  input: Partial<{
    asset_name: string;
    imei_or_serial: string | null;
    status: AssetStatus;
    damage_report_notes: string | null;
  }>,
) {
  const updateData: Record<string, unknown> = { ...input };
  if (input.status === 'bueno') {
    updateData['last_inspection_at'] = new Date().toISOString();
  }

  const { data, error } = await client
    .from('station_asset_custody')
    .update(updateData as Database['public']['Tables']['station_asset_custody']['Update'])
    .eq('id', assetId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar el activo');
  }

  return data;
}

// ---------------------------------------------------------------------------
// Agent Equipment Loans
// ---------------------------------------------------------------------------

export async function createLoan(
  client: Client,
  input: {
    tenant_id: string;
    user_id: string;
    item_id: string;
    quantity: number;
  },
) {
  const { data: item } = await client
    .from('inventory_items')
    .select('current_stock')
    .eq('id', input.item_id)
    .single();

  if (!item || item.current_stock < input.quantity) {
    throw new AppError('CONFLICT', 'Stock insuficiente para esta entrega');
  }

  const { data, error } = await client
    .from('agent_equipment_loans')
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al registrar la entrega');
  }

  await client
    .from('inventory_items')
    .update({ current_stock: item.current_stock - input.quantity })
    .eq('id', input.item_id);

  return data;
}

export async function getLoansByTenant(
  client: Client,
  tenantId: string,
  status?: LoanStatus,
) {
  let query = client
    .from('agent_equipment_loans')
    .select('*, inventory_items(item_name, category, size_or_model)')
    .eq('tenant_id', tenantId)
    .order('loan_date', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener las entregas');
  }

  return data ?? [];
}

export async function updateLoanStatus(
  client: Client,
  loanId: string,
  status: LoanStatus,
) {
  const { data: loan } = await client
    .from('agent_equipment_loans')
    .select('item_id, quantity, status')
    .eq('id', loanId)
    .single();

  if (!loan) {
    throw new AppError('NOT_FOUND', 'Entrega no encontrada');
  }

  if (loan.status !== 'entregado') {
    throw new AppError('CONFLICT', 'Esta entrega ya fue procesada');
  }

  const { data, error } = await client
    .from('agent_equipment_loans')
    .update({ status })
    .eq('id', loanId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar la entrega');
  }

  if (status === 'devuelto') {
    const { data: item } = await client
      .from('inventory_items')
      .select('current_stock')
      .eq('id', loan.item_id)
      .single();

    if (item) {
      await client
        .from('inventory_items')
        .update({ current_stock: item.current_stock + loan.quantity })
        .eq('id', loan.item_id);
    }
  }

  return data;
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, PayrollPeriodStatus } from '@/shared/types/database';
import type { PayrollSummary } from '../types';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Payroll Config
// ---------------------------------------------------------------------------

export async function getPayrollConfig(client: Client, tenantId: string) {
  const { data } = await client
    .from('payroll_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return data;
}

export async function updatePayrollConfig(
  client: Client,
  tenantId: string,
  input: Partial<{
    ordinary_hours_limit: number;
    overtime_flat_rate: boolean;
    pays_holiday_premium: boolean;
    social_security_rate: number;
    educational_insurance_rate: number;
  }>,
) {
  const { data, error } = await client
    .from('payroll_configs')
    .update(input)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar configuracion de nomina');
  }

  return data;
}

// ---------------------------------------------------------------------------
// Payroll Periods
// ---------------------------------------------------------------------------

export async function createPeriod(
  client: Client,
  input: { tenant_id: string; start_date: string; end_date: string },
) {
  const { data, error } = await client
    .from('payroll_periods')
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('CONFLICT', 'Ya existe un periodo con esas fechas');
    }
    throw new AppError('INTERNAL_ERROR', 'Error al crear periodo de nomina');
  }

  return data;
}

export async function getPeriodsByTenant(
  client: Client,
  tenantId: string,
  status?: PayrollPeriodStatus,
) {
  let query = client
    .from('payroll_periods')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('start_date', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new AppError('INTERNAL_ERROR', 'Error al obtener periodos');
  return data ?? [];
}

export async function updatePeriodStatus(
  client: Client,
  periodId: string,
  status: PayrollPeriodStatus,
) {
  const { data, error } = await client
    .from('payroll_periods')
    .update({ status })
    .eq('id', periodId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar estado del periodo');
  }

  return data;
}

// ---------------------------------------------------------------------------
// Payroll Calculation Engine
// ---------------------------------------------------------------------------

export async function calculatePayroll(
  client: Client,
  tenantId: string,
  periodId: string,
) {
  // 1. Get config
  const config = await getPayrollConfig(client, tenantId);
  if (!config) {
    throw new AppError('NOT_FOUND', 'Configuracion de nomina no encontrada');
  }

  // 2. Get period
  const { data: period } = await client
    .from('payroll_periods')
    .select('start_date, end_date, status')
    .eq('id', periodId)
    .maybeSingle();

  if (!period) {
    throw new AppError('NOT_FOUND', 'Periodo no encontrado');
  }

  if (period.status !== 'abierto') {
    throw new AppError('CONFLICT', 'Solo se pueden calcular periodos abiertos');
  }

  // 3. Get all shifts in the period
  const { data: shifts } = await client
    .from('agent_shifts')
    .select('user_id, clock_in, clock_out')
    .eq('tenant_id', tenantId)
    .gte('clock_in', period.start_date)
    .lte('clock_in', period.end_date + 'T23:59:59')
    .not('clock_out', 'is', null);

  // 4. Accumulate hours per agent
  const agentHours = new Map<string, { regular: number; overtime: number; holiday: number }>();

  for (const shift of shifts ?? []) {
    const clockIn = new Date(shift.clock_in);
    const clockOut = new Date(shift.clock_out!);
    const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / 3600000;

    if (hoursWorked <= 0) continue;

    const existing = agentHours.get(shift.user_id) ?? { regular: 0, overtime: 0, holiday: 0 };
    const totalSoFar = existing.regular + existing.overtime;

    const ordinaryLimit = Number(config.ordinary_hours_limit);

    if (totalSoFar >= ordinaryLimit) {
      existing.overtime += hoursWorked;
    } else if (totalSoFar + hoursWorked > ordinaryLimit) {
      const regularPortion = ordinaryLimit - totalSoFar;
      existing.regular += regularPortion;
      existing.overtime += hoursWorked - regularPortion;
    } else {
      existing.regular += hoursWorked;
    }

    agentHours.set(shift.user_id, existing);
  }

  // 5. Get agent hourly rates from contracts
  const agentIds = [...agentHours.keys()];
  if (agentIds.length === 0) {
    await updatePeriodStatus(client, periodId, 'calculado');
    return { calculated: 0 };
  }

  const { data: contracts } = await client
    .from('hr_contracts')
    .select('user_id, base_salary')
    .eq('tenant_id', tenantId)
    .eq('status', 'activo')
    .in('user_id', agentIds);

  const rateMap = new Map<string, number>();
  for (const contract of contracts ?? []) {
    const monthlySalary = Number(contract.base_salary);
    const hourlyRate = monthlySalary / 240;
    rateMap.set(contract.user_id, Math.round(hourlyRate * 100) / 100);
  }

  // 6. Build consolidated records
  const ssRate = Number(config.social_security_rate);
  const eiRate = Number(config.educational_insurance_rate);

  const records = agentIds.map((userId) => {
    const hours = agentHours.get(userId)!;
    const rate = rateMap.get(userId) ?? 3.04;

    const totalHours = hours.regular + hours.overtime + hours.holiday;
    const gross = Math.round(totalHours * rate * 100) / 100;
    const ssDed = Math.round(gross * ssRate * 100) / 100;
    const eiDed = Math.round(gross * eiRate * 100) / 100;
    const net = Math.round((gross - ssDed - eiDed) * 100) / 100;

    return {
      tenant_id: tenantId,
      payroll_period_id: periodId,
      user_id: userId,
      rate_per_hour: rate,
      regular_hours_accumulated: Math.round(hours.regular * 100) / 100,
      overtime_hours_accumulated: Math.round(hours.overtime * 100) / 100,
      holiday_hours_accumulated: Math.round(hours.holiday * 100) / 100,
      gross_salary: gross,
      social_security_deduction: ssDed,
      educational_insurance_deduction: eiDed,
      net_salary: net,
    };
  });

  // 7. Upsert consolidated records
  const { error: upsertError } = await client
    .from('payroll_agent_consolidated')
    .upsert(records, { onConflict: 'payroll_period_id,user_id' });

  if (upsertError) {
    throw new AppError('INTERNAL_ERROR', 'Error al guardar nomina consolidada');
  }

  // 8. Mark period as calculated
  await updatePeriodStatus(client, periodId, 'calculado');

  return { calculated: records.length };
}

// ---------------------------------------------------------------------------
// Consolidated Queries
// ---------------------------------------------------------------------------

export async function getConsolidatedByPeriod(client: Client, periodId: string) {
  const { data, error } = await client
    .from('payroll_agent_consolidated')
    .select('*')
    .eq('payroll_period_id', periodId)
    .order('net_salary', { ascending: false });

  if (error) throw new AppError('INTERNAL_ERROR', 'Error al obtener nomina');
  return data ?? [];
}

export async function adjustAgentPayroll(
  client: Client,
  consolidatedId: string,
  input: { adjustments_addition?: number; adjustments_deduction?: number },
) {
  const { data: current } = await client
    .from('payroll_agent_consolidated')
    .select('rate_per_hour, regular_hours_accumulated, overtime_hours_accumulated, holiday_hours_accumulated, adjustments_addition, adjustments_deduction')
    .eq('id', consolidatedId)
    .maybeSingle();

  if (!current) {
    throw new AppError('NOT_FOUND', 'Registro de nomina no encontrado');
  }

  const r2 = (v: number) => Math.round(v * 100) / 100;

  const newAddition = input.adjustments_addition ?? Number(current.adjustments_addition);
  const newDeduction = input.adjustments_deduction ?? Number(current.adjustments_deduction);

  const totalHours = Number(current.regular_hours_accumulated)
    + Number(current.overtime_hours_accumulated)
    + Number(current.holiday_hours_accumulated);
  const basePay = r2(totalHours * Number(current.rate_per_hour));
  const gross = r2(basePay + newAddition);
  const ss = r2(gross * 0.0975);
  const ei = r2(gross * 0.0125);
  const net = r2(Math.max(0, gross - ss - ei - newDeduction));

  const { data, error } = await client
    .from('payroll_agent_consolidated')
    .update({
      adjustments_addition: newAddition,
      adjustments_deduction: newDeduction,
      gross_salary: gross,
      social_security_deduction: ss,
      educational_insurance_deduction: ei,
      net_salary: net,
    })
    .eq('id', consolidatedId)
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al ajustar nomina');
  }

  return data;
}

export async function getPayrollSummary(client: Client, periodId: string): Promise<PayrollSummary> {
  const records = await getConsolidatedByPeriod(client, periodId);

  return {
    totalAgents: records.length,
    totalGross: records.reduce((s, r) => s + Number(r.gross_salary), 0),
    totalNet: records.reduce((s, r) => s + Number(r.net_salary), 0),
    totalSS: records.reduce((s, r) => s + Number(r.social_security_deduction), 0),
    totalEI: records.reduce((s, r) => s + Number(r.educational_insurance_deduction), 0),
    totalRegularHours: records.reduce((s, r) => s + Number(r.regular_hours_accumulated), 0),
    totalOvertimeHours: records.reduce((s, r) => s + Number(r.overtime_hours_accumulated), 0),
  };
}

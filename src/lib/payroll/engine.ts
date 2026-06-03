import { getSupabaseAdminClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors/app-error';
import type { Database } from '@/shared/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PayrollConfig {
  ordinaryHoursLimit: number;
  overtimeFlatRate: boolean;
  paysHolidayPremium: boolean;
  ssRate: number;
  eiRate: number;
}

interface PeriodDates {
  startDate: string;
  endDate: string;
}

interface AgentHourBucket {
  regularHours: number;
  overtimeHours: number;
  holidayHours: number;
  shiftCount: number;
}

interface ConsolidatedRecord {
  tenant_id: string;
  payroll_period_id: string;
  user_id: string;
  rate_per_hour: number;
  regular_hours_accumulated: number;
  overtime_hours_accumulated: number;
  holiday_hours_accumulated: number;
  adjustments_addition: number;
  adjustments_deduction: number;
  gross_salary: number;
  social_security_deduction: number;
  educational_insurance_deduction: number;
  net_salary: number;
}

// ---------------------------------------------------------------------------
// Precision helper — all monetary math goes through this
// ---------------------------------------------------------------------------

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function processFortnightPayroll(
  tenantId: string,
  periodId: string,
): Promise<void> {
  const startTime = Date.now();
  console.info(`[Payroll] Starting calculation for tenant=${tenantId} period=${periodId}`);

  const client = await getSupabaseAdminClient();

  try {
    // ------------------------------------------------------------------
    // 1. LOAD CONFIG & PERIOD
    // ------------------------------------------------------------------

    const config = await loadConfig(client, tenantId);
    const period = await loadPeriod(client, tenantId, periodId);

    console.info(`[Payroll] Period: ${period.startDate} → ${period.endDate}`);
    console.info(`[Payroll] Config: limit=${config.ordinaryHoursLimit}h, flatOT=${config.overtimeFlatRate}, SS=${config.ssRate}, EI=${config.eiRate}`);

    // ------------------------------------------------------------------
    // 2. EXTRACT SHIFTS & SUM HOURS
    // ------------------------------------------------------------------

    const agentBuckets = await extractShiftHours(client, tenantId, period);

    const agentIds = [...agentBuckets.keys()];

    if (agentIds.length === 0) {
      console.info('[Payroll] No completed shifts found in period — marking as calculated');
      await markPeriodCalculated(client, periodId);
      return;
    }

    console.info(`[Payroll] ${agentIds.length} agents with shifts detected`);

    // ------------------------------------------------------------------
    // 3. DISTRIBUTE HOURS (ordinary vs overtime)
    // ------------------------------------------------------------------

    const distributed = distributeHours(agentBuckets, config.ordinaryHoursLimit);

    // ------------------------------------------------------------------
    // 4. LOAD AGENT RATES + EXISTING ADJUSTMENTS
    // ------------------------------------------------------------------

    const rateMap = await loadAgentRates(client, tenantId, agentIds);
    const existingAdjustments = await loadExistingAdjustments(client, periodId, agentIds);

    // Load paysheet bonuses/penalties
    const paysheetBonuses = new Map<string, { bonus: number; penalty: number }>();
    const { data: paysheetAgg } = await client
      .from('operative_paysheet')
      .select('user_id, bonus, penalty')
      .eq('tenant_id', tenantId)
      .gte('shift_date', period.startDate)
      .lte('shift_date', period.endDate);

    for (const entry of paysheetAgg ?? []) {
      const existing = paysheetBonuses.get(entry.user_id) ?? { bonus: 0, penalty: 0 };
      existing.bonus += Number(entry.bonus);
      existing.penalty += Number(entry.penalty);
      paysheetBonuses.set(entry.user_id, existing);
    }

    // ------------------------------------------------------------------
    // 5. CALCULATE FINANCIALS
    // ------------------------------------------------------------------

    const records: ConsolidatedRecord[] = [];

    for (const [userId, hours] of distributed) {
      const rate = rateMap.get(userId) ?? 3.04;
      const adjustments = existingAdjustments.get(userId);
      const psBonus = paysheetBonuses.get(userId);
      const addition = (adjustments?.addition ?? 0) + (psBonus?.bonus ?? 0);
      const deduction = (adjustments?.deduction ?? 0) + (psBonus?.penalty ?? 0);

      const financials = calculateFinancials(
        hours.regularHours,
        hours.overtimeHours,
        hours.holidayHours,
        rate,
        config,
        addition,
        deduction,
      );

      records.push({
        tenant_id: tenantId,
        payroll_period_id: periodId,
        user_id: userId,
        rate_per_hour: rate,
        regular_hours_accumulated: round2(hours.regularHours),
        overtime_hours_accumulated: round2(hours.overtimeHours),
        holiday_hours_accumulated: round2(hours.holidayHours),
        adjustments_addition: round2(addition),
        adjustments_deduction: round2(deduction),
        gross_salary: financials.gross,
        social_security_deduction: financials.ssDed,
        educational_insurance_deduction: financials.eiDed,
        net_salary: financials.net,
      });
    }

    // ------------------------------------------------------------------
    // 6. PERSIST (UPSERT)
    // ------------------------------------------------------------------

    await persistConsolidated(client, records);
    await markPeriodCalculated(client, periodId);

    const totalNet = records.reduce((sum, r) => sum + r.net_salary, 0);
    const duration = Date.now() - startTime;

    console.info(
      `[Payroll] Completed: ${records.length} agents, gross=B/.${records.reduce((s, r) => s + r.gross_salary, 0).toFixed(2)}, net=B/.${totalNet.toFixed(2)} (${duration}ms)`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Payroll] FAILED for tenant=${tenantId} period=${periodId}: ${message}`);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Step 1: Load config
// ---------------------------------------------------------------------------

async function loadConfig(client: Client, tenantId: string): Promise<PayrollConfig> {
  const { data, error } = await client
    .from('payroll_configs')
    .select('ordinary_hours_limit, overtime_flat_rate, pays_holiday_premium, social_security_rate, educational_insurance_rate')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    throw new AppError('NOT_FOUND', 'Configuración de nómina no encontrada para este tenant');
  }

  return {
    ordinaryHoursLimit: Number(data.ordinary_hours_limit),
    overtimeFlatRate: data.overtime_flat_rate,
    paysHolidayPremium: data.pays_holiday_premium,
    ssRate: Number(data.social_security_rate),
    eiRate: Number(data.educational_insurance_rate),
  };
}

// ---------------------------------------------------------------------------
// Step 1b: Load period
// ---------------------------------------------------------------------------

async function loadPeriod(client: Client, tenantId: string, periodId: string): Promise<PeriodDates> {
  const { data, error } = await client
    .from('payroll_periods')
    .select('start_date, end_date, status')
    .eq('id', periodId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    throw new AppError('NOT_FOUND', 'Periodo de nómina no encontrado');
  }

  if (data.status !== 'abierto') {
    throw new AppError('CONFLICT', `El periodo tiene estado "${data.status}" — solo se calculan periodos abiertos`);
  }

  return {
    startDate: data.start_date,
    endDate: data.end_date,
  };
}

// ---------------------------------------------------------------------------
// Step 2: Extract shift hours
// ---------------------------------------------------------------------------

async function extractShiftHours(
  client: Client,
  tenantId: string,
  period: PeriodDates,
): Promise<Map<string, AgentHourBucket>> {
  // Try operative paysheet first (manual Excel-style entries)
  const { data: paysheetEntries } = await client
    .from('operative_paysheet')
    .select('user_id, hours, bonus, penalty, entry_type')
    .eq('tenant_id', tenantId)
    .gte('shift_date', period.startDate)
    .lte('shift_date', period.endDate);

  if (paysheetEntries && paysheetEntries.length > 0) {
    console.info(`[Payroll] Using operative paysheet: ${paysheetEntries.length} entries`);

    const buckets = new Map<string, AgentHourBucket & { bonusTotal: number; penaltyTotal: number }>();

    for (const entry of paysheetEntries) {
      const bucket = buckets.get(entry.user_id) ?? {
        regularHours: 0, overtimeHours: 0, holidayHours: 0, shiftCount: 0,
        bonusTotal: 0, penaltyTotal: 0,
      };

      bucket.regularHours += Number(entry.hours);
      if (entry.entry_type !== 'dia_libre') bucket.shiftCount += 1;
      bucket.bonusTotal += Number(entry.bonus);
      bucket.penaltyTotal += Number(entry.penalty);

      buckets.set(entry.user_id, bucket);
    }

    // Store bonus/penalty in holidayHours field temporarily (will be added as adjustments)
    // Actually, we'll handle it through the adjustments system
    return buckets;
  }

  // Fallback: use QR clock-in/clock-out data
  console.info('[Payroll] No paysheet data, falling back to agent_shifts');

  const periodStartISO = `${period.startDate}T00:00:00.000Z`;
  const periodEndISO = `${period.endDate}T23:59:59.999Z`;

  const { data: shifts, error } = await client
    .from('agent_shifts')
    .select('user_id, clock_in, clock_out')
    .eq('tenant_id', tenantId)
    .gte('clock_in', periodStartISO)
    .lte('clock_in', periodEndISO)
    .not('clock_out', 'is', null);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al consultar turnos del periodo');
  }

  const buckets = new Map<string, AgentHourBucket>();

  for (const shift of shifts ?? []) {
    if (!shift.clock_out) continue;

    const clockIn = new Date(shift.clock_in);
    const clockOut = new Date(shift.clock_out);

    const diffMs = clockOut.getTime() - clockIn.getTime();
    if (diffMs <= 0) continue;

    const hoursWorked = round2(diffMs / 3_600_000);

    const bucket = buckets.get(shift.user_id) ?? {
      regularHours: 0, overtimeHours: 0, holidayHours: 0, shiftCount: 0,
    };

    bucket.regularHours += hoursWorked;
    bucket.shiftCount += 1;

    buckets.set(shift.user_id, bucket);
  }

  return buckets;
}

// ---------------------------------------------------------------------------
// Step 3: Distribute hours (regular vs overtime)
// ---------------------------------------------------------------------------

function distributeHours(
  rawBuckets: Map<string, AgentHourBucket>,
  ordinaryLimit: number,
): Map<string, AgentHourBucket> {
  const result = new Map<string, AgentHourBucket>();

  for (const [userId, raw] of rawBuckets) {
    const totalRaw = raw.regularHours;

    let regular: number;
    let overtime: number;

    if (totalRaw <= ordinaryLimit) {
      regular = totalRaw;
      overtime = 0;
    } else {
      regular = ordinaryLimit;
      overtime = round2(totalRaw - ordinaryLimit);
    }

    result.set(userId, {
      regularHours: round2(regular),
      overtimeHours: overtime,
      holidayHours: raw.holidayHours,
      shiftCount: raw.shiftCount,
    });

    if (overtime > 0) {
      console.info(`[Payroll] Agent ${userId.slice(0, 8)}...: ${round2(totalRaw)}h total → ${round2(regular)}h regular + ${overtime}h overtime`);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Step 4: Load agent hourly rates from contracts
// ---------------------------------------------------------------------------

async function loadAgentRates(
  client: Client,
  tenantId: string,
  agentIds: string[],
): Promise<Map<string, number>> {
  const { data: contracts } = await client
    .from('hr_contracts')
    .select('user_id, base_salary')
    .eq('tenant_id', tenantId)
    .eq('status', 'activo')
    .in('user_id', agentIds);

  const rateMap = new Map<string, number>();

  for (const contract of contracts ?? []) {
    const monthly = Number(contract.base_salary);
    const hourly = round2(monthly / 240);
    rateMap.set(contract.user_id, hourly);
  }

  const withoutContract = agentIds.filter((id) => !rateMap.has(id));
  if (withoutContract.length > 0) {
    console.warn(`[Payroll] ${withoutContract.length} agents without active contract — using default rate B/.3.04`);
  }

  return rateMap;
}

// ---------------------------------------------------------------------------
// Step 4b: Load existing adjustments (preserve manual AD/DESC entries)
// ---------------------------------------------------------------------------

async function loadExistingAdjustments(
  client: Client,
  periodId: string,
  agentIds: string[],
): Promise<Map<string, { addition: number; deduction: number }>> {
  const { data } = await client
    .from('payroll_agent_consolidated')
    .select('user_id, adjustments_addition, adjustments_deduction')
    .eq('payroll_period_id', periodId)
    .in('user_id', agentIds);

  const map = new Map<string, { addition: number; deduction: number }>();

  for (const row of data ?? []) {
    map.set(row.user_id, {
      addition: Number(row.adjustments_addition),
      deduction: Number(row.adjustments_deduction),
    });
  }

  return map;
}

// ---------------------------------------------------------------------------
// Step 5: Financial calculation
// ---------------------------------------------------------------------------

interface FinancialResult {
  gross: number;
  ssDed: number;
  eiDed: number;
  net: number;
}

function calculateFinancials(
  regularHours: number,
  overtimeHours: number,
  holidayHours: number,
  ratePerHour: number,
  config: PayrollConfig,
  adjustmentAddition: number,
  adjustmentDeduction: number,
): FinancialResult {
  const regularPay = round2(regularHours * ratePerHour);

  let overtimePay: number;
  if (config.overtimeFlatRate) {
    overtimePay = round2(overtimeHours * ratePerHour);
  } else {
    overtimePay = round2(overtimeHours * ratePerHour * 1.25);
  }

  let holidayPay: number;
  if (config.paysHolidayPremium) {
    holidayPay = round2(holidayHours * ratePerHour * 1.50);
  } else {
    holidayPay = round2(holidayHours * ratePerHour);
  }

  // Gross before deductions = base pay + additions (CSS/SE base per Panama law)
  const grossBeforeDeductions = round2(regularPay + overtimePay + holidayPay + adjustmentAddition);
  const ssDed = round2(grossBeforeDeductions * config.ssRate);
  const eiDed = round2(grossBeforeDeductions * config.eiRate);
  // Net = gross - retenciones legales - deducciones administrativas
  const gross = round2(grossBeforeDeductions);
  const net = round2(grossBeforeDeductions - ssDed - eiDed - adjustmentDeduction);

  return {
    gross: Math.max(0, gross),
    ssDed: Math.max(0, ssDed),
    eiDed: Math.max(0, eiDed),
    net: Math.max(0, net),
  };
}

// ---------------------------------------------------------------------------
// Step 6: Persist consolidated records
// ---------------------------------------------------------------------------

async function persistConsolidated(
  client: Client,
  records: ConsolidatedRecord[],
): Promise<void> {
  if (records.length === 0) return;

  const { error } = await client
    .from('payroll_agent_consolidated')
    .upsert(records, { onConflict: 'payroll_period_id,user_id' });

  if (error) {
    console.error('[Payroll] Upsert error:', error.message);
    throw new AppError('INTERNAL_ERROR', 'Error al persistir nómina consolidada');
  }
}

// ---------------------------------------------------------------------------
// Mark period as calculated
// ---------------------------------------------------------------------------

async function markPeriodCalculated(client: Client, periodId: string): Promise<void> {
  const { error } = await client
    .from('payroll_periods')
    .update({ status: 'calculado' as const })
    .eq('id', periodId);

  if (error) {
    console.error('[Payroll] Error marking period as calculated:', error.message);
    throw new AppError('INTERNAL_ERROR', 'Error al actualizar estado del periodo');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';
import { validate } from '@/lib/validation/validate';
import { MASTER_PROMPT } from './master_prompt';

const chatSchema = z.object({
  question: z.string().min(3).max(500),
  tenant_id: z.string().uuid().optional(),
});

// System prompt imported from master_prompt.ts

let aiClient: Anthropic | null = null;
function getAI(): Anthropic {
  if (!aiClient) aiClient = new Anthropic({ timeout: 15000 });
  return aiClient;
}

interface AIResponse {
  category: string;
  intent: string;
  params: Record<string, unknown>;
  answer: string;
}

async function queryAttendance(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
  intent: string,
  aiParams: Record<string, unknown>,
) {
  const year = Number(aiParams['year'] ?? new Date().getFullYear());
  const yearStart = `${year}-01-01T00:00:00Z`;
  const yearEnd = `${year}-12-31T23:59:59Z`;

  if (intent === 'perfect_attendance_2026' || intent.includes('perfect')) {
    const { data: members } = await supabase
      .from('memberships').select('user_id').eq('tenant_id', tenantId).eq('role', 'editor');

    const { data: shifts } = await supabase
      .from('agent_shifts').select('user_id')
      .eq('tenant_id', tenantId)
      .gte('clock_in', yearStart).lte('clock_in', yearEnd);

    const shiftCounts = new Map<string, number>();
    for (const s of shifts ?? []) {
      shiftCounts.set(s.user_id, (shiftCounts.get(s.user_id) ?? 0) + 1);
    }

    const allIds = (members ?? []).map((m) => m.user_id);
    const maxShifts = Math.max(...shiftCounts.values(), 0);
    const perfectIds = allIds.filter((id) => (shiftCounts.get(id) ?? 0) >= maxShifts * 0.95);

    const { data: profiles } = perfectIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', perfectIds)
      : { data: [] };

    return {
      type: 'attendance_perfect',
      title: `Asistencia Perfecta ${year}`,
      agents: (profiles ?? []).map((p) => ({ name: p.full_name, shifts: shiftCounts.get(p.id) ?? 0 })),
      total: allIds.length,
    };
  }

  return { type: 'generic', title: 'Consulta de asistencia', data: [] };
}

async function queryPunctuality(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
) {
  const { data: shifts } = await supabase
    .from('agent_shifts').select('user_id, clock_in')
    .eq('tenant_id', tenantId)
    .gte('clock_in', `${new Date().getFullYear()}-01-01T00:00:00Z`);

  const lateByAgent = new Map<string, number>();
  const totalByAgent = new Map<string, number>();

  for (const s of shifts ?? []) {
    const hour = new Date(s.clock_in).getUTCHours();
    const isLate = (hour === 6 && new Date(s.clock_in).getUTCMinutes() > 15) ||
                   (hour === 18 && new Date(s.clock_in).getUTCMinutes() > 15);
    totalByAgent.set(s.user_id, (totalByAgent.get(s.user_id) ?? 0) + 1);
    if (isLate) lateByAgent.set(s.user_id, (lateByAgent.get(s.user_id) ?? 0) + 1);
  }

  const punctualIds = [...totalByAgent.keys()].filter((id) => !lateByAgent.has(id));

  const { data: profiles } = punctualIds.length > 0
    ? await supabase.from('profiles').select('id, full_name').in('id', punctualIds)
    : { data: [] };

  return {
    type: 'punctuality',
    title: 'Puntualidad de Hierro',
    agents: (profiles ?? []).map((p) => ({
      name: p.full_name,
      shifts: totalByAgent.get(p.id) ?? 0,
      lateCount: 0,
    })),
  };
}

async function queryFleet(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
) {
  const { data: vehicles } = await supabase
    .from('fleet_vehicles').select('id, plate_number, brand_model, status')
    .eq('tenant_id', tenantId);

  const { data: violations } = await supabase
    .from('geofence_violations').select('vehicle_id')
    .eq('tenant_id', tenantId);

  const violationCounts = new Map<string, number>();
  for (const v of violations ?? []) {
    violationCounts.set(v.vehicle_id, (violationCounts.get(v.vehicle_id) ?? 0) + 1);
  }

  const ranked = (vehicles ?? [])
    .map((v) => ({
      plate: v.plate_number,
      model: v.brand_model,
      incidents: violationCounts.get(v.id) ?? 0,
      status: v.status,
    }))
    .sort((a, b) => a.incidents - b.incidents);

  return {
    type: 'fleet_ranking',
    title: 'Ranking de Preservacion de Flota',
    vehicles: ranked,
    best: ranked[0] ?? null,
  };
}

async function queryPayroll(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
  intent: string,
) {
  // Last 3 closed periods
  const { data: periods } = await supabase
    .from('payroll_periods')
    .select('id, start_date, end_date')
    .eq('tenant_id', tenantId)
    .in('status', ['calculado', 'cerrado_pagado'])
    .order('end_date', { ascending: false })
    .limit(6);

  if (!periods || periods.length === 0) {
    return { type: 'payroll_empty', title: 'Sin datos de nomina', data: [] };
  }

  const periodIds = periods.map((p) => p.id);

  const { data: consolidated } = await supabase
    .from('payroll_agent_consolidated')
    .select('payroll_period_id, user_id, rate_per_hour, regular_hours_accumulated, overtime_hours_accumulated, gross_salary, net_salary')
    .in('payroll_period_id', periodIds);

  // Overtime cost per period
  const periodStats = periods.map((p) => {
    const recs = (consolidated ?? []).filter((c) => c.payroll_period_id === p.id);
    const totalRegular = recs.reduce((s, r) => s + Number(r.regular_hours_accumulated), 0);
    const totalOT = recs.reduce((s, r) => s + Number(r.overtime_hours_accumulated), 0);
    const totalGross = recs.reduce((s, r) => s + Number(r.gross_salary), 0);
    const totalNet = recs.reduce((s, r) => s + Number(r.net_salary), 0);
    const otCost = recs.reduce((s, r) => s + Number(r.overtime_hours_accumulated) * Number(r.rate_per_hour), 0);
    const totalHours = totalRegular + totalOT;
    const otRatio = totalHours > 0 ? Math.round((totalOT / totalHours) * 100) : 0;

    return {
      label: `${p.start_date.split('-')[2]}/${p.start_date.split('-')[1]}`,
      startDate: p.start_date,
      agents: recs.length,
      regularHours: Math.round(totalRegular),
      overtimeHours: Math.round(totalOT),
      otCost: Math.round(otCost * 100) / 100,
      otRatio,
      gross: Math.round(totalGross * 100) / 100,
      net: Math.round(totalNet * 100) / 100,
    };
  }).reverse();

  // Top contracts by salary
  if (intent.includes('top_contracts') || intent.includes('cliente') || intent.includes('contrato')) {
    const { data: contracts } = await supabase
      .from('hr_contracts')
      .select('user_id, contract_type, base_salary, start_date, status')
      .eq('tenant_id', tenantId)
      .order('base_salary', { ascending: false });

    const userIds = (contracts ?? []).map((c) => c.user_id);
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const ranked = (contracts ?? []).map((c) => ({
      name: nameMap.get(c.user_id) ?? 'Agente',
      salary: Number(c.base_salary),
      hourlyRate: Math.round((Number(c.base_salary) / 240) * 100) / 100,
      type: c.contract_type === 'indefinido' ? 'Indefinido' : 'Definido',
      status: c.status,
      startDate: c.start_date,
    }));

    const totalPayroll = ranked.reduce((s, r) => s + r.salary, 0);

    return {
      type: 'top_contracts',
      title: 'Contratos por Valor de Salario',
      agents: ranked.slice(0, 10).map((r) => ({
        name: r.name,
        salary: `B/.${r.salary.toFixed(2)}`,
        hourlyRate: `B/.${r.hourlyRate}/h`,
        type: r.type,
        status: r.status,
      })),
      totalMonthlyPayroll: Math.round(totalPayroll * 100) / 100,
      agentCount: ranked.length,
    };
  }

  // Overtime breakdown by agent and property
  if (intent.includes('overtime') || intent.includes('profitability') || intent.includes('extras') || intent.includes('dinero')) {
    const allRecs = consolidated ?? [];
    const userIds = [...new Set(allRecs.map((r) => r.user_id))];

    // Agent names
    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    // Overtime by agent (across all periods)
    const agentOT = new Map<string, { hours: number; cost: number }>();
    for (const r of allRecs) {
      const ot = Number(r.overtime_hours_accumulated);
      const cost = ot * Number(r.rate_per_hour);
      const prev = agentOT.get(r.user_id) ?? { hours: 0, cost: 0 };
      agentOT.set(r.user_id, { hours: prev.hours + ot, cost: prev.cost + cost });
    }

    const byAgent = [...agentOT.entries()]
      .map(([uid, data]) => ({
        name: nameMap.get(uid) ?? 'Agente',
        overtimeHours: Math.round(data.hours),
        otCost: Math.round(data.cost * 100) / 100,
      }))
      .sort((a, b) => b.otCost - a.otCost);

    // Overtime by property — trace shifts in the period range to properties
    const currentYear = new Date().getFullYear();
    const periodStart = periods[periods.length - 1]?.start_date ?? `${currentYear}-01-01`;
    const periodEnd = periods[0]?.end_date ?? `${currentYear}-12-31`;

    const { data: shifts } = await supabase
      .from('agent_shifts')
      .select('user_id, work_station_id, clock_in, clock_out')
      .eq('tenant_id', tenantId)
      .gte('clock_in', `${periodStart}T00:00:00Z`)
      .lte('clock_in', `${periodEnd}T23:59:59Z`)
      .not('clock_out', 'is', null);

    // Map stations to properties
    const stationIds = [...new Set((shifts ?? []).map((s) => s.work_station_id))];
    const { data: stations } = stationIds.length > 0
      ? await supabase.from('work_stations').select('id, property_id, properties_ph(name)').in('id', stationIds)
      : { data: [] };

    const stationPropertyMap = new Map(
      (stations ?? []).map((s) => [s.id, { propertyId: s.property_id, propertyName: s.properties_ph?.name ?? 'Propiedad' }]),
    );

    // Hours per agent per property
    const agentPropertyHours = new Map<string, Map<string, number>>();
    for (const s of shifts ?? []) {
      if (!s.clock_out) continue;
      const hours = (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3600000;
      const prop = stationPropertyMap.get(s.work_station_id);
      if (!prop) continue;

      const agentMap = agentPropertyHours.get(prop.propertyName) ?? new Map<string, number>();
      agentMap.set(s.user_id, (agentMap.get(s.user_id) ?? 0) + hours);
      agentPropertyHours.set(prop.propertyName, agentMap);
    }

    // Sum overtime cost by property
    const byProperty = [...agentPropertyHours.entries()].map(([propName, agentHours]) => {
      let totalOTHours = 0;
      let totalOTCost = 0;
      for (const [uid, hours] of agentHours) {
        const overLimit = Math.max(0, hours - 96 * (periods.length / 2));
        const rate = allRecs.find((r) => r.user_id === uid)?.rate_per_hour ?? 4.17;
        totalOTHours += overLimit;
        totalOTCost += overLimit * Number(rate);
      }
      return {
        property: propName,
        overtimeHours: Math.round(totalOTHours),
        otCost: Math.round(totalOTCost * 100) / 100,
        agents: agentHours.size,
      };
    }).sort((a, b) => b.otCost - a.otCost);

    return {
      type: 'overtime_breakdown',
      title: 'Fuga de Rentabilidad por Horas Extras',
      byAgent,
      byProperty,
      totalOTCost: Math.round(byAgent.reduce((s, a) => s + a.otCost, 0) * 100) / 100,
      periods: periodStats,
    };
  }

  if (intent.includes('bradford') || intent.includes('ausentismo')) {
    // Bradford Factor calculation
    const { data: members } = await supabase
      .from('memberships').select('user_id').eq('tenant_id', tenantId).in('role', ['editor', 'admin']);

    const { data: shifts } = await supabase
      .from('agent_shifts').select('user_id, clock_in')
      .eq('tenant_id', tenantId)
      .gte('clock_in', `${new Date().getFullYear()}-01-01T00:00:00Z`)
      .order('clock_in');

    const shiftDays = new Map<string, Set<string>>();
    for (const s of shifts ?? []) {
      const day = s.clock_in.split('T')[0]!;
      const set = shiftDays.get(s.user_id) ?? new Set();
      set.add(day);
      shiftDays.set(s.user_id, set);
    }

    const today = new Date();
    const allDays: string[] = [];
    const d = new Date(`${today.getFullYear()}-01-01`);
    while (d <= today) {
      allDays.push(d.toISOString().split('T')[0]!);
      d.setDate(d.getDate() + 1);
    }

    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name')
      .in('id', (members ?? []).map((m) => m.user_id));

    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const bradfordResults = (members ?? []).map((m) => {
      const workedDays = shiftDays.get(m.user_id) ?? new Set();
      let episodes = 0;
      let absentDays = 0;
      let inAbsence = false;

      for (const day of allDays) {
        if (!workedDays.has(day)) {
          absentDays++;
          if (!inAbsence) { episodes++; inAbsence = true; }
        } else {
          inAbsence = false;
        }
      }

      const bradford = episodes * episodes * absentDays;
      let severity: string;
      if (bradford <= 50) severity = 'Bajo';
      else if (bradford <= 200) severity = 'Moderado';
      else if (bradford <= 500) severity = 'Alto';
      else severity = 'Critico';

      return {
        name: nameMap.get(m.user_id) ?? 'Agente',
        episodes,
        absentDays,
        bradford,
        severity,
      };
    }).sort((a, b) => b.bradford - a.bradford);

    return {
      type: 'bradford',
      title: 'Factor de Bradford — Impacto del Ausentismo',
      agents: bradfordResults,
      chartType: 'table',
    };
  }

  return {
    type: 'payroll_overtime',
    title: 'Fuga de Rentabilidad por Horas Extras',
    periods: periodStats,
    totalOTCost: periodStats.reduce((s, p) => s + p.otCost, 0),
    avgOTRatio: Math.round(periodStats.reduce((s, p) => s + p.otRatio, 0) / periodStats.length),
    chartType: 'stacked_bar',
  };
}

async function queryFleetCPK(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
) {
  const { data: vehicles } = await supabase
    .from('fleet_vehicles')
    .select('id, plate_number, brand_model, current_odometer')
    .eq('tenant_id', tenantId);

  const { data: violations } = await supabase
    .from('geofence_violations')
    .select('vehicle_id')
    .eq('tenant_id', tenantId);

  const violationCounts = new Map<string, number>();
  for (const v of violations ?? []) {
    violationCounts.set(v.vehicle_id, (violationCounts.get(v.vehicle_id) ?? 0) + 1);
  }

  // Estimate CPK (maintenance cost / km) — using violations as proxy for cost events
  const cpkData = (vehicles ?? []).map((v) => {
    const incidents = violationCounts.get(v.id) ?? 0;
    const estimatedCost = incidents * 75; // B/.75 avg cost per incident
    const km = v.current_odometer > 0 ? v.current_odometer : 1;
    const cpk = Math.round((estimatedCost / km) * 10000) / 10000;

    let rating: string;
    if (cpk < 0.15) rating = 'Excelente';
    else if (cpk < 0.30) rating = 'Normal';
    else if (cpk < 0.50) rating = 'Elevado';
    else rating = 'Critico';

    return {
      plate: v.plate_number,
      model: v.brand_model,
      km: v.current_odometer,
      incidents,
      estimatedCost,
      cpk,
      rating,
    };
  }).sort((a, b) => a.cpk - b.cpk);

  return {
    type: 'fleet_cpk',
    title: 'Costo por Kilometro Recorrido (CPK)',
    vehicles: cpkData,
    best: cpkData[0] ?? null,
    worst: cpkData[cpkData.length - 1] ?? null,
    chartType: 'bar',
  };
}

async function queryHR(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
  intent: string,
) {
  if (intent.includes('turnover') || intent.includes('rotacion')) {
    const { data: contracts } = await supabase.from('hr_contracts').select('status').eq('tenant_id', tenantId);
    const active = (contracts ?? []).filter((c) => c.status === 'activo').length;
    const terminated = (contracts ?? []).filter((c) => c.status === 'terminado').length;
    const total = contracts?.length ?? 0;
    const rate = total > 0 ? Math.round((terminated / total) * 100) : 0;
    return { type: 'hr_turnover', title: 'Tasa de Rotacion de Personal', agents: [
      { name: 'Contratos activos', shifts: active },
      { name: 'Contratos terminados', shifts: terminated },
      { name: `Tasa de rotacion: ${rate}%`, shifts: total },
    ]};
  }

  if (intent.includes('tenure') || intent.includes('antiguedad')) {
    const { data } = await supabase.from('hr_agent_profiles').select('user_id, hire_date').eq('tenant_id', tenantId).order('hire_date');
    const userIds = (data ?? []).map((d) => d.user_id);
    const { data: profiles } = userIds.length > 0 ? await supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const today = Date.now();
    return { type: 'hr_tenure', title: 'Ranking de Antiguedad', agents: (data ?? []).map((d) => {
      const days = Math.floor((today - new Date(d.hire_date).getTime()) / 86400000);
      return { name: nameMap.get(d.user_id) ?? 'Agente', shifts: days, salary: `${Math.floor(days/365)}a ${Math.floor((days%365)/30)}m` };
    })};
  }

  if (intent.includes('mitradel') || intent.includes('sello')) {
    const { count } = await supabase.from('hr_contracts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'pendiente_sello');
    return { type: 'hr_mitradel', title: 'Contratos Pendientes MITRADEL', agents: [{ name: `${count ?? 0} contratos sin sello MITRADEL`, shifts: count ?? 0 }]};
  }

  if (intent.includes('disciplin') || intent.includes('amonestacion')) {
    const { data } = await supabase.from('hr_disciplinary_records').select('user_id, record_type').eq('tenant_id', tenantId);
    const counts = new Map<string, number>();
    for (const d of data ?? []) { counts.set(d.user_id, (counts.get(d.user_id) ?? 0) + 1); }
    const userIds = [...counts.keys()];
    const { data: profiles } = userIds.length > 0 ? await supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const ranked = [...counts.entries()].map(([uid, count]) => ({ name: nameMap.get(uid) ?? 'Agente', shifts: count })).sort((a, b) => b.shifts - a.shifts);
    return { type: 'hr_disciplinary', title: 'Historial Disciplinario', agents: ranked.length > 0 ? ranked : [{ name: 'Sin registros disciplinarios', shifts: 0 }]};
  }

  if (intent.includes('medical') || intent.includes('incapacidad')) {
    const { data } = await supabase.from('hr_medical_leaves').select('user_id, days').eq('tenant_id', tenantId);
    const counts = new Map<string, number>();
    for (const d of data ?? []) { counts.set(d.user_id, (counts.get(d.user_id) ?? 0) + d.days); }
    const userIds = [...counts.keys()];
    const { data: profiles } = userIds.length > 0 ? await supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const ranked = [...counts.entries()].map(([uid, days]) => ({ name: nameMap.get(uid) ?? 'Agente', shifts: days, salary: `${days} dias` })).sort((a, b) => b.shifts - a.shifts);
    return { type: 'hr_medical', title: 'Incapacidades Acumuladas', agents: ranked.length > 0 ? ranked : [{ name: 'Sin incapacidades registradas', shifts: 0 }]};
  }

  if (intent.includes('training') || intent.includes('compliance') || intent.includes('capacitacion')) {
    const today = new Date().toISOString().split('T')[0]!;
    const { data: logs } = await supabase.from('agent_training_logs').select('user_id, expiry_date').eq('tenant_id', tenantId);
    const valid = new Set((logs ?? []).filter((l) => l.expiry_date >= today).map((l) => l.user_id));
    const expired = new Set((logs ?? []).filter((l) => l.expiry_date < today).map((l) => l.user_id));
    const { count: totalAgents } = await supabase.from('memberships').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    return { type: 'hr_training', title: 'Cumplimiento de Capacitaciones', agents: [
      { name: 'Agentes con certificaciones vigentes', shifts: valid.size },
      { name: 'Agentes con certificaciones vencidas', shifts: expired.size },
      { name: 'Total agentes', shifts: totalAgents ?? 0 },
    ]};
  }

  if (intent.includes('permit') || intent.includes('arma')) {
    const today = new Date().toISOString().split('T')[0]!;
    const { data } = await supabase.from('firearms_inventory').select('serial_number, brand, model, permit_expiry_date').eq('tenant_id', tenantId).neq('status', 'retirada');
    const atRisk = (data ?? []).filter((f) => f.permit_expiry_date <= today || new Date(f.permit_expiry_date).getTime() - Date.now() < 60 * 86400000);
    return { type: 'hr_permits', title: 'Permisos de Armas', vehicles: atRisk.map((f) => ({ plate: f.serial_number, model: `${f.brand} ${f.model}`, incidents: Math.ceil((new Date(f.permit_expiry_date).getTime() - Date.now()) / 86400000) }))};
  }

  return { type: 'info', message: 'Consultando datos de RRHH...' };
}

async function queryIncidents(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await supabase.from('incidents_log').select('status, created_at').eq('tenant_id', tenantId).gte('created_at', thirtyDaysAgo);
  const total = data?.length ?? 0;
  const open = (data ?? []).filter((i) => i.status === 'open').length;
  const resolved = (data ?? []).filter((i) => i.status === 'resolved').length;
  const closed = (data ?? []).filter((i) => i.status === 'closed').length;
  return { type: 'incident_summary', title: 'Incidentes (ultimos 30 dias)', agents: [
    { name: 'Total incidentes', shifts: total },
    { name: 'Abiertos', shifts: open },
    { name: 'Resueltos', shifts: resolved },
    { name: 'Cerrados', shifts: closed },
  ]};
}

async function queryClients(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
) {
  const { data: tickets } = await supabase.from('client_tickets').select('property_id, status, properties_ph(name)').eq('tenant_id', tenantId);
  const byProperty = new Map<string, { name: string; open: number; total: number }>();
  for (const t of tickets ?? []) {
    const propName = t.properties_ph?.name ?? 'Propiedad';
    const entry = byProperty.get(t.property_id) ?? { name: propName, open: 0, total: 0 };
    entry.total++;
    if (t.status === 'abierto' || t.status === 'en_proceso') entry.open++;
    byProperty.set(t.property_id, entry);
  }
  const ranked = [...byProperty.values()].sort((a, b) => b.open - a.open);
  const { data: damages } = await supabase.from('client_damage_reports').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'bajo_investigacion');
  return { type: 'client_tickets', title: 'Quejas y Tickets por Propiedad', agents: [
    ...ranked.map((r) => ({ name: r.name, shifts: r.open, salary: `${r.total} total` })),
    { name: 'Danos bajo investigacion', shifts: damages?.length ?? 0 },
  ]};
}

async function queryInventory(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  tenantId: string,
) {
  const { data } = await supabase.from('inventory_items').select('item_name, category, current_stock, min_stock_alert').eq('tenant_id', tenantId).order('current_stock');
  const lowStock = (data ?? []).filter((i) => i.current_stock <= i.min_stock_alert);
  const outOfStock = (data ?? []).filter((i) => i.current_stock === 0);
  return { type: 'inventory_status', title: 'Estado del Inventario', agents: [
    { name: `${outOfStock.length} articulos agotados`, shifts: outOfStock.length },
    { name: `${lowStock.length} articulos bajo minimo`, shifts: lowStock.length },
    ...(data ?? []).map((i) => ({ name: `${i.item_name}`, shifts: i.current_stock, salary: `min: ${i.min_stock_alert}` })),
  ]};
}

function classifyQuestion(question: string): AIResponse {
  const q = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Bradford / ausentismo
  if (q.includes('bradford') || q.includes('ausentismo') || q.includes('ausencias')) {
    return { category: 'payroll', intent: 'bradford_factor', params: { year: new Date().getFullYear() }, answer: 'Calculando Factor de Bradford para todos los agentes...' };
  }

  // Overtime / horas extras / rentabilidad
  if (q.includes('hora extra') || q.includes('horas extra') || q.includes('overtime') || q.includes('pierdo dinero') || q.includes('rentabilidad') || q.includes('extras planas')) {
    return { category: 'payroll', intent: 'overtime_profitability', params: {}, answer: 'Analizando fuga de rentabilidad por horas extras...' };
  }

  // CPK / costo por kilometro
  if (q.includes('cpk') || q.includes('costo por kilo') || q.includes('kilometro') || q.includes('cuesta mas') || q.includes('mas caro')) {
    return { category: 'fleet', intent: 'cpk_analysis', params: {}, answer: 'Calculando Costo por Kilometro (CPK) de la flota...' };
  }

  // Fleet / vehiculo / daños
  if (q.includes('vehiculo') || q.includes('flota') || q.includes('dano') || q.includes('placa') || q.includes('preservacion')) {
    return { category: 'fleet', intent: 'fleet_ranking', params: {}, answer: 'Generando ranking de preservacion de flota...' };
  }

  // Punctuality / puntualidad / tardanza
  if (q.includes('puntual') || q.includes('tardanza') || q.includes('a tiempo') || q.includes('tarde') || q.includes('llega')) {
    return { category: 'punctuality', intent: 'zero_tardiness', params: {}, answer: 'Identificando agentes con puntualidad perfecta...' };
  }

  // Attendance / asistencia / falto
  if (q.includes('asistencia') || q.includes('falto') || q.includes('falta') || q.includes('no falto') || q.includes('record')) {
    return { category: 'attendance', intent: 'perfect_attendance_2026', params: { year: new Date().getFullYear() }, answer: 'Buscando agentes con asistencia perfecta en 2026...' };
  }

  // Contracts / clientes / top / salarios altos
  if (q.includes('contrato') || q.includes('cliente') || q.includes('salario mas alto') || q.includes('mas alto') || q.includes('top')) {
    return { category: 'payroll', intent: 'top_contracts', params: {}, answer: 'Consultando contratos con mayor valor...' };
  }

  // Nomina / salario / pago
  if (q.includes('nomina') || q.includes('salario') || q.includes('planilla') || q.includes('pago') || q.includes('neto')) {
    return { category: 'payroll', intent: 'payroll_summary', params: {}, answer: 'Generando resumen de nomina...' };
  }

  // HR
  if (q.includes('rotacion') || q.includes('renunci') || q.includes('despido') || q.includes('terminado')) {
    return { category: 'hr', intent: 'turnover_rate', params: {}, answer: 'Calculando tasa de rotacion...' };
  }
  if (q.includes('antiguedad') || q.includes('antiguo') || q.includes('veterano') || q.includes('mas tiempo')) {
    return { category: 'hr', intent: 'tenure_ranking', params: {}, answer: 'Identificando agentes con mayor antiguedad...' };
  }
  if (q.includes('documentacion') || q.includes('incompleto') || q.includes('expediente')) {
    return { category: 'hr', intent: 'compliance_gaps', params: {}, answer: 'Verificando documentacion...' };
  }
  if (q.includes('incapacidad') || q.includes('enferm') || q.includes('licencia medica')) {
    return { category: 'hr', intent: 'medical_leaves', params: {}, answer: 'Analizando incapacidades...' };
  }
  if (q.includes('amonestacion') || q.includes('disciplin') || q.includes('suspension') || q.includes('problematico')) {
    return { category: 'hr', intent: 'disciplinary_report', params: {}, answer: 'Consultando historial disciplinario...' };
  }
  if (q.includes('capacitacion') || q.includes('certificacion') || q.includes('curso') || q.includes('diasp') || q.includes('carnet')) {
    return { category: 'hr', intent: 'training_compliance', params: {}, answer: 'Verificando capacitaciones...' };
  }
  if (q.includes('mitradel') || q.includes('sello') || q.includes('sin sellar')) {
    return { category: 'hr', intent: 'mitradel_pending', params: {}, answer: 'Contratos sin sello MITRADEL...' };
  }
  if (q.includes('permiso') || q.includes('arma')) {
    return { category: 'hr', intent: 'permit_expiry', params: {}, answer: 'Verificando permisos de armas...' };
  }

  // Incidents
  if (q.includes('incidente') || q.includes('novedad') || q.includes('critico') || q.includes('seguridad')) {
    return { category: 'incidents', intent: 'incident_summary', params: {}, answer: 'Resumen de incidentes...' };
  }

  // Clients
  if (q.includes('queja') || q.includes('ticket') || q.includes('reclamo') || q.includes('pqr')) {
    return { category: 'clients', intent: 'complaint_ranking', params: {}, answer: 'Analizando quejas...' };
  }

  // Inventory
  if (q.includes('stock') || q.includes('inventario') || q.includes('bodega') || q.includes('agotado')) {
    return { category: 'inventory', intent: 'low_stock', params: {}, answer: 'Verificando inventario...' };
  }

  // Cobertura
  if (q.includes('puesto') || q.includes('cobertura') || q.includes('sin cubrir') || q.includes('vacio')) {
    return { category: 'attendance', intent: 'coverage_gaps', params: {}, answer: 'Analizando cobertura de puestos...' };
  }

  // Default
  return { category: 'attendance', intent: 'general_stats', params: { year: new Date().getFullYear() }, answer: 'Consultando estadisticas operativas...' };
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const { question, tenant_id: requestedTenantId } = validate(chatSchema, body);

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    let tenantId: string;
    if (requestedTenantId) {
      const { data: membership } = await supabase.from('memberships')
        .select('role').eq('tenant_id', requestedTenantId).eq('user_id', user.id).maybeSingle();
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin'))
        throw new AppError('FORBIDDEN', 'Acceso restringido');
      tenantId = requestedTenantId;
    } else {
      const { data: membership } = await supabase.from('memberships')
        .select('tenant_id, role').eq('user_id', user.id).limit(1).maybeSingle();
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin'))
        throw new AppError('FORBIDDEN', 'Acceso restringido');
      tenantId = membership.tenant_id;
    }

    // Classify the question — keyword-based (instant) with optional AI upgrade
    const aiResponse = classifyQuestion(question);

    // If ANTHROPIC_API_KEY is available, upgrade classification with AI
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const ai = getAI();
        const msg = await ai.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system: MASTER_PROMPT,
          messages: [{ role: 'user', content: question }],
        }, { signal: AbortSignal.timeout(12000) });

        const text = msg.content.find((b) => b.type === 'text');
        const parsed = JSON.parse(text?.type === 'text' ? text.text : '{}') as AIResponse;
        if (parsed.category) {
          aiResponse.category = parsed.category;
          aiResponse.intent = parsed.intent;
          aiResponse.answer = parsed.answer;
          if (parsed.params) aiResponse.params = parsed.params;
        }
      } catch {
        // Keep keyword classification — already set above
      }
    }

    // Execute the appropriate query
    let queryResult: unknown;

    switch (aiResponse.category) {
      case 'attendance':
        queryResult = await queryAttendance(supabase, tenantId, aiResponse.intent, aiResponse.params);
        break;
      case 'punctuality':
        queryResult = await queryPunctuality(supabase, tenantId);
        break;
      case 'fleet':
        if (aiResponse.intent.includes('cpk') || aiResponse.intent.includes('costo') || aiResponse.intent.includes('kilometro')) {
          queryResult = await queryFleetCPK(supabase, tenantId);
        } else {
          queryResult = await queryFleet(supabase, tenantId);
        }
        break;
      case 'payroll':
        queryResult = await queryPayroll(supabase, tenantId, aiResponse.intent);
        break;
      case 'hr':
        queryResult = await queryHR(supabase, tenantId, aiResponse.intent);
        break;
      case 'incidents':
        queryResult = await queryIncidents(supabase, tenantId);
        break;
      case 'clients':
        queryResult = await queryClients(supabase, tenantId);
        break;
      case 'inventory':
        queryResult = await queryInventory(supabase, tenantId);
        break;
      default:
        queryResult = { type: 'info', message: aiResponse.answer };
    }

    return NextResponse.json({
      data: {
        question,
        aiClassification: aiResponse,
        result: queryResult,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

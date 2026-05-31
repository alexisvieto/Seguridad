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
  const year = Number(aiParams['year'] ?? 2026);
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
    .gte('clock_in', '2026-01-01T00:00:00Z');

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

  if (intent.includes('bradford') || intent.includes('ausentismo')) {
    // Bradford Factor calculation
    const { data: members } = await supabase
      .from('memberships').select('user_id').eq('tenant_id', tenantId).in('role', ['editor', 'admin']);

    const { data: shifts } = await supabase
      .from('agent_shifts').select('user_id, clock_in')
      .eq('tenant_id', tenantId)
      .gte('clock_in', '2026-01-01T00:00:00Z')
      .order('clock_in');

    const shiftDays = new Map<string, Set<string>>();
    for (const s of shifts ?? []) {
      const day = s.clock_in.split('T')[0]!;
      const set = shiftDays.get(s.user_id) ?? new Set();
      set.add(day);
      shiftDays.set(s.user_id, set);
    }

    // Generate all working days in 2026 so far
    const today = new Date();
    const allDays: string[] = [];
    const d = new Date('2026-01-01');
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

function classifyQuestion(question: string): AIResponse {
  const q = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Bradford / ausentismo
  if (q.includes('bradford') || q.includes('ausentismo') || q.includes('ausencias')) {
    return { category: 'payroll', intent: 'bradford_factor', params: { year: 2026 }, answer: 'Calculando Factor de Bradford para todos los agentes...' };
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
    return { category: 'attendance', intent: 'perfect_attendance_2026', params: { year: 2026 }, answer: 'Buscando agentes con asistencia perfecta en 2026...' };
  }

  // Nomina / salario / pago
  if (q.includes('nomina') || q.includes('salario') || q.includes('planilla') || q.includes('pago') || q.includes('neto')) {
    return { category: 'payroll', intent: 'payroll_summary', params: {}, answer: 'Generando resumen de nomina...' };
  }

  // Default
  return { category: 'attendance', intent: 'general_stats', params: { year: 2026 }, answer: 'Consultando estadisticas operativas...' };
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const { question } = validate(chatSchema, body);

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: membership } = await supabase.from('memberships')
      .select('tenant_id, role').eq('user_id', user.id).maybeSingle();
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin'))
      throw new AppError('FORBIDDEN', 'Acceso restringido');

    const tenantId = membership.tenant_id;

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

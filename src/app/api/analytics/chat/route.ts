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

    // Ask AI to classify the question
    let aiResponse: AIResponse;
    try {
      const ai = getAI();
      const msg = await ai.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: MASTER_PROMPT,
        messages: [{ role: 'user', content: question }],
      }, { signal: AbortSignal.timeout(12000) });

      const text = msg.content.find((b) => b.type === 'text');
      aiResponse = JSON.parse(text?.type === 'text' ? text.text : '{}') as AIResponse;
    } catch {
      aiResponse = { category: 'general', intent: 'fallback', params: {}, answer: 'Procesando su consulta...' };
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
        queryResult = await queryFleet(supabase, tenantId);
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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validate } from '@/lib/validation/validate';
import { handleApiError } from '@/lib/errors/error-handler';
import { AppError } from '@/lib/errors/app-error';
import { refineIncidentText } from '@/lib/ai/refine-incident';

const reportIncidentSchema = z.object({
  work_station_id: z.string().uuid('ID de puesto inválido'),
  raw_text: z
    .string()
    .min(1, 'El reporte no puede estar vacío')
    .max(5000, 'El reporte no puede superar 5000 caracteres'),
  action_taken: z.string().max(2000).nullable().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const input = validate(reportIncidentSchema, body);

    // 1. Authenticate
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new AppError('UNAUTHORIZED', 'Debes iniciar sesión para reportar una novedad');
    }

    // 2. Verify work station exists and get tenant_id
    const { data: station, error: stationError } = await supabase
      .from('work_stations')
      .select('id, tenant_id, is_active')
      .eq('id', input.work_station_id)
      .maybeSingle();

    if (stationError || !station) {
      throw new AppError('NOT_FOUND', 'Puesto de trabajo no encontrado');
    }

    // 2b. Validate user is member of the station's tenant
    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('tenant_id', station.tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      throw new AppError('FORBIDDEN', 'No tienes acceso a este tenant');
    }

    if (!station.is_active) {
      throw new AppError('VALIDATION_ERROR', 'Este puesto de trabajo está desactivado');
    }

    // 3. Refine text with AI
    let aiRefinedText: string | null = null;

    try {
      aiRefinedText = await refineIncidentText(input.raw_text);
    } catch (aiError) {
      console.error('[AI Refinement Error]', aiError);
      // Non-blocking: the incident is saved even if AI fails
    }

    // 4. Insert incident
    const { data: incident, error: insertError } = await supabase
      .from('incidents_log')
      .insert({
        tenant_id: station.tenant_id,
        work_station_id: station.id,
        user_id: user.id,
        raw_text: input.raw_text,
        ai_refined_text: aiRefinedText,
        action_taken: input.action_taken ?? null,
      })
      .select()
      .single();

    if (insertError || !incident) {
      throw new AppError('INTERNAL_ERROR', 'Error al registrar la novedad');
    }

    return NextResponse.json(
      {
        data: {
          incident_id: incident.id,
          raw_text: incident.raw_text,
          ai_refined_text: incident.ai_refined_text,
          status: incident.status,
          am_report_sent: incident.am_report_sent,
          created_at: incident.created_at,
          ai_available: aiRefinedText !== null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

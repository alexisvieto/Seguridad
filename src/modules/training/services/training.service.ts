import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/shared/types/database';
import type { CertExpiryAlert, EligibilityResult } from '../types';
import { AppError } from '@/lib/errors/app-error';

type Client = SupabaseClient<Database>;

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export async function createCourse(
  client: Client,
  input: {
    tenant_id: string;
    course_name: string;
    description?: string | null;
    validity_months?: number;
  },
) {
  const { data, error } = await client
    .from('training_courses')
    .insert({
      tenant_id: input.tenant_id,
      course_name: input.course_name,
      description: input.description ?? null,
      validity_months: input.validity_months ?? 12,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al crear el curso');
  }

  return data;
}

export async function getCoursesByTenant(client: Client, tenantId: string) {
  const { data, error } = await client
    .from('training_courses')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('course_name');

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener cursos');
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Training Logs
// ---------------------------------------------------------------------------

export async function logTraining(
  client: Client,
  input: {
    tenant_id: string;
    user_id: string;
    course_id: string;
    completion_date: string;
    grade?: string | null;
    certificate_pdf_url?: string | null;
  },
) {
  const { data: course } = await client
    .from('training_courses')
    .select('validity_months')
    .eq('id', input.course_id)
    .maybeSingle();

  if (!course) {
    throw new AppError('NOT_FOUND', 'Curso no encontrado');
  }

  const completionDate = new Date(input.completion_date);
  const expiryDate = new Date(completionDate);
  expiryDate.setMonth(expiryDate.getMonth() + course.validity_months);

  const { data, error } = await client
    .from('agent_training_logs')
    .insert({
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      course_id: input.course_id,
      completion_date: input.completion_date,
      expiry_date: expiryDate.toISOString().split('T')[0]!,
      grade: input.grade ?? null,
      certificate_pdf_url: input.certificate_pdf_url ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new AppError('INTERNAL_ERROR', 'Error al registrar la capacitación');
  }

  return data;
}

export async function getTrainingsByUser(client: Client, tenantId: string, userId: string) {
  const { data, error } = await client
    .from('agent_training_logs')
    .select('*, training_courses(course_name, validity_months)')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .order('expiry_date', { ascending: false });

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener capacitaciones');
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Station Requirements
// ---------------------------------------------------------------------------

export async function assignRequiredTraining(
  client: Client,
  input: { tenant_id: string; work_station_id: string; course_id: string },
) {
  const { data, error } = await client
    .from('station_required_trainings')
    .insert(input)
    .select()
    .single();

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('CONFLICT', 'Este curso ya es requisito para este puesto');
    }
    throw new AppError('INTERNAL_ERROR', 'Error al asignar requisito');
  }

  return data;
}

export async function getRequiredTrainings(client: Client, stationId: string) {
  const { data, error } = await client
    .from('station_required_trainings')
    .select('*, training_courses(course_name, validity_months)')
    .eq('work_station_id', stationId);

  if (error) {
    throw new AppError('INTERNAL_ERROR', 'Error al obtener requisitos');
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Eligibility Check
// ---------------------------------------------------------------------------

export async function checkAgentEligibility(
  client: Client,
  userId: string,
  stationId: string,
): Promise<EligibilityResult> {
  const { data: requirements } = await client
    .from('station_required_trainings')
    .select('course_id, training_courses(course_name)')
    .eq('work_station_id', stationId);

  if (!requirements || requirements.length === 0) {
    return { eligible: true, missing: [] };
  }

  const today = new Date().toISOString().split('T')[0]!;

  const { data: validCerts } = await client
    .from('agent_training_logs')
    .select('course_id')
    .eq('user_id', userId)
    .gte('expiry_date', today);

  const validCourseIds = new Set((validCerts ?? []).map((c) => c.course_id));

  const missing = requirements
    .filter((r) => !validCourseIds.has(r.course_id))
    .map((r) => ({
      courseId: r.course_id,
      courseName: r.training_courses?.course_name ?? 'Curso desconocido',
    }));

  return { eligible: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Expiry Alerts
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export async function getCertExpiryAlerts(
  client: Client,
  tenantId: string,
): Promise<CertExpiryAlert[]> {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]!;

  const { data } = await client
    .from('agent_training_logs')
    .select('user_id, expiry_date, training_courses(course_name)')
    .eq('tenant_id', tenantId)
    .lte('expiry_date', thirtyDaysFromNow);

  const userIds = [...new Set((data ?? []).map((d) => d.user_id))];
  const { data: profiles } = userIds.length > 0
    ? await client.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] };
  const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return (data ?? []).map((d) => ({
    agentName: nameMap.get(d.user_id) ?? 'Agente',
    userId: d.user_id,
    courseName: d.training_courses?.course_name ?? '',
    expiryDate: d.expiry_date,
    daysRemaining: daysUntil(d.expiry_date),
  }));
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors/app-error';
import { handleApiError } from '@/lib/errors/error-handler';
import { generatePdfHtml } from '@/lib/pdf/styles';
import { getTenantBranding } from '@/lib/pdf/tenant-branding';

export async function GET(request: NextRequest) {
  try {
    const reportId = request.nextUrl.searchParams.get('report_id');
    if (!reportId) throw new AppError('VALIDATION_ERROR', 'report_id requerido');

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: report } = await supabase.from('shift_change_reports').select('*').eq('id', reportId).maybeSingle();
    if (!report) throw new AppError('NOT_FOUND', 'Reporte no encontrado');

    const { data: membership } = await supabase.from('memberships').select('role').eq('tenant_id', report.tenant_id).eq('user_id', user.id).maybeSingle();
    if (!membership) throw new AppError('FORBIDDEN', 'Sin acceso');

    const branding = await getTenantBranding(supabase, report.tenant_id);

    const { data: events } = await supabase.from('shift_change_events').select('*').eq('report_id', reportId).order('created_at');

    // Resolve names
    const stationIds = [...new Set((events ?? []).map((e) => e.work_station_id))];
    const { data: stations } = stationIds.length > 0 ? await supabase.from('work_stations').select('id, name, properties_ph(name)').in('id', stationIds) : { data: [] };
    const stationMap = new Map((stations ?? []).map((s) => [s.id, { name: s.name, property: (s.properties_ph as { name: string } | null)?.name ?? '' }]));

    const agentIds = new Set<string>();
    for (const e of events ?? []) {
      if (e.programmed_agent_id) agentIds.add(e.programmed_agent_id);
      if (e.actual_agent_id) agentIds.add(e.actual_agent_id);
      if (e.waiting_agent_id) agentIds.add(e.waiting_agent_id);
    }
    const { data: profiles } = agentIds.size > 0 ? await supabase.from('profiles').select('id, full_name').in('id', [...agentIds]) : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
    const getName = (id: string | null) => id ? (nameMap.get(id) ?? 'Agente') : null;

    const dateObj = new Date(report.report_date + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('es-PA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
    const shiftLabel = report.shift_type === 'diurno' ? 'TURNO DIURNO' : 'TURNO NOCTURNO';
    const shiftHours = report.shift_type === 'diurno' ? '06:00 a.m. — 06:00 p.m.' : '06:00 p.m. — 06:00 a.m.';

    const eventTypeLabels: Record<string, string> = {
      ausencia: 'AUSENCIAS', tardanza: 'TARDANZAS', suspension: 'SUSPENSIONES', permiso: 'PERMISOS',
      licencia: 'LICENCIA', induccion: 'INDUCCIONES', incapacidad: 'INCAPACIDADES', turno_especial: 'TURNOS ESPECIALES',
    };

    const grouped: Record<string, typeof events> = {};
    for (const e of events ?? []) {
      if (!grouped[e.event_type]) grouped[e.event_type] = [];
      grouped[e.event_type]!.push(e);
    }

    const allTypes = ['ausencia', 'tardanza', 'suspension', 'permiso', 'licencia', 'induccion', 'incapacidad', 'turno_especial'];
    let sectionsHtml = '';

    for (const type of allTypes) {
      const label = eventTypeLabels[type] ?? type.toUpperCase();
      const items = grouped[type];

      sectionsHtml += `<div class="section"><div class="section-header">${label}</div>`;

      if (!items || items.length === 0) {
        sectionsHtml += '<div class="empty">Ninguna.</div>';
      } else {
        for (const e of items) {
          const st = stationMap.get(e.work_station_id);
          const programmed = getName(e.programmed_agent_id);
          const actual = getName(e.actual_agent_id);
          const waiting = getName(e.waiting_agent_id);

          sectionsHtml += `<div class="event">`;
          sectionsHtml += `<div class="event-header">${st?.property ?? ''}${st?.name ? ' — ' + st.name : ''}</div>`;
          if (programmed) sectionsHtml += `<div class="event-detail">Unidad: ${programmed}</div>`;
          if (e.narrative) sectionsHtml += `<div class="event-narrative">${e.narrative}</div>`;
          if (actual && actual !== programmed) {
            sectionsHtml += `<div class="event-detail">Cubre: <strong>${actual}</strong>`;
            if (e.arrival_time) sectionsHtml += ` — Llegada: ${e.arrival_time}`;
            sectionsHtml += `</div>`;
          }
          if (waiting) sectionsHtml += `<div class="event-detail">En espera: ${waiting}</div>`;
          sectionsHtml += `</div>`;
        }
      }
      sectionsHtml += '</div>';
    }

    // Free personnel
    const freeLines = (report.free_personnel ?? '').split('\n').filter((l: string) => l.trim());
    sectionsHtml += `<div class="section"><div class="section-header">PERSONAL LIBRE DEL ${shiftLabel}</div>`;
    if (freeLines.length === 0) {
      sectionsHtml += '<div class="empty">No especificado.</div>';
    } else {
      sectionsHtml += '<ul>';
      for (const line of freeLines) sectionsHtml += `<li>${line.trim()}</li>`;
      sectionsHtml += '</ul>';
    }
    sectionsHtml += '</div>';

    // Observations
    sectionsHtml += `<div class="section"><div class="section-header">OBSERVACIONES GENERALES</div><div style="font-size:10.5px;color:#475569;line-height:1.6;padding:4px 0;">${report.general_observations || 'Sin observaciones.'}</div></div>`;

    const body = `
      <div style="display:flex;justify-content:space-between;background:#F8FAFB;border-radius:6px;padding:10px 16px;margin-bottom:20px;font-size:10px;">
        <span style="color:#475569;">FECHA: <strong style="color:#0C1528;">${dateStr}</strong></span>
        <span style="color:#475569;">HORARIO: <strong style="color:#0C1528;">${shiftHours}</strong></span>
      </div>
      ${sectionsHtml}`;

    const html = generatePdfHtml({
      title: `INFORME DEL ${shiftLabel}`,
      subtitle: 'Asistencias y Novedades',
      tenantName: branding.name,
      tenantLogoUrl: branding.logoUrl,
      brandingPhone: branding.phone,
      brandingEmail: branding.email,
      brandingWebsite: branding.website,
      date: dateStr,
      body,
    });

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    return handleApiError(error);
  }
}

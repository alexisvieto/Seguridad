import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors/app-error';
import { handleApiError } from '@/lib/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const reportId = request.nextUrl.searchParams.get('report_id');
    if (!reportId) throw new AppError('VALIDATION_ERROR', 'report_id requerido');

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    // Fetch report
    const { data: report } = await supabase
      .from('shift_change_reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();

    if (!report) throw new AppError('NOT_FOUND', 'Reporte no encontrado');

    // Verify membership
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('tenant_id', report.tenant_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) throw new AppError('FORBIDDEN', 'Sin acceso');

    // Fetch tenant name
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', report.tenant_id)
      .maybeSingle();

    // Fetch events
    const { data: events } = await supabase
      .from('shift_change_events')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at');

    // Resolve station names
    const stationIds = [...new Set((events ?? []).map((e) => e.work_station_id))];
    const { data: stations } = stationIds.length > 0
      ? await supabase.from('work_stations').select('id, name, properties_ph(name)').in('id', stationIds)
      : { data: [] };
    const stationMap = new Map((stations ?? []).map((s) => [s.id, {
      name: s.name,
      propertyName: (s.properties_ph as { name: string } | null)?.name ?? '',
    }]));

    // Resolve agent names
    const agentIds = new Set<string>();
    for (const e of events ?? []) {
      if (e.programmed_agent_id) agentIds.add(e.programmed_agent_id);
      if (e.actual_agent_id) agentIds.add(e.actual_agent_id);
      if (e.waiting_agent_id) agentIds.add(e.waiting_agent_id);
    }

    const { data: profiles } = agentIds.size > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', [...agentIds])
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const getName = (id: string | null) => id ? (nameMap.get(id) ?? 'Agente') : null;

    // Group events by type
    const eventTypeLabels: Record<string, string> = {
      ausencia: 'AUSENCIAS',
      tardanza: 'TARDANZAS',
      suspension: 'SUSPENSIONES',
      permiso: 'PERMISOS',
      licencia: 'LICENCIA',
      induccion: 'INDUCCIONES',
      incapacidad: 'INCAPACIDADES',
      turno_especial: 'TURNOS ESPECIALES',
    };

    const grouped: Record<string, typeof events> = {};
    for (const e of events ?? []) {
      if (!grouped[e.event_type]) grouped[e.event_type] = [];
      grouped[e.event_type]!.push(e);
    }

    // Format date
    const dateObj = new Date(report.report_date + 'T12:00:00');
    const dateStr = dateObj.toLocaleDateString('es-PA', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).toUpperCase();

    const shiftLabel = report.shift_type === 'diurno' ? 'TURNO DIURNO' : 'TURNO NOCTURNO';
    const shiftHours = report.shift_type === 'diurno' ? '06:00 a.m. — 06:00 p.m.' : '06:00 p.m. — 06:00 a.m.';

    // Build logo URL
    const proto = request.headers.get('x-forwarded-proto') ?? 'http';
    const host = request.headers.get('host') ?? 'localhost:3000';
    const logoUrl = `${proto}://${host}/nexguard360-logo.png`;

    // Build event sections HTML
    const allTypes = ['ausencia', 'tardanza', 'suspension', 'permiso', 'licencia', 'induccion', 'incapacidad', 'turno_especial'];
    let sectionsHtml = '';

    for (const type of allTypes) {
      const label = eventTypeLabels[type] ?? type.toUpperCase();
      const items = grouped[type];

      sectionsHtml += `<div class="section"><h3>${label}</h3>`;

      if (!items || items.length === 0) {
        sectionsHtml += '<p class="empty">Ninguna.</p>';
      } else {
        for (const e of items) {
          const station = stationMap.get(e.work_station_id);
          const stationName = station?.name ?? '';
          const propertyName = station?.propertyName ?? '';
          const programmed = getName(e.programmed_agent_id);
          const actual = getName(e.actual_agent_id);
          const waiting = getName(e.waiting_agent_id);

          sectionsHtml += `<div class="event">`;
          sectionsHtml += `<p class="event-header"><strong>${propertyName}${stationName ? ', ' + stationName : ''}</strong></p>`;

          if (programmed) {
            sectionsHtml += `<p class="event-detail">Unidad: ${programmed}</p>`;
          }

          if (e.narrative) {
            sectionsHtml += `<p class="event-narrative">${e.narrative}</p>`;
          }

          if (actual && actual !== programmed) {
            sectionsHtml += `<p class="event-detail">En su lugar cubre: <strong>${actual}</strong>`;
            if (e.arrival_time) sectionsHtml += ` — Hora de llegada: ${e.arrival_time}`;
            sectionsHtml += `</p>`;
          }

          if (waiting) {
            sectionsHtml += `<p class="event-detail">Se mantuvo a la espera: ${waiting}</p>`;
          }

          sectionsHtml += `</div>`;
        }
      }

      sectionsHtml += '</div>';
    }

    // Free personnel
    const freeLines = (report.free_personnel ?? '').split('\n').filter((l: string) => l.trim());
    let freeHtml = '<div class="section"><h3>PERSONAL LIBRE DEL ' + shiftLabel + '</h3>';
    if (freeLines.length === 0) {
      freeHtml += '<p class="empty">No especificado.</p>';
    } else {
      freeHtml += '<ul>';
      for (const line of freeLines) {
        freeHtml += `<li>${line.trim()}</li>`;
      }
      freeHtml += '</ul>';
    }
    freeHtml += '</div>';

    // Observations
    const obsHtml = `<div class="section"><h3>OBSERVACIONES GENERAL</h3><p>${report.general_observations || 'Sin observaciones.'}</p></div>`;

    // Full HTML
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe ${shiftLabel} — ${report.report_date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: letter; margin: 20mm; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; background: #fff; line-height: 1.6; font-size: 13px; }
    .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 20px; border-bottom: 3px solid #0C1528; margin-bottom: 24px; }
    .logo { height: 52px; }
    .brand { text-align: right; }
    .brand-name { font-size: 11px; font-weight: 700; color: #0C1528; letter-spacing: 2px; text-transform: uppercase; }
    .brand-slogan { font-size: 9px; color: #888; letter-spacing: 1px; }
    .brand-web { font-size: 9px; color: #10b981; }
    .title-block { text-align: center; margin-bottom: 28px; }
    .title-block h1 { font-size: 18px; font-weight: 800; color: #0C1528; letter-spacing: 3px; text-transform: uppercase; }
    .title-block h2 { font-size: 13px; font-weight: 600; color: #10b981; margin-top: 2px; }
    .meta { display: flex; justify-content: space-between; background: #f4f6f9; border-radius: 8px; padding: 12px 18px; margin-bottom: 24px; font-size: 12px; }
    .meta span { color: #555; }
    .meta strong { color: #1a1a2e; }
    .section { margin-bottom: 20px; }
    .section h3 { font-size: 12px; font-weight: 700; letter-spacing: 2px; color: #0C1528; background: #e8ecf1; padding: 8px 14px; border-radius: 6px; margin-bottom: 10px; text-transform: uppercase; }
    .event { padding: 10px 14px; border-left: 3px solid #10b981; margin-bottom: 10px; background: #fafbfc; border-radius: 0 6px 6px 0; }
    .event-header { font-size: 13px; font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
    .event-detail { font-size: 12px; color: #555; margin-bottom: 2px; }
    .event-narrative { font-size: 12px; color: #333; margin: 6px 0; line-height: 1.6; }
    .empty { font-size: 12px; color: #999; font-style: italic; padding: 6px 14px; }
    ul { padding-left: 20px; }
    li { font-size: 12px; color: #333; margin-bottom: 2px; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 2px solid #e8ecf1; text-align: center; font-size: 10px; color: #aaa; }
    .footer strong { color: #10b981; }
    .tenant-name { font-size: 11px; color: #555; font-weight: 600; margin-bottom: 4px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logoUrl}" alt="NexGuard360" class="logo" />
    <div class="brand">
      <p class="brand-name">NexGuard360</p>
      <p class="brand-slogan">Seguridad Operativa y Control 360</p>
      <p class="brand-web">www.nexguard360.com</p>
    </div>
  </div>

  <div class="title-block">
    <p class="tenant-name">${tenant?.name ?? ''}</p>
    <h1>INFORME DEL ${shiftLabel}</h1>
    <h2>ASISTENCIAS Y NOVEDADES</h2>
  </div>

  <div class="meta">
    <span>FECHA: <strong>${dateStr}</strong></span>
    <span>HORARIO: <strong>${shiftHours}</strong></span>
  </div>

  ${sectionsHtml}
  ${freeHtml}
  ${obsHtml}

  <div class="footer">
    <p>Generado por <strong>NexGuard360</strong> — www.nexguard360.com</p>
    <p>Seguridad Operativa y Control 360</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

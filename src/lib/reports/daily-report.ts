import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, EmergencyContact } from '@/shared/types/database';

type Client = SupabaseClient<Database>;

interface StationIncident {
  station_name: string;
  time: string;
  ai_refined_text: string;
}

interface ReportData {
  property_name: string;
  property_address: string;
  report_date: string;
  contacts: EmergencyContact[];
  stations: Map<string, StationIncident[]>;
  incident_ids: string[];
}

/**
 * Fetches pending incidents for a property from the last 24 hours
 * and builds the structured report data.
 */
export async function generateDailyReportForProperty(
  client: Client,
  propertyId: string,
): Promise<ReportData | null> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: property } = await client
    .from('properties_ph')
    .select('name, address, contact_emergency')
    .eq('id', propertyId)
    .single();

  if (!property) return null;

  const { data: incidents } = await client
    .from('incidents_log')
    .select('id, raw_text, ai_refined_text, created_at, work_stations(name)')
    .eq('am_report_sent', false)
    .gte('created_at', twentyFourHoursAgo)
    .in(
      'work_station_id',
      (await client
        .from('work_stations')
        .select('id')
        .eq('property_id', propertyId)
      ).data?.map((ws) => ws.id) ?? [],
    )
    .order('created_at', { ascending: true });

  if (!incidents || incidents.length === 0) return null;

  const stations = new Map<string, StationIncident[]>();
  const incidentIds: string[] = [];

  for (const incident of incidents) {
    const stationName = incident.work_stations?.name ?? 'Puesto desconocido';
    const time = new Date(incident.created_at).toLocaleTimeString('es-PA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const existing = stations.get(stationName) ?? [];
    existing.push({
      station_name: stationName,
      time,
      ai_refined_text: incident.ai_refined_text ?? incident.raw_text,
    });
    stations.set(stationName, existing);
    incidentIds.push(incident.id);
  }

  const contacts = (property.contact_emergency ?? []) as EmergencyContact[];

  return {
    property_name: property.name,
    property_address: property.address,
    report_date: new Date().toLocaleDateString('es-PA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    contacts,
    stations,
    incident_ids: incidentIds,
  };
}

/**
 * Builds the HTML email for a daily report.
 */
export function buildReportHtml(data: ReportData): string {
  const stationRows = Array.from(data.stations.entries())
    .map(([stationName, incidents]) => {
      const incidentRows = incidents
        .map(
          (inc) => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;white-space:nowrap;vertical-align:top;">
                ${inc.time}
              </td>
              <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#1f2937;line-height:1.5;">
                ${escapeHtml(inc.ai_refined_text)}
              </td>
            </tr>`,
        )
        .join('');

      return `
        <tr>
          <td colspan="2" style="padding:12px;background-color:#f3f4f6;font-weight:600;color:#374151;border-bottom:1px solid #d1d5db;">
            ${escapeHtml(stationName)}
          </td>
        </tr>
        ${incidentRows}`;
    })
    .join('');

  const totalIncidents = Array.from(data.stations.values()).reduce(
    (sum, list) => sum + list.length,
    0,
  );

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:24px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color:#111827;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
        Reporte Diario de Seguridad
      </h1>
      <p style="margin:4px 0 0;color:#9ca3af;font-size:14px;">
        ${escapeHtml(data.report_date)}
      </p>
    </div>

    <!-- Property info -->
    <div style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
      <table style="width:100%;" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7280;font-size:13px;padding-bottom:4px;">Propiedad</td>
        </tr>
        <tr>
          <td style="font-size:18px;font-weight:600;color:#111827;">
            ${escapeHtml(data.property_name)}
          </td>
        </tr>
        <tr>
          <td style="color:#6b7280;font-size:13px;padding-top:2px;">
            ${escapeHtml(data.property_address)}
          </td>
        </tr>
      </table>
    </div>

    <!-- Summary -->
    <div style="padding:16px 32px;background-color:#eff6ff;border-bottom:1px solid #bfdbfe;">
      <p style="margin:0;font-size:14px;color:#1e40af;">
        <strong>${totalIncidents}</strong> novedad${totalIncidents !== 1 ? 'es' : ''} registrada${totalIncidents !== 1 ? 's' : ''} en
        <strong>${data.stations.size}</strong> puesto${data.stations.size !== 1 ? 's' : ''}
      </p>
    </div>

    <!-- Incidents table -->
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #111827;color:#111827;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">
              Hora
            </th>
            <th style="text-align:left;padding:8px 12px;border-bottom:2px solid #111827;color:#111827;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">
              Novedad
            </th>
          </tr>
        </thead>
        <tbody>
          ${stationRows}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        Reporte generado automáticamente — Sistema de Seguridad SaaS
      </p>
    </div>

  </div>
</body>
</html>`;
}

/**
 * Builds an HTML email for properties with zero incidents.
 */
export function buildNoIncidentsHtml(propertyName: string, reportDate: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:640px;margin:24px auto;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background-color:#111827;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
        Reporte Diario de Seguridad
      </h1>
      <p style="margin:4px 0 0;color:#9ca3af;font-size:14px;">
        ${escapeHtml(reportDate)}
      </p>
    </div>
    <div style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
      <p style="font-size:18px;font-weight:600;color:#111827;margin:0;">
        ${escapeHtml(propertyName)}
      </p>
    </div>
    <div style="padding:40px 32px;text-align:center;">
      <p style="font-size:16px;color:#059669;font-weight:600;margin:0;">
        Sin novedades críticas en el perímetro
      </p>
      <p style="font-size:14px;color:#6b7280;margin:8px 0 0;">
        No se registraron incidentes en las últimas 24 horas.
      </p>
    </div>
    <div style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        Reporte generado automáticamente — Sistema de Seguridad SaaS
      </p>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

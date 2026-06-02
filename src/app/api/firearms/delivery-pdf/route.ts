import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors/app-error';
import { handleApiError } from '@/lib/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const assignmentId = request.nextUrl.searchParams.get('id');
    if (!assignmentId) throw new AppError('VALIDATION_ERROR', 'id requerido');

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: assignment } = await supabase
      .from('firearms_assignments')
      .select('*, firearms_inventory(serial_number, type, brand, model, permit_number, permit_expiry_date)')
      .eq('id', assignmentId)
      .maybeSingle();

    if (!assignment) throw new AppError('NOT_FOUND', 'Asignación no encontrada');

    const { data: tenant } = await supabase.from('tenants').select('name').eq('id', assignment.tenant_id).maybeSingle();

    const agentId = assignment.user_id;
    const stationId = assignment.work_station_id;
    const isStationAssignment = !agentId && !!stationId;

    const { data: profile } = agentId
      ? await supabase.from('profiles').select('full_name').eq('id', agentId).maybeSingle()
      : { data: null };
    const { data: hrProfile } = agentId
      ? await supabase.from('hr_agent_profiles').select('cedula').eq('user_id', agentId).eq('tenant_id', assignment.tenant_id).maybeSingle()
      : { data: null };
    const { data: station } = stationId
      ? await supabase.from('work_stations').select('name, properties_ph(name)').eq('id', stationId).maybeSingle()
      : { data: null };

    const firearm = assignment.firearms_inventory as {
      serial_number: string; type: string; brand: string; model: string;
      permit_number: string; permit_expiry_date: string;
    } | null;

    const agentName = profile?.full_name ?? 'Agente';
    const cedula = hrProfile?.cedula ?? 'No registrada';
    const stationName = station?.name ?? 'Puesto';
    const propertyName = (station?.properties_ph as { name: string } | null)?.name ?? '';
    const assignDate = new Date(assignment.assigned_at).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });

    const proto = request.headers.get('x-forwarded-proto') ?? 'http';
    const host = request.headers.get('host') ?? 'localhost:3000';
    const logoUrl = `${proto}://${host}/nexguard360-logo.png`;

    const typeLabels: Record<string, string> = { revolver: 'Revólver', pistola: 'Pistola', escopeta: 'Escopeta' };

    const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>Acta de Entrega de Arma — ${agentName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}@page{size:letter;margin:25mm}
body{font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a2e;background:#fff;line-height:1.7;font-size:13px}
.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:20px;border-bottom:3px solid #0C1528;margin-bottom:30px}
.logo{height:52px}.brand{text-align:right}
.brand-name{font-size:11px;font-weight:700;color:#0C1528;letter-spacing:2px;text-transform:uppercase}
.brand-slogan{font-size:9px;color:#888;letter-spacing:1px}
.brand-web{font-size:9px;color:#84CC16}
.title{text-align:center;margin-bottom:30px}
.title h1{font-size:18px;font-weight:800;color:#0C1528;letter-spacing:2px;text-transform:uppercase}
.title p{font-size:12px;color:#888;margin-top:4px}
.section{margin-bottom:24px}
.section h3{font-size:12px;font-weight:700;letter-spacing:2px;color:#0C1528;background:#e8ecf1;padding:8px 14px;border-radius:6px;margin-bottom:12px;text-transform:uppercase}
.field{display:flex;margin-bottom:8px;font-size:13px}
.field-label{width:180px;color:#666;font-weight:500}
.field-value{color:#1a1a2e;font-weight:600}
.agreement{padding:16px 20px;background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;font-size:12px;color:#444;line-height:1.8;margin-bottom:30px}
.warning{padding:12px 16px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;font-size:12px;color:#92400e;margin-bottom:20px;font-weight:500}
.signatures{display:flex;justify-content:space-between;margin-top:50px;padding-top:20px}
.sig-block{width:45%;text-align:center}
.sig-line{border-top:1px solid #333;padding-top:8px;font-size:12px;color:#333;font-weight:600}
.sig-sub{font-size:10px;color:#888;margin-top:2px}
.footer{margin-top:40px;padding-top:16px;border-top:2px solid #e8ecf1;text-align:center;font-size:10px;color:#aaa}
.footer strong{color:#84CC16}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header">
  <img src="${logoUrl}" alt="NexGuard360" class="logo"/>
  <div class="brand"><p class="brand-name">NexGuard360</p><p class="brand-slogan">Seguridad Operativa y Control 360</p><p class="brand-web">www.nexguard360.com</p></div>
</div>
<div class="title"><h1>Acta de Entrega de Arma de Fuego</h1><p>${tenant?.name ?? ''} — ${assignDate}</p></div>

<div class="warning">DOCUMENTO CONFIDENCIAL — Control de armamento regulado por DIASP, República de Panamá. La posesión y porte de armas de fuego está sujeta a la legislación vigente.</div>

${isStationAssignment ? `
<div class="section"><h3>Datos del Puesto de Custodia</h3>
<div class="field"><span class="field-label">Puesto:</span><span class="field-value">${stationName}</span></div>
<div class="field"><span class="field-label">Propiedad:</span><span class="field-value">${propertyName}</span></div>
<div class="field"><span class="field-label">Empresa:</span><span class="field-value">${tenant?.name ?? ''}</span></div>
<div class="field"><span class="field-label">Fecha de asignación:</span><span class="field-value">${assignDate}</span></div>
<div class="field"><span class="field-label">Modalidad:</span><span class="field-value">Arma compartida — custodia del puesto. Los agentes asignados a este puesto son responsables durante su turno.</span></div>
</div>` : `
<div class="section"><h3>Datos del Agente Receptor</h3>
<div class="field"><span class="field-label">Nombre completo:</span><span class="field-value">${agentName}</span></div>
<div class="field"><span class="field-label">Cédula de identidad:</span><span class="field-value">${cedula}</span></div>
<div class="field"><span class="field-label">Empresa:</span><span class="field-value">${tenant?.name ?? ''}</span></div>
<div class="field"><span class="field-label">Fecha de entrega:</span><span class="field-value">${assignDate}</span></div>
</div>`}

<div class="section"><h3>Datos del Arma de Fuego</h3>
<div class="field"><span class="field-label">Número de serie:</span><span class="field-value">${firearm?.serial_number ?? 'N/A'}</span></div>
<div class="field"><span class="field-label">Tipo:</span><span class="field-value">${typeLabels[firearm?.type ?? ''] ?? firearm?.type ?? 'N/A'}</span></div>
<div class="field"><span class="field-label">Marca:</span><span class="field-value">${firearm?.brand ?? 'N/A'}</span></div>
<div class="field"><span class="field-label">Modelo:</span><span class="field-value">${firearm?.model ?? 'N/A'}</span></div>
<div class="field"><span class="field-label">Número de permiso DIASP:</span><span class="field-value">${firearm?.permit_number ?? 'N/A'}</span></div>
<div class="field"><span class="field-label">Vencimiento del permiso:</span><span class="field-value">${firearm?.permit_expiry_date ? new Date(firearm.permit_expiry_date).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</span></div>
</div>

${isStationAssignment ? `
<div class="section"><h3>Acuerdo de Custodia por Puesto</h3>
<div class="agreement">
Por medio del presente documento, <strong>${tenant?.name ?? ''}</strong> asigna el arma de fuego detallada al puesto <strong>${stationName}</strong> ubicado en <strong>${propertyName}</strong>.<br><br>
Condiciones de custodia:<br>
1. El arma permanecerá en el puesto y será responsabilidad del agente en turno durante su jornada laboral.<br>
2. Cada agente que inicie turno en este puesto asume la custodia del arma durante su horario asignado.<br>
3. Al finalizar el turno, el agente saliente debe verificar que el arma se encuentre en su lugar y en buen estado antes de entregar el puesto al agente entrante.<br>
4. Cualquier pérdida, daño o irregularidad debe reportarse inmediatamente al supervisor de operaciones.<br>
5. Queda prohibido retirar el arma del puesto sin autorización expresa de la gerencia de operaciones.<br>
6. Se cumplirán todas las disposiciones legales vigentes sobre porte y uso de armas de fuego en la República de Panamá.
</div></div>

<div class="signatures">
<div class="sig-block"><p class="sig-line">Supervisor de Operaciones</p><p class="sig-sub">${tenant?.name ?? ''}</p></div>
<div class="sig-block"><p class="sig-line">Responsable de Armería</p><p class="sig-sub">${tenant?.name ?? ''}</p></div>
</div>` : `
<div class="section"><h3>Acuerdo de Custodia y Responsabilidad</h3>
<div class="agreement">
Yo, <strong>${agentName}</strong>, identificado(a) con cédula <strong>${cedula}</strong>, declaro haber recibido de parte de <strong>${tenant?.name ?? ''}</strong> el arma de fuego detallada en el presente documento.<br><br>
Me comprometo a:<br>
1. Portar el arma exclusivamente durante el ejercicio de mis funciones laborales asignadas.<br>
2. Mantener el arma en condiciones óptimas de conservación y funcionamiento.<br>
3. No ceder, prestar ni transferir el arma a terceros bajo ninguna circunstancia.<br>
4. Reportar inmediatamente cualquier pérdida, hurto, robo o uso indebido del arma.<br>
5. Devolver el arma al finalizar mi turno o cuando la empresa lo requiera.<br>
6. Cumplir con todas las disposiciones legales vigentes sobre porte y uso de armas de fuego en la República de Panamá.<br><br>
En caso de pérdida, daño por negligencia o uso indebido, acepto la responsabilidad civil y penal correspondiente, así como el descuento del valor de reposición de mi liquidación o salario conforme al Código de Trabajo.
</div></div>

<div class="signatures">
<div class="sig-block"><p class="sig-line">${agentName}</p><p class="sig-sub">Cédula: ${cedula}</p><p class="sig-sub">Agente Receptor</p></div>
<div class="sig-block"><p class="sig-line">Operaciones ${tenant?.name ?? ''}</p><p class="sig-sub">Responsable de Armería</p></div>
</div>`}

<div class="footer"><p>Generado por <strong>NexGuard360</strong> — www.nexguard360.com</p><p>Seguridad Operativa y Control 360</p></div>
</body></html>`;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors/app-error';
import { handleApiError } from '@/lib/errors/error-handler';
import { generatePdfHtml } from '@/lib/pdf/styles';
import { getTenantBranding } from '@/lib/pdf/tenant-branding';

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

    const branding = await getTenantBranding(supabase, assignment.tenant_id);

    const agentId = assignment.user_id;
    const stationId = assignment.work_station_id;
    const isStation = !agentId && !!stationId;

    const { data: profile } = agentId ? await supabase.from('profiles').select('full_name').eq('id', agentId).maybeSingle() : { data: null };
    const { data: hrProfile } = agentId ? await supabase.from('hr_agent_profiles').select('cedula').eq('user_id', agentId).eq('tenant_id', assignment.tenant_id).maybeSingle() : { data: null };
    const { data: station } = stationId ? await supabase.from('work_stations').select('name, properties_ph(name)').eq('id', stationId).maybeSingle() : { data: null };

    const firearm = assignment.firearms_inventory as { serial_number: string; type: string; brand: string; model: string; permit_number: string; permit_expiry_date: string } | null;
    const agentName = profile?.full_name ?? 'Agente';
    const cedula = hrProfile?.cedula ?? 'No registrada';
    const stationName = station?.name ?? 'Puesto';
    const propertyName = (station?.properties_ph as { name: string } | null)?.name ?? '';
    const assignDate = new Date(assignment.assigned_at).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });

    const typeLabels: Record<string, string> = { revolver: 'Revólver', pistola: 'Pistola', escopeta: 'Escopeta' };

    const recipientSection = isStation ? `
      <div class="section">
        <div class="section-header">Puesto de Custodia</div>
        <div class="field-grid">
          <div class="field"><div class="field-label">Puesto</div><div class="field-value">${stationName}</div></div>
          <div class="field"><div class="field-label">Propiedad</div><div class="field-value">${propertyName}</div></div>
          <div class="field"><div class="field-label">Empresa</div><div class="field-value">${branding.name}</div></div>
          <div class="field"><div class="field-label">Modalidad</div><div class="field-value">Arma compartida — custodia del puesto</div></div>
        </div>
      </div>` : `
      <div class="section">
        <div class="section-header">Agente Receptor</div>
        <div class="field-grid">
          <div class="field"><div class="field-label">Nombre</div><div class="field-value">${agentName}</div></div>
          <div class="field"><div class="field-label">Cédula</div><div class="field-value">${cedula}</div></div>
          <div class="field"><div class="field-label">Empresa</div><div class="field-value">${branding.name}</div></div>
          <div class="field"><div class="field-label">Fecha</div><div class="field-value">${assignDate}</div></div>
        </div>
      </div>`;

    const weaponSection = `
      <div class="section">
        <div class="section-header">Datos del Arma de Fuego</div>
        <div class="field-grid">
          <div class="field"><div class="field-label">Número de Serie</div><div class="field-value" style="font-family:Courier,monospace;">${firearm?.serial_number ?? 'N/A'}</div></div>
          <div class="field"><div class="field-label">Tipo</div><div class="field-value">${typeLabels[firearm?.type ?? ''] ?? 'N/A'}</div></div>
          <div class="field"><div class="field-label">Marca</div><div class="field-value">${firearm?.brand ?? 'N/A'}</div></div>
          <div class="field"><div class="field-label">Modelo</div><div class="field-value">${firearm?.model ?? 'N/A'}</div></div>
          <div class="field"><div class="field-label">Permiso ${branding.regulatoryEntity}</div><div class="field-value">${firearm?.permit_number ?? 'N/A'}</div></div>
          <div class="field"><div class="field-label">Vencimiento</div><div class="field-value">${firearm?.permit_expiry_date ? new Date(firearm.permit_expiry_date).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A'}</div></div>
        </div>
      </div>`;

    const agreement = isStation ? `
      <div class="section">
        <div class="section-header">Acuerdo de Custodia por Puesto</div>
        <div class="agreement">
          Por medio del presente, <strong>${branding.name}</strong> asigna el arma de fuego detallada al puesto <strong>${stationName}</strong> en <strong>${propertyName}</strong>.<br/><br/>
          1. El arma es responsabilidad del agente en turno durante su jornada.<br/>
          2. Al finalizar turno, el agente saliente verifica estado del arma antes de entregar.<br/>
          3. Queda prohibido retirar el arma del puesto sin autorización de gerencia.<br/>
          4. Cualquier irregularidad debe reportarse inmediatamente al supervisor.<br/>
          5. Se cumplirán las disposiciones de ${branding.regulatoryEntity} vigentes.
        </div>
      </div>
      <div class="signatures">
        <div class="sig-block"><div class="sig-line">Supervisor de Operaciones</div><div class="sig-sub">${branding.name}</div></div>
        <div class="sig-block"><div class="sig-line">Responsable de Armería</div><div class="sig-sub">${branding.name}</div></div>
      </div>` : `
      <div class="section">
        <div class="section-header">Acuerdo de Custodia y Responsabilidad</div>
        <div class="agreement">
          Yo, <strong>${agentName}</strong>, cédula <strong>${cedula}</strong>, declaro recibir el arma detallada de parte de <strong>${branding.name}</strong>.<br/><br/>
          1. Portar el arma exclusivamente durante funciones laborales.<br/>
          2. Mantener en condiciones óptimas de conservación.<br/>
          3. No ceder, prestar ni transferir a terceros.<br/>
          4. Reportar pérdida, hurto o uso indebido inmediatamente.<br/>
          5. Devolver al finalizar turno o cuando la empresa lo requiera.<br/>
          6. Cumplir disposiciones de ${branding.regulatoryEntity} vigentes.<br/><br/>
          En caso de pérdida o daño por negligencia, acepto la responsabilidad civil y penal correspondiente.
        </div>
      </div>
      <div class="signatures">
        <div class="sig-block"><div class="sig-line">${agentName}</div><div class="sig-sub">Cédula: ${cedula}</div></div>
        <div class="sig-block"><div class="sig-line">Responsable de Armería</div><div class="sig-sub">${branding.name}</div></div>
      </div>`;

    const html = generatePdfHtml({
      title: 'Acta de Entrega de Arma de Fuego',
      subtitle: `${branding.name} — ${assignDate}`,
      tenantName: branding.name,
      tenantLogoUrl: branding.logoUrl,
      brandingPhone: branding.phone,
      brandingEmail: branding.email,
      brandingWebsite: branding.website,
      date: assignDate,
      warning: `DOCUMENTO CONFIDENCIAL — Control de armamento regulado por ${branding.regulatoryEntity}. La posesión y porte de armas está sujeta a la legislación vigente.`,
      body: `${recipientSection}${weaponSection}${agreement}`,
    });

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    return handleApiError(error);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors/app-error';
import { handleApiError } from '@/lib/errors/error-handler';
import { generatePdfHtml } from '@/lib/pdf/styles';
import { getTenantBranding } from '@/lib/pdf/tenant-branding';

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get('tenant_slug');
    const loanId = request.nextUrl.searchParams.get('loan_id');
    if (!tenantSlug) throw new AppError('VALIDATION_ERROR', 'tenant_slug requerido');

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    if (!tenant) throw new AppError('NOT_FOUND', 'Tenant no encontrado');

    const branding = await getTenantBranding(supabase, tenant.id);
    const today = new Date().toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });

    // Single loan PDF
    if (loanId) {
      const { data: loan } = await supabase.from('agent_equipment_loans').select('*').eq('id', loanId).eq('tenant_id', tenant.id).maybeSingle();
      if (!loan) throw new AppError('NOT_FOUND', 'Entrega no encontrada');

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', loan.user_id).maybeSingle();
      const { data: hrProfile } = await supabase.from('hr_agent_profiles').select('cedula').eq('user_id', loan.user_id).eq('tenant_id', tenant.id).maybeSingle();
      const { data: item } = await supabase.from('inventory_items').select('item_name, category, size_or_model').eq('id', loan.item_id).maybeSingle();

      const agentName = profile?.full_name ?? 'Agente';
      const cedula = hrProfile?.cedula ?? 'No registrada';
      const loanDate = new Date(loan.loan_date).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });

      const body = `
        <div class="section">
          <div class="section-header">Agente Receptor</div>
          <div class="field-grid">
            <div class="field"><div class="field-label">Nombre</div><div class="field-value">${agentName}</div></div>
            <div class="field"><div class="field-label">Cédula</div><div class="field-value">${cedula}</div></div>
            <div class="field"><div class="field-label">Empresa</div><div class="field-value">${branding.name}</div></div>
            <div class="field"><div class="field-label">Fecha</div><div class="field-value">${loanDate}</div></div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">Equipo Entregado</div>
          <div class="field-grid">
            <div class="field"><div class="field-label">Artículo</div><div class="field-value">${item?.item_name ?? 'N/A'}</div></div>
            <div class="field"><div class="field-label">Categoría</div><div class="field-value">${item?.category ?? 'N/A'}</div></div>
            ${item?.size_or_model ? `<div class="field"><div class="field-label">Talla / Modelo</div><div class="field-value">${item.size_or_model}</div></div>` : ''}
            <div class="field"><div class="field-label">Cantidad</div><div class="field-value">${loan.quantity}</div></div>
            <div class="field"><div class="field-label">Estado</div><div class="field-value">Nuevo / Buen estado</div></div>
          </div>
        </div>

        <div class="section">
          <div class="section-header">Acuerdo de Responsabilidad</div>
          <div class="agreement">
            Yo, <strong>${agentName}</strong>, cédula <strong>${cedula}</strong>, declaro recibir los artículos detallados en perfecto estado.<br/><br/>
            1. Utilizar exclusivamente para funciones laborales asignadas.<br/>
            2. Mantener en buen estado de conservación.<br/>
            3. Reportar pérdida o daño inmediatamente.<br/>
            4. Devolver en las mismas condiciones al momento de desvinculación o cuando la empresa lo requiera.<br/><br/>
            En caso de pérdida o daño por negligencia, el costo podrá ser descontado conforme a la legislación laboral vigente.
          </div>
        </div>

        <div class="signatures">
          <div class="sig-block"><div class="sig-line">${agentName}</div><div class="sig-sub">Cédula: ${cedula}</div></div>
          <div class="sig-block"><div class="sig-line">Operaciones</div><div class="sig-sub">${branding.name}</div></div>
        </div>`;

      const html = generatePdfHtml({
        title: 'Acta de Entrega de Equipo',
        subtitle: `${branding.name} — ${loanDate}`,
        tenantName: branding.name,
        tenantLogoUrl: branding.logoUrl,
        brandingPhone: branding.phone,
        brandingEmail: branding.email,
        brandingWebsite: branding.website,
        date: loanDate,
        body,
      });

      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Bulk export
    const { data: loans } = await supabase.from('agent_equipment_loans').select('id, user_id, item_id, quantity, loan_date, status').eq('tenant_id', tenant.id).order('loan_date', { ascending: false });

    const userIds = [...new Set((loans ?? []).map((l) => l.user_id))];
    const itemIds = [...new Set((loans ?? []).map((l) => l.item_id))];

    const { data: profiles } = userIds.length > 0 ? await supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const { data: items } = itemIds.length > 0 ? await supabase.from('inventory_items').select('id, item_name').in('id', itemIds) : { data: [] };
    const itemMap = new Map((items ?? []).map((i) => [i.id, i.item_name]));

    const statusLabel = (s: string) => s === 'entregado' ? 'Entregado' : s === 'devuelto' ? 'Devuelto' : 'Descontado';
    const statusCls = (s: string) => s === 'entregado' ? 'badge-success' : s === 'devuelto' ? 'badge-info' : 'badge-danger';

    let rows = '';
    for (const l of loans ?? []) {
      const date = new Date(l.loan_date).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
      rows += `<tr><td>${date}</td><td style="font-weight:600;">${nameMap.get(l.user_id) ?? 'Agente'}</td><td>${itemMap.get(l.item_id) ?? 'Artículo'}</td><td style="text-align:center;">${l.quantity}</td><td style="text-align:center;"><span class="badge ${statusCls(l.status)}">${statusLabel(l.status)}</span></td></tr>`;
    }

    const body = `
      <table>
        <thead><tr><th>Fecha</th><th>Agente</th><th>Artículo</th><th style="text-align:center;">Cant.</th><th style="text-align:center;">Estado</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="empty">Sin entregas registradas</td></tr>'}</tbody>
      </table>`;

    const html = generatePdfHtml({
      title: 'Registro General de Entregas de Equipo',
      subtitle: branding.name,
      tenantName: branding.name,
      tenantLogoUrl: branding.logoUrl,
      brandingPhone: branding.phone,
      brandingEmail: branding.email,
      date: today,
      body,
    });

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    return handleApiError(error);
  }
}

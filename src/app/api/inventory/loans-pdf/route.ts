import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors/app-error';
import { handleApiError } from '@/lib/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get('tenant_slug');
    const loanId = request.nextUrl.searchParams.get('loan_id');
    if (!tenantSlug) throw new AppError('VALIDATION_ERROR', 'tenant_slug requerido');

    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new AppError('UNAUTHORIZED', 'No autenticado');

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('slug', tenantSlug)
      .maybeSingle();
    if (!tenant) throw new AppError('NOT_FOUND', 'Tenant no encontrado');

    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership) throw new AppError('FORBIDDEN', 'Sin acceso');

    const proto = request.headers.get('x-forwarded-proto') ?? 'http';
    const host = request.headers.get('host') ?? 'localhost:3000';
    const logoUrl = `${proto}://${host}/nexguard360-logo.png`;
    const today = new Date().toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });

    // Single loan PDF
    if (loanId) {
      const { data: loan } = await supabase
        .from('agent_equipment_loans')
        .select('*')
        .eq('id', loanId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (!loan) throw new AppError('NOT_FOUND', 'Entrega no encontrada');

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', loan.user_id).maybeSingle();
      const { data: hrProfile } = await supabase.from('hr_agent_profiles').select('cedula').eq('user_id', loan.user_id).eq('tenant_id', tenant.id).maybeSingle();
      const { data: item } = await supabase.from('inventory_items').select('item_name, category, size_or_model').eq('id', loan.item_id).maybeSingle();

      const agentName = profile?.full_name ?? 'Agente';
      const cedula = hrProfile?.cedula ?? 'No registrada';
      const loanDate = new Date(loan.loan_date).toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' });

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Acta de Entrega — ${agentName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    @page{size:letter;margin:25mm}
    body{font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a2e;background:#fff;line-height:1.7;font-size:13px}
    .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:20px;border-bottom:3px solid #0C1528;margin-bottom:30px}
    .logo{height:52px}
    .brand{text-align:right}
    .brand-name{font-size:11px;font-weight:700;color:#0C1528;letter-spacing:2px;text-transform:uppercase}
    .brand-slogan{font-size:9px;color:#888;letter-spacing:1px}
    .brand-web{font-size:9px;color:#10b981}
    .title{text-align:center;margin-bottom:30px}
    .title h1{font-size:18px;font-weight:800;color:#0C1528;letter-spacing:2px;text-transform:uppercase}
    .title p{font-size:12px;color:#888;margin-top:4px}
    .section{margin-bottom:24px}
    .section h3{font-size:12px;font-weight:700;letter-spacing:2px;color:#0C1528;background:#e8ecf1;padding:8px 14px;border-radius:6px;margin-bottom:12px;text-transform:uppercase}
    .field{display:flex;margin-bottom:8px;font-size:13px}
    .field-label{width:160px;color:#666;font-weight:500}
    .field-value{color:#1a1a2e;font-weight:600}
    .agreement{padding:16px 20px;background:#f8f9fb;border:1px solid #e2e6ed;border-radius:8px;font-size:12px;color:#444;line-height:1.8;margin-bottom:30px}
    .signatures{display:flex;justify-content:space-between;margin-top:50px;padding-top:20px}
    .sig-block{width:45%;text-align:center}
    .sig-line{border-top:1px solid #333;padding-top:8px;font-size:12px;color:#333;font-weight:600}
    .sig-sub{font-size:10px;color:#888;margin-top:2px}
    .footer{margin-top:40px;padding-top:16px;border-top:2px solid #e8ecf1;text-align:center;font-size:10px;color:#aaa}
    .footer strong{color:#10b981}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
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

  <div class="title">
    <h1>Acta de Entrega de Equipo</h1>
    <p>${tenant.name} — ${loanDate}</p>
  </div>

  <div class="section">
    <h3>Datos del Agente Receptor</h3>
    <div class="field"><span class="field-label">Nombre completo:</span><span class="field-value">${agentName}</span></div>
    <div class="field"><span class="field-label">Cédula de identidad:</span><span class="field-value">${cedula}</span></div>
    <div class="field"><span class="field-label">Empresa:</span><span class="field-value">${tenant.name}</span></div>
    <div class="field"><span class="field-label">Fecha de entrega:</span><span class="field-value">${loanDate}</span></div>
  </div>

  <div class="section">
    <h3>Detalle del Equipo Entregado</h3>
    <div class="field"><span class="field-label">Artículo:</span><span class="field-value">${item?.item_name ?? 'N/A'}</span></div>
    <div class="field"><span class="field-label">Categoría:</span><span class="field-value">${item?.category ?? 'N/A'}</span></div>
    ${item?.size_or_model ? `<div class="field"><span class="field-label">Talla / Modelo:</span><span class="field-value">${item.size_or_model}</span></div>` : ''}
    <div class="field"><span class="field-label">Cantidad:</span><span class="field-value">${loan.quantity}</span></div>
    <div class="field"><span class="field-label">Estado al momento de entrega:</span><span class="field-value">Nuevo / Buen estado</span></div>
  </div>

  <div class="section">
    <h3>Acuerdo de Responsabilidad</h3>
    <div class="agreement">
      Yo, <strong>${agentName}</strong>, identificado(a) con cédula <strong>${cedula}</strong>,
      declaro haber recibido de parte de <strong>${tenant.name}</strong> los artículos detallados en el presente documento
      en perfecto estado de funcionamiento y conservación.<br><br>
      Me comprometo a:<br>
      1. Utilizar el equipo entregado exclusivamente para las funciones laborales asignadas.<br>
      2. Mantener el equipo en buen estado de conservación y funcionamiento.<br>
      3. Reportar inmediatamente cualquier daño, pérdida o hurto del equipo.<br>
      4. Devolver el equipo en las mismas condiciones al momento de la desvinculación laboral o cuando la empresa lo requiera.<br><br>
      En caso de pérdida, daño por negligencia o uso indebido, acepto que el costo de reposición o reparación podrá ser
      descontado de mi liquidación o salario, conforme a lo establecido en el Código de Trabajo de la República de Panamá.
    </div>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <p class="sig-line">${agentName}</p>
      <p class="sig-sub">Cédula: ${cedula}</p>
      <p class="sig-sub">Agente Receptor</p>
    </div>
    <div class="sig-block">
      <p class="sig-line">Operaciones ${tenant.name}</p>
      <p class="sig-sub">Responsable de Entrega</p>
    </div>
  </div>

  <div class="footer">
    <p>Generado por <strong>NexGuard360</strong> — www.nexguard360.com</p>
    <p>Seguridad Operativa y Control 360</p>
  </div>
</body>
</html>`;

      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // Bulk export — all loans
    const { data: loans } = await supabase
      .from('agent_equipment_loans')
      .select('id, user_id, item_id, quantity, loan_date, status')
      .eq('tenant_id', tenant.id)
      .order('loan_date', { ascending: false });

    const userIds = [...new Set((loans ?? []).map((l) => l.user_id))];
    const itemIds = [...new Set((loans ?? []).map((l) => l.item_id))];

    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds) : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const { data: items } = itemIds.length > 0
      ? await supabase.from('inventory_items').select('id, item_name').in('id', itemIds) : { data: [] };
    const itemMap = new Map((items ?? []).map((i) => [i.id, i.item_name]));

    const statusLabel = (s: string) => s === 'entregado' ? 'Entregado' : s === 'devuelto' ? 'Devuelto' : 'Descontado';
    const statusColor = (s: string) => s === 'entregado' ? '#10D080' : s === 'devuelto' ? '#3B82F6' : '#EF4444';

    let rowsHtml = '';
    for (const l of loans ?? []) {
      const date = new Date(l.loan_date).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
      rowsHtml += `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf1;font-size:12px;color:#555">${date}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf1;font-size:13px;color:#1a1a2e;font-weight:600">${nameMap.get(l.user_id) ?? 'Agente'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf1;font-size:12px;color:#333">${itemMap.get(l.item_id) ?? 'Artículo'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf1;text-align:center">${l.quantity}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf1;text-align:center">
          <span style="padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;color:${statusColor(l.status)};background:${statusColor(l.status)}1A">${statusLabel(l.status)}</span>
        </td></tr>`;
    }

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Registro de Entregas — ${tenant.name}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}@page{size:letter;margin:20mm}body{font-family:'Segoe UI',system-ui,sans-serif;color:#1a1a2e;background:#fff;line-height:1.6;font-size:13px}.header{display:flex;align-items:center;justify-content:space-between;padding-bottom:20px;border-bottom:3px solid #0C1528;margin-bottom:24px}.logo{height:52px}.brand{text-align:right}.brand-name{font-size:11px;font-weight:700;color:#0C1528;letter-spacing:2px;text-transform:uppercase}.brand-slogan{font-size:9px;color:#888;letter-spacing:1px}.brand-web{font-size:9px;color:#10b981}.title{text-align:center;margin-bottom:24px}.title h1{font-size:18px;font-weight:800;color:#0C1528;letter-spacing:2px;text-transform:uppercase}.title p{font-size:12px;color:#888;margin-top:4px}table{width:100%;border-collapse:collapse}th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;letter-spacing:1px;color:#0C1528;background:#e8ecf1;text-transform:uppercase}.footer{margin-top:32px;padding-top:16px;border-top:2px solid #e8ecf1;text-align:center;font-size:10px;color:#aaa}.footer strong{color:#10b981}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<div class="header"><img src="${logoUrl}" alt="NexGuard360" class="logo"/><div class="brand"><p class="brand-name">NexGuard360</p><p class="brand-slogan">Seguridad Operativa y Control 360</p><p class="brand-web">www.nexguard360.com</p></div></div>
<div class="title"><h1>Registro General de Entregas</h1><p>${tenant.name} — Generado el ${today}</p></div>
<table><thead><tr><th>Fecha</th><th>Agente</th><th>Artículo</th><th style="text-align:center">Cant.</th><th style="text-align:center">Estado</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#999">Sin entregas</td></tr>'}</tbody></table>
<div class="footer"><p>Generado por <strong>NexGuard360</strong> — www.nexguard360.com</p><p>Seguridad Operativa y Control 360</p></div></body></html>`;

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  } catch (error) {
    return handleApiError(error);
  }
}

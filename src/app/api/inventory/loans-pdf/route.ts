import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/errors/app-error';
import { handleApiError } from '@/lib/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const tenantSlug = request.nextUrl.searchParams.get('tenant_slug');
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

    const { data: loans } = await supabase
      .from('agent_equipment_loans')
      .select('id, user_id, item_id, quantity, loan_date, status')
      .eq('tenant_id', tenant.id)
      .order('loan_date', { ascending: false });

    const userIds = [...new Set((loans ?? []).map((l) => l.user_id))];
    const itemIds = [...new Set((loans ?? []).map((l) => l.item_id))];

    const { data: profiles } = userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
      : { data: [] };
    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const { data: items } = itemIds.length > 0
      ? await supabase.from('inventory_items').select('id, item_name, category').in('id', itemIds)
      : { data: [] };
    const itemMap = new Map((items ?? []).map((i) => [i.id, { name: i.item_name, category: i.category }]));

    const proto = request.headers.get('x-forwarded-proto') ?? 'http';
    const host = request.headers.get('host') ?? 'localhost:3000';
    const logoUrl = `${proto}://${host}/nexguard360-logo.png`;

    const statusLabel = (s: string) => s === 'entregado' ? 'Entregado' : s === 'devuelto' ? 'Devuelto' : 'Descontado por pérdida';
    const statusColor = (s: string) => s === 'entregado' ? '#10D080' : s === 'devuelto' ? '#3B82F6' : '#EF4444';

    let rowsHtml = '';
    for (const l of loans ?? []) {
      const item = itemMap.get(l.item_id);
      const date = new Date(l.loan_date).toLocaleDateString('es-PA', { day: '2-digit', month: 'short', year: 'numeric' });
      rowsHtml += `<tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf1;font-size:12px;color:#555;">${date}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf1;font-size:13px;color:#1a1a2e;font-weight:600;">${nameMap.get(l.user_id) ?? 'Agente'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf1;font-size:12px;color:#333;">${item?.name ?? 'Artículo'}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf1;font-size:12px;color:#333;text-align:center;">${l.quantity}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e8ecf1;text-align:center;">
          <span style="display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:600;color:${statusColor(l.status)};background:${statusColor(l.status)}1A;">${statusLabel(l.status)}</span>
        </td>
      </tr>`;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Registro de Entregas — ${tenant.name}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size:letter; margin:20mm; }
    body { font-family:'Segoe UI',system-ui,sans-serif; color:#1a1a2e; background:#fff; line-height:1.6; font-size:13px; }
    .header { display:flex; align-items:center; justify-content:space-between; padding-bottom:20px; border-bottom:3px solid #0C1528; margin-bottom:24px; }
    .logo { height:52px; }
    .brand { text-align:right; }
    .brand-name { font-size:11px; font-weight:700; color:#0C1528; letter-spacing:2px; text-transform:uppercase; }
    .brand-slogan { font-size:9px; color:#888; letter-spacing:1px; }
    .brand-web { font-size:9px; color:#10b981; }
    .title { text-align:center; margin-bottom:24px; }
    .title h1 { font-size:18px; font-weight:800; color:#0C1528; letter-spacing:2px; text-transform:uppercase; }
    .title p { font-size:12px; color:#888; margin-top:4px; }
    table { width:100%; border-collapse:collapse; }
    th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; letter-spacing:1px; color:#0C1528; background:#e8ecf1; text-transform:uppercase; }
    .footer { margin-top:32px; padding-top:16px; border-top:2px solid #e8ecf1; text-align:center; font-size:10px; color:#aaa; }
    .footer strong { color:#10b981; }
    .disclaimer { margin-top:24px; padding:12px 16px; background:#f4f6f9; border-radius:8px; font-size:11px; color:#555; line-height:1.7; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
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
    <h1>Registro de Entregas de Equipo</h1>
    <p>${tenant.name} — Generado el ${new Date().toLocaleDateString('es-PA', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Agente</th>
        <th>Artículo</th>
        <th style="text-align:center;">Cant.</th>
        <th style="text-align:center;">Estado</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="5" style="padding:20px;text-align:center;color:#999;">Sin entregas registradas</td></tr>'}
    </tbody>
  </table>

  <div class="disclaimer">
    <strong>Nota legal:</strong> Este documento constituye un registro oficial de las entregas de equipo realizadas a los agentes de seguridad.
    Cada entrega fue confirmada mediante firma digital del agente receptor. En caso de pérdida o daño del equipo entregado,
    este registro sirve como evidencia para el deslinde de responsabilidades conforme a la legislación laboral de la República de Panamá.
  </div>

  <div class="footer">
    <p>Generado por <strong>NexGuard360</strong> — www.nexguard360.com</p>
    <p>Seguridad Operativa y Control 360</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

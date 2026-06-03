export const pdfColors = {
  bg: '#FFFFFF',
  surface: '#F8FAFB',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  primary: '#0C1528',
  secondary: '#475569',
  muted: '#94A3B8',
  accent: '#84CC16',
  accentDark: '#4D7C0F',
  danger: '#DC2626',
  warning: '#F59E0B',
  success: '#16A34A',
} as const;

export const pdfFonts = {
  heading: 'Helvetica-Bold',
  body: 'Helvetica',
  mono: 'Courier',
} as const;

export function generatePdfHtml({
  title,
  subtitle,
  tenantName,
  tenantLogoUrl,
  brandingPhone,
  brandingEmail,
  brandingWebsite,
  reportNumber,
  date,
  body,
  warning,
  footer,
}: {
  title: string;
  subtitle?: string;
  tenantName: string;
  tenantLogoUrl?: string | null;
  brandingPhone?: string;
  brandingEmail?: string;
  brandingWebsite?: string;
  reportNumber?: string;
  date: string;
  body: string;
  warning?: string;
  footer?: string;
}): string {
  const logoHtml = tenantLogoUrl
    ? `<img src="${tenantLogoUrl}" alt="${tenantName}" style="height:56px;max-width:260px;object-fit:contain;" />`
    : `<div style="font-family:Helvetica-Bold,Helvetica,sans-serif;font-size:16px;font-weight:800;color:${pdfColors.primary};letter-spacing:0.5px;">${tenantName}</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${title} — ${tenantName}</title>
<style>
  @page { size: letter; margin: 22mm 20mm 20mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: ${pdfColors.primary}; background: ${pdfColors.bg}; line-height: 1.6; font-size: 13px; }

  /* Header */
  .header { display: flex; align-items: flex-start; justify-content: space-between; padding-bottom: 16px; border-bottom: 2px solid ${pdfColors.primary}; margin-bottom: 24px; }
  .header-left { display: flex; flex-direction: column; gap: 4px; }
  .header-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .header-right .meta { font-size: 9px; color: ${pdfColors.muted}; letter-spacing: 0.3px; }

  /* Title block */
  .title-block { text-align: center; margin-bottom: 22px; padding: 16px 0; }
  .title-block h1 { font-size: 18px; font-weight: 800; color: ${pdfColors.primary}; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 3px; }
  .title-block .sub { font-size: 12px; color: ${pdfColors.secondary}; }

  /* Warning box */
  .warning-box { padding: 10px 14px; background: #FEF3C7; border-left: 3px solid ${pdfColors.warning}; border-radius: 4px; font-size: 9.5px; color: #92400E; margin-bottom: 20px; line-height: 1.5; }

  /* Sections */
  .section { margin-bottom: 18px; }
  .section-header { font-size: 11px; font-weight: 700; letter-spacing: 1.8px; color: ${pdfColors.accent}; text-transform: uppercase; padding-bottom: 6px; border-bottom: 1px solid ${pdfColors.borderLight}; margin-bottom: 10px; }

  /* Field rows */
  .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  .field { display: flex; flex-direction: column; padding: 6px 0; }
  .field-label { font-size: 10px; font-weight: 600; color: ${pdfColors.muted}; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 2px; }
  .field-value { font-size: 13px; font-weight: 600; color: ${pdfColors.primary}; }
  .field-full { grid-column: 1 / -1; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  thead th { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: ${pdfColors.secondary}; text-transform: uppercase; text-align: left; padding: 8px 10px; border-bottom: 2px solid ${pdfColors.border}; }
  tbody td { padding: 10px 12px; font-size: 12px; border-bottom: 1px solid ${pdfColors.borderLight}; color: ${pdfColors.primary}; }
  tbody tr:nth-child(even) { background: ${pdfColors.surface}; }

  /* Status badge */
  .badge { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; }
  .badge-success { background: #DCFCE7; color: #166534; }
  .badge-warning { background: #FEF3C7; color: #92400E; }
  .badge-danger { background: #FEE2E2; color: #991B1B; }
  .badge-info { background: #DBEAFE; color: #1E40AF; }

  /* Agreement box */
  .agreement { padding: 16px 20px; background: ${pdfColors.surface}; border: 1px solid ${pdfColors.border}; border-radius: 6px; font-size: 12px; color: ${pdfColors.secondary}; line-height: 1.7; margin-bottom: 20px; }
  .agreement strong { color: ${pdfColors.primary}; }

  /* Signatures */
  .signatures { display: flex; justify-content: space-between; margin-top: 24px; padding-top: 0; }
  .sig-block { width: 42%; text-align: center; }
  .sig-line { border-top: 1px solid ${pdfColors.primary}; padding-top: 8px; font-size: 12px; font-weight: 700; color: ${pdfColors.primary}; }
  .sig-sub { font-size: 10px; color: ${pdfColors.muted}; margin-top: 2px; letter-spacing: 0.3px; }

  /* Event blocks (for shift change reports) */
  .event { padding: 10px 12px; border-left: 3px solid ${pdfColors.accent}; margin-bottom: 8px; background: ${pdfColors.surface}; border-radius: 0 4px 4px 0; }
  .event-header { font-size: 13px; font-weight: 700; color: ${pdfColors.primary}; margin-bottom: 3px; }
  .event-detail { font-size: 12px; color: ${pdfColors.secondary}; margin-bottom: 1px; }
  .event-narrative { font-size: 12px; color: ${pdfColors.primary}; margin: 5px 0; line-height: 1.6; }

  /* Empty state */
  .empty { font-size: 12px; color: ${pdfColors.muted}; font-style: italic; padding: 6px 12px; }

  /* List */
  ul { padding-left: 16px; }
  li { font-size: 12px; color: ${pdfColors.primary}; margin-bottom: 3px; }

  /* Footer */
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid ${pdfColors.border}; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 10px; color: ${pdfColors.muted}; }
  .footer-right { font-size: 10px; color: ${pdfColors.accent}; font-weight: 600; letter-spacing: 0.3px; }

  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  @media screen {
    body { max-width: 800px; margin: 20px auto; padding: 40px; border: 1px solid #E2E8F0; border-radius: 8px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .no-print { position: fixed; top: 16px; right: 16px; z-index: 100; display: flex; gap: 8px; }
    .no-print button { padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
    .btn-print { background: #84CC16; color: #0C1528; }
    .btn-close { background: #E2E8F0; color: #475569; }
  }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<div class="no-print">
  <button class="btn-print" onclick="window.print()">Imprimir / Guardar PDF</button>
  <button class="btn-close" onclick="window.close()">Cerrar</button>
</div>

<div class="header">
  <div class="header-left">
    ${logoHtml}
    ${brandingPhone || brandingEmail ? `<div style="margin-top:4px;font-size:8.5px;color:${pdfColors.muted};">${brandingPhone ? brandingPhone + (brandingEmail ? ' · ' : '') : ''}${brandingEmail ?? ''}</div>` : ''}
  </div>
  <div class="header-right">
    ${reportNumber ? `<div style="font-size:12px;font-weight:800;letter-spacing:1px;color:${pdfColors.primary};font-family:Courier,monospace;">${reportNumber}</div>` : ''}
    <div style="font-size:9px;font-weight:700;letter-spacing:1.5px;color:${pdfColors.muted};text-transform:uppercase;">DOCUMENTO OFICIAL</div>
    <div class="meta">${date}</div>
    ${brandingWebsite ? `<div class="meta">${brandingWebsite}</div>` : ''}
  </div>
</div>

<div class="title-block">
  <h1>${title}</h1>
  ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
</div>

${warning ? `<div class="warning-box">${warning}</div>` : ''}

${body}

<div class="footer">
  <div class="footer-left">${footer ?? `Generado por NexGuard360 · ${tenantName}`}</div>
  <div class="footer-right">www.nexguard360.com</div>
</div>

</body>
</html>`;
}

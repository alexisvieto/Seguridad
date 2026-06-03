import { NextRequest, NextResponse } from 'next/server';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function GET(request: NextRequest) {
  const tenantName = escapeHtml(request.nextUrl.searchParams.get('empresa') ?? 'Su Empresa');
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host = request.headers.get('host') ?? 'localhost:3000';
  const logoNg = `${proto}://${host}/brand/logo-nexguard360-light.svg`;
  const logoNexera = `${proto}://${host}/brand/nexera-logo.png`;

  const PH = (ch: number, title: string) => `
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Cap. ${ch} · ${tenantName}</div>
  </div>`;

  const PF = `
  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Manual de Usuario — NexGuard360 | ${tenantName}</title>
<style>
  @page { size: letter; margin: 20mm 18mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #1a1a2e; background: #fff; font-size: 14px; line-height: 1.75; }

  @media screen {
    body { max-width: 850px; margin: 0 auto; padding: 0; }
    .no-print { position: fixed; top: 16px; right: 16px; z-index: 100; display: flex; gap: 8px; }
    .no-print button { padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
    .btn-print { background: #84CC16; color: #0C1528; }
    .btn-close { background: #E2E8F0; color: #475569; }
  }
  @media print { .no-print { display: none !important; } }

  .cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px 40px; page-break-after: always; }
  .cover-logo { height: 120px; margin-bottom: 56px; }
  .cover h1 { font-size: 36px; font-weight: 800; color: #0C1528; letter-spacing: -0.5px; margin-bottom: 8px; }
  .cover .subtitle { font-size: 18px; color: #84CC16; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 40px; }
  .cover .tenant { font-size: 22px; font-weight: 700; color: #0C1528; padding: 16px 40px; border: 2px solid #84CC16; border-radius: 12px; margin-bottom: 48px; }
  .cover .meta { font-size: 13px; color: #94A3B8; }
  .cover .nexera { margin-top: 60px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .cover .nexera img { height: 44px; mix-blend-mode: multiply; }
  .cover .nexera span { font-size: 11px; color: #94A3B8; letter-spacing: 0.5px; }

  .page { page-break-before: always; padding: 0; }
  .page:first-of-type { page-break-before: auto; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 2px solid #0C1528; margin-bottom: 28px; }
  .page-header-logo { height: 36px; }
  .page-header-right { font-size: 10px; color: #94A3B8; text-align: right; letter-spacing: 0.5px; }
  .page-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 10px; color: #94A3B8; }

  h2 { font-size: 24px; font-weight: 800; color: #0C1528; margin-bottom: 6px; letter-spacing: -0.3px; }
  h3 { font-size: 17px; font-weight: 700; color: #0C1528; margin-top: 24px; margin-bottom: 8px; }
  h4 { font-size: 14px; font-weight: 700; color: #84CC16; margin-top: 18px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
  .eyebrow { font-size: 11px; font-weight: 700; color: #84CC16; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  p { margin-bottom: 12px; color: #334155; }
  .lead { font-size: 15px; color: #475569; margin-bottom: 20px; }

  .steps { counter-reset: step; margin: 16px 0; }
  .step { counter-increment: step; display: flex; gap: 14px; margin-bottom: 14px; align-items: flex-start; }
  .step::before { content: counter(step); flex-shrink: 0; width: 28px; height: 28px; background: #84CC16; color: #0C1528; font-weight: 800; font-size: 13px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
  .step-content { flex: 1; }
  .step-content strong { color: #0C1528; }

  .tip { padding: 14px 18px; background: #F0FDF4; border-left: 3px solid #84CC16; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 13px; color: #166534; }
  .tip strong { color: #15803D; }
  .warning { padding: 14px 18px; background: #FEF3C7; border-left: 3px solid #F59E0B; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 13px; color: #92400E; }
  .info { padding: 14px 18px; background: #EFF6FF; border-left: 3px solid #3B82F6; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 13px; color: #1E40AF; }

  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th { background: #F1F5F9; padding: 10px 14px; text-align: left; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #E2E8F0; }
  td { padding: 10px 14px; border-bottom: 1px solid #F1F5F9; color: #334155; }

  hr { border: none; border-top: 1px solid #E2E8F0; margin: 28px 0; }
  .toc { margin: 20px 0; }
  .toc-item { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px dotted #CBD5E1; font-size: 13px; }
  .toc-item span:first-child { color: #0C1528; font-weight: 600; }
  .toc-item span:last-child { color: #94A3B8; font-size: 12px; }

  .back-cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px 40px; page-break-before: always; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { page-break-before: always; }
    .cover, .back-cover { page-break-after: always; }
  }
</style>
</head>
<body>

<div class="no-print">
  <button class="btn-print" onclick="window.print()">Imprimir / Guardar PDF</button>
</div>

<!-- ================================================================ -->
<!-- COVER PAGE                                                        -->
<!-- ================================================================ -->
<div class="cover">
  <img src="${logoNg}" alt="NexGuard360" class="cover-logo" />
  <h1>Manual de Usuario</h1>
  <div class="subtitle">Guía Completa de Operación</div>
  <div class="tenant">${tenantName}</div>
  <div class="meta">Versión 2.0 — Junio 2026</div>
  <div class="meta">www.nexguard360.com</div>
  <div class="nexera">
    <span>Un producto de</span>
    <img src="${logoNexera}" alt="Nexera" />
    <span>www.nexerai.io</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- TABLE OF CONTENTS                                                 -->
<!-- ================================================================ -->
<div class="page">
  ${PH(0, 'Contenido')}

  <div class="eyebrow">Contenido</div>
  <h2>Tabla de Contenido</h2>
  <p class="lead">Esta guía le acompañará paso a paso en la configuración y uso diario de NexGuard360. Siga el orden la primera vez — cada sección construye sobre la anterior.</p>

  <div class="toc">
    <div class="toc-item"><span>1. Configuración Inicial</span><span>Primer ingreso y datos de empresa</span></div>
    <div class="toc-item"><span>2. Gestión Comercial</span><span>Clientes, contratos, propiedades y QR</span></div>
    <div class="toc-item"><span>3. Recursos Humanos</span><span>Empleados, expedientes y liquidaciones</span></div>
    <div class="toc-item"><span>4. Programación de Turnos</span><span>Asignaciones fijas, temporales y mensuales</span></div>
    <div class="toc-item"><span>5. NOC Monitor</span><span>Panel de cobertura en tiempo real</span></div>
    <div class="toc-item"><span>6. Centro de Comando</span><span>Novedades, alertas y auditoría</span></div>
    <div class="toc-item"><span>7. Cambio de Turno</span><span>Reporte narrativo del operador</span></div>
    <div class="toc-item"><span>8. Consignas por Puesto</span><span>Tareas operativas para el agente</span></div>
    <div class="toc-item"><span>9. Planilla Operativa</span><span>Control de asistencia tipo Excel</span></div>
    <div class="toc-item"><span>10. Nómina</span><span>Cálculo quincenal y planilla</span></div>
    <div class="toc-item"><span>11. Inventario</span><span>Stock, activos por puesto y entregas</span></div>
    <div class="toc-item"><span>12. Flota Vehicular</span><span>Vehículos, mantenimiento e inspecciones</span></div>
    <div class="toc-item"><span>13. Capacitaciones</span><span>Cursos y certificaciones</span></div>
    <div class="toc-item"><span>14. Dashboard Gerencial + IA</span><span>KPIs ejecutivos y asistente inteligente</span></div>
    <div class="toc-item"><span>15. Portal del Cliente</span><span>Tickets y reportes de daños</span></div>
  </div>

  <div class="tip"><strong>Consejo:</strong> Imprima este manual con el botón de arriba para tenerlo a mano durante la configuración inicial.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 1. CONFIGURACIÓN INICIAL                                          -->
<!-- ================================================================ -->
<div class="page">
  ${PH(1, 'Configuración Inicial')}

  <div class="eyebrow">Capítulo 1</div>
  <h2>Configuración Inicial</h2>
  <p class="lead">La primera vez que ingrese al sistema, será dirigido automáticamente a esta pantalla. Complete cada campo — esta información aparecerá en todos sus reportes y documentos oficiales.</p>

  <h3>Acceso al Sistema</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Abra su navegador y visite <strong>www.nexguard360.com</strong></div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Iniciar Sesión"</strong></div></div>
    <div class="step"><div class="step-content">Ingrese el correo electrónico y la contraseña que le fueron proporcionados</div></div>
    <div class="step"><div class="step-content">El sistema le llevará automáticamente a la <strong>Configuración de Empresa</strong></div></div>
  </div>

  <h3>Datos de la Empresa</h3>

  <h4>Identidad</h4>
  <div class="steps">
    <div class="step"><div class="step-content"><strong>Logo de la Empresa:</strong> Suba el logo en formato PNG o JPG. Aparecerá en todos los documentos PDF generados.</div></div>
    <div class="step"><div class="step-content"><strong>Nombre, Dirección, Teléfono, Email:</strong> Datos de contacto de la empresa.</div></div>
  </div>

  <h4>Configuración Regional</h4>
  <p>Seleccione su país — el sistema configurará automáticamente la moneda y zona horaria.</p>

  <h4>Configuración de Nómina</h4>
  <p>Configure las deducciones salariales. Por defecto: CSS 9.75% + Seguro Educativo 1.25% (Panamá). Puede agregar, modificar o eliminar deducciones según su legislación.</p>

  <div class="info"><strong>Nota:</strong> Si su empresa no paga horas extras (acuerdo extraordinario), desactive la casilla "Pagar horas extras". Esto aplica a todas las quincenas.</div>

  <h4>Guardar</h4>
  <p>Haga clic en <strong>"Guardar Cambios"</strong>. A partir de este momento el sistema está listo para operar.</p>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 2. GESTIÓN COMERCIAL                                              -->
<!-- ================================================================ -->
<div class="page">
  ${PH(2, 'Gestión Comercial')}

  <div class="eyebrow">Capítulo 2</div>
  <h2>Gestión Comercial</h2>
  <p class="lead">Registre clientes, cree contratos, vincule propiedades, cree puestos de control y genere los códigos QR. Siga el orden — cada paso depende del anterior.</p>

  <h3>Crear un Cliente</h3>
  <div class="steps">
    <div class="step"><div class="step-content">En el menú lateral, haga clic en <strong>"Clientes y Contratos"</strong></div></div>
    <div class="step"><div class="step-content">Seleccione la pestaña <strong>"Clientes"</strong> y haga clic en <strong>"+ Nuevo"</strong></div></div>
    <div class="step"><div class="step-content">Complete: Razón Social, RUC, Representante Legal, Email y Teléfono</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Registrar"</strong></div></div>
  </div>

  <h3>Crear un Contrato</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Cambie a la pestaña <strong>"Contratos"</strong> y haga clic en <strong>"+ Nuevo"</strong></div></div>
    <div class="step"><div class="step-content">Seleccione el cliente, monto mensual, cantidad de agentes requeridos y fechas</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Crear Contrato"</strong></div></div>
  </div>

  <h3>Vincular una Propiedad</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic sobre el contrato para ver su detalle</div></div>
    <div class="step"><div class="step-content">En "Propiedades", haga clic en <strong>"+ Vincular propiedad"</strong></div></div>
    <div class="step"><div class="step-content">Si no existe, haga clic en <strong>"+ Crear Nueva Propiedad"</strong>, ingrese nombre y dirección</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Crear y Vincular"</strong></div></div>
  </div>

  <h3>Crear Puestos de Control</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Dentro de la propiedad vinculada, haga clic en <strong>"+ Crear Puesto"</strong></div></div>
    <div class="step"><div class="step-content">Ingrese el nombre del puesto (ej: "Garita Principal", "Lobby", "Ronda Perimetral")</div></div>
    <div class="step"><div class="step-content">Repita para cada puesto de control que necesite</div></div>
  </div>

  <h3>Generar Código QR</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Junto a cada puesto verá un botón <strong>"QR"</strong> en azul</div></div>
    <div class="step"><div class="step-content">Haga clic para ver el código QR del puesto</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Descargar PNG"</strong> para guardar la imagen</div></div>
    <div class="step"><div class="step-content">Imprima el QR y colóquelo en el puesto de control. Los agentes lo escanearán para marcar entrada.</div></div>
  </div>

  <div class="tip"><strong>Nota:</strong> Este proceso solo se hace una vez por puesto. Una vez creado, el QR funciona permanentemente.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 3. RECURSOS HUMANOS                                               -->
<!-- ================================================================ -->
<div class="page">
  ${PH(3, 'Recursos Humanos')}

  <div class="eyebrow">Capítulo 3</div>
  <h2>Recursos Humanos</h2>
  <p class="lead">Cree perfiles de empleados, gestione expedientes completos, registre poligrafías, incapacidades, disciplina y calcule liquidaciones según la ley panameña.</p>

  <h3>Crear un Empleado</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Vaya a <strong>"RRHH"</strong> en el menú lateral</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Nuevo Empleado"</strong></div></div>
    <div class="step"><div class="step-content">Complete: Nombre, Cédula, Tipo de Empleado, Email, Contraseña y Salario Mensual</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Crear Empleado"</strong></div></div>
  </div>

  <h4>Tipos de Empleado</h4>
  <table>
    <thead><tr><th>Tipo</th><th>Función</th><th>Acceso al Sistema</th></tr></thead>
    <tbody>
      <tr><td><strong>Agente de Campo</strong></td><td>Vigilante en puestos</td><td>Solo Mi Puesto (escaneo QR)</td></tr>
      <tr><td><strong>Conductor</strong></td><td>Chofer de patrulla</td><td>Flota</td></tr>
      <tr><td><strong>Supervisor</strong></td><td>Supervisión en campo</td><td>Operaciones + Mi Puesto</td></tr>
      <tr><td><strong>Operador</strong></td><td>Control desde oficina</td><td>Módulos operativos completos</td></tr>
      <tr><td><strong>Administrativo</strong></td><td>Personal de oficina</td><td>Todo excepto Portal Cliente</td></tr>
    </tbody>
  </table>

  <h3>Expediente del Empleado (7 pestañas)</h3>
  <p>Haga clic sobre cualquier empleado para ver su expediente completo:</p>
  <div class="steps">
    <div class="step"><div class="step-content"><strong>Ficha:</strong> Datos personales, cédula, carnet, contacto de emergencia. Opción de dar de baja con fecha y motivo.</div></div>
    <div class="step"><div class="step-content"><strong>Contrato:</strong> Tipo de contrato (indefinido/definido), salario, estado MITRADEL, adjuntar contrato firmado en PDF.</div></div>
    <div class="step"><div class="step-content"><strong>Poligrafía:</strong> Fecha del examen, resultado (aprobado/no aprobado/pendiente), adjuntar documento.</div></div>
    <div class="step"><div class="step-content"><strong>Activos:</strong> Equipos y armas actualmente asignados al empleado (se alimenta de Inventario).</div></div>
    <div class="step"><div class="step-content"><strong>Incapacidades:</strong> Licencias médicas con clínica, doctor, días y certificado adjunto.</div></div>
    <div class="step"><div class="step-content"><strong>Disciplina:</strong> Llamados de atención, faltas y suspensiones con evidencia y fecha.</div></div>
    <div class="step"><div class="step-content"><strong>Liquidaciones:</strong> Calculadora de prestaciones según la ley panameña (ver abajo).</div></div>
  </div>

  <h3>Calculadora de Liquidaciones</h3>
  <p>La pestaña de Liquidaciones permite calcular prestaciones laborales según el Código de Trabajo de Panamá. Solo aparece para empleados con salario registrado.</p>

  <h4>4 Tipos de Cálculo</h4>
  <table>
    <thead><tr><th>Tipo</th><th>Qué Incluye</th></tr></thead>
    <tbody>
      <tr><td><strong>Décimo Tercer Mes</strong></td><td>Bono obligatorio proporcional al período (Ene-Abr, May-Ago, Sep-Dic)</td></tr>
      <tr><td><strong>Renuncia Voluntaria</strong></td><td>Vacaciones proporcionales + décimo + prima de antigüedad (si contrato indefinido)</td></tr>
      <tr><td><strong>Despido Justificado</strong></td><td>Vacaciones + décimo + prima de antigüedad (1.923% de salarios devengados)</td></tr>
      <tr><td><strong>Despido Injustificado</strong></td><td>Todo lo anterior + indemnización Art. 225 (3.4 semanas por año, escala >10 años)</td></tr>
    </tbody>
  </table>

  <div class="steps">
    <div class="step"><div class="step-content">Seleccione el tipo de liquidación (botones de colores)</div></div>
    <div class="step"><div class="step-content">Ingrese la fecha de salida (excepto para décimo que usa la fecha actual)</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Calcular"</strong></div></div>
    <div class="step"><div class="step-content">El sistema muestra el desglose completo: vacaciones, décimo, prima, indemnización, seguro social y total a pagar</div></div>
  </div>

  <div class="warning"><strong>Importante:</strong> Dar de baja a un empleado NO elimina sus registros. Toda la información se conserva para auditoría y cumplimiento legal.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 4. PROGRAMACIÓN DE TURNOS                                         -->
<!-- ================================================================ -->
<div class="page">
  ${PH(4, 'Programación de Turnos')}

  <div class="eyebrow">Capítulo 4</div>
  <h2>Programación de Turnos</h2>
  <p class="lead">Asigne agentes a puestos de control con horarios fijos, temporales o mensuales. El sistema previene solapamientos automáticamente.</p>

  <h3>Crear una Asignación</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Vaya a <strong>"Turnos"</strong> en el menú lateral</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Nueva Asignación"</strong></div></div>
    <div class="step"><div class="step-content">Seleccione el <strong>agente</strong> y el <strong>puesto de control</strong></div></div>
    <div class="step"><div class="step-content">Elija el tipo de asignación:</div></div>
  </div>

  <table>
    <thead><tr><th>Tipo</th><th>Uso</th><th>Vigencia</th></tr></thead>
    <tbody>
      <tr><td><strong>Fijo</strong></td><td>Agente permanente en un puesto</td><td>Sin fecha de fin (hasta que se modifique)</td></tr>
      <tr><td><strong>Temporal</strong></td><td>Cobertura por vacaciones o refuerzo</td><td>Rango de fechas específico</td></tr>
      <tr><td><strong>Mensual</strong></td><td>Rotación programada</td><td>Se renueva cada mes</td></tr>
    </tbody>
  </table>

  <div class="steps">
    <div class="step"><div class="step-content">Configure la <strong>hora de entrada</strong> y <strong>hora de salida</strong> (ej: 06:00 a 18:00 diurno, 18:00 a 06:00 nocturno)</div></div>
    <div class="step"><div class="step-content">Defina las <strong>fechas de vigencia</strong> (inicio y fin)</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Guardar"</strong></div></div>
  </div>

  <div class="info"><strong>Anti-solapamiento:</strong> Si intenta asignar un agente a un puesto donde ya tiene turno en el mismo horario, el sistema lo rechazará automáticamente.</div>

  <h3>Doble Turno</h3>
  <p>Si un agente escanea el QR de un puesto donde ya tiene un turno activo, el sistema cierra automáticamente el turno anterior y abre uno nuevo. No necesita intervención manual.</p>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 5. NOC MONITOR                                                    -->
<!-- ================================================================ -->
<div class="page">
  ${PH(5, 'NOC Monitor')}

  <div class="eyebrow">Capítulo 5</div>
  <h2>NOC Monitor</h2>
  <p class="lead">Panel de monitoreo en tiempo real que muestra el estado de cobertura de todos los puestos de control. Permite al operador ver de un vistazo cuáles puestos están cubiertos, cuáles tienen tardanza y cuáles están vacantes.</p>

  <h3>Estados de los Puestos</h3>
  <table>
    <thead><tr><th>Color</th><th>Estado</th><th>Significado</th></tr></thead>
    <tbody>
      <tr><td style="color:#16A34A;font-weight:700;">● Verde</td><td>A Tiempo</td><td>Agente marcó entrada dentro del horario programado</td></tr>
      <tr><td style="color:#F59E0B;font-weight:700;">● Amarillo</td><td>Tardanza</td><td>Agente marcó entrada pero con retraso</td></tr>
      <tr><td style="color:#DC2626;font-weight:700;">● Rojo</td><td>Vacante</td><td>Nadie ha marcado entrada — puesto sin cubrir</td></tr>
    </tbody>
  </table>

  <h3>Cómo Funciona</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Vaya a <strong>"NOC Monitor"</strong> en el menú lateral</div></div>
    <div class="step"><div class="step-content">Verá tarjetas compactas para cada puesto (5 por fila)</div></div>
    <div class="step"><div class="step-content">Cada tarjeta muestra: nombre del puesto, propiedad, nombre del agente y hora de entrada</div></div>
    <div class="step"><div class="step-content">Los puestos rojos (vacantes) se destacan visualmente para acción inmediata</div></div>
  </div>

  <h3>Alertas Automáticas de No-Show</h3>
  <p>El sistema ejecuta verificaciones automáticas a las <strong>6:05 AM</strong> (turno diurno) y <strong>6:05 PM</strong> (turno nocturno). Si un puesto programado no tiene agente, se genera una <strong>alerta persistente</strong> que aparece como banner en la parte superior de todas las pantallas.</p>

  <div class="warning"><strong>Alertas persistentes:</strong> Las alertas de no-show permanecen visibles hasta que un operador las gestione desde el Centro de Comando.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 6. CENTRO DE COMANDO                                              -->
<!-- ================================================================ -->
<div class="page">
  ${PH(6, 'Centro de Comando')}

  <div class="eyebrow">Capítulo 6</div>
  <h2>Centro de Comando</h2>
  <p class="lead">Pantalla central donde el operador gestiona todas las novedades. Dividida en dos secciones: Operaciones (novedades de campo) y Cliente (tickets y daños). Cada acción queda registrada para auditoría.</p>

  <h3>Flujo de Colores</h3>
  <table>
    <thead><tr><th>Color</th><th>Estado</th><th>Significado</th></tr></thead>
    <tbody>
      <tr><td style="color:#DC2626;font-weight:700;">● Rojo</td><td>Sin Atender</td><td>Novedad nueva, requiere acción inmediata (parpadea)</td></tr>
      <tr><td style="color:#F59E0B;font-weight:700;">● Ámbar</td><td>En Proceso</td><td>Operador está trabajando en ella</td></tr>
      <tr><td style="color:#16A34A;font-weight:700;">● Verde</td><td>Resuelto</td><td>Novedad resuelta, pasa al historial</td></tr>
    </tbody>
  </table>

  <h3>Gestionar una Novedad</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Las novedades sin atender <strong>parpadean en rojo</strong> hasta que les cambie el estado</div></div>
    <div class="step"><div class="step-content">Haga clic para expandir el detalle</div></div>
    <div class="step"><div class="step-content">Lea la descripción y la <strong>Acción del Agente</strong> (qué hizo el agente en campo)</div></div>
    <div class="step"><div class="step-content">Escriba su nota describiendo la acción tomada (campo obligatorio)</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"En Proceso"</strong> o <strong>"Resuelto"</strong></div></div>
  </div>

  <div class="info"><strong>Trazabilidad:</strong> Cada acción queda registrada con quién la hizo, cuándo y qué nota dejó. Si primero marca "En Proceso" y luego "Resuelto", ambas acciones aparecen en el Historial de Acciones.</div>

  <h3>Estadísticas Independientes</h3>
  <p>Cada sección tiene sus propios contadores: <strong>Abiertas</strong> (rojo) y <strong>Resueltas Hoy</strong> (verde). Los contadores de Operaciones y Cliente son independientes.</p>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 7. CAMBIO DE TURNO                                                -->
<!-- ================================================================ -->
<div class="page">
  ${PH(7, 'Cambio de Turno')}

  <div class="eyebrow">Capítulo 7</div>
  <h2>Cambio de Turno</h2>
  <p class="lead">El operador documenta el cambio de turno con un reporte narrativo por cada puesto. El sistema detecta automáticamente si hubo relevos, tardanzas o ausencias y genera un PDF oficial.</p>

  <h3>Crear un Reporte</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Vaya a <strong>"Cambio de Turno"</strong> en el menú lateral</div></div>
    <div class="step"><div class="step-content">Seleccione la <strong>fecha</strong> y el <strong>tipo de turno</strong> (Diurno 6AM-6PM o Nocturno 6PM-6AM)</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Crear Reporte"</strong> — el sistema carga todos los puestos programados</div></div>
  </div>

  <h3>Documentar Eventos</h3>
  <p>Para cada puesto, el operador registra qué sucedió:</p>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Agregar Evento"</strong> junto al puesto</div></div>
    <div class="step"><div class="step-content">Seleccione el tipo de evento: <strong>Se presentó, Tardanza, No se presentó, Relevo</strong></div></div>
    <div class="step"><div class="step-content">Escriba la <strong>narrativa</strong> explicando qué pasó (ej: "El agente llegó 45 min tarde. El agente saliente esperó.")</div></div>
    <div class="step"><div class="step-content">Repita para cada puesto con novedades</div></div>
  </div>

  <h3>Observaciones Generales y Personal Libre</h3>
  <p>Al final del reporte puede agregar <strong>observaciones generales</strong> del turno y registrar el <strong>personal libre</strong> (agentes disponibles para relevos).</p>

  <h3>Enviar el Reporte</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Revise todo el reporte</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Enviar a Gerencia"</strong></div></div>
    <div class="step"><div class="step-content">El reporte se marca como enviado y se puede generar en <strong>PDF</strong> con número de reporte automático (CDT-0001)</div></div>
  </div>

  <div class="tip"><strong>PDF Oficial:</strong> Cada reporte genera un PDF con el logo de su empresa, membrete, detalles de cada puesto y firmas. Ideal para archivo y auditoría.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 8. CONSIGNAS                                                      -->
<!-- ================================================================ -->
<div class="page">
  ${PH(8, 'Consignas por Puesto')}

  <div class="eyebrow">Capítulo 8</div>
  <h2>Consignas por Puesto</h2>
  <p class="lead">Las consignas son las tareas que cada agente debe cumplir en su puesto. Se cargan automáticamente cuando el agente marca su entrada con el QR.</p>

  <h3>Agregar Consignas</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Vaya a <strong>"Consignas"</strong> en el menú lateral</div></div>
    <div class="step"><div class="step-content">Verá las propiedades con sus puestos. Haga clic en un puesto para expandirlo</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Agregar Consigna"</strong></div></div>
    <div class="step"><div class="step-content">Escriba la tarea (ej: "Ronda en área social a las 8am, 6pm y 12am")</div></div>
    <div class="step"><div class="step-content">Seleccione la prioridad: Baja, Media, Alta o Crítica</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Agregar"</strong></div></div>
  </div>

  <p>Puede editar, activar o desactivar consignas en cualquier momento. Las consignas desactivadas no se muestran al agente.</p>

  <h3>Qué Ve el Agente</h3>
  <p>Cuando el agente escanea el QR de su puesto, la pantalla <strong>"Mi Puesto"</strong> le muestra automáticamente todas las consignas activas ordenadas por prioridad. El agente puede reportar novedades directamente desde esa pantalla.</p>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 9. PLANILLA OPERATIVA                                             -->
<!-- ================================================================ -->
<div class="page">
  ${PH(9, 'Planilla Operativa')}

  <div class="eyebrow">Capítulo 9</div>
  <h2>Planilla Operativa</h2>
  <p class="lead">Control de asistencia tipo Excel donde el operador registra día a día el estado de cada agente. Esta planilla alimenta directamente el cálculo de nómina.</p>

  <h3>Cómo Funciona</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Vaya a <strong>"Planilla Operativa"</strong> en el menú lateral</div></div>
    <div class="step"><div class="step-content">Seleccione la quincena (1-15 o 16-30/31 del mes)</div></div>
    <div class="step"><div class="step-content">Verá una grilla con los agentes en filas y los días en columnas</div></div>
    <div class="step"><div class="step-content">Haga clic en cualquier celda para editarla</div></div>
  </div>

  <h3>Tipos de Entrada</h3>
  <table>
    <thead><tr><th>Tipo</th><th>Color</th><th>Horas</th><th>Efecto en Nómina</th></tr></thead>
    <tbody>
      <tr><td><strong>Completo</strong></td><td style="color:#16A34A;">Verde</td><td>12h</td><td>Horas normales</td></tr>
      <tr><td><strong>Tardanza</strong></td><td style="color:#F59E0B;">Amarillo</td><td>Variable</td><td>Se pagan las horas que trabajó</td></tr>
      <tr><td><strong>Falta sin Aviso</strong></td><td style="color:#DC2626;">Rojo</td><td>0h</td><td>Descuento B/.15.00</td></tr>
      <tr><td><strong>Falta con Aviso</strong></td><td style="color:#F97316;">Naranja</td><td>0h</td><td>Sin penalización</td></tr>
      <tr><td><strong>Día Libre</strong></td><td style="color:#6B7280;">Gris</td><td>0h</td><td>No aplica</td></tr>
      <tr><td><strong>Relevo</strong></td><td style="color:#8B5CF6;">Púrpura</td><td>12h</td><td>Turno normal</td></tr>
      <tr><td><strong>Relevo por Falto</strong></td><td style="color:#EC4899;">Rosa</td><td>12h</td><td>Bonificación B/.15.00</td></tr>
    </tbody>
  </table>

  <h3>Totales</h3>
  <p>La última columna muestra el <strong>total de horas + bonificaciones - descuentos</strong> para cada agente en la quincena. Este total se usa para el cálculo de nómina.</p>

  <div class="info"><strong>Conexión con Nómina:</strong> Al calcular la nómina, el motor toma las horas de la Planilla Operativa primero. Si un agente no tiene entrada en la planilla, usa los datos del escaneo QR como respaldo.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 10. NÓMINA                                                        -->
<!-- ================================================================ -->
<div class="page">
  ${PH(10, 'Nómina')}

  <div class="eyebrow">Capítulo 10</div>
  <h2>Nómina</h2>
  <p class="lead">Cálculo quincenal automatizado que toma las horas de la Planilla Operativa, aplica las deducciones configuradas y genera el informe de planilla completo.</p>

  <h3>Crear un Período</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Vaya a <strong>"Nómina"</strong> en el menú lateral</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Nuevo Periodo"</strong></div></div>
    <div class="step"><div class="step-content">Seleccione las fechas de la quincena (ej: 1-15 junio o 16-30 junio)</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Crear"</strong></div></div>
  </div>

  <h3>Calcular la Nómina</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic sobre el período creado para abrirlo</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Calcular Nómina"</strong></div></div>
    <div class="step"><div class="step-content">El sistema procesa automáticamente:
      <br/>— Horas regulares vs horas extras (tope configurable, por defecto 96h)
      <br/>— Bonificaciones y descuentos de la planilla operativa
      <br/>— CSS 9.75% + Seguro Educativo 1.25% (o sus deducciones personalizadas)
      <br/>— Salario neto por agente</div></div>
    <div class="step"><div class="step-content">Revise los resultados en el <strong>Informe de Planilla</strong></div></div>
  </div>

  <h3>Informe de Planilla</h3>
  <p>El informe muestra para cada agente: horas regulares, horas extras, tarifa/hora, adiciones, deducciones, bruto, CSS, SE y neto. Al final muestra los totales.</p>

  <div class="warning"><strong>Recalcular:</strong> Si modifica la Planilla Operativa después de calcular la nómina, puede recalcular el período las veces que necesite. Los nuevos datos reemplazan los anteriores.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 11. INVENTARIO                                                    -->
<!-- ================================================================ -->
<div class="page">
  ${PH(11, 'Inventario')}

  <div class="eyebrow">Capítulo 11</div>
  <h2>Inventario</h2>
  <p class="lead">Gestione el stock de uniformes, radios y equipos. Controle los activos asignados a cada puesto y registre entregas a agentes con firma digital y acta PDF.</p>

  <h3>Stock General</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic en <strong>"Ingresar Mercancía"</strong> para agregar artículos a la bodega</div></div>
    <div class="step"><div class="step-content">Ingrese: categoría, nombre, cantidad y alerta mínima de stock</div></div>
    <div class="step"><div class="step-content">El sistema alertará cuando el stock baje del mínimo configurado</div></div>
  </div>

  <h3>Activos por Puesto</h3>
  <p>Vea qué equipos están asignados a cada puesto. Haga clic en un puesto para ver el detalle. Puede reportar daños desde aquí.</p>

  <h3>Entrega a Agentes</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic en <strong>"Formulario de Entrega"</strong></div></div>
    <div class="step"><div class="step-content">Seleccione el agente, el artículo y la cantidad</div></div>
    <div class="step"><div class="step-content">El agente debe firmar digitalmente en el canvas</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Registrar"</strong>. El stock se descuenta automáticamente.</div></div>
    <div class="step"><div class="step-content">Descargue el <strong>Acta de Entrega en PDF</strong> desde el historial de entregas</div></div>
  </div>

  <div class="info"><strong>Documentos:</strong> Cada entrega genera un acta con número único (ENT-0001), datos del agente, detalle del equipo y acuerdo de responsabilidad.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 12. FLOTA                                                         -->
<!-- ================================================================ -->
<div class="page">
  ${PH(12, 'Flota Vehicular')}

  <div class="eyebrow">Capítulo 12</div>
  <h2>Flota Vehicular</h2>
  <p class="lead">Registre vehículos, gestione mantenimiento preventivo y registre inspecciones con evidencia fotográfica.</p>

  <h3>Registrar un Vehículo</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Registrar Vehículo"</strong></div></div>
    <div class="step"><div class="step-content">Complete: placa, tipo, marca/modelo, GPS (opcional), odómetro</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Registrar"</strong></div></div>
  </div>

  <h3>Mantenimiento Preventivo</h3>
  <p>En la pestaña "Mantenimiento Preventivo", registre cada servicio realizado. El sistema actualiza el odómetro y calcula cuándo corresponde el próximo mantenimiento.</p>

  <h3>Inspección de Flota</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Vaya a la pestaña <strong>"Inspección de Flota"</strong></div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Inspección"</strong></div></div>
    <div class="step"><div class="step-content">Seleccione vehículo, fecha, kilometraje</div></div>
    <div class="step"><div class="step-content">Detalle el estado de <strong>chasis/pintura</strong> y <strong>rines/llantas</strong></div></div>
    <div class="step"><div class="step-content">Suba fotografías como evidencia (se comprimen automáticamente)</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Registrar Inspección"</strong></div></div>
  </div>

  <div class="tip"><strong>Historial:</strong> Las inspecciones se agrupan por mes. Haga clic sobre cualquiera para ver el detalle completo con fotos.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 13. CAPACITACIONES                                                -->
<!-- ================================================================ -->
<div class="page">
  ${PH(13, 'Capacitaciones')}

  <div class="eyebrow">Capítulo 13</div>
  <h2>Capacitaciones</h2>
  <p class="lead">Gestione los cursos de su empresa y registre las certificaciones de cada agente. El sistema alerta 60 días antes del vencimiento.</p>

  <h3>Crear un Curso</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Agregar Curso"</strong></div></div>
    <div class="step"><div class="step-content">Ingrese: nombre del curso, descripción y vigencia en meses</div></div>
    <div class="step"><div class="step-content">El curso queda disponible para asignar a cualquier agente</div></div>
  </div>

  <h3>Registrar Capacitación</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Registrar Capacitación"</strong></div></div>
    <div class="step"><div class="step-content">Seleccione el agente y el curso (puede crear uno nuevo con "+ Nuevo")</div></div>
    <div class="step"><div class="step-content">Ingrese la <strong>fecha de vencimiento</strong> de la certificación</div></div>
    <div class="step"><div class="step-content">Opcionalmente: calificación y certificado en PDF</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Registrar"</strong></div></div>
  </div>

  <div class="warning"><strong>Alerta automática:</strong> El sistema alerta 60 días antes del vencimiento. Renueve la certificación para eliminar la alerta.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 14. DASHBOARD GERENCIAL + IA                                      -->
<!-- ================================================================ -->
<div class="page">
  ${PH(14, 'Dashboard Gerencial + IA')}

  <div class="eyebrow">Capítulo 14</div>
  <h2>Dashboard Gerencial + IA</h2>
  <p class="lead">Vista ejecutiva para el gerente/dueño. KPIs de la operación en una sola pantalla más un asistente de inteligencia artificial que responde preguntas sobre sus datos.</p>

  <h3>KPIs Disponibles</h3>
  <table>
    <thead><tr><th>Indicador</th><th>Qué Muestra</th></tr></thead>
    <tbody>
      <tr><td><strong>Facturación Mensual</strong></td><td>Suma de todos los contratos activos</td></tr>
      <tr><td><strong>Contratos Activos</strong></td><td>Cantidad de contratos vigentes</td></tr>
      <tr><td><strong>Agentes / Requeridos</strong></td><td>Agentes registrados vs requeridos por contratos</td></tr>
      <tr><td><strong>Inventario por Armería</strong></td><td>Equipos disponibles agrupados por categoría</td></tr>
      <tr><td><strong>Contratos por Vencer</strong></td><td>Contratos que vencen en los próximos 60 días</td></tr>
      <tr><td><strong>Tickets Abiertos</strong></td><td>Solicitudes de clientes sin resolver</td></tr>
    </tbody>
  </table>

  <h3>Asistente de IA</h3>
  <p>En el panel derecho encontrará un asistente inteligente. Puede hacerle preguntas en español sobre sus datos operativos:</p>
  <div class="steps">
    <div class="step"><div class="step-content"><strong>"¿Dónde pierdo dinero en horas extras?"</strong> — Analiza la rentabilidad por puesto y agente</div></div>
    <div class="step"><div class="step-content"><strong>"¿Cuál es el Bradford Factor de mis agentes?"</strong> — Detecta patrones de ausentismo</div></div>
    <div class="step"><div class="step-content"><strong>"¿Qué agentes tienen asistencia perfecta?"</strong> — Identifica los más cumplidos</div></div>
    <div class="step"><div class="step-content"><strong>"¿Cuáles son mis contratos de mayor valor?"</strong> — Ranking de facturación</div></div>
    <div class="step"><div class="step-content"><strong>"¿Cuánto cuesta por kilómetro cada vehículo?"</strong> — CPK de la flota</div></div>
  </div>

  <div class="tip"><strong>Nota:</strong> La IA puede tardar unos segundos en responder. Los resultados se basan en datos reales de su operación, no en estimaciones.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- 15. PORTAL DEL CLIENTE                                            -->
<!-- ================================================================ -->
<div class="page">
  ${PH(15, 'Portal del Cliente')}

  <div class="eyebrow">Capítulo 15</div>
  <h2>Portal del Cliente</h2>
  <p class="lead">Sus clientes (propietarios, administradores) acceden a un portal donde reportan quejas, solicitan refuerzos y documentan daños.</p>

  <h3>Acceso del Cliente</h3>
  <p>El cliente accede con sus credenciales de rol <strong>"Cliente"</strong> que usted crea desde RRHH o desde el panel de administración.</p>

  <h3>Funcionalidades del Cliente</h3>
  <div class="steps">
    <div class="step"><div class="step-content"><strong>Tickets PQR:</strong> Quejas, solicitudes de refuerzo o reportes de fallas de servicio</div></div>
    <div class="step"><div class="step-content"><strong>Reportes de Daños:</strong> Documenta daños en la propiedad con costo estimado, evidencia y responsable</div></div>
  </div>

  <p>Todos los tickets y daños aparecen automáticamente en su <strong>Centro de Comando</strong> como "Novedades de Cliente" para que su equipo los gestione.</p>

  <div class="tip"><strong>Privacidad:</strong> El cliente no ve información interna de su operación (turnos, ausencias, nómina, personal). Solo ve lo relacionado a su propiedad.</div>

  ${PF}
</div>

<!-- ================================================================ -->
<!-- BACK COVER                                                        -->
<!-- ================================================================ -->
<div class="back-cover">
  <img src="${logoNg}" alt="NexGuard360" style="height:100px;margin-bottom:40px;" />
  <h2 style="font-size:28px;margin-bottom:8px;">¿Necesita ayuda?</h2>
  <p style="font-size:16px;color:#475569;max-width:400px;">Nuestro equipo de soporte está disponible para guiarle en cualquier momento. No dude en contactarnos.</p>
  <p style="margin-top:24px;font-size:14px;color:#84CC16;font-weight:600;">www.nexguard360.com</p>
  <p style="font-size:13px;color:#94A3B8;">ventas@nexguard360.com</p>

  <div style="margin-top:80px;display:flex;flex-direction:column;align-items:center;gap:8px;">
    <span style="font-size:11px;color:#94A3B8;">Un producto de</span>
    <img src="${logoNexera}" alt="Nexera" style="height:44px;mix-blend-mode:multiply;" />
    <span style="font-size:11px;color:#94A3B8;">www.nexerai.io</span>
  </div>

  <p style="margin-top:40px;font-size:10px;color:#CBD5E1;">&copy; 2026 NexGuard360 by Nexera. Panam&aacute; — Todos los derechos reservados.</p>
</div>

</body>
</html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

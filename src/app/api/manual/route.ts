import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const tenantName = request.nextUrl.searchParams.get('empresa') ?? 'Su Empresa';
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  const host = request.headers.get('host') ?? 'localhost:3000';
  const logoNg = `${proto}://${host}/brand/logo-nexguard360-light.svg`;
  const logoNexera = `${proto}://${host}/brand/nexera-logo.png`;

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

  /* Print controls */
  @media screen {
    body { max-width: 850px; margin: 0 auto; padding: 0; }
    .no-print { position: fixed; top: 16px; right: 16px; z-index: 100; display: flex; gap: 8px; }
    .no-print button { padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; }
    .btn-print { background: #84CC16; color: #0C1528; }
    .btn-close { background: #E2E8F0; color: #475569; }
  }
  @media print { .no-print { display: none !important; } }

  /* Cover page */
  .cover { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px 40px; page-break-after: always; }
  .cover-logo { height: 120px; margin-bottom: 56px; }
  .cover h1 { font-size: 36px; font-weight: 800; color: #0C1528; letter-spacing: -0.5px; margin-bottom: 8px; }
  .cover .subtitle { font-size: 18px; color: #84CC16; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 40px; }
  .cover .tenant { font-size: 22px; font-weight: 700; color: #0C1528; padding: 16px 40px; border: 2px solid #84CC16; border-radius: 12px; margin-bottom: 48px; }
  .cover .meta { font-size: 13px; color: #94A3B8; }
  .cover .nexera { margin-top: 60px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .cover .nexera img { height: 44px; mix-blend-mode: multiply; }
  .cover .nexera span { font-size: 11px; color: #94A3B8; letter-spacing: 0.5px; }

  /* Page header/footer */
  .page { page-break-before: always; padding: 0; }
  .page:first-of-type { page-break-before: auto; }
  .page-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 2px solid #0C1528; margin-bottom: 28px; }
  .page-header-logo { height: 36px; }
  .page-header-right { font-size: 10px; color: #94A3B8; text-align: right; letter-spacing: 0.5px; }
  .page-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 10px; color: #94A3B8; }

  /* Typography */
  h2 { font-size: 24px; font-weight: 800; color: #0C1528; margin-bottom: 6px; letter-spacing: -0.3px; }
  h3 { font-size: 17px; font-weight: 700; color: #0C1528; margin-top: 24px; margin-bottom: 8px; }
  h4 { font-size: 14px; font-weight: 700; color: #84CC16; margin-top: 18px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1px; }
  .eyebrow { font-size: 11px; font-weight: 700; color: #84CC16; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  p { margin-bottom: 12px; color: #334155; }
  .lead { font-size: 15px; color: #475569; margin-bottom: 20px; }

  /* Steps */
  .steps { counter-reset: step; margin: 16px 0; }
  .step { counter-increment: step; display: flex; gap: 14px; margin-bottom: 14px; align-items: flex-start; }
  .step::before { content: counter(step); flex-shrink: 0; width: 28px; height: 28px; background: #84CC16; color: #0C1528; font-weight: 800; font-size: 13px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
  .step-content { flex: 1; }
  .step-content strong { color: #0C1528; }

  /* Tip box */
  .tip { padding: 14px 18px; background: #F0FDF4; border-left: 3px solid #84CC16; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 13px; color: #166534; }
  .tip strong { color: #15803D; }

  /* Warning box */
  .warning { padding: 14px 18px; background: #FEF3C7; border-left: 3px solid #F59E0B; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 13px; color: #92400E; }

  /* Info box */
  .info { padding: 14px 18px; background: #EFF6FF; border-left: 3px solid #3B82F6; border-radius: 0 8px 8px 0; margin: 16px 0; font-size: 13px; color: #1E40AF; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th { background: #F1F5F9; padding: 10px 14px; text-align: left; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; color: #475569; border-bottom: 2px solid #E2E8F0; }
  td { padding: 10px 14px; border-bottom: 1px solid #F1F5F9; color: #334155; }

  /* Divider */
  hr { border: none; border-top: 1px solid #E2E8F0; margin: 28px 0; }

  /* TOC */
  .toc { margin: 20px 0; }
  .toc-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #CBD5E1; font-size: 14px; }
  .toc-item span:first-child { color: #0C1528; font-weight: 600; }
  .toc-item span:last-child { color: #94A3B8; font-size: 13px; }

  /* Back cover */
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
  <div class="meta">Versión 1.0 — Junio 2026</div>
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
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Contenido</div>
  <h2>Tabla de Contenido</h2>
  <p class="lead">Esta guía le acompañará paso a paso en la configuración y uso diario de NexGuard360. Tómese su tiempo con cada sección — no hay prisa.</p>

  <div class="toc">
    <div class="toc-item"><span>1. Configuración Inicial</span><span>Su primer paso</span></div>
    <div class="toc-item"><span>2. Gestión Comercial</span><span>Clientes, contratos y puestos</span></div>
    <div class="toc-item"><span>3. Recursos Humanos</span><span>Crear empleados y expedientes</span></div>
    <div class="toc-item"><span>4. Centro de Comando</span><span>Novedades y alertas</span></div>
    <div class="toc-item"><span>5. Dashboard Gerencial</span><span>KPIs y analítica</span></div>
    <div class="toc-item"><span>6. Consignas por Puesto</span><span>Tareas operativas</span></div>
    <div class="toc-item"><span>7. Inventario</span><span>Stock, activos y entregas</span></div>
    <div class="toc-item"><span>8. Flota Vehicular</span><span>Vehículos e inspecciones</span></div>
    <div class="toc-item"><span>9. Capacitaciones</span><span>Cursos y certificaciones</span></div>
    <div class="toc-item"><span>10. Portal del Cliente</span><span>Tickets y reportes de daños</span></div>
  </div>

  <div class="tip"><strong>Consejo:</strong> Le recomendamos seguir este manual en orden la primera vez. Cada sección construye sobre la anterior. Tenga paciencia — el sistema es completo pero intuitivo una vez que lo conoce.</div>

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- 1. CONFIGURACIÓN INICIAL                                          -->
<!-- ================================================================ -->
<div class="page">
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Capítulo 1</div>
  <h2>Configuración Inicial</h2>
  <p class="lead">La primera vez que ingrese al sistema, será dirigido automáticamente a esta pantalla. Tenga paciencia y complete cada campo — esta información aparecerá en todos sus reportes y documentos oficiales.</p>

  <h3>Acceso al Sistema</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Abra su navegador y visite <strong>www.nexguard360.com</strong></div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Iniciar Sesión"</strong></div></div>
    <div class="step"><div class="step-content">Ingrese el correo electrónico y la contraseña que le fueron proporcionados</div></div>
    <div class="step"><div class="step-content">El sistema le llevará automáticamente a la <strong>Configuración de Empresa</strong></div></div>
  </div>

  <h3>Datos de la Empresa</h3>
  <p>Complete con paciencia los siguientes campos. Toda esta información se usará en los reportes PDF que genere el sistema:</p>

  <h4>Identidad</h4>
  <div class="steps">
    <div class="step"><div class="step-content"><strong>Logo de la Empresa:</strong> Suba el logo de su empresa en formato PNG o JPG. Este logo aparecerá en todos los documentos oficiales generados por el sistema.</div></div>
    <div class="step"><div class="step-content"><strong>Nombre, Dirección, Teléfono, Email:</strong> Complete los datos de contacto de su empresa.</div></div>
  </div>

  <h4>Configuración Regional</h4>
  <p>Seleccione su país — el sistema configurará automáticamente la moneda y zona horaria correctas.</p>

  <h4>Configuración de Nómina</h4>
  <p>Configure las deducciones salariales de su país. Por defecto viene CSS 9.75% + Seguro Educativo 1.25% (Panamá). Puede agregar o quitar deducciones según su legislación.</p>

  <div class="info"><strong>Nota:</strong> Si su empresa no paga horas extras por acuerdo extraordinario, desactive la casilla "Pagar horas extras".</div>

  <h4>Guardar</h4>
  <p>Una vez que complete todos los campos, haga clic en <strong>"Guardar Cambios"</strong> en la esquina superior derecha. A partir de este momento, el sistema está listo para operar.</p>

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- 2. GESTIÓN COMERCIAL                                              -->
<!-- ================================================================ -->
<div class="page">
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Capítulo 2</div>
  <h2>Gestión Comercial</h2>
  <p class="lead">Aquí registra sus clientes, crea contratos, vincula propiedades, crea puestos de control y genera los códigos QR. Tenga paciencia y siga el orden — cada paso depende del anterior.</p>

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
    <div class="step"><div class="step-content">Haga clic sobre el contrato creado para ver su detalle</div></div>
    <div class="step"><div class="step-content">En la sección "Propiedades", haga clic en <strong>"+ Vincular propiedad"</strong></div></div>
    <div class="step"><div class="step-content">Si la propiedad no existe, haga clic en <strong>"+ Crear Nueva Propiedad"</strong>, ingrese el nombre y dirección</div></div>
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
    <div class="step"><div class="step-content">Imprima el QR y colóquelo en el puesto de control. Los agentes lo escanearán para marcar su entrada.</div></div>
  </div>

  <div class="tip"><strong>Paciencia:</strong> Este proceso solo se hace una vez por puesto. Una vez creado, el QR funciona permanentemente.</div>

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- 3. RECURSOS HUMANOS                                               -->
<!-- ================================================================ -->
<div class="page">
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Capítulo 3</div>
  <h2>Recursos Humanos</h2>
  <p class="lead">Desde RRHH crea los perfiles de sus empleados, gestiona expedientes, poligrafías y puede dar de baja al personal. Tenga paciencia al completar cada expediente — esta información es valiosa para auditorías.</p>

  <h3>Crear un Empleado</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Vaya a <strong>"RRHH"</strong> en el menú lateral</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Nuevo Empleado"</strong></div></div>
    <div class="step"><div class="step-content">Complete: Nombre, Cédula, Tipo de Empleado, Email, Contraseña y Salario</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Crear Empleado"</strong></div></div>
  </div>

  <h4>Tipos de Empleado</h4>
  <table>
    <thead><tr><th>Tipo</th><th>Función</th><th>Acceso</th></tr></thead>
    <tbody>
      <tr><td><strong>Agente de Campo</strong></td><td>Vigilante en puestos</td><td>Solo Mi Puesto</td></tr>
      <tr><td><strong>Conductor</strong></td><td>Chofer de patrulla</td><td>Flota</td></tr>
      <tr><td><strong>Supervisor</strong></td><td>Supervisión en campo</td><td>Operaciones + Mi Puesto</td></tr>
      <tr><td><strong>Operador</strong></td><td>Control desde oficina</td><td>Operaciones + Capacitaciones</td></tr>
      <tr><td><strong>Administrativo</strong></td><td>Personal de oficina</td><td>Todo excepto Portal Cliente</td></tr>
    </tbody>
  </table>

  <h3>Expediente del Empleado</h3>
  <p>Haga clic sobre cualquier empleado para ver su expediente completo con las siguientes pestañas:</p>
  <div class="steps">
    <div class="step"><div class="step-content"><strong>Ficha:</strong> Datos personales, cédula, carnet, contacto de emergencia. Opción de dar de baja.</div></div>
    <div class="step"><div class="step-content"><strong>Contrato:</strong> Tipo de contrato, salario, estado MITRADEL, adjuntar contrato firmado.</div></div>
    <div class="step"><div class="step-content"><strong>Poligrafía:</strong> Fecha del examen, resultado, adjuntar documento del resultado.</div></div>
    <div class="step"><div class="step-content"><strong>Activos:</strong> Equipos y armas asignados al empleado.</div></div>
    <div class="step"><div class="step-content"><strong>Incapacidades:</strong> Registro de licencias médicas con certificados.</div></div>
    <div class="step"><div class="step-content"><strong>Disciplina:</strong> Llamados de atención, faltas y suspensiones con evidencia.</div></div>
  </div>

  <h3>Dar de Baja a un Empleado</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Abra la ficha del empleado</div></div>
    <div class="step"><div class="step-content">Al fondo encontrará <strong>"Dar de Baja al Agente"</strong> — haga clic para expandir</div></div>
    <div class="step"><div class="step-content">Ingrese la fecha y el motivo (despido, renuncia, abandono)</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Confirmar Baja"</strong>. El empleado quedará marcado pero sus registros se conservan.</div></div>
  </div>

  <div class="warning"><strong>Importante:</strong> Dar de baja a un empleado NO elimina sus registros. Toda la información se conserva para fines de auditoría y cumplimiento legal.</div>

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- 4. CENTRO DE COMANDO                                              -->
<!-- ================================================================ -->
<div class="page">
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Capítulo 4</div>
  <h2>Centro de Comando</h2>
  <p class="lead">Esta es la pantalla central donde el operador gestiona todas las novedades. Dividida en dos secciones: Operaciones (novedades de campo) y Cliente (tickets y daños). Tenga paciencia — cada acción queda registrada para auditoría.</p>

  <h3>Cómo Funciona</h3>
  <p>Las novedades llegan automáticamente cuando un agente reporta algo desde su puesto, o cuando un cliente crea un ticket. Cada novedad tiene un flujo de colores:</p>

  <table>
    <thead><tr><th>Color</th><th>Estado</th><th>Significado</th></tr></thead>
    <tbody>
      <tr><td style="color:#DC2626;font-weight:700;">● Rojo</td><td>Sin Atender</td><td>Nueva novedad, requiere acción inmediata</td></tr>
      <tr><td style="color:#F59E0B;font-weight:700;">● Ámbar</td><td>En Proceso</td><td>El operador está trabajando en ella</td></tr>
      <tr><td style="color:#16A34A;font-weight:700;">● Verde</td><td>Resuelto</td><td>Novedad resuelta, pasa al historial</td></tr>
    </tbody>
  </table>

  <h3>Gestionar una Novedad</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Las novedades sin atender <strong>parpadean en rojo</strong> hasta que les cambie el estado</div></div>
    <div class="step"><div class="step-content">Haga clic sobre la novedad para expandir el detalle</div></div>
    <div class="step"><div class="step-content">Lea la descripción y la <strong>Acción del Agente</strong> (qué hizo el agente en campo)</div></div>
    <div class="step"><div class="step-content">Escriba su nota describiendo la acción que usted tomó (campo obligatorio)</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"En Proceso"</strong> (ámbar) o <strong>"Resuelto"</strong> (verde)</div></div>
  </div>

  <div class="info"><strong>Trazabilidad:</strong> Cada acción queda registrada con quién la hizo, cuándo, y qué nota dejó. Si primero marca "En Proceso" y luego "Resuelto", ambas acciones aparecen en el Historial de Acciones.</div>

  <h3>Estadísticas</h3>
  <p>Cada sección tiene sus propios contadores independientes: <strong>Abiertas</strong> (rojo) y <strong>Resueltas Hoy</strong> (verde). Resolver una novedad de cliente no afecta el contador de operaciones y viceversa.</p>

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- 5. DASHBOARD GERENCIAL                                            -->
<!-- ================================================================ -->
<div class="page">
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Capítulo 5</div>
  <h2>Dashboard Gerencial</h2>
  <p class="lead">Vista ejecutiva para el gerente/dueño. Muestra los KPIs más importantes de la operación en una sola pantalla. No requiere configuración — se alimenta automáticamente de los datos del sistema.</p>

  <h3>KPIs Disponibles</h3>
  <table>
    <thead><tr><th>Indicador</th><th>Qué Muestra</th></tr></thead>
    <tbody>
      <tr><td><strong>Facturación Mensual</strong></td><td>Suma de todos los contratos activos</td></tr>
      <tr><td><strong>Contratos Activos</strong></td><td>Cantidad de contratos vigentes</td></tr>
      <tr><td><strong>Agentes / Requeridos</strong></td><td>Agentes registrados vs requeridos por contratos</td></tr>
      <tr><td><strong>Inventario por Armería</strong></td><td>Armas disponibles agrupadas por modelo y ubicación</td></tr>
      <tr><td><strong>Contratos por Vencer</strong></td><td>Contratos que vencen en los próximos 60 días</td></tr>
      <tr><td><strong>Tickets Abiertos</strong></td><td>Solicitudes de clientes sin resolver</td></tr>
    </tbody>
  </table>

  <h3>Asistente IA</h3>
  <p>En el panel derecho encontrará un asistente de inteligencia artificial. Puede hacerle preguntas en español sobre sus datos operativos:</p>
  <div class="steps">
    <div class="step"><div class="step-content">"¿Dónde pierdo dinero en horas extras?"</div></div>
    <div class="step"><div class="step-content">"¿Cuántos contratos están por vencer?"</div></div>
    <div class="step"><div class="step-content">"¿Cuál es el Bradford Factor de mis agentes?"</div></div>
  </div>

  <div class="tip"><strong>Paciencia:</strong> La IA puede tardar unos segundos en responder. Los resultados se basan en datos reales de su operación.</div>

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- 6. CONSIGNAS                                                      -->
<!-- ================================================================ -->
<div class="page">
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Capítulo 6</div>
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

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- 7. INVENTARIO                                                     -->
<!-- ================================================================ -->
<div class="page">
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Capítulo 7</div>
  <h2>Inventario</h2>
  <p class="lead">Gestione el stock de uniformes, radios y equipos. Controle los activos asignados a cada puesto y registre las entregas a agentes con firma digital. Tenga paciencia al registrar el inventario inicial.</p>

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
    <div class="step"><div class="step-content">Puede descargar el <strong>Acta de Entrega en PDF</strong> desde el historial</div></div>
  </div>

  <div class="info"><strong>Documentos:</strong> Cada entrega genera un acta con número único (ENT-0001), datos del agente, detalle del equipo y acuerdo de responsabilidad. Este documento tiene validez para deslinde de responsabilidades.</div>

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- 8. FLOTA                                                          -->
<!-- ================================================================ -->
<div class="page">
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Capítulo 8</div>
  <h2>Flota Vehicular</h2>
  <p class="lead">Registre sus vehículos, gestione el mantenimiento preventivo y registre inspecciones con evidencia fotográfica.</p>

  <h3>Registrar un Vehículo</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Registrar Vehículo"</strong></div></div>
    <div class="step"><div class="step-content">Complete: placa, tipo, marca/modelo, GPS (opcional), odómetro</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Registrar"</strong></div></div>
  </div>

  <h3>Mantenimiento Preventivo</h3>
  <p>En la pestaña "Mantenimiento Preventivo", registre cada servicio realizado. El sistema actualizará el odómetro y calculará cuándo corresponde el próximo mantenimiento.</p>

  <h3>Inspección de Flota</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Vaya a la pestaña <strong>"Inspección de Flota"</strong></div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Inspección"</strong></div></div>
    <div class="step"><div class="step-content">Seleccione vehículo, fecha, kilometraje</div></div>
    <div class="step"><div class="step-content">Detalle el estado de <strong>chasis/pintura</strong> y <strong>rines/llantas</strong></div></div>
    <div class="step"><div class="step-content">Suba fotografías como evidencia (se comprimen automáticamente)</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Registrar Inspección"</strong></div></div>
  </div>

  <div class="tip"><strong>Paciencia:</strong> Las inspecciones se agrupan automáticamente por mes. Haga clic sobre cualquier inspección para ver el detalle completo.</div>

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- 9. CAPACITACIONES                                                 -->
<!-- ================================================================ -->
<div class="page">
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Capítulo 9</div>
  <h2>Capacitaciones</h2>
  <p class="lead">Gestione los cursos de su empresa y registre las certificaciones de cada agente. El sistema le alertará 60 días antes del vencimiento.</p>

  <h3>Crear un Curso</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Agregar Curso"</strong></div></div>
    <div class="step"><div class="step-content">Ingrese: nombre del curso, descripción y vigencia en meses</div></div>
    <div class="step"><div class="step-content">El curso queda registrado y disponible para asignar a cualquier agente</div></div>
  </div>

  <h3>Registrar Capacitación</h3>
  <div class="steps">
    <div class="step"><div class="step-content">Haga clic en <strong>"+ Registrar Capacitación"</strong></div></div>
    <div class="step"><div class="step-content">Seleccione el agente y el curso (puede crear uno nuevo con el botón "+ Nuevo")</div></div>
    <div class="step"><div class="step-content">Ingrese la <strong>fecha de vencimiento</strong> de la certificación</div></div>
    <div class="step"><div class="step-content">Opcionalmente: calificación y certificado en PDF</div></div>
    <div class="step"><div class="step-content">Haga clic en <strong>"Registrar"</strong></div></div>
  </div>

  <div class="warning"><strong>Alerta automática:</strong> El sistema enviará una alerta 60 días antes de la fecha de vencimiento. Para eliminar la alerta, renueve la certificación del agente.</div>

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
</div>

<!-- ================================================================ -->
<!-- 10. PORTAL DEL CLIENTE                                            -->
<!-- ================================================================ -->
<div class="page">
  <div class="page-header">
    <img src="${logoNg}" alt="NexGuard360" class="page-header-logo" />
    <div class="page-header-right">Manual de Usuario · ${tenantName}</div>
  </div>

  <div class="eyebrow">Capítulo 10</div>
  <h2>Portal del Cliente</h2>
  <p class="lead">Sus clientes (propietarios de edificios, administradores de PH) pueden acceder a un portal donde reportan quejas, solicitan refuerzos y documentan daños.</p>

  <h3>Acceso del Cliente</h3>
  <p>El cliente accede con sus credenciales de rol <strong>"Cliente"</strong> que usted crea desde RRHH o desde el panel de administración.</p>

  <h3>Funcionalidades del Cliente</h3>
  <div class="steps">
    <div class="step"><div class="step-content"><strong>Tickets PQR:</strong> El cliente crea quejas, solicitudes de refuerzo o reportes de fallas de servicio</div></div>
    <div class="step"><div class="step-content"><strong>Reportes de Daños:</strong> Documenta daños en la propiedad con costo estimado, evidencia y responsable</div></div>
  </div>

  <p>Todos los tickets y daños reportados por el cliente aparecen automáticamente en su <strong>Centro de Comando</strong> como "Novedades de Cliente" para que su equipo los gestione.</p>

  <div class="tip"><strong>Paciencia:</strong> El cliente no ve información interna de su operación (turnos, ausencias, personal). Solo ve lo relacionado a su propiedad.</div>

  <div class="page-footer">
    <span>NexGuard360 · Manual de Usuario</span>
    <span>${tenantName}</span>
  </div>
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

  <p style="margin-top:40px;font-size:10px;color:#CBD5E1;">© 2026 NexGuard360 by Nexera. Panamá — Todos los derechos reservados.</p>
</div>

</body>
</html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

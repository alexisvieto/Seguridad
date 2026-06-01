'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Radio, Activity, Calendar, ShieldAlert, Car, Wallet, UserCheck,
  Brain, ClipboardList, Lock, Building2, Package, GraduationCap,
  ArrowRight, Menu, X, Crosshair, Bell, FileText,
} from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease },
};

const modules = [
  {
    id: 'noc',
    icon: <Activity size={24} />,
    name: 'NOC Monitor',
    eyebrow: 'Tiempo real',
    image: '/modules/noc-monitor.png',
    headline: 'Cada puesto, cada agente, cada segundo.',
    body: 'Pantalla de centro de comando con WebSockets. Vea en tiempo real quién está en cada puesto, quién marcó entrada, quién lleva retraso. Alertas instantáneas cuando un puesto queda descubierto. Contactos de emergencia por propiedad con un toque.',
    features: ['WebSockets en tiempo real', 'Estado de GPS validado', 'Alertas de puesto vacante', 'Feed de novedades en vivo', 'Contactos de emergencia'],
  },
  {
    id: 'turnos',
    icon: <Calendar size={24} />,
    name: 'Programación de Turnos',
    eyebrow: 'Anti-solapamiento',
    image: '/modules/turnos.png',
    headline: 'Un agente, un puesto, un horario. Sin conflictos.',
    body: 'Asigne agentes como fijos, temporales o mensuales con rangos de fecha. El sistema impide automáticamente asignar al mismo agente en dos puestos simultáneamente. Soporte completo para turnos nocturnos que cruzan medianoche.',
    features: ['Fijo, temporal, mensual', 'Validación de solapamiento', 'Turnos nocturnos', 'Selector visual de disponibilidad', 'Vista por día del calendario'],
  },
  {
    id: 'cambio',
    icon: <ClipboardList size={24} />,
    name: 'Cambio de Turno',
    eyebrow: 'Reporte PDF',
    image: '/modules/cambio-turno.png',
    headline: 'El reporte que su dueño necesita a las 6 AM.',
    body: 'Detección automática de ausencias, tardanzas y relevistas comparando turnos programados contra marcaciones reales. El operador documenta cada incidencia en el contexto del puesto afectado. Exporta PDF con logo de su agencia y envía a gerencia cuando está listo.',
    features: ['Detección automática no-show', 'Narrativa contextual por puesto', 'Relevista identificado', 'PDF con branding', 'Envío manual a gerencia'],
  },
  {
    id: 'armamento',
    icon: <ShieldAlert size={24} />,
    name: 'Control de Armamento',
    eyebrow: 'Compliance DIASP',
    image: '/modules/armamento.png',
    headline: 'Cada arma trazada. Cada permiso auditado.',
    body: 'Inventario completo con número de serie, tipo, marca y estado. Permisos DIASP con semáforo de vencimientos que alerta antes de que expire. Asignación de custodia a agentes con registro auditable. Compliance de tiro, psicología y dopaje.',
    features: ['Inventario por serial', 'Semáforo de vencimientos DIASP', 'Asignación de custodia', 'Compliance de agentes', 'Historial auditable'],
  },
  {
    id: 'flota',
    icon: <Car size={24} />,
    name: 'Hub de Flota',
    eyebrow: 'Integra su GPS',
    image: '/modules/flota.png',
    headline: 'Quédese con su GPS. Agréguele el cerebro.',
    body: 'Nos integramos a su proveedor GPS actual — Wialon, Hikvision, Geotab u otros. Centralizamos la analítica que ellos no le dan: consumo de combustible por puesto, mantenimiento predictivo por kilometraje, alertas de geocercas en tiempo real al NOC.',
    features: ['Integración con su GPS actual', 'Geocercas y alertas de velocidad', 'Mantenimiento por kilometraje', 'Mapa en tiempo real', 'Historial de recorridos'],
  },
  {
    id: 'nomina',
    icon: <Wallet size={24} />,
    name: 'Nómina Quincenal',
    eyebrow: 'ACH Panamá',
    image: '/modules/nomina.png',
    headline: 'De las marcaciones al banco. Sin escalas.',
    body: 'Motor de liquidación que convierte marcaciones QR en horas trabajadas, distribuye ordinarias y extras, calcula CSS 9.75% + SE 1.25% sobre bruto antes de deducciones. Genera archivo ACH en formato bancario de Panamá listo para subir al banco.',
    features: ['CSS 9.75% + SE 1.25%', 'Tope 96h ordinarias', 'Archivo ACH bancario', 'Sábana de pagos editable', 'Auditoría centavo a centavo'],
  },
  {
    id: 'portal',
    icon: <UserCheck size={24} />,
    name: 'Portal del Cliente',
    eyebrow: 'PQR',
    image: '/modules/portal-cliente.png',
    headline: 'Su cliente ve el servicio sin llamar a su oficina.',
    body: 'El cliente contratante accede a un portal donde ve el estado del servicio en su propiedad. Abre tickets de quejas, solicitudes de refuerzo y fallas de servicio. Reporta daños con costo estimado, evidencia fotográfica y responsable asignado.',
    features: ['Tickets PQR', 'Reportes de daños', 'Evidencia fotográfica', 'Estado del servicio', 'Historial de atención'],
  },
  {
    id: 'ia',
    icon: <Brain size={24} />,
    name: 'Analítica con IA',
    eyebrow: 'Lenguaje natural',
    image: '/modules/analitica-ia.png',
    headline: 'Pregunte en español. Obtenga respuestas con datos.',
    body: 'Motor de analítica que responde preguntas en lenguaje natural sobre sus datos operativos. "¿Dónde pierdo dinero en horas extras?" "¿Cuál es el Bradford Factor de mis agentes?" Respuestas con datos reales, gráficos y recomendaciones.',
    features: ['40+ intents reconocidos', 'Análisis de overtime por propiedad', 'Bradford Factor', 'Rankings de puntualidad', 'Funciona sin API key (keyword fallback)'],
  },
  {
    id: 'rrhh',
    icon: <Lock size={24} />,
    name: 'RRHH y Bóveda Documental',
    eyebrow: 'Legal',
    image: '/modules/rrhh.png',
    headline: 'Blindaje documental para cuando más lo necesita.',
    body: 'Expedientes completos: cédula, CSS, seguro, carnet DIASP, datos bancarios. Contratos MITRADEL con estado de sello. Registros disciplinarios con evidencia fotográfica y validez legal. Bóveda indexada con compresión automática de archivos.',
    features: ['Expedientes digitales', 'Contratos MITRADEL', 'Registros disciplinarios', 'Bóveda documental', 'Portal de autoservicio'],
  },
  {
    id: 'comercial',
    icon: <Building2 size={24} />,
    name: 'Gestión Comercial',
    eyebrow: 'Cadena completa',
    image: '/modules/comercial.png',
    headline: 'De la firma del contrato al agente en el puesto.',
    body: 'Registro de clientes con RUC y representante legal. Contratos con monto mensual y agentes requeridos. Cadena completa: Cliente → Contrato → Propiedad → Puestos → Consignas → Agente. Todo conectado, todo trazable.',
    features: ['Clientes y contratos', 'Propiedades vinculadas', 'Consignas por puesto', 'Estado de sello MITRADEL', 'Cadena auditable'],
  },
  {
    id: 'inventario',
    icon: <Package size={24} />,
    name: 'Inventario y Custodia',
    eyebrow: 'Stock atómico',
    image: '/modules/inventario.png',
    headline: 'Cada radio, cada uniforme, cada firma.',
    body: 'Control de stock con funciones atómicas de incremento y decremento. Custodia de activos por puesto con reporte de daños. Préstamos de equipo a agentes con firma digital capturada en canvas.',
    features: ['Stock atómico SQL', 'Custodia por puesto', 'Firma digital', 'Reporte de daños', 'Historial de préstamos'],
  },
  {
    id: 'capacitaciones',
    icon: <GraduationCap size={24} />,
    name: 'Capacitaciones',
    eyebrow: 'Idoneidad',
    image: '/modules/capacitaciones.png',
    headline: 'El agente correcto en el puesto correcto.',
    body: 'Catálogo de cursos con fechas de vencimiento automático. Registro de capacitaciones por agente. Motor de idoneidad por puesto que valida que el agente cumpla los requisitos de entrenamiento antes de ser asignado.',
    features: ['Cursos con vencimiento', 'Registro por agente', 'Motor de idoneidad', 'Requisitos por puesto', 'Alertas de expiración'],
  },
  {
    id: 'dashboard',
    icon: <Radio size={24} />,
    name: 'Dashboard Gerencial',
    eyebrow: 'KPIs',
    image: '/modules/dashboard.png',
    headline: 'Su agencia entera en una sola pantalla.',
    body: 'KPIs de asistencia, rankings de puntualidad, preservación de flota y asistente de inteligencia artificial. Seleccione rango de fechas y obtenga la fotografía completa de su operación.',
    features: ['KPIs en tiempo real', 'Rankings de agentes', 'Preservación de flota', 'Rango de fechas configurable', 'Asistente IA integrado'],
  },
  {
    id: 'executive',
    icon: <Bell size={24} />,
    name: 'Centro de Comando',
    eyebrow: 'Ejecutivo',
    image: '/modules/executive.png',
    headline: 'Decisiones basadas en datos, no en intuición.',
    body: 'Dashboard ejecutivo con 7 consultas paralelas, gráficos de barras, alertas activas y resumen de cobertura. La vista que el dueño de la agencia necesita para tomar decisiones informadas.',
    features: ['7 queries paralelas', 'Gráficos Recharts', 'Alertas activas', 'Cobertura de puestos', 'Resumen de incidencias'],
  },
];

export default function ProductoPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  return (
    <div className="flex flex-col" style={{ background: 'var(--ng-bg-deep)', color: 'var(--ng-text-primary)' }}>

      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--ng-border)', background: 'rgba(6,10,20,0.85)', backdropFilter: 'blur(16px) saturate(180%)' }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/nexguard360-logo.png" alt="NexGuard360" width={180} height={40} className="h-8 w-auto" priority />
          </Link>
          <div className="hidden items-center gap-8 md:flex" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', color: 'var(--ng-text-secondary)' }}>
            <Link href="/producto" className="transition-colors" style={{ color: 'var(--ng-lime)' }}>Producto</Link>
            <Link href="/precios" className="transition-colors hover:text-[var(--ng-text-primary)]">Precios</Link>
            <Link href="/sobre" className="transition-colors hover:text-[var(--ng-text-primary)]">Sobre</Link>
            <Link href="/contacto" className="transition-colors hover:text-[var(--ng-text-primary)]">Contacto</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-primary)', border: '1px solid rgba(255,255,255,0.10)' }}>Iniciar Sesión</Link>
            <Link href="/contacto" className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer inline-flex items-center gap-2" style={{ fontFamily: 'var(--ng-font-body)', background: 'linear-gradient(135deg, var(--ng-lime), var(--ng-lime-bright))', color: 'var(--ng-bg-deep)' }}>
              Pedir Demo <ArrowRight size={16} />
            </Link>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden cursor-pointer" style={{ color: 'var(--ng-text-secondary)' }}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute top-[20%] right-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none animate-[blob_18s_ease-in-out_infinite]" style={{ background: 'var(--ng-lime-glow)', filter: 'blur(80px)' }} />
        <div className="mx-auto max-w-[1200px] px-6 pt-20 pb-16 text-center">
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)', background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
              <Crosshair size={12} /> Producto
            </span>
            <h1 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.95rem, 5.2vw, 3rem)', letterSpacing: '-0.025em' }}>
              Todo lo que su agencia necesita.{' '}
              <span style={{ color: 'var(--ng-lime)' }}>Nada que sobre.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--ng-text-secondary)' }}>
              14 módulos diseñados desde cero para operaciones de seguridad privada.
              Cada uno resuelve un problema real que usted enfrenta hoy.
            </p>
          </motion.div>
        </div>
      </section>

      {/* MODULE DEEP DIVES */}
      {modules.map((mod, i) => (
        <section
          key={mod.id}
          id={mod.id}
          style={{ background: i % 2 === 0 ? 'var(--ng-bg-surface)' : 'var(--ng-bg-deep)', borderTop: '1px solid var(--ng-border)' }}
        >
          <div className="mx-auto max-w-[1200px] px-6 py-16 md:py-20">
            <div className={`grid gap-10 md:gap-16 items-center ${i % 2 === 0 ? 'md:grid-cols-[1fr_380px]' : 'md:grid-cols-[380px_1fr]'}`}>
              <motion.div {...fadeUp} className={i % 2 !== 0 ? 'md:order-2' : ''}>
                <span className="inline-block mb-3" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)' }}>
                  {mod.eyebrow}
                </span>
                <h2 className="mb-4" style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2rem)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {mod.headline}
                </h2>
                <p className="mb-6" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.95rem', color: 'var(--ng-text-secondary)', lineHeight: 1.7 }}>
                  {mod.body}
                </p>
                <ul className="space-y-2.5">
                  {mod.features.map((f) => (
                    <li key={f} className="flex items-center gap-3" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.88rem', color: 'var(--ng-text-secondary)' }}>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--ng-lime-bg)' }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ng-lime)' }} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>

              <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }} className={i % 2 !== 0 ? 'md:order-1' : ''}>
                <div
                  className="rounded-xl overflow-hidden cursor-pointer transition-all hover:ring-2 hover:ring-[var(--ng-lime)]/30 hover:shadow-[0_0_28px_-6px_rgba(132,204,22,0.18)]"
                  style={{ background: 'var(--ng-bg-float)', border: '1px solid var(--ng-border)' }}
                  onClick={() => setLightboxImage(mod.image)}
                >
                  <Image
                    src={mod.image}
                    alt={mod.name}
                    width={760}
                    height={480}
                    className="w-full h-auto object-cover"
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      ))}

      {/* LIGHTBOX WITH SCROLL ZOOM */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[9999] flex flex-col" onClick={() => { setLightboxImage(null); setZoomLevel(1); }}>
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

          {/* Controls bar */}
          <div className="relative z-20 flex items-center justify-end gap-3 px-6 py-3">
            <span className="rounded-full px-3 py-1" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', color: 'var(--ng-lime)', background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setZoomLevel(1); }}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
              style={{ fontFamily: 'var(--ng-font-body)', background: 'rgba(132,204,22,0.10)', border: '1px solid rgba(132,204,22,0.32)', color: 'var(--ng-lime)' }}
            >
              Restablecer
            </button>
            <button
              onClick={() => { setLightboxImage(null); setZoomLevel(1); }}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer"
              style={{ fontFamily: 'var(--ng-font-body)', background: 'rgba(6,10,20,0.9)', border: '1px solid var(--ng-border)', color: 'var(--ng-text-primary)' }}
            >
              Cerrar <X size={16} />
            </button>
          </div>

          {/* Image container */}
          <div
            className="relative z-10 flex-1 overflow-auto"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              e.preventDefault();
              setZoomLevel((prev) => {
                const delta = e.deltaY > 0 ? -0.15 : 0.15;
                return Math.min(Math.max(prev + delta, 0.5), 4);
              });
            }}
          >
            <div className="min-h-full flex items-center justify-center p-8" style={{ minWidth: zoomLevel > 1 ? `${zoomLevel * 90}vw` : undefined }}>
              <Image
                src={lightboxImage}
                alt="Vista del módulo"
                width={1920}
                height={1080}
                className="rounded-xl"
                style={{
                  width: `${zoomLevel * 80}vw`,
                  maxWidth: 'none',
                  height: 'auto',
                  boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
                }}
              />
            </div>
          </div>

          {/* Hint */}
          <div className="relative z-20 text-center py-2">
            <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.75rem', color: 'var(--ng-text-muted)' }}>
              Use la rueda del mouse para zoom in / zoom out
            </p>
          </div>
        </div>
      )}

      {/* CTA */}
      <section style={{ background: 'var(--ng-bg-surface)', borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 text-center">
          <motion.div {...fadeUp}>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', letterSpacing: '-0.02em' }}>
              14 módulos. Un solo login. Cero parches.
            </h2>
            <p className="mx-auto mt-4 max-w-xl" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', color: 'var(--ng-text-secondary)', lineHeight: 1.7 }}>
              Comience con una prueba gratuita de 14 días. Sin tarjeta, sin compromiso.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/contacto" className="flex h-14 w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-10 text-base font-bold cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', background: 'linear-gradient(135deg, var(--ng-lime), var(--ng-lime-bright))', color: 'var(--ng-bg-deep)', boxShadow: '0 0 22px -6px var(--ng-lime-glow)' }}>
                Pedir Demo Gratuito <ArrowRight size={18} />
              </Link>
              <Link href="/precios" className="flex h-14 w-full sm:w-auto items-center justify-center rounded-xl px-8 text-base font-medium cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--ng-text-primary)' }}>
                Ver Precios
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <Image src="/nexguard360-logo.png" alt="NexGuard360" width={140} height={32} className="h-6 w-auto" />
          <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.78rem', color: 'var(--ng-text-muted)' }}>
            © 2026 NexGuard360 by Nexera. Panamá.
          </p>
          <a href="https://www.nexguard360.com" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', color: 'var(--ng-lime)', letterSpacing: '0.1em' }}>www.nexguard360.com</a>
        </div>
      </footer>
    </div>
  );
}

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="flex flex-col bg-[#060A14] text-zinc-100">

      {/* ============================================================ */}
      {/* NAV                                                           */}
      {/* ============================================================ */}
      <nav className="sticky top-0 z-40 border-b border-zinc-800/40 bg-[#060A14]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600">
              <ShieldIcon />
            </div>
            <span className="text-lg font-bold tracking-tight">NexGuard360</span>
          </div>
          <div className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#features" className="transition-colors hover:text-zinc-100">Funcionalidades</a>
            <a href="#platform" className="transition-colors hover:text-zinc-100">Plataforma</a>
            <a href="#cta" className="transition-colors hover:text-zinc-100">Contacto</a>
          </div>
          <Link
            href="/login"
            className="flex h-10 items-center rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 cursor-pointer"
          >
            Iniciar Sesion
          </Link>
        </div>
      </nav>

      {/* ============================================================ */}
      {/* HERO                                                          */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08)_0%,_transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pb-32 md:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-4 text-sm font-medium tracking-widest text-emerald-500 uppercase">
              Plataforma de gestion para seguridad privada
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl md:leading-none">
              El centro de comando que su empresa de seguridad
              <span className="text-emerald-400"> necesita</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
              Control operativo en tiempo real, bitacoras refinadas con inteligencia artificial,
              blindaje legal documental y telemetria vehicular. Todo en una sola plataforma
              multi-tenant diseñada para Panama.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link
                href="/login"
                className="flex h-14 w-full items-center justify-center rounded-xl bg-emerald-600 px-8 text-base font-semibold text-white transition-colors hover:bg-emerald-500 cursor-pointer sm:w-auto"
              >
                Iniciar Sesion
              </Link>
              <a
                href="#features"
                className="flex h-14 w-full items-center justify-center rounded-xl border border-zinc-700 px-8 text-base font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white cursor-pointer sm:w-auto"
              >
                Ver funcionalidades
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className="mx-auto mt-20 grid max-w-2xl grid-cols-3 gap-8 border-t border-zinc-800/60 pt-10">
            {[
              { value: '27', label: 'Tablas con RLS' },
              { value: '100%', label: 'Aislamiento multi-tenant' },
              { value: '<200ms', label: 'Respuesta de API' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl font-bold tabular-nums text-emerald-400 md:text-3xl">{stat.value}</p>
                <p className="mt-1 text-xs text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FEATURES                                                      */}
      {/* ============================================================ */}
      <section id="features" className="border-t border-zinc-800/40 bg-[#080D18]">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center">
            <p className="text-sm font-medium tracking-widest text-emerald-500 uppercase">Funcionalidades</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">Todo lo que necesita, nada que sobre</h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Cada modulo fue diseñado para resolver un problema real de la operacion de seguridad privada en Panama.
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            {/* Feature 1 */}
            <div className="group rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-8 transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <RealtimeIcon />
              </div>
              <h3 className="mt-5 text-xl font-semibold">Control Operativo Realtime</h3>
              <p className="mt-3 leading-relaxed text-zinc-400">
                Monitor NOC con WebSockets que muestra en tiempo real el estado de cada puesto de vigilancia.
                Detecta ausentismo al instante con alertas visuales de puestos vacantes y notificacion
                directa al supervisor de zona.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['WebSockets', 'GPS Validado', 'QR Check-in'].map((tag) => (
                  <span key={tag} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">{tag}</span>
                ))}
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-8 transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <AiIcon />
              </div>
              <h3 className="mt-5 text-xl font-semibold">Bitacoras con Inteligencia Artificial</h3>
              <p className="mt-3 leading-relaxed text-zinc-400">
                Los agentes dictan novedades por voz desde su celular. La IA transforma el reporte rustico
                en un informe tecnico corporativo y lo envia automaticamente al cliente a las 8:00 AM
                con diseño profesional.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Claude AI', 'Dictado por Voz', 'Reporte 8AM'].map((tag) => (
                  <span key={tag} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">{tag}</span>
                ))}
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-8 transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <VaultIcon />
              </div>
              <h3 className="mt-5 text-xl font-semibold">Blindaje Legal Documental</h3>
              <p className="mt-3 leading-relaxed text-zinc-400">
                Boveda digital indexada para contratos sellados por MITRADEL, fichas CSS, certificaciones DIASP,
                pruebas de dopaje y evidencias fotograficas con validez legal para litigios laborales.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['MITRADEL', 'CSS', 'DIASP', 'Evidencia Legal'].map((tag) => (
                  <span key={tag} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">{tag}</span>
                ))}
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-8 transition-colors hover:border-emerald-500/20 hover:bg-emerald-500/5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <GpsIcon />
              </div>
              <h3 className="mt-5 text-xl font-semibold">Telemetria de Patrullas GPS</h3>
              <p className="mt-3 leading-relaxed text-zinc-400">
                Recepcion de coordenadas GPS vehiculares via webhook de alta frecuencia. Deteccion automatica
                de excesos de velocidad, salidas de zona y alertas de mantenimiento por odometro
                en tiempo real.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Webhook API', 'Geofencing', 'Velocidad', 'Mantenimiento'].map((tag) => (
                  <span key={tag} className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* PLATFORM MODULES                                              */}
      {/* ============================================================ */}
      <section id="platform" className="border-t border-zinc-800/40">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="text-center">
            <p className="text-sm font-medium tracking-widest text-emerald-500 uppercase">Plataforma completa</p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">14 modulos integrados</h2>
          </div>

          <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {[
              'Control de turnos',
              'Bitacora con IA',
              'Monitor NOC',
              'Armamento',
              'Inventario',
              'Flota vehicular',
              'Expedientes RRHH',
              'Contratos legales',
              'Capacitaciones',
              'Portal del cliente',
              'Tickets PQR',
              'Reportes de daños',
              'Boveda documental',
              'Solicitudes internas',
            ].map((mod) => (
              <div key={mod} className="flex items-center gap-2.5 rounded-xl border border-zinc-800/40 bg-zinc-900/20 px-4 py-3">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-sm text-zinc-300">{mod}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* CTA                                                           */}
      {/* ============================================================ */}
      <section id="cta" className="border-t border-zinc-800/40 bg-[#080D18]">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Listo para transformar su operacion
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Inicie sesion para acceder a su espacio de trabajo o contactenos para una demostracion personalizada.
          </p>
          <Link
            href="/login"
            className="mt-10 inline-flex h-14 items-center rounded-xl bg-emerald-600 px-10 text-base font-semibold text-white transition-colors hover:bg-emerald-500 cursor-pointer"
          >
            Acceder a la plataforma
          </Link>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER                                                        */}
      {/* ============================================================ */}
      <footer className="border-t border-zinc-800/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-emerald-600">
              <ShieldIconSm />
            </div>
            <span className="text-sm font-semibold text-zinc-400">NexGuard360 ERP</span>
          </div>
          <p className="text-xs text-zinc-600">Panama — Todos los derechos reservados</p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ShieldIcon() {
  return (
    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function ShieldIconSm() {
  return (
    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function RealtimeIcon() {
  return (
    <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function AiIcon() {
  return (
    <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}

function VaultIcon() {
  return (
    <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function GpsIcon() {
  return (
    <svg className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

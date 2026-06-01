'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Radio, Activity, Calendar, ShieldAlert, Car, Wallet, UserCheck,
  Brain, ClipboardList, Crosshair, ArrowRight, Lock, Building2,
  Package, GraduationCap, ChevronRight, Menu, X,
} from 'lucide-react';
import { useState } from 'react';

// ---------------------------------------------------------------------------
// Animation config
// ---------------------------------------------------------------------------

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease },
};

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex flex-col" style={{ background: 'var(--ng-bg-deep)', color: 'var(--ng-text-primary)' }}>

      {/* ================================================================ */}
      {/* NAV                                                              */}
      {/* ================================================================ */}
      <nav className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--ng-border)', background: 'rgba(6,10,20,0.85)', backdropFilter: 'blur(16px) saturate(180%)' }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/nexguard360-logo.png" alt="NexGuard360" width={180} height={40} className="h-8 w-auto" priority />
          </Link>
          <div className="hidden items-center gap-8 md:flex" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', color: 'var(--ng-text-secondary)' }}>
            <Link href="/producto" className="transition-colors hover:text-[var(--ng-text-primary)]">Producto</Link>
            <Link href="/precios" className="transition-colors hover:text-[var(--ng-text-primary)]">Precios</Link>
            <Link href="/sobre" className="transition-colors hover:text-[var(--ng-text-primary)]">Sobre</Link>
            <Link href="/contacto" className="transition-colors hover:text-[var(--ng-text-primary)]">Contacto</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-primary)', border: '1px solid rgba(255,255,255,0.10)' }}>
              Iniciar Sesión
            </Link>
            <Link href="/contacto" className="px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer inline-flex items-center gap-2" style={{ fontFamily: 'var(--ng-font-body)', background: 'linear-gradient(135deg, var(--ng-lime), var(--ng-lime-bright))', color: 'var(--ng-bg-deep)', boxShadow: '0 0 22px -6px var(--ng-lime-glow)' }}>
              Pedir Demo <ArrowRight size={16} />
            </Link>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden cursor-pointer" style={{ color: 'var(--ng-text-secondary)' }}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t px-6 py-4 flex flex-col gap-4" style={{ borderColor: 'var(--ng-border)', background: 'var(--ng-bg-deep)' }}>
            <Link href="/producto" onClick={() => setMenuOpen(false)} style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-secondary)' }}>Producto</Link>
            <Link href="/precios" onClick={() => setMenuOpen(false)} style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-secondary)' }}>Precios</Link>
            <Link href="/sobre" onClick={() => setMenuOpen(false)} style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-secondary)' }}>Sobre</Link>
            <Link href="/contacto" onClick={() => setMenuOpen(false)} style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-secondary)' }}>Contacto</Link>
            <Link href="/login" onClick={() => setMenuOpen(false)} style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-primary)' }}>Iniciar Sesión</Link>
          </div>
        )}
      </nav>

      {/* ================================================================ */}
      {/* HERO                                                             */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden">
        {/* Blobs */}
        <div className="absolute top-[10%] left-[60%] w-[500px] h-[500px] rounded-full pointer-events-none animate-[blob_18s_ease-in-out_infinite]" style={{ background: 'var(--ng-lime-glow)', filter: 'blur(80px)' }} />
        <div className="absolute top-[55%] left-[-10%] w-[400px] h-[400px] rounded-full pointer-events-none animate-[blob_22s_ease-in-out_infinite_4s]" style={{ background: 'rgba(59,130,246,0.08)', filter: 'blur(80px)' }} />

        <div className="relative mx-auto max-w-[1200px] px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="mx-auto max-w-3xl text-center">
            <motion.div {...fadeUp}>
              <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)', background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--ng-lime)' }} />
                Plataforma de gestión para seguridad privada
              </span>
            </motion.div>

            <motion.h1 {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.95rem, 5.2vw, 3.6rem)', letterSpacing: '-0.025em', lineHeight: 1.08 }}>
              Operación 360 para agencias de seguridad.{' '}
              <span style={{ color: 'var(--ng-lime)' }}>Sin Excel, sin WhatsApp, sin parches.</span>
            </motion.h1>

            <motion.p {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }} className="mx-auto mt-6 max-w-2xl" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--ng-text-secondary)' }}>
              El sistema operativo que centraliza turnos, armamento DIASP, flota, nómina quincenal
              y cumplimiento en un solo cerebro. Construido para Panamá.
            </motion.p>

            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }} className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link href="/contacto" className="flex h-14 w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-8 text-base font-bold cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', background: 'linear-gradient(135deg, var(--ng-lime), var(--ng-lime-bright))', color: 'var(--ng-bg-deep)', boxShadow: '0 0 22px -6px var(--ng-lime-glow)' }}>
                Pedir Demo Gratuito <ArrowRight size={18} />
              </Link>
              <Link href="/precios" className="flex h-14 w-full sm:w-auto items-center justify-center rounded-xl px-8 text-base font-medium cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--ng-text-primary)' }}>
                Ver Precios
              </Link>
            </motion.div>
          </div>

          {/* Stats */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.4 }} className="mx-auto mt-20 grid max-w-3xl grid-cols-2 lg:grid-cols-4 overflow-hidden" style={{ gap: 1, background: 'var(--ng-border)', borderRadius: 16, border: '1px solid var(--ng-border)' }}>
            {[
              { value: '38', label: 'Tablas con RLS' },
              { value: '307', label: 'Agencias DIASP en Panamá' },
              { value: '100%', label: 'Multi-tenant aislado' },
              { value: '<200ms', label: 'Respuesta de API' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center text-center" style={{ background: 'var(--ng-bg-deep)', padding: '1.75rem 1rem' }}>
                <span style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.1rem, 2.2vw, 1.55rem)', color: 'var(--ng-lime)', lineHeight: 1.1 }}>{s.value}</span>
                <span className="mt-2" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.78rem', color: 'var(--ng-text-secondary)' }}>{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* 3 KEY MESSAGES                                                   */}
      {/* ================================================================ */}
      <section style={{ background: 'var(--ng-bg-surface)', borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Eyebrow>Por qué NexGuard360</Eyebrow>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', letterSpacing: '-0.02em' }}>
              Su agencia entera, en una sola pantalla
            </h2>
          </motion.div>

          <div className="grid gap-8 md:grid-cols-3">
            <MessageCard
              icon={<Radio size={20} />}
              title="Reemplaza 3-5 sistemas con uno."
              body="Scheduling, control de armas, flota vehicular, planilla quincenal, portal de clientes. Todo conectado, todo en español, todo con compliance Panamá."
              delay={0}
            />
            <MessageCard
              icon={<ShieldAlert size={20} />}
              title="Compliance DIASP, CSS y MITRADEL out-of-the-box."
              body="Aportes calculados (CSS 9.75% + SE 1.25%), archivo ACH bancario listo para subir al banco, permisos de armas auditables, MITRADEL al día."
              delay={0.08}
            />
            <MessageCard
              icon={<Brain size={20} />}
              title="La capa de inteligencia sobre su operación."
              body="Nos integramos a su proveedor GPS actual (Wialon, Hikvision, Geotab) y le agregamos analítica: consumo por puesto, mantenimiento predictivo, alertas de geocercas al NOC."
              delay={0.16}
            />
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* MODULES SHOWCASE                                                 */}
      {/* ================================================================ */}
      <section style={{ borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Eyebrow>Plataforma completa</Eyebrow>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', letterSpacing: '-0.02em' }}>
              15 módulos integrados
            </h2>
            <p className="mx-auto mt-4 max-w-xl" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', color: 'var(--ng-text-secondary)', lineHeight: 1.7 }}>
              Cada módulo fue diseñado para resolver un problema real de la operación de seguridad privada.
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: <Activity size={20} />, name: 'NOC Monitor', tag: 'Tiempo real', desc: 'Estado de cada puesto con WebSockets. Alertas instantáneas de puestos vacantes.' },
              { icon: <Calendar size={20} />, name: 'Programación de Turnos', tag: 'Anti-solapamiento', desc: 'Fijo, temporal o mensual. Validación que impide asignar al mismo agente en dos puestos.' },
              { icon: <ClipboardList size={20} />, name: 'Cambio de Turno', tag: 'Reporte PDF', desc: 'Detección automática de ausencias y tardanzas. Reporte con narrativa contextual por puesto.' },
              { icon: <ShieldAlert size={20} />, name: 'Control de Armamento', tag: 'DIASP', desc: 'Inventario, permisos con semáforo de vencimiento, asignación de custodia auditable.' },
              { icon: <Car size={20} />, name: 'Hub de Flota', tag: 'Integra su GPS', desc: 'Se conecta a su proveedor GPS actual. Geocercas, alertas de velocidad, mantenimiento por kilometraje.' },
              { icon: <Wallet size={20} />, name: 'Nómina Quincenal', tag: 'ACH Panamá', desc: 'CSS 9.75% + SE 1.25%, tope 96h ordinarias, archivo bancario listo para el banco.' },
              { icon: <UserCheck size={20} />, name: 'Portal del Cliente', tag: 'PQR', desc: 'Su cliente ve el servicio, reporta daños y abre tickets sin llamar a su oficina.' },
              { icon: <Brain size={20} />, name: 'Analítica IA', tag: 'Lenguaje natural', desc: 'Pregunte en español: "¿dónde pierdo dinero en extras?" y obtenga respuesta con datos reales.' },
              { icon: <Lock size={20} />, name: 'Bóveda Documental', tag: 'Legal', desc: 'Contratos MITRADEL, fichas CSS, certificaciones DIASP, pruebas de dopaje. Todo indexado.' },
              { icon: <Building2 size={20} />, name: 'Gestión Comercial', tag: 'Clientes + Contratos', desc: 'Cliente → Contrato → Propiedad → Puestos → Consignas → Agente. Cadena completa.' },
              { icon: <Package size={20} />, name: 'Inventario y Custodia', tag: 'Stock atómico', desc: 'Control de uniformes, equipos, radios. Préstamos con firma digital del agente.' },
              { icon: <GraduationCap size={20} />, name: 'Capacitaciones', tag: 'Idoneidad', desc: 'Cursos con vencimiento automático. Motor de idoneidad por puesto.' },
            ].map((m, i) => (
              <motion.div key={m.name} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.05 }}>
                <ModuleCard icon={m.icon} name={m.name} tag={m.tag} desc={m.desc} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PRICING TEASER                                                   */}
      {/* ================================================================ */}
      <section style={{ background: 'var(--ng-bg-surface)', borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-12">
            <Eyebrow>Precios transparentes</Eyebrow>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', letterSpacing: '-0.02em' }}>
              Un plan para cada tamaño de agencia
            </h2>
            <p className="mx-auto mt-4 max-w-xl" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', color: 'var(--ng-text-secondary)', lineHeight: 1.7 }}>
              Desde 1 hasta 1,200+ vigilantes. Todos los planes incluyen 14 días de prueba sin tarjeta.
            </p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            {[
              { name: 'Operativo', band: '1-30', price: '$650', popular: false },
              { name: 'Operativo+', band: '31-80', price: '$1,100', popular: false },
              { name: 'Profesional', band: '81-180', price: '$1,900', popular: true },
              { name: 'Profesional+', band: '181-350', price: '$3,000', popular: false },
            ].map((plan, i) => (
              <motion.div key={plan.name} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}
                className="relative rounded-xl p-6 flex flex-col"
                style={{
                  background: 'var(--ng-bg-surface)',
                  border: plan.popular ? '2px solid var(--ng-lime)' : '1px solid var(--ng-border)',
                  borderTop: plan.popular ? '2px solid var(--ng-lime)' : '2px solid var(--ng-lime)',
                }}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--ng-lime)', background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
                    Popular
                  </span>
                )}
                <p style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{plan.name}</p>
                <p className="mt-1" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', color: 'var(--ng-text-muted)', letterSpacing: '0.1em' }}>{plan.band} vigilantes</p>
                <p className="mt-4" style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: '2rem', color: 'var(--ng-lime)' }}>
                  {plan.price}<span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--ng-text-muted)' }}>/mes</span>
                </p>
                <Link href="/precios" className="mt-6 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', background: plan.popular ? 'linear-gradient(135deg, var(--ng-lime), var(--ng-lime-bright))' : 'transparent', color: plan.popular ? 'var(--ng-bg-deep)' : 'var(--ng-text-primary)', border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.10)' }}>
                  {plan.popular ? 'Comenzar Prueba Gratis' : 'Ver Detalles'} <ChevronRight size={16} />
                </Link>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeUp} className="mt-8 text-center">
            <Link href="/precios" className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-lime)' }}>
              Ver los 7 planes completos + comparador de funcionalidades <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* SOCIAL PROOF                                                     */}
      {/* ================================================================ */}
      <section style={{ borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-24">
          <motion.div {...fadeUp} className="text-center mb-12">
            <Eyebrow>Construido desde la operación real</Eyebrow>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', letterSpacing: '-0.02em' }}>
              Construido por ingenieros que se sentaron con dueños de agencias
            </h2>
          </motion.div>

          <motion.div {...fadeUp} className="mx-auto max-w-2xl rounded-xl p-8" style={{ background: 'var(--ng-bg-surface)', border: '1px solid var(--ng-border)', borderLeft: '3px solid var(--ng-lime)' }}>
            <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--ng-text-secondary)' }}>
              &ldquo;Sabemos lo que es estar pendiente de cada marcación a las 6 am. NexGuard360 nació de meses
              sentados con operadores reales, entendiendo por qué las planillas no cuadraban, por qué los
              reportes llegaban tarde y por qué WhatsApp no escala.&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
                <Crosshair size={18} style={{ color: 'var(--ng-lime)' }} />
              </div>
              <div>
                <p style={{ fontFamily: 'var(--ng-font-body)', fontWeight: 600, fontSize: '0.92rem' }}>Equipo Nexera</p>
                <p style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', color: 'var(--ng-text-muted)', letterSpacing: '0.1em' }}>AI-First Software Factory</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CTA FINAL                                                        */}
      {/* ================================================================ */}
      <section style={{ background: 'var(--ng-bg-surface)', borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 md:py-24 text-center">
          <motion.div {...fadeUp}>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.75rem, 4vw, 2.6rem)', letterSpacing: '-0.02em' }}>
              Su agencia opera como un centro de comando.
            </h2>
            <p className="mx-auto mt-4 max-w-xl" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', color: 'var(--ng-text-secondary)', lineHeight: 1.7 }}>
              14 días de prueba sin tarjeta. Setup en menos de 24 horas.
              Soporte en español por ingenieros que entienden su operación.
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

      {/* ================================================================ */}
      {/* FOOTER                                                           */}
      {/* ================================================================ */}
      <footer style={{ borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-12">
          <div className="grid gap-10 md:grid-cols-4">
            <div>
              <Image src="/nexguard360-logo.png" alt="NexGuard360" width={160} height={36} className="h-7 w-auto mb-4" />
              <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem', color: 'var(--ng-text-secondary)', lineHeight: 1.6 }}>
                Seguridad Operativa y Control 360.
                Construido en Panamá para LATAM.
              </p>
            </div>
            <div>
              <p className="mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-text-muted)' }}>Producto</p>
              <div className="flex flex-col gap-2.5" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem', color: 'var(--ng-text-secondary)' }}>
                <Link href="/producto" className="hover:text-[var(--ng-text-primary)] transition-colors">Funcionalidades</Link>
                <Link href="/precios" className="hover:text-[var(--ng-text-primary)] transition-colors">Precios</Link>
                <Link href="/contacto" className="hover:text-[var(--ng-text-primary)] transition-colors">Solicitar Demo</Link>
              </div>
            </div>
            <div>
              <p className="mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-text-muted)' }}>Empresa</p>
              <div className="flex flex-col gap-2.5" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem', color: 'var(--ng-text-secondary)' }}>
                <Link href="/sobre" className="hover:text-[var(--ng-text-primary)] transition-colors">Sobre Nosotros</Link>
                <Link href="/blog" className="hover:text-[var(--ng-text-primary)] transition-colors">Blog</Link>
                <Link href="/seguridad" className="hover:text-[var(--ng-text-primary)] transition-colors">Seguridad</Link>
              </div>
            </div>
            <div>
              <p className="mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-text-muted)' }}>Legal</p>
              <div className="flex flex-col gap-2.5" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem', color: 'var(--ng-text-secondary)' }}>
                <Link href="/terminos" className="hover:text-[var(--ng-text-primary)] transition-colors">Términos de Servicio</Link>
                <Link href="/privacidad" className="hover:text-[var(--ng-text-primary)] transition-colors">Política de Privacidad</Link>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderTop: '1px solid var(--ng-border)' }}>
            <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.78rem', color: 'var(--ng-text-muted)' }}>
              © {new Date().getFullYear()} NexGuard360 by Nexera. Panamá — Todos los derechos reservados.
            </p>
            <a href="https://www.nexguard360.com" target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', color: 'var(--ng-lime)', letterSpacing: '0.1em' }}>
              www.nexguard360.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="block mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)' }}>
      {children}
    </span>
  );
}

function MessageCard({ icon, title, body, delay }: { icon: React.ReactNode; title: string; body: string; delay: number }) {
  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay }} className="rounded-xl p-7 flex flex-col gap-4" style={{ background: 'var(--ng-bg-surface)', border: '1px solid var(--ng-border)', borderTop: '2px solid var(--ng-lime)' }}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
        <span style={{ color: 'var(--ng-lime)' }}>{icon}</span>
      </div>
      <h3 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.25 }}>{title}</h3>
      <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', color: 'var(--ng-text-secondary)', lineHeight: 1.65 }}>{body}</p>
    </motion.div>
  );
}

function ModuleCard({ icon, name, tag, desc }: { icon: React.ReactNode; name: string; tag: string; desc: string }) {
  return (
    <div className="rounded-xl p-6 flex flex-col gap-3 transition-colors hover:border-[rgba(132,204,22,0.3)] cursor-pointer" style={{ background: 'var(--ng-bg-surface)', border: '1px solid var(--ng-border)', borderTop: '2px solid var(--ng-lime)' }}>
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
          <span style={{ color: 'var(--ng-lime)' }}>{icon}</span>
        </div>
        <span style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.7rem', fontWeight: 600, color: 'var(--ng-lime)', letterSpacing: '0.04em' }}>{tag}</span>
      </div>
      <h3 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.25 }}>{name}</h3>
      <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.875rem', color: 'var(--ng-text-secondary)', lineHeight: 1.65 }}>{desc}</p>
    </div>
  );
}

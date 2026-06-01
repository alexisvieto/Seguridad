'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Minus, ChevronRight, Menu, X } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease },
};

// ---------------------------------------------------------------------------
// Pricing data
// ---------------------------------------------------------------------------

interface Plan {
  name: string;
  band: string;
  monthly: number;
  annual: number;
  setup: number;
  trial: string;
  popular: boolean;
  cta: 'trial' | 'demo';
}

const plans: Plan[] = [
  { name: 'Operativo', band: '1-30', monthly: 650, annual: 6240, setup: 0, trial: '14 días sin tarjeta', popular: false, cta: 'trial' },
  { name: 'Operativo+', band: '31-80', monthly: 1100, annual: 10560, setup: 0, trial: '14 días sin tarjeta', popular: false, cta: 'trial' },
  { name: 'Profesional', band: '81-180', monthly: 1900, annual: 18240, setup: 500, trial: '14 días sin tarjeta', popular: true, cta: 'trial' },
  { name: 'Profesional+', band: '181-350', monthly: 3000, annual: 28800, setup: 1500, trial: '14 días sin tarjeta', popular: false, cta: 'trial' },
  { name: 'Enterprise', band: '351-700', monthly: 4500, annual: 43200, setup: 3000, trial: 'Solicitar demo', popular: false, cta: 'demo' },
  { name: 'Enterprise+', band: '701-1,200', monthly: 6500, annual: 62400, setup: 5000, trial: 'Solicitar demo', popular: false, cta: 'demo' },
  { name: 'Corporate', band: '1,200+', monthly: 8500, annual: 0, setup: 7500, trial: 'Solicitar demo', popular: false, cta: 'demo' },
];

type FeatureAvail = boolean | 'addon' | 'from-pro' | 'from-pro+' | 'from-ent+' | 'from-corp';

interface FeatureRow {
  name: string;
  availability: FeatureAvail[];
}

const features: FeatureRow[] = [
  { name: 'Gestión comercial (clientes, contratos, propiedades)', availability: [true, true, true, true, true, true, true] },
  { name: 'Programación de turnos con anti-solapamiento', availability: [true, true, true, true, true, true, true] },
  { name: 'Cambio de turno + reporte PDF', availability: [true, true, true, true, true, true, true] },
  { name: 'NOC Monitor en tiempo real', availability: [true, true, true, true, true, true, true] },
  { name: 'Dashboard ejecutivo + analítica IA', availability: [true, true, true, true, true, true, true] },
  { name: 'Recursos humanos + expedientes', availability: [true, true, true, true, true, true, true] },
  { name: 'Portal cliente con tickets PQR', availability: [true, true, true, true, true, true, true] },
  { name: 'Reportes automáticos por email', availability: [true, true, true, true, true, true, true] },
  { name: 'Inventario y custodia de activos', availability: [true, true, true, true, true, true, true] },
  { name: 'Control de armamento DIASP', availability: [false, false, true, true, true, true, true] },
  { name: 'Hub de flota vehicular (integra su GPS)', availability: [false, false, true, true, true, true, true] },
  { name: 'Marcación QR + GPS por puesto', availability: [false, false, false, true, true, true, true] },
  { name: 'Nómina ACH bancario Panamá', availability: [false, false, false, true, true, true, true] },
  { name: 'Subdominio propio', availability: [false, false, false, false, false, true, true] },
  { name: 'Branding white-label', availability: [false, false, false, false, false, true, true] },
  { name: 'SLA garantizado', availability: [false, false, false, false, false, true, true] },
  { name: 'Integraciones a medida', availability: [false, false, false, false, false, false, true] },
];

const faqs = [
  { q: '¿Qué pasa si mi agencia crece y necesito cambiar de plan?', a: 'Sube de banda en cualquier momento desde su portal de cliente. El cambio se prorratea automáticamente. Sin penalidades ni contratos de permanencia.' },
  { q: '¿La prueba gratuita requiere tarjeta de crédito?', a: 'No. Los planes Operativo hasta Profesional+ incluyen 14 días de prueba sin necesidad de ingresar tarjeta. Empiece a usar la plataforma hoy mismo.' },
  { q: '¿Qué incluye el setup fee?', a: 'Configuración inicial de su tenant, migración de datos existentes (Excel, CSV), capacitación del equipo de operaciones y soporte dedicado durante las primeras 2 semanas.' },
  { q: '¿Puedo cancelar en cualquier momento?', a: 'Sí. Sin contratos de permanencia. Si cancela, mantiene acceso hasta el final del periodo facturado. Sus datos se conservan 90 días por si decide regresar.' },
  { q: '¿En qué moneda se factura?', a: 'Todos los precios están en dólares americanos (USD), la moneda de curso legal en Panamá. Facturación via Stripe con recibo fiscal automático.' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PreciosPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex flex-col" style={{ background: 'var(--ng-bg-deep)', color: 'var(--ng-text-primary)' }}>

      {/* NAV */}
      <nav className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--ng-border)', background: 'rgba(6,10,20,0.85)', backdropFilter: 'blur(16px) saturate(180%)' }}>
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/nexguard360-logo.png" alt="NexGuard360" width={180} height={40} className="h-8 w-auto" priority />
          </Link>
          <div className="hidden items-center gap-8 md:flex" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', color: 'var(--ng-text-secondary)' }}>
            <Link href="/producto" className="transition-colors hover:text-[var(--ng-text-primary)]">Producto</Link>
            <Link href="/precios" className="transition-colors" style={{ color: 'var(--ng-lime)' }}>Precios</Link>
            <Link href="/sobre" className="transition-colors hover:text-[var(--ng-text-primary)]">Sobre</Link>
            <Link href="/contacto" className="transition-colors hover:text-[var(--ng-text-primary)]">Contacto</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-primary)', border: '1px solid rgba(255,255,255,0.10)' }}>
              Iniciar Sesión
            </Link>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden cursor-pointer" style={{ color: 'var(--ng-text-secondary)' }}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t px-6 py-4 flex flex-col gap-4" style={{ borderColor: 'var(--ng-border)', background: 'var(--ng-bg-deep)' }}>
            <Link href="/producto" onClick={() => setMenuOpen(false)} style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-secondary)' }}>Producto</Link>
            <Link href="/precios" onClick={() => setMenuOpen(false)} style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-lime)' }}>Precios</Link>
            <Link href="/sobre" onClick={() => setMenuOpen(false)} style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-secondary)' }}>Sobre</Link>
            <Link href="/contacto" onClick={() => setMenuOpen(false)} style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-secondary)' }}>Contacto</Link>
            <Link href="/login" onClick={() => setMenuOpen(false)} style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-primary)' }}>Iniciar Sesión</Link>
          </div>
        )}
      </nav>

      {/* HEADER */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16 pb-8 text-center">
        <motion.div {...fadeUp}>
          <span className="inline-block mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)' }}>
            Precios transparentes
          </span>
          <h1 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.95rem, 5.2vw, 3rem)', letterSpacing: '-0.025em' }}>
            Un plan para cada tamaño de agencia
          </h1>
          <p className="mx-auto mt-4 max-w-xl" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', color: 'var(--ng-text-secondary)', lineHeight: 1.7 }}>
            Desde 1 hasta 1,200+ vigilantes. Sin per-seat, sin sorpresas.
            Su agencia entra a su banda y sube cuando crece.
          </p>
        </motion.div>

        {/* Toggle */}
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="mt-8 inline-flex rounded-full p-1" style={{ background: 'var(--ng-bg-surface)', border: '1px solid var(--ng-border)' }}>
          <button
            onClick={() => setIsAnnual(false)}
            className="rounded-full px-6 py-2.5 text-sm font-medium transition-all cursor-pointer"
            style={{
              fontFamily: 'var(--ng-font-body)',
              background: !isAnnual ? 'var(--ng-lime)' : 'transparent',
              color: !isAnnual ? 'var(--ng-bg-deep)' : 'var(--ng-text-secondary)',
              fontWeight: !isAnnual ? 700 : 500,
            }}
          >
            Mensual
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className="rounded-full px-6 py-2.5 text-sm font-medium transition-all cursor-pointer flex items-center gap-2"
            style={{
              fontFamily: 'var(--ng-font-body)',
              background: isAnnual ? 'var(--ng-lime)' : 'transparent',
              color: isAnnual ? 'var(--ng-bg-deep)' : 'var(--ng-text-secondary)',
              fontWeight: isAnnual ? 700 : 500,
            }}
          >
            Anual <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: isAnnual ? 'rgba(0,0,0,0.15)' : 'var(--ng-lime-bg)', color: isAnnual ? 'var(--ng-bg-deep)' : 'var(--ng-lime)' }}>20% off</span>
          </button>
        </motion.div>
      </section>

      {/* PLAN CARDS */}
      <section className="mx-auto max-w-[1200px] px-6 pb-20">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
          {plans.slice(0, 4).map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} isAnnual={isAnnual} delay={i * 0.06} />
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {plans.slice(4).map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} isAnnual={isAnnual} delay={(i + 4) * 0.06} />
          ))}
        </div>
      </section>

      {/* FEATURE COMPARISON */}
      <section style={{ background: 'var(--ng-bg-surface)', borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <motion.div {...fadeUp} className="text-center mb-12">
            <span className="inline-block mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)' }}>
              Comparador
            </span>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', letterSpacing: '-0.02em' }}>
              ¿Qué incluye cada plan?
            </h2>
          </motion.div>

          <motion.div {...fadeUp} className="overflow-x-auto">
            <table className="w-full min-w-[900px]" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem' }}>
              <thead>
                <tr>
                  <th className="text-left pb-4 pr-6" style={{ color: 'var(--ng-text-muted)', fontWeight: 500, width: '30%' }}>Funcionalidad</th>
                  {plans.map((p) => (
                    <th key={p.name} className="pb-4 text-center" style={{ color: 'var(--ng-text-secondary)', fontWeight: 600, fontSize: '0.78rem' }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((f, fi) => (
                  <tr key={f.name} style={{ borderTop: '1px solid var(--ng-border-soft)' }}>
                    <td className="py-3 pr-6" style={{ color: 'var(--ng-text-secondary)' }}>{f.name}</td>
                    {f.availability.map((a, ai) => (
                      <td key={ai} className="py-3 text-center">
                        {a === true ? (
                          <Check size={16} className="mx-auto" style={{ color: 'var(--ng-lime)' }} />
                        ) : (
                          <Minus size={16} className="mx-auto" style={{ color: 'var(--ng-text-muted)' }} />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[800px] px-6 py-20">
          <motion.div {...fadeUp} className="text-center mb-12">
            <span className="inline-block mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)' }}>
              Preguntas frecuentes
            </span>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', letterSpacing: '-0.02em' }}>
              Resolvemos sus dudas
            </h2>
          </motion.div>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.05 }}
                className="rounded-xl overflow-hidden"
                style={{ background: 'var(--ng-bg-surface)', border: '1px solid var(--ng-border)' }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left cursor-pointer"
                >
                  <span style={{ fontFamily: 'var(--ng-font-body)', fontWeight: 600, fontSize: '0.92rem' }}>{faq.q}</span>
                  <ChevronRight
                    size={18}
                    className="shrink-0 ml-4 transition-transform"
                    style={{ color: 'var(--ng-text-muted)', transform: openFaq === i ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4">
                    <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', color: 'var(--ng-text-secondary)', lineHeight: 1.65 }}>{faq.a}</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--ng-bg-surface)', borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 text-center">
          <motion.div {...fadeUp}>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', letterSpacing: '-0.02em' }}>
              Comience hoy, sin compromiso
            </h2>
            <p className="mx-auto mt-4 max-w-xl" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', color: 'var(--ng-text-secondary)', lineHeight: 1.7 }}>
              14 días de prueba sin tarjeta. Migre sus datos existentes en menos de 24 horas.
            </p>
            <Link href="/contacto" className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-xl px-10 text-base font-bold cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', background: 'linear-gradient(135deg, var(--ng-lime), var(--ng-lime-bright))', color: 'var(--ng-bg-deep)', boxShadow: '0 0 22px -6px var(--ng-lime-glow)' }}>
              Pedir Demo Gratuito <ArrowRight size={18} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image src="/nexguard360-logo.png" alt="NexGuard360" width={140} height={32} className="h-6 w-auto" />
          </div>
          <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.78rem', color: 'var(--ng-text-muted)' }}>
            © {new Date().getFullYear()} NexGuard360 by Nexera. Panamá.
          </p>
          <a href="https://www.nexguard360.com" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', color: 'var(--ng-lime)', letterSpacing: '0.1em' }}>
            www.nexguard360.com
          </a>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlanCard({ plan, isAnnual, delay }: { plan: Plan; isAnnual: boolean; delay: number }) {
  const displayPrice = isAnnual && plan.annual > 0
    ? Math.round(plan.annual / 12)
    : plan.monthly;

  const annualTotal = plan.annual > 0 ? plan.annual : null;
  const isCorporate = plan.name === 'Corporate';

  return (
    <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay }}
      className="relative rounded-xl p-6 flex flex-col"
      style={{
        background: 'var(--ng-bg-surface)',
        border: plan.popular ? '2px solid var(--ng-lime)' : '1px solid var(--ng-border)',
        borderTop: '2px solid var(--ng-lime)',
      }}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--ng-lime)', background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
          Popular
        </span>
      )}

      <p style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{plan.name}</p>
      <p className="mt-1" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', color: 'var(--ng-text-muted)', letterSpacing: '0.1em' }}>
        {plan.band} vigilantes
      </p>

      <div className="mt-4">
        {isCorporate ? (
          <p style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: '1.6rem', color: 'var(--ng-lime)' }}>
            Desde ${displayPrice.toLocaleString()}<span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--ng-text-muted)' }}>/mes</span>
          </p>
        ) : (
          <p style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: '2rem', color: 'var(--ng-lime)' }}>
            ${displayPrice.toLocaleString()}<span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--ng-text-muted)' }}>/mes</span>
          </p>
        )}
        {isAnnual && annualTotal && (
          <p className="mt-1" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.76rem', color: 'var(--ng-text-muted)' }}>
            Facturado anualmente a ${annualTotal.toLocaleString()}
          </p>
        )}
      </div>

      {plan.setup > 0 && (
        <p className="mt-2" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.76rem', color: 'var(--ng-text-muted)' }}>
          Setup: ${plan.setup.toLocaleString()} (una vez)
        </p>
      )}

      <p className="mt-3" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.68rem', color: 'var(--ng-text-secondary)', letterSpacing: '0.05em' }}>
        {plan.trial}
      </p>

      <div className="mt-auto pt-6">
        <Link
          href={plan.cta === 'trial' ? '/contacto' : '/contacto'}
          className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold cursor-pointer w-full"
          style={{
            fontFamily: 'var(--ng-font-body)',
            background: plan.popular ? 'linear-gradient(135deg, var(--ng-lime), var(--ng-lime-bright))' : 'transparent',
            color: plan.popular ? 'var(--ng-bg-deep)' : 'var(--ng-text-primary)',
            border: plan.popular ? 'none' : '1px solid rgba(255,255,255,0.10)',
            boxShadow: plan.popular ? '0 0 22px -6px var(--ng-lime-glow)' : 'none',
          }}
        >
          {plan.cta === 'trial' ? 'Comenzar Prueba Gratis' : 'Solicitar Demo'} <ChevronRight size={16} />
        </Link>
      </div>
    </motion.div>
  );
}

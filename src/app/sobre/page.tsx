'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Crosshair, Code, Users, Shield, Menu, X } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease },
};

export default function SobrePage() {
  const [menuOpen, setMenuOpen] = useState(false);

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
            <Link href="/precios" className="transition-colors hover:text-[var(--ng-text-primary)]">Precios</Link>
            <Link href="/sobre" className="transition-colors" style={{ color: 'var(--ng-lime)' }}>Sobre</Link>
            <Link href="/contacto" className="transition-colors hover:text-[var(--ng-text-primary)]">Contacto</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
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
      <section className="mx-auto max-w-[1200px] px-6 pt-20 pb-16">
        <motion.div {...fadeUp} className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)', background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
            <Crosshair size={12} /> Sobre nosotros
          </span>
          <h1 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.95rem, 5.2vw, 3rem)', letterSpacing: '-0.025em' }}>
            Construido por ingenieros que pasaron meses{' '}
            <span style={{ color: 'var(--ng-lime)' }}>entendiendo cómo opera una agencia de verdad.</span>
          </h1>
        </motion.div>
      </section>

      {/* STORY */}
      <section style={{ background: 'var(--ng-bg-surface)', borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[800px] px-6 py-20">
          <motion.div {...fadeUp} className="space-y-6" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', color: 'var(--ng-text-secondary)', lineHeight: 1.8 }}>
            <p>
              NexGuard360 nació dentro de <strong style={{ color: 'var(--ng-text-primary)' }}>Nexera</strong>, una fábrica de software AI-first con sede en Panamá. No somos una empresa de seguridad que decidió hacer software. Somos ingenieros que se sentaron con dueños de agencias, operadores de turno y supervisores de campo para entender por qué las planillas no cuadraban, por qué los reportes llegaban tarde y por qué WhatsApp no escala.
            </p>
            <p>
              Descubrimos que las agencias de seguridad privada operan con 3 a 5 sistemas desconectados: un Excel para la planilla, WhatsApp para comunicar novedades, Word para los reportes del turno, un sistema de GPS que no habla con nada más, y carpetas físicas para los expedientes de RRHH. El resultado es caos operativo disfrazado de proceso.
            </p>
            <p>
              NexGuard360 reemplaza todo eso con una sola plataforma multi-tenant donde cada agencia tiene su espacio aislado, sus datos protegidos, y sus procesos automatizados. Desde la marcación QR del agente en campo hasta el archivo ACH que sube al banco.
            </p>
            <p style={{ color: 'var(--ng-lime)', fontWeight: 600 }}>
              Lo que usted ve construido es lo que vendemos. No hay mockups ni roadmaps vacíos. Cada módulo funciona hoy.
            </p>
          </motion.div>
        </div>
      </section>

      {/* VALUES */}
      <section style={{ borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20">
          <motion.div {...fadeUp} className="text-center mb-12">
            <span className="inline-block mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)' }}>
              Principios
            </span>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', letterSpacing: '-0.02em' }}>
              Cómo construimos NexGuard360
            </h2>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: <Code size={20} />, title: 'Dogfood primero', desc: 'El CRM con el que vendemos NexGuard360 también es nuestro producto. Esta web también está construida con nuestro stack. Usamos lo que vendemos.' },
              { icon: <Users size={20} />, title: 'Diseñado desde el campo', desc: 'Cada módulo nació de una conversación real con un operador de turno, un supervisor de campo o un dueño de agencia. No hay features inventadas.' },
              { icon: <Shield size={20} />, title: 'Compliance como cimiento', desc: 'DIASP, CSS 9.75%, SE 1.25%, MITRADEL, ACH bancario Panamá. No son add-ons. Son la base sobre la que está construido todo el sistema.' },
            ].map((v, i) => (
              <motion.div key={v.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }} className="rounded-xl p-7 flex flex-col gap-4" style={{ background: 'var(--ng-bg-surface)', border: '1px solid var(--ng-border)', borderTop: '2px solid var(--ng-lime)' }}>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
                  <span style={{ color: 'var(--ng-lime)' }}>{v.icon}</span>
                </div>
                <h3 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{v.title}</h3>
                <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', color: 'var(--ng-text-secondary)', lineHeight: 1.65 }}>{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* NEXERA */}
      <section style={{ background: 'var(--ng-bg-surface)', borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[800px] px-6 py-20 text-center">
          <motion.div {...fadeUp}>
            <span className="inline-block mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-text-muted)' }}>
              Construido por
            </span>
            <h2 className="mb-4" style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.02em' }}>Nexera</h2>
            <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', color: 'var(--ng-text-secondary)', lineHeight: 1.7 }}>
              Fábrica de software AI-first. Construimos productos verticales para industrias que todavía operan con Excel y WhatsApp. NexGuard360 es nuestro primer producto para seguridad privada. Estamos en Panamá y construimos para LATAM.
            </p>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-20 text-center">
          <motion.div {...fadeUp}>
            <h2 style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', letterSpacing: '-0.02em' }}>
              ¿Listo para ver NexGuard360 en acción?
            </h2>
            <Link href="/contacto" className="mt-8 inline-flex h-14 items-center justify-center gap-2 rounded-xl px-10 text-base font-bold cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', background: 'linear-gradient(135deg, var(--ng-lime), var(--ng-lime-bright))', color: 'var(--ng-bg-deep)', boxShadow: '0 0 22px -6px var(--ng-lime-glow)' }}>
              Solicitar Demo <ArrowRight size={18} />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <Image src="/nexguard360-logo.png" alt="NexGuard360" width={140} height={32} className="h-6 w-auto" />
          <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.78rem', color: 'var(--ng-text-muted)' }}>© 2026 NexGuard360 by Nexera. Panamá.</p>
          <a href="https://www.nexguard360.com" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', color: 'var(--ng-lime)', letterSpacing: '0.1em' }}>www.nexguard360.com</a>
        </div>
      </footer>
    </div>
  );
}

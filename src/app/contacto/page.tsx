'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Send, Mail, MapPin, Phone, Menu, X, Crosshair } from 'lucide-react';

const ease = [0.16, 1, 0.3, 1] as const;
const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.7, ease },
};

export default function ContactoPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', company: '', agents: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setStatus('sending');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  }, [form]);

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

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
            <Link href="/sobre" className="transition-colors hover:text-[var(--ng-text-primary)]">Sobre</Link>
            <Link href="/contacto" className="transition-colors" style={{ color: 'var(--ng-lime)' }}>Contacto</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="px-5 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', color: 'var(--ng-text-primary)', border: '1px solid rgba(255,255,255,0.10)' }}>Iniciar Sesión</Link>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden cursor-pointer" style={{ color: 'var(--ng-text-secondary)' }}>
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* CONTENT */}
      <section className="mx-auto max-w-[1200px] px-6 py-20">
        <div className="grid gap-16 md:grid-cols-[1fr_420px]">

          {/* LEFT: Info */}
          <motion.div {...fadeUp}>
            <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)', background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
              <Crosshair size={12} /> Contacto
            </span>
            <h1 className="mb-6" style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: 'clamp(1.95rem, 4vw, 2.8rem)', letterSpacing: '-0.025em', lineHeight: 1.1 }}>
              Solicite una demo personalizada{' '}
              <span style={{ color: 'var(--ng-lime)' }}>para su agencia.</span>
            </h1>
            <p className="mb-10" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', color: 'var(--ng-text-secondary)', lineHeight: 1.7 }}>
              Le mostramos NexGuard360 con datos de su operación real.
              Sin presentaciones genéricas. Sin compromiso.
              Un ingeniero del equipo le guía personalmente.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
                  <Mail size={18} style={{ color: 'var(--ng-lime)' }} />
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--ng-font-body)', fontWeight: 600, fontSize: '0.92rem' }}>Email</p>
                  <a href="mailto:ventas@nexguard360.com" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', color: 'var(--ng-text-secondary)' }}>ventas@nexguard360.com</a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
                  <Phone size={18} style={{ color: 'var(--ng-lime)' }} />
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--ng-font-body)', fontWeight: 600, fontSize: '0.92rem' }}>Teléfono</p>
                  <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', color: 'var(--ng-text-secondary)' }}>+507 6000-0000</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--ng-lime-bg)', border: '1px solid var(--ng-lime-border)' }}>
                  <MapPin size={18} style={{ color: 'var(--ng-lime)' }} />
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--ng-font-body)', fontWeight: 600, fontSize: '0.92rem' }}>Ubicación</p>
                  <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', color: 'var(--ng-text-secondary)' }}>Ciudad de Panamá, Panamá</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT: Form */}
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
            <form onSubmit={handleSubmit} className="rounded-xl p-7 space-y-5" style={{ background: 'var(--ng-bg-surface)', border: '1px solid var(--ng-border)' }}>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem', fontWeight: 500, color: 'var(--ng-text-secondary)' }}>Nombre completo</label>
                <input
                  type="text" required value={form.name} onChange={(e) => updateField('name', e.target.value)}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
                  style={{ fontFamily: 'var(--ng-font-body)', background: 'var(--ng-bg-input)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--ng-text-primary)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ng-lime)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
                />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem', fontWeight: 500, color: 'var(--ng-text-secondary)' }}>Email corporativo</label>
                <input
                  type="email" required value={form.email} onChange={(e) => updateField('email', e.target.value)}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
                  style={{ fontFamily: 'var(--ng-font-body)', background: 'var(--ng-bg-input)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--ng-text-primary)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ng-lime)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
                />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem', fontWeight: 500, color: 'var(--ng-text-secondary)' }}>Nombre de la agencia</label>
                <input
                  type="text" value={form.company} onChange={(e) => updateField('company', e.target.value)}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
                  style={{ fontFamily: 'var(--ng-font-body)', background: 'var(--ng-bg-input)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--ng-text-primary)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ng-lime)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
                />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem', fontWeight: 500, color: 'var(--ng-text-secondary)' }}>Cantidad aproximada de vigilantes</label>
                <input
                  type="text" value={form.agents} onChange={(e) => updateField('agents', e.target.value)}
                  placeholder="Ej: 120"
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
                  style={{ fontFamily: 'var(--ng-font-body)', background: 'var(--ng-bg-input)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--ng-text-primary)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ng-lime)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
                />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem', fontWeight: 500, color: 'var(--ng-text-secondary)' }}>Mensaje (opcional)</label>
                <textarea
                  value={form.message} onChange={(e) => updateField('message', e.target.value)}
                  rows={3}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors resize-none"
                  style={{ fontFamily: 'var(--ng-font-body)', background: 'var(--ng-bg-input)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--ng-text-primary)' }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ng-lime)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
                />
              </div>

              {status === 'sent' ? (
                <div className="rounded-xl py-4 text-center" style={{ background: 'rgba(16,208,128,0.10)', border: '1px solid rgba(16,208,128,0.3)' }}>
                  <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', fontWeight: 600, color: '#10D080' }}>
                    Solicitud enviada. Le contactaremos en menos de 24 horas.
                  </p>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold cursor-pointer disabled:opacity-50"
                  style={{ fontFamily: 'var(--ng-font-body)', background: 'linear-gradient(135deg, var(--ng-lime), var(--ng-lime-bright))', color: 'var(--ng-bg-deep)', boxShadow: '0 0 22px -6px var(--ng-lime-glow)' }}
                >
                  {status === 'sending' ? 'Enviando...' : 'Solicitar Demo Gratuito'} <Send size={16} />
                </button>
              )}

              {status === 'error' && (
                <p className="text-center" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.86rem', color: '#EF4444' }}>
                  Error al enviar. Intente de nuevo o escríbanos a ventas@nexguard360.com
                </p>
              )}
            </form>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--ng-border)' }}>
        <div className="mx-auto max-w-[1200px] px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <Image src="/nexguard360-logo.png" alt="NexGuard360" width={140} height={32} className="h-6 w-auto" />
          <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.78rem', color: 'var(--ng-text-muted)' }}>© {new Date().getFullYear()} NexGuard360 by Nexera. Panamá.</p>
          <a href="https://www.nexguard360.com" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', color: 'var(--ng-lime)', letterSpacing: '0.1em' }}>www.nexguard360.com</a>
        </div>
      </footer>
    </div>
  );
}

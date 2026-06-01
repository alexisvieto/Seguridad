'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

type LoginStep = 'form' | 'routing';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState<LoginStep>('form');

  // Clear error when inputs change
  useEffect(() => { setError(''); }, [email, password]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError('');
    setStep('routing');

    try {
      const supabase = getSupabaseBrowserClient();

      // 1. Authenticate
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError('Credenciales invalidas. Verifique su email y contraseña.');
        setStep('form');
        return;
      }

      // 2. Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Error al obtener la sesion del usuario.');
        setStep('form');
        return;
      }

      // 3. Get memberships to determine role and tenant
      const { data: memberships } = await supabase
        .from('memberships')
        .select('role, tenant_id, tenants(slug)')
        .eq('user_id', user.id)
        .limit(1);

      const membership = memberships?.[0];

      if (!membership) {
        setError('Su cuenta no esta asociada a ninguna empresa. Contacte al administrador.');
        setStep('form');
        return;
      }

      const tenantSlug = membership.tenants?.slug;

      if (!tenantSlug) {
        setError('Error al resolver la empresa. Contacte al administrador.');
        setStep('form');
        return;
      }

      // 4. Route based on role
      let dashboardPath: string;

      if (membership.role === 'owner' || membership.role === 'admin') {
        dashboardPath = '/dashboard/live-monitor';
      } else if (membership.role === 'viewer') {
        dashboardPath = '/cliente';
      } else {
        dashboardPath = '/puesto';
      }

      window.location.href = `/${tenantSlug}${dashboardPath}`;
    } catch {
      setError('Error de conexion. Intente nuevamente.');
      setStep('form');
    }
  }, [email, password]);

  return (
    <div className="flex min-h-dvh flex-col bg-[#060A14]">

      {/* Header */}
      <header className="px-6 py-5">
        <Link href="/" className="inline-block cursor-pointer">
          <Image src="/nexguard360-logo.png" alt="NexGuard360" width={200} height={44} className="h-9 w-auto" />
        </Link>
      </header>

      {/* Form */}
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">

          <div className="text-center">
            <h1 className="text-2xl font-bold text-zinc-100">Iniciar sesion</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Ingrese sus credenciales para acceder a la plataforma
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Correo electronico</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="usuario@empresa.com"
                disabled={step === 'routing'}
                className="mt-1 block w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-zinc-400">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Ingrese su contraseña"
                disabled={step === 'routing'}
                className="mt-1 block w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              />
            </label>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={step === 'routing' || !email.trim() || !password}
              className="flex w-full min-h-[52px] items-center justify-center rounded-xl bg-emerald-600 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
            >
              {step === 'routing' ? (
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Conectando...</span>
                </div>
              ) : (
                'Iniciar sesion'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-zinc-600">
            Al iniciar sesion, acepta los terminos de servicio y la politica de privacidad de NexGuard360 ERP.
          </p>
        </div>
      </main>
    </div>
  );
}

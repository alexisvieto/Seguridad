import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Seguridad | NexGuard360',
  description: 'Cómo NexGuard360 protege los datos de su agencia de seguridad privada.',
};

export default function SeguridadPage() {
  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--ng-bg-deep)', color: 'var(--ng-text-primary)' }}>
      <Nav />
      <main className="mx-auto max-w-[800px] px-6 py-20 flex-1">
        <span className="inline-block mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)' }}>Seguridad</span>
        <h1 className="mb-4" style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.02em' }}>Cómo protegemos sus datos</h1>
        <p className="mb-10" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1.05rem', color: 'var(--ng-text-secondary)', lineHeight: 1.7 }}>
          La seguridad de los datos de su agencia es nuestra prioridad.
          Estas son las medidas técnicas y organizativas que implementamos.
        </p>

        <div className="space-y-6" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.95rem', color: 'var(--ng-text-secondary)', lineHeight: 1.8 }}>
          <Section title="Aislamiento Multi-Tenant">
            Cada agencia opera en su propio espacio aislado. Utilizamos Row Level Security (RLS) a nivel de PostgreSQL en las 38 tablas del sistema. Las políticas de seguridad se ejecutan en el motor de base de datos, no en la aplicación, lo que significa que incluso en caso de un error en el código, los datos de un tenant no son accesibles por otro.
          </Section>

          <Section title="Cifrado">
            Todos los datos en tránsito están protegidos con TLS 1.3. Los datos en reposo utilizan cifrado AES-256 a nivel de disco. Los documentos en la bóveda documental se almacenan en buckets privados con URLs firmadas de acceso temporal que expiran en minutos.
          </Section>

          <Section title="Autenticación">
            Utilizamos Supabase Auth con tokens JWT que se renuevan automáticamente en Server Components. Las contraseñas se procesan con bcrypt. Cada sesión se valida contra la membresía del tenant y el rol del usuario antes de ejecutar cualquier operación.
          </Section>

          <Section title="Validación de Pertenencia">
            Cada API route valida explícitamente que el usuario autenticado tiene membresía en el tenant al que intenta acceder y que su rol tiene los permisos necesarios para la operación solicitada. No se confía en datos enviados por el cliente para determinar el tenant.
          </Section>

          <Section title="Protección de Inputs">
            Todos los datos de entrada se validan con esquemas Zod estrictos antes de ser procesados. Las consultas a la base de datos se parametrizan automáticamente a través del cliente de Supabase, eliminando vectores de inyección SQL.
          </Section>

          <Section title="Control de Armamento">
            Los registros de armamento cumplen con los requisitos de trazabilidad de DIASP. Cada asignación de arma, transferencia de custodia y registro de cumplimiento queda registrado con timestamp y usuario que ejecutó la acción.
          </Section>

          <Section title="Webhooks y APIs Externas">
            Los webhooks de telemetría GPS utilizan autenticación timing-safe para prevenir ataques de timing. Los secretos de cron y GPS se validan con comparación de tiempo constante.
          </Section>

          <Section title="Infraestructura">
            La plataforma se ejecuta en Vercel (edge network global) con base de datos en Supabase (PostgreSQL 17). Ambos proveedores cumplen con SOC 2 Type II. Los backups de la base de datos se realizan automáticamente cada hora.
          </Section>

          <Section title="Reporte de Vulnerabilidades">
            Si descubre una vulnerabilidad de seguridad, repórtela responsablemente a <a href="mailto:seguridad@nexguard360.com" style={{ color: 'var(--ng-lime)' }}>seguridad@nexguard360.com</a>. Nos comprometemos a responder en 48 horas y a no tomar acciones legales contra investigadores que reporten de buena fe.
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3" style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 700, fontSize: '1.15rem', color: 'var(--ng-text-primary)' }}>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--ng-border)', background: 'rgba(6,10,20,0.85)', backdropFilter: 'blur(16px) saturate(180%)' }}>
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
        <Link href="/"><Image src="/nexguard360-logo.png" alt="NexGuard360" width={180} height={40} className="h-8 w-auto" priority /></Link>
        <div className="hidden md:flex items-center gap-8" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.92rem', color: 'var(--ng-text-secondary)' }}>
          <Link href="/producto" className="hover:text-[var(--ng-text-primary)] transition-colors">Producto</Link>
          <Link href="/precios" className="hover:text-[var(--ng-text-primary)] transition-colors">Precios</Link>
          <Link href="/contacto" className="hover:text-[var(--ng-text-primary)] transition-colors">Contacto</Link>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--ng-border)' }}>
      <div className="mx-auto max-w-[1200px] px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <Image src="/nexguard360-logo.png" alt="NexGuard360" width={140} height={32} className="h-6 w-auto" />
        <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.78rem', color: 'var(--ng-text-muted)' }}>© {new Date().getFullYear()} NexGuard360 by Nexera. Panamá.</p>
      </div>
    </footer>
  );
}

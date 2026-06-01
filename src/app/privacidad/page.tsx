import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Política de Privacidad | NexGuard360',
  description: 'Política de privacidad y protección de datos de NexGuard360.',
};

export default function PrivacidadPage() {
  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--ng-bg-deep)', color: 'var(--ng-text-primary)' }}>
      <Nav />
      <main className="mx-auto max-w-[800px] px-6 py-20 flex-1">
        <span className="inline-block mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)' }}>Legal</span>
        <h1 className="mb-8" style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.02em' }}>Política de Privacidad</h1>
        <div className="space-y-6" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.95rem', color: 'var(--ng-text-secondary)', lineHeight: 1.8 }}>
          <p><strong style={{ color: 'var(--ng-text-primary)' }}>Última actualización:</strong> 1 de junio de 2026</p>

          <Section title="1. Información que Recopilamos">
            Recopilamos información que usted nos proporciona directamente al crear una cuenta y usar la plataforma: nombre, correo electrónico, nombre de la empresa, datos de empleados y agentes (según lo ingresado por el cliente), registros de marcación GPS, fotografías de evidencia, y documentos subidos a la bóveda documental.
          </Section>

          <Section title="2. Cómo Utilizamos su Información">
            Utilizamos la información exclusivamente para: (a) proveer y mantener el Servicio, (b) procesar la nómina y generar reportes, (c) enviar comunicaciones relacionadas con el servicio (reportes diarios, alertas), (d) mejorar la plataforma. No vendemos, alquilamos ni compartimos datos personales con terceros para fines de marketing.
          </Section>

          <Section title="3. Aislamiento de Datos (Multi-Tenant)">
            NexGuard360 opera bajo un modelo multi-tenant con aislamiento estricto. Los datos de cada empresa están separados mediante Row Level Security (RLS) a nivel de base de datos. Ningún usuario puede acceder a datos de otro tenant bajo ninguna circunstancia.
          </Section>

          <Section title="4. Almacenamiento y Seguridad">
            Los datos se almacenan en servidores de Supabase (infraestructura PostgreSQL) con cifrado en tránsito (TLS 1.3) y en reposo (AES-256). Los documentos se almacenan en buckets privados con URLs firmadas de acceso temporal. Las contraseñas se almacenan usando hashing bcrypt, nunca en texto plano.
          </Section>

          <Section title="5. Coordenadas GPS">
            Las coordenadas GPS se recopilan durante la marcación de entrada y salida de los agentes, y para el rastreo de flota vehicular. Estos datos se utilizan exclusivamente para validar la ubicación del agente en el puesto asignado y para analítica de flota. No se comparten con terceros.
          </Section>

          <Section title="6. Retención de Datos">
            Los datos se conservan mientras la suscripción esté activa. Tras la cancelación, los datos se retienen por 90 días calendario para permitir la reactivación. Después de este período, los datos se eliminan de forma irreversible de todos los sistemas, incluyendo backups.
          </Section>

          <Section title="7. Derechos del Usuario">
            Usted tiene derecho a: (a) acceder a sus datos, (b) solicitar la corrección de datos inexactos, (c) solicitar la eliminación de sus datos, (d) exportar sus datos en formato estándar. Para ejercer estos derechos, contacte a <a href="mailto:privacidad@nexguard360.com" style={{ color: 'var(--ng-lime)' }}>privacidad@nexguard360.com</a>.
          </Section>

          <Section title="8. Cookies">
            Utilizamos cookies estrictamente necesarias para el funcionamiento de la autenticación y la sesión del usuario. No utilizamos cookies de seguimiento, publicidad ni analytics de terceros que identifiquen personalmente al usuario.
          </Section>

          <Section title="9. Procesadores Terceros">
            Utilizamos los siguientes servicios de terceros para operar la plataforma: Supabase (base de datos y almacenamiento), Stripe (procesamiento de pagos), Resend (envío de emails), Vercel (hosting). Cada uno opera bajo sus propias políticas de privacidad y cumple con estándares de seguridad SOC 2.
          </Section>

          <Section title="10. Cambios a esta Política">
            Notificaremos cambios sustanciales a esta política por email con al menos 15 días de anticipación. El uso continuado del Servicio después de la notificación constituye aceptación de la política actualizada.
          </Section>

          <Section title="11. Contacto">
            Para consultas sobre privacidad: <a href="mailto:privacidad@nexguard360.com" style={{ color: 'var(--ng-lime)' }}>privacidad@nexguard360.com</a>
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

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Términos de Servicio | NexGuard360',
  description: 'Términos y condiciones de uso de la plataforma NexGuard360 para agencias de seguridad privada.',
};

export default function TerminosPage() {
  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--ng-bg-deep)', color: 'var(--ng-text-primary)' }}>
      <Nav />
      <main className="mx-auto max-w-[800px] px-6 py-20 flex-1">
        <span className="inline-block mb-4" style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)' }}>Legal</span>
        <h1 className="mb-8" style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: '2rem', letterSpacing: '-0.02em' }}>Términos de Servicio</h1>
        <div className="space-y-6" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.95rem', color: 'var(--ng-text-secondary)', lineHeight: 1.8 }}>
          <p><strong style={{ color: 'var(--ng-text-primary)' }}>Última actualización:</strong> 1 de junio de 2026</p>

          <Section title="1. Aceptación de los Términos">
            Al acceder o utilizar la plataforma NexGuard360 (&ldquo;el Servicio&rdquo;), usted acepta estar sujeto a estos Términos de Servicio. Si no está de acuerdo con alguno de estos términos, no utilice el Servicio. NexGuard360 es operado por Nexera (&ldquo;la Empresa&rdquo;), con domicilio en Ciudad de Panamá, República de Panamá.
          </Section>

          <Section title="2. Descripción del Servicio">
            NexGuard360 es una plataforma SaaS multi-tenant diseñada para la gestión operativa de empresas de seguridad privada. El Servicio incluye, según el plan contratado: gestión de turnos, control de armamento, administración de flota, nómina quincenal, portal de clientes, analítica con inteligencia artificial, y demás módulos disponibles en la plataforma.
          </Section>

          <Section title="3. Cuentas y Acceso">
            Cada empresa cliente (&ldquo;Tenant&rdquo;) recibe un espacio aislado dentro de la plataforma. Usted es responsable de mantener la confidencialidad de las credenciales de acceso de su cuenta y de todas las actividades que ocurran bajo su cuenta. Debe notificar inmediatamente a NexGuard360 sobre cualquier uso no autorizado.
          </Section>

          <Section title="4. Planes y Facturación">
            Los precios están publicados en la página de precios y están expresados en dólares americanos (USD). La facturación se realiza mensual o anualmente según el plan seleccionado a través de Stripe. Los cambios de plan se prorratean automáticamente. No hay contratos de permanencia mínima.
          </Section>

          <Section title="5. Período de Prueba">
            Algunos planes incluyen un período de prueba gratuito de 14 días sin necesidad de ingresar método de pago. Al finalizar el período de prueba, si no se ha registrado un método de pago, la suscripción se cancela automáticamente y el acceso se suspende.
          </Section>

          <Section title="6. Propiedad de los Datos">
            Todos los datos ingresados por el cliente en la plataforma son propiedad exclusiva del cliente. NexGuard360 actúa únicamente como procesador de datos. En caso de cancelación, los datos se conservan por 90 días calendario, después de los cuales se eliminan de forma permanente.
          </Section>

          <Section title="7. Disponibilidad del Servicio">
            NexGuard360 se compromete a mantener una disponibilidad del 99.5% mensual para los planes con SLA garantizado. Para los demás planes, el Servicio se provee &ldquo;tal cual&rdquo; con el mejor esfuerzo comercialmente razonable.
          </Section>

          <Section title="8. Uso Aceptable">
            El cliente se compromete a utilizar el Servicio únicamente para fines legales relacionados con la gestión de operaciones de seguridad privada. Está prohibido utilizar la plataforma para almacenar contenido ilegal, realizar actividades fraudulentas, o intentar acceder a datos de otros tenants.
          </Section>

          <Section title="9. Limitación de Responsabilidad">
            En la máxima medida permitida por la ley, NexGuard360 no será responsable por daños indirectos, incidentales, especiales o consecuentes que resulten del uso o la imposibilidad de uso del Servicio.
          </Section>

          <Section title="10. Modificaciones">
            NexGuard360 se reserva el derecho de modificar estos términos en cualquier momento. Los cambios significativos se notificarán con al menos 30 días de anticipación por email al administrador de la cuenta.
          </Section>

          <Section title="11. Legislación Aplicable">
            Estos términos se rigen por las leyes de la República de Panamá. Cualquier controversia será sometida a los tribunales competentes de la Ciudad de Panamá.
          </Section>

          <Section title="12. Contacto">
            Para consultas legales: <a href="mailto:legal@nexguard360.com" style={{ color: 'var(--ng-lime)' }}>legal@nexguard360.com</a>
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
        <p style={{ fontFamily: 'var(--ng-font-body)', fontSize: '0.78rem', color: 'var(--ng-text-muted)' }}>© 2026 NexGuard360 by Nexera. Panamá.</p>
      </div>
    </footer>
  );
}

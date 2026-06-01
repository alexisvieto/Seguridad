import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-dvh items-center justify-center" style={{ background: 'var(--ng-bg-deep)', color: 'var(--ng-text-primary)' }}>
      <Image src="/nexguard360-logo.png" alt="NexGuard360" width={180} height={40} className="h-8 w-auto mb-10" />
      <p style={{ fontFamily: 'var(--ng-font-mono)', fontSize: '0.7rem', letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--ng-lime)' }}>Error 404</p>
      <h1 className="mt-3 mb-4" style={{ fontFamily: 'var(--ng-font-display)', fontWeight: 800, fontSize: '2.5rem' }}>Página no encontrada</h1>
      <p className="mb-8" style={{ fontFamily: 'var(--ng-font-body)', fontSize: '1rem', color: 'var(--ng-text-secondary)' }}>La ruta que busca no existe o fue movida.</p>
      <Link href="/" className="inline-flex h-12 items-center justify-center rounded-xl px-8 text-sm font-bold cursor-pointer" style={{ fontFamily: 'var(--ng-font-body)', background: 'linear-gradient(135deg, var(--ng-lime), var(--ng-lime-bright))', color: 'var(--ng-bg-deep)' }}>
        Volver al Inicio
      </Link>
    </div>
  );
}

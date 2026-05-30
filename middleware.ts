import { type NextRequest, NextResponse } from 'next/server';
import {
  createSupabaseMiddlewareClient,
  applySessionCookies,
} from '@/lib/supabase/middleware';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'app', 'admin', 'mail']);

const PUBLIC_PATHS = new Set(['/login', '/register', '/api/health']);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  for (const p of PUBLIC_PATHS) {
    if (pathname.startsWith(`${p}/`)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Subdomain extraction
// ---------------------------------------------------------------------------

function extractTenantSlug(hostname: string, rootDomain: string): string | null {
  const host = hostname.split(':')[0] ?? '';
  const root = rootDomain.split(':')[0] ?? '';

  // Bare root domain, localhost, or IP → no tenant
  if (host === root || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  // Development: *.localhost pattern (e.g. alfa-seguridad.localhost:3000)
  if (host.endsWith('.localhost')) {
    const slug = host.replace('.localhost', '');
    if (slug && !slug.includes('.') && !RESERVED_SUBDOMAINS.has(slug)) {
      return slug;
    }
    return null;
  }

  // Production: slug.tudominio.com
  if (root && host.endsWith(`.${root}`)) {
    const slug = host.replace(`.${root}`, '');
    if (slug && !slug.includes('.') && !RESERVED_SUBDOMAINS.has(slug)) {
      return slug;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Refresh Supabase session (JWT) on every request
  const { response: sessionResponse, user } =
    await createSupabaseMiddlewareClient(request);

  // 2. Extract tenant slug from the hostname
  const hostname = request.headers.get('host') ?? '';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000';
  const tenantSlug = extractTenantSlug(hostname, rootDomain);

  // ------------------------------------------------------------------
  // A) No tenant subdomain → landing / global routes
  // ------------------------------------------------------------------
  if (!tenantSlug) {
    if (!user && !isPublicPath(pathname) && pathname !== '/') {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return applySessionCookies(sessionResponse, NextResponse.redirect(loginUrl));
    }
    return sessionResponse;
  }

  // ------------------------------------------------------------------
  // B) Tenant subdomain detected → rewrite to /[tenant]/...
  // ------------------------------------------------------------------

  // Unauthenticated → redirect to login on the tenant subdomain
  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return applySessionCookies(sessionResponse, NextResponse.redirect(loginUrl));
  }

  // Build the internal rewrite URL:
  //   alfa-seguridad.midominio.com/dashboard
  //     → internally serves /alfa-seguridad/dashboard
  //   alfa-seguridad.midominio.com/
  //     → internally serves /alfa-seguridad
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = pathname === '/'
    ? `/${tenantSlug}`
    : `/${tenantSlug}${pathname}`;

  const rewriteResponse = NextResponse.rewrite(rewriteUrl);

  // Propagate the tenant slug via header for Server Components
  rewriteResponse.headers.set('x-tenant-slug', tenantSlug);

  // Propagate refreshed auth cookies onto the rewrite response
  return applySessionCookies(sessionResponse, rewriteResponse);
}

// ---------------------------------------------------------------------------
// Matcher — skip static assets
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

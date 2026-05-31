import { type NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Edge-compatible middleware — zero external dependencies
// Only parses URL/hostname for subdomain routing. No DB calls, no Supabase.
// Auth validation happens in [tenant]/layout.tsx via Server Components.
// ---------------------------------------------------------------------------

const RESERVED_SUBDOMAINS = new Set(['www', 'api', 'app', 'admin', 'mail']);

const PUBLIC_PATHS = new Set(['/', '/login', '/register']);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/login/')) return true;
  if (pathname.startsWith('/register/')) return true;
  return false;
}

function extractTenantSlug(hostname: string, rootDomain: string): string | null {
  const host = hostname.split(':')[0] ?? '';
  const root = rootDomain.split(':')[0] ?? '';

  if (host === root || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  if (host.endsWith('.localhost')) {
    const slug = host.replace('.localhost', '');
    if (slug && !slug.includes('.') && !RESERVED_SUBDOMAINS.has(slug)) {
      return slug;
    }
    return null;
  }

  if (root && host.endsWith(`.${root}`)) {
    const slug = host.replace(`.${root}`, '');
    if (slug && !slug.includes('.') && !RESERVED_SUBDOMAINS.has(slug)) {
      return slug;
    }
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') ?? '';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost:3000';

  const tenantSlug = extractTenantSlug(hostname, rootDomain);

  // ------------------------------------------------------------------
  // A) No tenant subdomain → pass through to global routes
  // ------------------------------------------------------------------
  if (!tenantSlug) {
    return NextResponse.next();
  }

  // ------------------------------------------------------------------
  // B) Tenant subdomain detected
  // ------------------------------------------------------------------

  // Public paths and API routes are global — never rewrite
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Rewrite to /[tenant]/... without changing the browser URL
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/${tenantSlug}${pathname}`;

  const response = NextResponse.rewrite(rewriteUrl);
  response.headers.set('x-tenant-slug', tenantSlug);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt|json|woff|woff2|ttf|css|js|map)$).*)',
  ],
};

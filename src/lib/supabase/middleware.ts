import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/shared/types/database';

/**
 * Creates a Supabase client bound to the middleware request/response cycle.
 * Refreshes the JWT silently and propagates updated auth cookies to the browser
 * regardless of whether the final response is next(), redirect(), or rewrite().
 */
export async function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}

/**
 * Copies all Set-Cookie headers from the Supabase session response
 * onto a different response (redirect or rewrite) so the browser
 * receives the refreshed auth tokens.
 */
export function applySessionCookies(
  source: NextResponse,
  target: NextResponse,
): NextResponse {
  const setCookieHeaders = source.headers.getSetCookie();
  for (const raw of setCookieHeaders) {
    target.headers.append('set-cookie', raw);
  }
  return target;
}

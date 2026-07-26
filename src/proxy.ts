import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/terms", "/privacy"];

// Name of the request header this proxy uses to forward the network-verified
// user id to the app render, so `requireUser()` doesn't have to pay for a
// second `auth.getUser()` round-trip for the same request. Only proxy.ts
// (which runs on every matched request, ahead of the app render) is allowed
// to set this — see src/lib/session.ts for why that makes it trustworthy.
export const TRUSTED_USER_ID_HEADER = "x-lfg-user-id";

export async function proxy(request: NextRequest) {
  const cookiesToApply: {
    name: string;
    value: string;
    options?: CookieOptions;
  }[] = [];

  const supabase = createServerClient(
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
          cookiesToApply.push(...cookiesToSet);
        },
      },
    },
  );

  // Optimistic check only — refreshes the session cookie if needed.
  // Real authorization happens server-side in each protected page.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(loginUrl);
  }

  // Strip any client-supplied value first so this header can only ever
  // reflect what we just verified above — the request always passes through
  // this proxy (see matcher below), so nothing downstream can spoof it.
  request.headers.delete(TRUSTED_USER_ID_HEADER);
  if (user) {
    request.headers.set(TRUSTED_USER_ID_HEADER, user.id);
  }

  const response = NextResponse.next({ request });
  for (const { name, value, options } of cookiesToApply) {
    response.cookies.set(name, value, options);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

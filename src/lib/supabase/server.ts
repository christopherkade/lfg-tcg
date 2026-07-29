import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Memoized per request: every requireUser()/requireProfile()/
// requireTrustedProfile() call (and any direct caller) within the same
// render pass gets the exact same client instance instead of each
// constructing its own. This is what lets getProfile()'s own cache()
// wrapping (src/lib/session.ts) actually dedupe — without it, two calls
// passing "the current client" would be passing two different object
// references, which cache() treats as different arguments.
export const createClient = cache(async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component without a mutable cookie store.
            // Safe to ignore when session refresh is handled by proxy.ts.
          }
        },
      },
    },
  );
});

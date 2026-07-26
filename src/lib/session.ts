import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TRUSTED_USER_ID_HEADER } from "@/proxy";
import type { Profile } from "@/types/database";

// `auth.getUser()` round-trips to the Supabase Auth server. The layout and
// every page/action beneath it call requireUser()/requireProfile() within
// the same request, so without this they'd each pay that network cost
// sequentially. React's cache() dedupes calls made during the same render
// pass (it resets per request), collapsing them into a single lookup.
const getCachedAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Returns just the current user's id, trusting proxy.ts's network-verified
 * check instead of paying for a second `auth.getUser()` round-trip. Every
 * matched request passes through proxy first (see its matcher), so this
 * header can't be spoofed by the client. Use this where only the id is
 * needed (e.g. the app layout's currentUserId prop) — reach for
 * requireUser()/requireProfile() when the full user object or a redirect
 * guarantee is required.
 */
export async function getTrustedUserId(): Promise<string | null> {
  const headerList = await headers();
  return headerList.get(TRUSTED_USER_ID_HEADER);
}

/**
 * Returns the authenticated Supabase user for the current request,
 * redirecting to /login if there is no session. This is the real
 * auth gate — proxy.ts only performs an optimistic pre-check.
 *
 * `path` is the caller's own route (e.g. `/pods/<id>` for a shared pod
 * link) so the login page can carry it through Discord OAuth via `?next=`
 * and return the user to it once they're signed in.
 */
export async function requireUser(path?: string) {
  const supabase = await createClient();
  const user = await getCachedAuthUser();

  if (!user) {
    redirect(path ? `/login?next=${encodeURIComponent(path)}` : "/login");
  }

  return { supabase, user };
}

/**
 * Fetches the profile row for a given user id, or null if the user
 * hasn't completed onboarding yet.
 */
export async function getProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  return data;
}

/**
 * Requires both a session and a completed profile, redirecting to
 * /profile if onboarding hasn't been completed yet.
 */
export async function requireProfile(path?: string) {
  const { supabase, user } = await requireUser(path);
  const profile = await getProfile(supabase, user.id);

  if (!profile) {
    redirect("/profile");
  }

  return { supabase, user, profile };
}

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TRUSTED_USER_ID_HEADER } from "@/proxy";
import type { OrganizerProfile, Profile } from "@/types/database";

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
 * hasn't completed onboarding yet. Wrapped in cache() for the same reason
 * as getCachedAuthUser above: the layout and every page/action beneath it
 * independently call requireProfile()/requireTrustedProfile() within the
 * same request, so without this each would issue its own identical
 * `profiles` SELECT. cache() dedupes by argument identity (userId), and
 * resets per request.
 */
export const getProfile = cache(
  async (
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
  ): Promise<Profile | null> => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    return data;
  },
);

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

/**
 * Same guarantee as requireProfile() — a session and a completed profile,
 * redirecting to /login or /profile as needed — but skips the extra
 * `auth.getUser()` round-trip in favor of proxy.ts's already-verified id
 * (see getTrustedUserId()). Use this wherever the caller only needs the
 * user's id, not the full Supabase user object (email, user_metadata,
 * etc.) — reach for requireProfile() when that's needed instead.
 */
export async function requireTrustedProfile(path?: string) {
  const supabase = await createClient();
  const userId = await getTrustedUserId();

  if (!userId) {
    redirect(path ? `/login?next=${encodeURIComponent(path)}` : "/login");
  }

  const profile = await getProfile(supabase, userId);

  if (!profile) {
    redirect("/profile");
  }

  return { supabase, userId, profile };
}

/**
 * Fetches the organizers row for a given user id, or null if they aren't
 * an organiser (or their organiser record has been deactivated). Wrapped
 * in cache() for the same per-request dedupe reason as getProfile above —
 * the layout and every /organizer page independently need this.
 */
export const getOrganizer = cache(
  async (
    supabase: Awaited<ReturnType<typeof createClient>>,
    userId: string,
  ): Promise<OrganizerProfile | null> => {
    const { data } = await supabase
      .from("organizers")
      .select(
        "id, store_name, city, description, verification_url, is_active, created_at, updated_at",
      )
      .eq("id", userId)
      .eq("is_active", true)
      .maybeSingle();

    return data;
  },
);

/**
 * Requires a session, a completed profile, AND an active organiser record,
 * redirecting non-organisers to /pods. Every organiser-only page/action
 * calls this — never requireProfile() — as its first line: grep for
 * `requireOrganizerProfile` to find the entire organiser-only surface,
 * exactly the way `requireProfile()` marks the player-facing surface
 * today. The one deliberate exception is /organizer/apply, which onboards
 * someone who isn't an organiser yet and so uses requireProfile() instead.
 */
export async function requireOrganizerProfile(path?: string) {
  const { supabase, user, profile } = await requireProfile(path);
  const organizer = await getOrganizer(supabase, user.id);

  if (!organizer) {
    redirect("/pods");
  }

  return { supabase, user, profile, organizer };
}

/**
 * Requires a session, a completed profile, AND profiles.is_admin, redirecting
 * non-admins to /pods. Every admin-only page/action calls this — never
 * requireProfile() — as its first line, the same convention
 * requireOrganizerProfile() established for the organiser surface. Unlike
 * getOrganizer, no extra query is needed: is_admin already lives on the
 * profiles row requireProfile() fetches.
 */
export async function requireAdminProfile(path?: string) {
  const { supabase, user, profile } = await requireProfile(path);

  if (!profile.is_admin) {
    redirect("/pods");
  }

  return { supabase, user, profile };
}

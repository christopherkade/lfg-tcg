import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

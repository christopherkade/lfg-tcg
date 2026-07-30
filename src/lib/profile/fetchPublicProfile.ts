import type { SupabaseClient } from "@supabase/supabase-js";

export interface PublicProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  discord_handle: string;
  city: string | null;
}

export interface PublicProfileStats {
  people_met: number;
  irl_count: number;
  online_count: number;
}

export interface PublicProfileData {
  profile: PublicProfile;
  gamesPlayedCount: number;
  stats: PublicProfileStats;
}

/**
 * Fetches a profile by username plus its lifetime stats, for the public
 * profile side panel — accepts either the browser or server Supabase
 * client (same shape), since this runs both client-side (panel opened
 * in-app) and server-side (a direct visit to the /profile/[username] route).
 * Relies on get_profile_pod_stats/get_games_played_count's p_user_id param
 * (supabase/sql/public_profile_stats.sql) to report someone else's stats,
 * not just the caller's own.
 */
export async function fetchPublicProfile(
  supabase: SupabaseClient,
  username: string,
): Promise<PublicProfileData | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, discord_handle, city")
    .eq("username", username)
    .maybeSingle();

  if (!profile) return null;

  // Errors are logged rather than left to silently fall back to 0 — e.g.
  // if supabase/sql/public_profile_stats.sql (the p_user_id patch) hasn't
  // been applied to this environment's database yet, both calls fail with
  // PGRST202 "could not find the function," which would otherwise look
  // identical to every stat legitimately being zero.
  const [gamesPlayedResult, statsResult] = await Promise.all([
    supabase.rpc("get_games_played_count", { p_user_id: profile.id }),
    supabase.rpc("get_profile_pod_stats", { p_user_id: profile.id }),
  ]);

  if (gamesPlayedResult.error) {
    console.error("get_games_played_count failed:", gamesPlayedResult.error);
  }
  if (statsResult.error) {
    console.error("get_profile_pod_stats failed:", statsResult.error);
  }

  const gamesPlayedCount = (gamesPlayedResult.data as number | null) ?? 0;
  const stats = (statsResult.data as PublicProfileStats[] | null)?.[0] ?? {
    people_met: 0,
    irl_count: 0,
    online_count: 0,
  };

  return { profile, gamesPlayedCount, stats };
}

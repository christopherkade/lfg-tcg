"use server";

import { createClient } from "@/lib/supabase/server";
import type { MatchType } from "@/types/database";

// Deliberately does NOT call requireUser()/requireProfile() — this must
// work pre-auth on the Login page (anon role), same as the two RPCs it
// wraps (supabase/sql/platform_activity_stats.sql, granted to `anon` too).
// createClient() itself works for both: anon role with no session cookie,
// authenticated role with one.

export interface PlatformActivityStats {
  activePodCount: number;
  matchedLast24h: number;
  matchedLast7d: number;
}

export interface PlatformActivityEvent {
  eventType: "CREATED" | "MATCHED";
  gameKey: string;
  formatKey: string;
  type: MatchType;
  eventAt: string;
}

// This project's Supabase clients aren't typed against generated Database
// types (see src/lib/supabase/server.ts), so .rpc() results come back
// untyped — these describe the raw snake_case rows the two SQL functions
// return (supabase/sql/platform_activity_stats.sql).
interface RawStatsRow {
  active_pod_count: number;
  matched_last_24h: number;
  matched_last_7d: number;
}

interface RawEventRow {
  event_type: string;
  game_key: string;
  format_key: string;
  type: MatchType;
  event_at: string;
}

/**
 * Ambient trust-signal data, not core functionality — on any RPC error this
 * logs and returns null/[] rather than throwing, so a failure here can never
 * break the Login page or the Match Feed empty state that render it.
 */
export async function getPlatformActivityStats(): Promise<PlatformActivityStats | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_platform_activity_stats")
    .maybeSingle();
  const row = data as RawStatsRow | null;

  if (error || !row) {
    if (error) console.error("getPlatformActivityStats failed:", error);
    return null;
  }

  return {
    activePodCount: row.active_pod_count,
    matchedLast24h: row.matched_last_24h,
    matchedLast7d: row.matched_last_7d,
  };
}

export async function getRecentPlatformActivity(
  limit = 6,
): Promise<PlatformActivityEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_recent_platform_activity", {
    p_limit: limit,
  });
  const rows = data as RawEventRow[] | null;

  if (error || !rows) {
    if (error) console.error("getRecentPlatformActivity failed:", error);
    return [];
  }

  return rows.map((row) => ({
    eventType: row.event_type as "CREATED" | "MATCHED",
    gameKey: row.game_key,
    formatKey: row.format_key,
    type: row.type,
    eventAt: row.event_at,
  }));
}

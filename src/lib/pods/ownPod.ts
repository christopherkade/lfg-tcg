import type { SupabaseClient } from "@supabase/supabase-js";
import type { PodWithRelations } from "@/types/database";

/**
 * The viewer's own active pod, with the relations MyPodPanel needs (member
 * profiles, join requests). Shared so PodsView can seed OwnPodPanel's
 * initial data server-side, and so both OwnPodPanel's own client refetch and
 * the LfgButton prefetch below run the exact same query. Wrapped in
 * Promise.resolve() — Supabase's query builders are thenable but not real
 * Promise instances (missing .catch/.finally), which React's use() and
 * plain prop typing both expect.
 */
export function fetchOwnPodData(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: PodWithRelations | null; error: unknown }> {
  return Promise.resolve(
    supabase
      .from("pods")
      .select("*, profiles(*), pod_joins(*, profiles(*))")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle(),
  );
}

interface PrefetchedOwnPod {
  userId: string;
  promise: Promise<{ data: PodWithRelations | null; error: unknown }>;
}

// Module-level, single slot — mirrors prefetchActivePods/
// consumePrefetchedActivePods in matchFeed.ts. Survives the client-side
// transition from wherever the prefetch was fired (e.g. LfgButton, right
// after creating a pod) through to OwnPodPanel mounting on /pods.
let prefetchedOwnPod: PrefetchedOwnPod | null = null;

/**
 * Kicks off the own-pod fetch ahead of an imminent navigation to /pods
 * (browser client, so this can run from any client component). Fire-and-
 * forget from the caller's side — the result is only ever picked up via
 * `consumePrefetchedOwnPod`.
 */
export function prefetchOwnPod(supabase: SupabaseClient, userId: string) {
  prefetchedOwnPod = { userId, promise: fetchOwnPodData(supabase, userId) };
}

/**
 * Consumed at most once, and only by the matching user — a stale or
 * mismatched entry is discarded rather than reused.
 */
export function consumePrefetchedOwnPod(
  userId: string,
): Promise<{ data: PodWithRelations | null; error: unknown }> | null {
  if (!prefetchedOwnPod || prefetchedOwnPod.userId !== userId) {
    return null;
  }
  const { promise } = prefetchedOwnPod;
  prefetchedOwnPod = null;
  return promise;
}

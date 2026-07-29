"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePodRealtime } from "@/components/PodRealtimeProvider";
import { MyPodPanel } from "@/components/MyPodPanel";
import { consumePrefetchedOwnPod, fetchOwnPodData } from "@/lib/pods/ownPod";
import type { PodWithRelations } from "@/types/database";

// Matches MyPodPanel's highlight animation length (4 segments × 0.9s) so the
// state clears right as the pulse settles back to rest, not mid-pulse.
const HIGHLIGHT_DURATION_MS = 3600;

interface OwnPodPanelProps {
  currentUserId: string;
  /**
   * Not awaited by PodsView — this suspends on it directly via use(),
   * covered by that caller's own <Suspense fallback={null}>. Since this
   * component already renders nothing until `pod` is set, an empty
   * fallback while the promise is pending is visually identical to today's
   * "no active pod" state, just arriving a beat later.
   */
  initialPodPromise: Promise<{ data: PodWithRelations | null; error: unknown }>;
  /**
   * True when the page was reached via ?highlight=own (set by LfgButton
   * right after creating a pod), so the just-created pod can be called out
   * with a brief pulse instead of silently appearing at the top of /pods.
   */
  initialHighlight?: boolean;
}

/**
 * Client wrapper around MyPodPanel that keeps the host's own active
 * pod (and its join requests / accepted members) in sync with realtime
 * changes, so the panel appears/disappears and its request list updates
 * live instead of only reflecting whatever was fetched on the last page
 * load. Mirrors MatchFeed's "no server-side filter, just refetch on any
 * change" approach.
 */
export function OwnPodPanel({
  currentUserId,
  initialPodPromise,
  initialHighlight = false,
}: OwnPodPanelProps) {
  const router = useRouter();
  const { subscribePods, subscribePodJoins } = usePodRealtime();
  // Prefer an already-in-flight (likely already-resolved) prefetch — e.g.
  // LfgButton kicks one off right after creating a pod, well before the
  // redirect here — over the server-seeded `initialPodPromise`, so
  // MyPodPanel doesn't suspend and pop in a beat after the rest of the page.
  // Lazy-initialized so the check (and its one-time cache consumption) only
  // ever runs once per mount, not on every render/retry.
  const [initialPodSource] = useState(
    () => consumePrefetchedOwnPod(currentUserId) ?? initialPodPromise,
  );
  const { data: initialPod } = use(initialPodSource);
  const [pod, setPod] = useState<PodWithRelations | null>(initialPod);

  // A freshly created pod arrives here via ?highlight=own (see LfgButton).
  // Captured into state and immediately stripped from the URL so the pulse
  // only plays once, not on every refresh/back-navigation.
  const [highlight, setHighlight] = useState(initialHighlight);
  useEffect(() => {
    if (!initialHighlight) return;
    router.replace("/pods", { scroll: false });
    const timeout = setTimeout(() => setHighlight(false), HIGHLIGHT_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [initialHighlight, router]);

  const fetchOwnPod = useCallback(async () => {
    const { data } = await fetchOwnPodData(createClient(), currentUserId);
    setPod((data as PodWithRelations) ?? null);
  }, [currentUserId]);

  // Routed through a ref rather than listed as an effect dependency — see
  // repo memory on realtime channel churn / ref-indirection pattern.
  const fetchOwnPodRef = useRef(fetchOwnPod);
  useEffect(() => {
    fetchOwnPodRef.current = fetchOwnPod;
  }, [fetchOwnPod]);

  // Resilience fallback: Supabase Realtime's postgres_changes delivery has
  // been observed to be unreliable in this project (channel stays
  // SUBSCRIBED, but specific events occasionally never arrive — see repo
  // memory). Resync whenever the tab regains focus/visibility so a missed
  // event self-heals without the user needing to manually reload. Unlike
  // MatchFeed/LfgButton/NotificationBell (whose focus/visibility-only
  // fallback is enough since their content just sits there stale until
  // next glanced at), a host waiting on a join request is typically
  // staring at an already-focused /pods tab the whole time — a
  // focus/visibility listener alone would never fire, so this also polls
  // on an interval while the tab is visible, in addition to on mount and
  // focus/visibility, mirroring MatchedPodWatcher/NotificationBell. 25s
  // (not 10s) since this is purely a safety net for realtime's own
  // occasional delivery misses, not the primary update path.
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        fetchOwnPodRef.current();
      }
    }
    fetchOwnPodRef.current();
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchOwnPodRef.current();
      }
    }, 25_000);
    return () => {
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
      clearInterval(intervalId);
    };
  }, []);

  // Registers with the shared pods/pod_joins channel (PodRealtimeProvider,
  // mounted once in the (app) layout) instead of opening its own channel —
  // see that file's docstring for why the three components that used to
  // each open an identical unfiltered channel now share one.
  useEffect(() => {
    const unsubscribePods = subscribePods(() => fetchOwnPodRef.current());
    const unsubscribePodJoins = subscribePodJoins(() =>
      fetchOwnPodRef.current(),
    );
    return () => {
      unsubscribePods();
      unsubscribePodJoins();
    };
  }, [subscribePods, subscribePodJoins]);

  if (!pod) {
    return null;
  }

  return <MyPodPanel pod={pod} onChanged={fetchOwnPod} highlight={highlight} />;
}

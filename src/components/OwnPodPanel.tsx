"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MyPodPanel } from "@/components/MyPodPanel";
import type { PodWithRelations } from "@/types/database";

// Matches MyPodPanel's highlight animation length (4 segments × 0.9s) so the
// state clears right as the pulse settles back to rest, not mid-pulse.
const HIGHLIGHT_DURATION_MS = 3600;

interface OwnPodPanelProps {
  currentUserId: string;
  initialPod: PodWithRelations | null;
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
  initialPod,
  initialHighlight = false,
}: OwnPodPanelProps) {
  const router = useRouter();
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
    const supabase = createClient();
    const { data } = await supabase
      .from("pods")
      .select("*, profiles(*), pod_joins(*, profiles(*))")
      .eq("user_id", currentUserId)
      .eq("status", "ACTIVE")
      .maybeSingle();
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
  // event self-heals without the user needing to manually reload.
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        fetchOwnPodRef.current();
      }
    }
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`own-pod-panel-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pods" },
        () => fetchOwnPodRef.current(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pod_joins" },
        () => fetchOwnPodRef.current(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  if (!pod) {
    return null;
  }

  return <MyPodPanel pod={pod} onChanged={fetchOwnPod} highlight={highlight} />;
}

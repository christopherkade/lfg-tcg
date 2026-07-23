"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MyPodPanel } from "@/components/MyPodPanel";
import type { PodWithRelations } from "@/types/database";

interface OwnPodPanelProps {
  currentUserId: string;
  initialPod: PodWithRelations | null;
}

/**
 * Client wrapper around MyPodPanel that keeps the host's own active
 * pod (and its join requests / accepted members) in sync with realtime
 * changes, so the panel appears/disappears and its request list updates
 * live instead of only reflecting whatever was fetched on the last page
 * load. Mirrors MatchFeed's "no server-side filter, just refetch on any
 * change" approach.
 */
export function OwnPodPanel({ currentUserId, initialPod }: OwnPodPanelProps) {
  const [pod, setPod] = useState<PodWithRelations | null>(initialPod);

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

  return <MyPodPanel pod={pod} onChanged={fetchOwnPod} />;
}

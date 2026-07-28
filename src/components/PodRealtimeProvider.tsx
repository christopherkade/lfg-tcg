"use client";

import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type PodChangeCallback = () => void;

interface PodRealtimeContextValue {
  subscribePods: (callback: PodChangeCallback) => () => void;
  subscribePodJoins: (callback: PodChangeCallback) => () => void;
  notifyPodsChanged: () => void;
}

const PodRealtimeContext = createContext<PodRealtimeContextValue | null>(null);

/**
 * Consolidates what used to be three separate per-component Realtime
 * channels (MatchFeed's "match-feed", OwnPodPanel's "own-pod-panel-*",
 * LfgButton's "lfg-own-pod-*") — all subscribing to the same unfiltered
 * `pods`/`pod_joins` postgres_changes events and each just triggering their
 * own refetch — into a single shared channel. This cuts per-tab Realtime
 * channel count for these three from 3 to 1 without changing what triggers
 * a refetch or how each component reacts to it.
 *
 * Deliberately still unfiltered (no `filter` param): NotificationBell's
 * postgres_changes subscription documents that adding a `filter` param was
 * observed to silently break realtime delivery in this project, so the
 * same "listen to everything on the table, let each subscriber decide what
 * to do" shape is kept here.
 *
 * Callback registration is stored in refs (not React state), so
 * subscribing/unsubscribing never triggers a re-render, and a child
 * registering before this provider's own channel-open effect has run is
 * still safe — the callback is already present in the set by the time any
 * event could arrive.
 */
export function PodRealtimeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const podCallbacksRef = useRef(new Set<PodChangeCallback>());
  const podJoinCallbacksRef = useRef(new Set<PodChangeCallback>());

  const subscribePods = useCallback((callback: PodChangeCallback) => {
    podCallbacksRef.current.add(callback);
    return () => {
      podCallbacksRef.current.delete(callback);
    };
  }, []);

  const subscribePodJoins = useCallback((callback: PodChangeCallback) => {
    podJoinCallbacksRef.current.add(callback);
    return () => {
      podJoinCallbacksRef.current.delete(callback);
    };
  }, []);

  // Manual escape hatch alongside the postgres_changes subscription below:
  // lets a component that has already confirmed a `pods` change through some
  // other channel (e.g. MatchedPodWatcher's own realtime subscription/poll
  // fallback noticing a MATCHED transition) force every other subscriber
  // (MatchFeed, OwnPodPanel, LfgButton) to refetch immediately, instead of
  // depending on that second, independent postgres_changes delivery to this
  // provider's own channel also succeeding — Realtime delivery has been
  // observed to be unreliable in this project, and unlike those other
  // subscribers' focus/visibility fallback, a viewer dismissing the Matched
  // dialog is typically already on a focused /pods tab, so that fallback
  // would never fire either.
  const notifyPodsChanged = useCallback(() => {
    for (const callback of podCallbacksRef.current) callback();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("shared-pods-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pods" },
        () => {
          for (const callback of podCallbacksRef.current) callback();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pod_joins" },
        () => {
          for (const callback of podJoinCallbacksRef.current) callback();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <PodRealtimeContext.Provider
      value={{ subscribePods, subscribePodJoins, notifyPodsChanged }}
    >
      {children}
    </PodRealtimeContext.Provider>
  );
}

export function usePodRealtime() {
  const context = useContext(PodRealtimeContext);
  if (!context) {
    throw new Error("usePodRealtime must be used within a PodRealtimeProvider");
  }
  return context;
}

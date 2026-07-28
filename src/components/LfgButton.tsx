"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Radio, X } from "lucide-react";
import { Fab, Alert, Typography } from "@mui/material";
import { useTheme, alpha, darken, lighten } from "@mui/material/styles";
import { DEFAULT_GLOW_COLOR, GAMES_CONFIG } from "@/constants/gamesConfig";
import { cancelPod } from "@/app/actions/pods";
import { createClient } from "@/lib/supabase/client";
import { prefetchActivePods } from "@/lib/pods/matchFeed";
import { prefetchOwnPod } from "@/lib/pods/ownPod";
import { usePodRealtime } from "@/components/PodRealtimeProvider";
import { LfgDialog } from "@/components/LfgDialog";
import { CantStartSearchDialog } from "@/components/CantStartSearchDialog";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { playSound } from "@/lib/soundEffect";
import type { TranslationKey } from "@/lib/i18n";
import type { Pod, Profile } from "@/types/database";

const MotionFab = motion.create(Fab);

// Length of one "searching" boxShadow pulse cycle (see the `isSearching`
// animate/transition below) — reused so the post-create redirect can wait
// for a couple of full cycles instead of cutting the animation off mid-pulse.
const SEARCHING_PULSE_DURATION_MS = 500;

interface LfgButtonProps {
  profile: Profile;
  /**
   * Optional — when omitted (the normal case, see `(app)/page.tsx`), the
   * button renders immediately from `profile` alone and fetches these
   * itself on mount via `fetchOwnPod`/`fetchHasActiveJoin` below, the same
   * functions already used for realtime resync. Mirrors MatchFeed's
   * `initialPods` "skip fetch if already seeded" pattern, just inverted:
   * here the seed is intentionally never provided by the server.
   */
  ownPod?: Pod | null;
  hasActiveJoin?: boolean;
}

export function LfgButton({
  profile,
  ownPod: initialOwnPod,
  hasActiveJoin: initialHasActiveJoin,
}: LfgButtonProps) {
  const { t } = useTranslation();
  const { subscribePods, subscribePodJoins } = usePodRealtime();
  const router = useRouter();
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const [ownPod, setOwnPod] = useState(initialOwnPod ?? null);
  const [hasActiveJoin, setHasActiveJoin] = useState(
    initialHasActiveJoin ?? false,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  const fetchOwnPod = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("pods")
      .select("*")
      .eq("user_id", profile.id)
      .eq("status", "ACTIVE")
      .maybeSingle();
    setOwnPod((data as Pod) ?? null);
  }, [profile.id]);

  const fetchHasActiveJoin = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("pod_joins")
      .select("id, pods!inner(status)")
      .eq("user_id", profile.id)
      .in("status", ["PENDING", "ACCEPTED"])
      .eq("pods.status", "ACTIVE")
      .maybeSingle();
    setHasActiveJoin(data != null);
  }, [profile.id]);

  // Routed through refs rather than listed as effect dependencies — see
  // repo memory on realtime channel churn / ref-indirection pattern.
  const fetchOwnPodRef = useRef(fetchOwnPod);
  useEffect(() => {
    fetchOwnPodRef.current = fetchOwnPod;
  }, [fetchOwnPod]);

  const fetchHasActiveJoinRef = useRef(fetchHasActiveJoin);
  useEffect(() => {
    fetchHasActiveJoinRef.current = fetchHasActiveJoin;
  }, [fetchHasActiveJoin]);

  // The page intentionally never seeds these server-side (see the
  // LfgButtonProps doc comment above) — fetch on mount instead, same as
  // MatchFeed does when it isn't handed `initialPods`. Skipped whenever a
  // caller *does* pass an initial value, so this stays inert if that ever
  // changes.
  useEffect(() => {
    if (initialOwnPod === undefined) fetchOwnPodRef.current();
    if (initialHasActiveJoin === undefined) fetchHasActiveJoinRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resilience fallback: Supabase Realtime's postgres_changes delivery has
  // been observed to be unreliable in this project (channel stays
  // SUBSCRIBED, but specific events occasionally never arrive — see repo
  // memory). Resync whenever the tab regains focus/visibility so a missed
  // event self-heals without the user needing to manually reload.
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        fetchOwnPodRef.current();
        fetchHasActiveJoinRef.current();
      }
    }
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
    };
  }, []);

  // Keep ownPod and hasActiveJoin in sync with realtime changes (e.g.
  // cancelled/matched/started from another tab or device, or a join
  // request accepted/rejected/left elsewhere) instead of only reflecting
  // what was fetched on the last page load. Registers with the shared
  // pods/pod_joins channel (PodRealtimeProvider, mounted once in the (app)
  // layout) instead of opening its own channel — see that file's docstring
  // for why the three components that used to each open an identical
  // unfiltered channel now share one.
  useEffect(() => {
    const unsubscribePods = subscribePods(() => {
      fetchOwnPodRef.current();
      fetchHasActiveJoinRef.current();
    });
    const unsubscribePodJoins = subscribePodJoins(() =>
      fetchHasActiveJoinRef.current(),
    );
    return () => {
      unsubscribePods();
      unsubscribePodJoins();
    };
  }, [subscribePods, subscribePodJoins]);

  const game = profile.preferred_game
    ? GAMES_CONFIG[profile.preferred_game]
    : null;
  const glowColor = game?.glowColor ?? DEFAULT_GLOW_COLOR;
  const isSearching = ownPod?.status === "ACTIVE";

  // Physical-button palette, derived from the theme so the "keycap +
  // recessed skirt" bevel effect below reads correctly in both light and
  // dark mode instead of the fixed dark-only hex values this used to have.
  const isDarkMode = theme.palette.mode === "dark";
  const capColor = theme.palette.background.paper;
  const skirtColor = isDarkMode
    ? darken(capColor, 0.75)
    : darken(capColor, 0.22);
  const glossColor = isDarkMode ? lighten(capColor, 0.16) : "#ffffff";
  const innerShadowColor = isDarkMode
    ? "rgba(0, 0, 0, 0.55)"
    : "rgba(15, 15, 20, 0.14)";
  const hoverBgColor = isDarkMode
    ? lighten(capColor, 0.08)
    : darken(capColor, 0.02);
  const activeBgColor = isDarkMode
    ? darken(capColor, 0.1)
    : darken(capColor, 0.06);

  // Two box-shadow "recipes": resting (gloss line along the top edge, as
  // if catching light) and pressed (that gloss replaced by an inward
  // shadow, as if the light source is now blocked by the cap sitting in
  // its recessed skirt). `skirtOffset` is the vertical distance between
  // the cap and its skirt — paired 1:1 with how far the cap should
  // translate down in `whileTap`/press so the two layers meet exactly.
  const restShadow = (
    skirtOffset: number,
    glowBlur: number,
    glowSpread: number,
  ) =>
    [
      `inset 0 1.5px 0 0 ${alpha(glossColor, isDarkMode ? 0.22 : 0.9)}`,
      `inset 0 -3px 6px 0 ${innerShadowColor}`,
      `0 ${skirtOffset}px 0 0 ${skirtColor}`,
      `0 0 ${glowBlur}px ${glowSpread}px ${glowColor}`,
    ].join(", ");
  const pressedShadow = (
    skirtOffset: number,
    glowBlur: number,
    glowSpread: number,
  ) =>
    [
      `inset 0 3px 7px 0 ${innerShadowColor}`,
      `0 ${skirtOffset}px 0 0 ${skirtColor}`,
      `0 0 ${glowBlur}px ${glowSpread}px ${glowColor}`,
    ].join(", ");
  const formatKey = game?.formats.find(
    (format) => format.key === profile.preferred_format,
  )?.key;
  const formatLabel = formatKey
    ? t(`format.${formatKey}` as TranslationKey)
    : undefined;

  // Real sample (Kenney UI Audio, CC0). playbackRate is jittered so repeated
  // taps don't sound identical. Played via Web Audio API (not
  // HTMLAudioElement) so iOS Safari doesn't show its "now playing" pill.
  const playClickSound = useCallback((pitchMultiplier = 1) => {
    const jitter = 0.97 + Math.random() * 0.06;
    playSound("/sounds/button-click.wav", {
      volume: 0.3,
      playbackRate: pitchMultiplier * jitter,
    });
  }, []);

  // Bright chime for "search started" — reused from the notification bell
  // rather than another synthesized sound, since it already reads as a
  // positive/success cue elsewhere in the app.
  const playChimeSound = useCallback((pitchMultiplier = 1) => {
    playSound("/sounds/notification.wav", {
      volume: 0.5,
      playbackRate: pitchMultiplier,
    });
  }, []);

  // Fires the activate/power-down cue on the isSearching transition itself
  // (not from handleClick) so it plays correctly even when the state flips
  // via the LfgDialog success flow or a realtime sync, not just a direct
  // cancel click. Ref-tracked previous value skips the sound on mount.
  const prevIsSearchingRef = useRef(isSearching);
  useEffect(() => {
    if (prevIsSearchingRef.current !== isSearching) {
      if (isSearching) {
        playChimeSound(1.15);
      } else {
        playClickSound(0.8);
      }
      prevIsSearchingRef.current = isSearching;
    }
  }, [isSearching, playChimeSound, playClickSound]);

  async function handleClick() {
    playClickSound();
    setBurstKey((key) => key + 1);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(18);
    }

    if (!isSearching) {
      if (hasActiveJoin) {
        setBlockedDialogOpen(true);
        return;
      }
      setDialogOpen(true);
      return;
    }

    setPending(true);
    setError(null);
    const result = await cancelPod(ownPod!.id);
    if (result.error) {
      setError(result.error);
    } else {
      await fetchOwnPodRef.current();
      await fetchHasActiveJoinRef.current();
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <Typography
          component="span"
          sx={{
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "text.secondary",
          }}
        >
          {isSearching
            ? t("lfgButton.searchingFor")
            : t("lfgButton.lastSearch")}
        </Typography>
        <Typography
          component="span"
          sx={{ fontSize: "1.125rem", fontWeight: 600, color: "text.primary" }}
        >
          {game?.name} &middot; {formatLabel} &middot;{" "}
          {profile.preferred_match_type === "IRL"
            ? t("podFilters.matchTypeIrl")
            : t("podFilters.matchTypeOnline")}
        </Typography>
      </div>
      <div className="relative flex items-center justify-center">
        {/* Radar-ping rings: broadcasting-signal metaphor for the Radio
            icon/"looking for group" concept, looping while a search is
            active. Suppressed under prefers-reduced-motion. */}
        <AnimatePresence>
          {isSearching && !prefersReducedMotion && (
            <>
              <motion.div
                key="radar-ring-1"
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ border: `2px solid ${glowColor}` }}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: [1, 1.8, 2.2], opacity: [0.6, 0.6, 0] }}
                exit={{ opacity: 0, transition: { duration: 0.3, repeat: 0 } }}
                transition={{
                  duration: 1.8,
                  times: [0, 0.6, 1],
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
              <motion.div
                key="radar-ring-2"
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{ border: `2px solid ${glowColor}` }}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: [1, 1.8, 2.2], opacity: [0.6, 0.6, 0] }}
                exit={{ opacity: 0, transition: { duration: 0.3, repeat: 0 } }}
                transition={{
                  duration: 1.8,
                  times: [0, 0.6, 1],
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: 0.9,
                }}
              />
            </>
          )}
        </AnimatePresence>

        {/* One-shot impact shockwave, re-keyed on every tap. */}
        <AnimatePresence>
          {burstKey > 0 && (
            <motion.div
              key={burstKey}
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ border: `2px solid ${glowColor}` }}
              initial={{ scale: 0, opacity: 0.7 }}
              animate={{ scale: 2.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          )}
        </AnimatePresence>

        <MotionFab
          type="button"
          onClick={handleClick}
          disabled={pending}
          whileHover={pending ? undefined : { y: -3, scale: 1.02 }}
          whileTap={
            pending
              ? undefined
              : {
                  y: 6,
                  scale: 0.95,
                  boxShadow: pressedShadow(2, 16, 6),
                }
          }
          animate={
            pending
              ? { y: 0, scale: 1, boxShadow: restShadow(8, 16, 6) }
              : isSearching
                ? {
                    y: 0,
                    scale: 1,
                    boxShadow: [
                      restShadow(8, 16, 6),
                      restShadow(8, 40, 20),
                      restShadow(8, 16, 6),
                    ],
                  }
                : prefersReducedMotion
                  ? { y: 0, scale: 1, boxShadow: restShadow(8, 16, 6) }
                  : {
                      // Gentle idle "breathing" invitation to press — a slow
                      // lift + brighten, distinct from (and much subtler
                      // than) the searching-state pulse below.
                      y: [0, -3, 0],
                      scale: [1, 1.015, 1],
                      boxShadow: [
                        restShadow(8, 16, 6),
                        restShadow(8, 26, 10),
                        restShadow(8, 16, 6),
                      ],
                    }
          }
          transition={
            pending
              ? {
                  boxShadow: { duration: 0.3 },
                  y: { type: "spring", stiffness: 500, damping: 30 },
                  scale: { type: "spring", stiffness: 500, damping: 30 },
                }
              : isSearching
                ? {
                    boxShadow: {
                      duration: SEARCHING_PULSE_DURATION_MS / 1000,
                      repeat: Infinity,
                      ease: "easeInOut",
                    },
                    y: { type: "spring", stiffness: 500, damping: 30 },
                    scale: { type: "spring", stiffness: 500, damping: 30 },
                  }
                : prefersReducedMotion
                  ? { boxShadow: { duration: 0.3 } }
                  : {
                      y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                      scale: {
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      },
                      boxShadow: {
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                      },
                    }
          }
          sx={{
            height: 128,
            width: 128,
            // MUI's Fab defaults to theme.zIndex.fab (1050), which would
            // otherwise render above LfgDialog's overlay (Tailwind z-20).
            // This button isn't meant to float above other UI, so pin it
            // back down to the normal stacking layer.
            zIndex: 0,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
            bgcolor: capColor,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
            fontSize: "1.125rem",
            fontWeight: 700,
            // Let framer-motion own transform/box-shadow (the 3D press
            // effect below) instead of racing MUI's own CSS transition.
            transition: "background-color 150ms ease",
            "&:hover": { bgcolor: hoverBgColor },
            "&:active": { bgcolor: activeBgColor },
            "&.Mui-disabled": {
              bgcolor: capColor,
              opacity: 0.6,
              color: theme.palette.text.primary,
            },
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isSearching ? "cancel-icon" : "lfg-icon"}
              className="flex items-center justify-center"
              initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
              transition={{ duration: 0.2 }}
            >
              {isSearching ? (
                <X className="h-6 w-6" />
              ) : (
                <Radio className="h-6 w-6" />
              )}
            </motion.span>
          </AnimatePresence>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isSearching ? "cancel-label" : "lfg-label"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {isSearching ? t("lfgButton.cancel") : t("lfgButton.lfg")}
            </motion.span>
          </AnimatePresence>
        </MotionFab>
      </div>
      {error && <Alert severity="error">{error}</Alert>}

      <LfgDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={async () => {
          setDialogOpen(false);
          // Kicks off the same queries MatchFeedList and OwnPodPanel will
          // need on /pods, well ahead of the redirect below — both pick
          // these up via their own consumePrefetched*() instead of
          // suspending on a freshly-issued fetch, so neither the match feed
          // skeleton nor MyPodPanel's own pop-in lag behind the rest of the
          // page. Also warms the destination route's JS via router.prefetch.
          const supabase = createClient();
          prefetchActivePods(supabase, profile.id, profile);
          prefetchOwnPod(supabase, profile.id);
          router.prefetch("/pods?highlight=own");

          // Awaited so `isSearching` (and its boxShadow pulse) flips on
          // before the delay below starts counting.
          await fetchOwnPodRef.current();
          void fetchHasActiveJoinRef.current();
          // Let the button pulse a couple of times as "search started"
          // feedback before navigating away, instead of redirecting the
          // instant the dialog closes. Skipped under reduced motion, since
          // there's no pulse to wait out in that case.
          if (!prefersReducedMotion) {
            await new Promise((resolve) =>
              setTimeout(resolve, SEARCHING_PULSE_DURATION_MS * 2),
            );
          }
          router.push("/pods?highlight=own");
        }}
        profile={profile}
      />

      <CantStartSearchDialog
        open={blockedDialogOpen}
        onClose={() => setBlockedDialogOpen(false)}
      />
    </div>
  );
}

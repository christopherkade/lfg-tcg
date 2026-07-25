"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Radio, X } from "lucide-react";
import { Fab, Alert, Typography } from "@mui/material";
import { DEFAULT_GLOW_COLOR, GAMES_CONFIG } from "@/constants/gamesConfig";
import { cancelPod } from "@/app/actions/pods";
import { createClient } from "@/lib/supabase/client";
import { LfgDialog } from "@/components/LfgDialog";
import { CantStartSearchDialog } from "@/components/CantStartSearchDialog";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import type { Pod, Profile } from "@/types/database";

const MotionFab = motion.create(Fab);

interface LfgButtonProps {
  profile: Profile;
  ownPod: Pod | null;
  hasActiveJoin: boolean;
}

export function LfgButton({
  profile,
  ownPod: initialOwnPod,
  hasActiveJoin: initialHasActiveJoin,
}: LfgButtonProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [ownPod, setOwnPod] = useState(initialOwnPod);
  const [hasActiveJoin, setHasActiveJoin] = useState(initialHasActiveJoin);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);

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
  // what was fetched on the last page load.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`lfg-own-pod-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pods" },
        () => {
          fetchOwnPodRef.current();
          fetchHasActiveJoinRef.current();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pod_joins" },
        () => fetchHasActiveJoinRef.current(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id]);

  const game = profile.preferred_game
    ? GAMES_CONFIG[profile.preferred_game]
    : null;
  const glowColor = game?.glowColor ?? DEFAULT_GLOW_COLOR;
  const isSearching = ownPod?.status === "ACTIVE";
  const formatKey = game?.formats.find(
    (format) => format.key === profile.preferred_format,
  )?.key;
  const formatLabel = formatKey
    ? t(`format.${formatKey}` as TranslationKey)
    : undefined;

  // Real sample (Kenney UI Audio, CC0) instead of a synthesized tone —
  // cloning the element per play lets rapid presses overlap cleanly.
  const clickAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    clickAudioRef.current = new Audio("/sounds/button-click.wav");
  }, []);
  const playClickSound = useCallback(() => {
    const base = clickAudioRef.current;
    if (!base) return;
    const sound = base.cloneNode(true) as HTMLAudioElement;
    sound.volume = 0.5;
    void sound.play().catch(() => {});
  }, []);

  async function handleClick() {
    playClickSound();

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
          sx={{ fontSize: "0.875rem", fontWeight: 500, color: "text.secondary" }}
        >
          {isSearching ? t("lfgButton.searchingFor") : t("lfgButton.lastSearch")}
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
      <MotionFab
        type="button"
        onClick={handleClick}
        disabled={pending}
        whileHover={pending ? undefined : { y: -2 }}
        whileTap={
          pending
            ? undefined
            : { y: 4, boxShadow: `0 2px 0 0 #3f3f46, 0 0 16px 6px ${glowColor}` }
        }
        animate={
          isSearching
            ? {
                y: 0,
                boxShadow: [
                  `0 6px 0 0 #3f3f46, 0 0 16px 6px ${glowColor}`,
                  `0 6px 0 0 #3f3f46, 0 0 40px 20px ${glowColor}`,
                  `0 6px 0 0 #3f3f46, 0 0 16px 6px ${glowColor}`,
                ],
              }
            : { y: 0, boxShadow: `0 6px 0 0 #3f3f46, 0 0 16px 6px ${glowColor}` }
        }
        transition={
          isSearching
            ? {
                boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" },
                y: { type: "spring", stiffness: 500, damping: 30 },
              }
            : {
                boxShadow: { duration: 0.3 },
                y: { type: "spring", stiffness: 500, damping: 30 },
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
          bgcolor: "#27272a",
          border: "1px solid #3f3f46",
          color: "#fafafa",
          fontSize: "1.125rem",
          fontWeight: 700,
          // Let framer-motion own transform/box-shadow (the 3D press
          // effect below) instead of racing MUI's own CSS transition.
          transition: "background-color 150ms ease",
          "&:hover": { bgcolor: "#3f3f46" },
          "&:active": { bgcolor: "#18181b" },
          "&.Mui-disabled": {
            bgcolor: "#27272a",
            opacity: 0.6,
            color: "#fafafa",
          },
        }}
      >
        {isSearching ? (
          <X className="h-6 w-6" />
        ) : (
          <Radio className="h-6 w-6" />
        )}
        {isSearching ? t("lfgButton.cancel") : t("lfgButton.lfg")}
      </MotionFab>
      {error && <Alert severity="error">{error}</Alert>}

      <LfgDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => {
          setDialogOpen(false);
          void fetchOwnPodRef.current();
          void fetchHasActiveJoinRef.current();
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

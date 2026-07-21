"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio, X } from "lucide-react";
import { Fab, Alert } from "@mui/material";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { cancelBeacon } from "@/app/actions/beacons";
import { createClient } from "@/lib/supabase/client";
import { LfgDialog } from "@/components/LfgDialog";
import { CantStartSearchDialog } from "@/components/CantStartSearchDialog";
import type { Beacon, Profile } from "@/types/database";

const MotionFab = motion.create(Fab);

interface LfgButtonProps {
  profile: Profile;
  ownBeacon: Beacon | null;
  hasActiveJoin: boolean;
}

export function LfgButton({
  profile,
  ownBeacon: initialOwnBeacon,
  hasActiveJoin: initialHasActiveJoin,
}: LfgButtonProps) {
  const [ownBeacon, setOwnBeacon] = useState(initialOwnBeacon);
  const [hasActiveJoin, setHasActiveJoin] = useState(initialHasActiveJoin);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false);

  // Keep ownBeacon and hasActiveJoin in sync with realtime changes (e.g.
  // cancelled/matched/started from another tab or device, or a join
  // request accepted/rejected/left elsewhere) instead of only reflecting
  // what was fetched on the last page load.
  useEffect(() => {
    const supabase = createClient();

    async function fetchOwnBeacon() {
      const { data } = await supabase
        .from("beacons")
        .select("*")
        .eq("user_id", profile.id)
        .eq("status", "ACTIVE")
        .maybeSingle();
      setOwnBeacon((data as Beacon) ?? null);
    }

    async function fetchHasActiveJoin() {
      const { data } = await supabase
        .from("beacon_joins")
        .select("id, beacons!inner(status)")
        .eq("user_id", profile.id)
        .in("status", ["PENDING", "ACCEPTED"])
        .eq("beacons.status", "ACTIVE")
        .maybeSingle();
      setHasActiveJoin(data != null);
    }

    const channel = supabase
      .channel(`lfg-own-beacon-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacons" },
        () => {
          fetchOwnBeacon();
          fetchHasActiveJoin();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacon_joins" },
        () => fetchHasActiveJoin(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id]);

  const game = GAMES_CONFIG[profile.preferred_game];
  const glowColor = game?.glowColor ?? "rgba(255,255,255,0.4)";
  const isSearching = ownBeacon?.status === "ACTIVE";
  const formatLabel = game?.formats.find(
    (format) => format.key === profile.preferred_format,
  )?.label;

  async function handleClick() {
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
    const result = await cancelBeacon(ownBeacon!.id);
    if (result.error) {
      setError(result.error);
    }
    setPending(false);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-sm font-medium text-zinc-400">
          {isSearching ? "Searching for" : "Last search"}
        </span>
        <span className="text-lg font-semibold text-zinc-50">
          {game?.name} &middot; {formatLabel} &middot;{" "}
          {profile.preferred_match_type}
        </span>
      </div>
      <MotionFab
        type="button"
        onClick={handleClick}
        disabled={pending}
        animate={
          isSearching
            ? {
                boxShadow: [
                  `0 0 0px 0px ${glowColor}`,
                  `0 0 40px 20px ${glowColor}`,
                  `0 0 0px 0px ${glowColor}`,
                ],
              }
            : { boxShadow: `0 0 0px 0px ${glowColor}` }
        }
        transition={
          isSearching
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
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
          bgcolor: "#18181b",
          color: "#fafafa",
          fontSize: "1.125rem",
          fontWeight: 700,
          "&:hover": { bgcolor: "#27272a" },
          "&.Mui-disabled": {
            bgcolor: "#18181b",
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
        {isSearching ? "CANCEL" : "LFG"}
      </MotionFab>
      {error && <Alert severity="error">{error}</Alert>}

      <LfgDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => setDialogOpen(false)}
        profile={profile}
      />

      <CantStartSearchDialog
        open={blockedDialogOpen}
        onClose={() => setBlockedDialogOpen(false)}
      />
    </div>
  );
}

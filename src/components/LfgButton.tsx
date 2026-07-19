"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio, X } from "lucide-react";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { cancelBeacon } from "@/app/actions/beacons";
import { createClient } from "@/lib/supabase/client";
import { LfgDialog } from "@/components/LfgDialog";
import type { Beacon, Profile } from "@/types/database";

interface LfgButtonProps {
  profile: Profile;
  ownBeacon: Beacon | null;
}

export function LfgButton({
  profile,
  ownBeacon: initialOwnBeacon,
}: LfgButtonProps) {
  const [ownBeacon, setOwnBeacon] = useState(initialOwnBeacon);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Keep ownBeacon in sync with realtime changes (e.g. cancelled/matched/
  // started from another tab or device) instead of only reflecting what
  // was fetched on the last page load.
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

    const channel = supabase
      .channel(`lfg-own-beacon-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "beacons" },
        () => fetchOwnBeacon(),
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
      <motion.button
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
        className="flex h-32 w-32 flex-col items-center justify-center gap-1 rounded-full bg-zinc-900 text-lg font-bold text-zinc-50 disabled:opacity-60"
      >
        {isSearching ? (
          <X className="h-6 w-6" />
        ) : (
          <Radio className="h-6 w-6" />
        )}
        {isSearching ? "CANCEL" : "LFG"}
      </motion.button>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <LfgDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSearchStarted={() => setDialogOpen(false)}
        profile={profile}
      />
    </div>
  );
}

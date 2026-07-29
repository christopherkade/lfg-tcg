"use client";

import { use, useCallback, useImperativeHandle, useState } from "react";
import { Avatar, Box, IconButton, Typography } from "@mui/material";
import { Trash2 } from "lucide-react";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { CITY_MAP } from "@/constants/citiesConfig";
import { createClient } from "@/lib/supabase/client";
import { formatPodWhen } from "@/lib/date";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import { deletePodHistoryEntry } from "@/app/actions/history";
import { PodHistoryDetailDialog } from "@/components/PodHistoryDetailDialog";
import type { PodHistoryEntryWithHost } from "@/components/HistoryList";

export interface HistoryEntriesListHandle {
  refetch: () => Promise<void>;
}

interface HistoryEntriesListProps {
  ref?: React.Ref<HistoryEntriesListHandle>;
  emptyLabel: string;
  gamesPlayedCountPromise: Promise<number>;
  entriesPromise: Promise<PodHistoryEntryWithHost[]>;
}

// Owns everything that depends on the history data — split out of
// HistoryList so that component's title/refresh-button header can render
// synchronously while this suspends (via use()) on the initial
// server-seeded promises. See HistoryList.tsx for the <Suspense> boundary
// wrapping this.
export function HistoryEntriesList({
  ref,
  emptyLabel,
  gamesPlayedCountPromise,
  entriesPromise,
}: HistoryEntriesListProps) {
  const { t, locale } = useTranslation();
  const initialEntries = use(entriesPromise);
  const initialGamesPlayedCount = use(gamesPlayedCountPromise);
  const [entries, setEntries] = useState(initialEntries);
  const [gamesPlayedCount, setGamesPlayedCount] = useState(
    initialGamesPlayedCount,
  );
  const [selectedEntry, setSelectedEntry] =
    useState<PodHistoryEntryWithHost | null>(null);

  const handleDelete = (entryId: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    deletePodHistoryEntry(entryId);
  };

  // Mirrors MatchFeedList's own client-side refetch pattern — this list's
  // state was seeded once from the server promises above and never
  // re-syncs from them again, so a router-level refresh wouldn't actually
  // update what's on screen; refetch both pieces directly instead.
  const refetch = useCallback(async () => {
    const supabase = createClient();
    const [{ data: entriesData }, { data: countData }] = await Promise.all([
      supabase
        .from("pod_history")
        .select("*, host:profiles!host_id(id, username, avatar_url, discord_handle)")
        .order("matched_at", { ascending: false })
        .limit(50),
      supabase.rpc("get_games_played_count"),
    ]);
    setEntries((entriesData ?? []) as PodHistoryEntryWithHost[]);
    setGamesPlayedCount(countData ?? 0);
  }, []);

  useImperativeHandle(ref, () => ({ refetch }), [refetch]);

  const gamesPlayedLine = (
    <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
      {t("historyPage.gamesPlayed", { count: gamesPlayedCount })}
    </Typography>
  );

  if (entries.length === 0) {
    return (
      <>
        {gamesPlayedLine}
        <Typography sx={{ color: "text.secondary", textAlign: "center" }}>
          {emptyLabel}
        </Typography>
      </>
    );
  }

  return (
    <>
      {gamesPlayedLine}
      <div className="flex w-full max-w-md flex-col gap-4">
        {entries.map((entry) => {
          const game = GAMES_CONFIG[entry.game_key];
          const when = formatPodWhen(
            { scheduled_at: entry.scheduled_at, created_at: entry.pod_created_at },
            locale,
            t,
          );

          return (
            <Box
              key={entry.id}
              onClick={() => setSelectedEntry(entry)}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: "background.paper",
                cursor: "pointer",
              }}
              className="flex flex-col gap-3 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col">
                  <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                    {game?.name ?? entry.game_key}
                  </Typography>
                  <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                    {t(`format.${entry.format_key}` as TranslationKey)}
                    {" · "}
                    {entry.type === "IRL"
                      ? t("podFilters.matchTypeIrl")
                      : t("podFilters.matchTypeOnline")}
                  </Typography>
                  <Typography
                    className="sm:hidden"
                    sx={{ fontSize: "0.75rem", color: "text.secondary" }}
                  >
                    {when}
                  </Typography>
                </div>
                <div className="flex items-center gap-1">
                  <Typography
                    className="hidden sm:inline"
                    sx={{ fontSize: "0.75rem", color: "text.secondary" }}
                  >
                    {when}
                  </Typography>
                  <IconButton
                    size="small"
                    aria-label={t("historyPage.delete")}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(entry.id);
                    }}
                    sx={{ color: "text.secondary" }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>

              {entry.location_name && (
                <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                  {entry.location_name}
                  {entry.city && CITY_MAP[entry.city]
                    ? ` (${CITY_MAP[entry.city].label})`
                    : ""}
                </Typography>
              )}

              <div
                className="flex flex-col gap-2 pt-2"
                style={{ borderTop: "1px solid rgba(128, 128, 128, 0.2)" }}
              >
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary" }}>
                  {t("historyPage.members")}
                </Typography>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={entry.host.avatar_url ?? undefined}
                      sx={{ width: 24, height: 24, fontSize: "0.75rem" }}
                    >
                      {entry.host.username[0]?.toUpperCase()}
                    </Avatar>
                    <Typography sx={{ fontSize: "0.875rem", color: "text.primary" }}>
                      {entry.host.username}
                    </Typography>
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                      ({t("historyPage.host")})
                    </Typography>
                  </div>
                  <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                    {entry.host.discord_handle}
                  </Typography>
                </div>
                {entry.members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar
                        src={member.avatar_url ?? undefined}
                        sx={{ width: 24, height: 24, fontSize: "0.75rem" }}
                      >
                        {member.username[0]?.toUpperCase()}
                      </Avatar>
                      <Typography sx={{ fontSize: "0.875rem", color: "text.primary" }}>
                        {member.username}
                      </Typography>
                    </div>
                    <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                      {member.discord_handle}
                    </Typography>
                  </div>
                ))}
              </div>
            </Box>
          );
        })}
      </div>
      <PodHistoryDetailDialog
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onDelete={handleDelete}
      />
    </>
  );
}

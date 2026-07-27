"use client";

import { Suspense, useRef } from "react";
import { Skeleton, Typography } from "@mui/material";
import { RefreshButton } from "@/components/RefreshButton";
import {
  HistoryEntriesList,
  type HistoryEntriesListHandle,
} from "@/components/HistoryEntriesList";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { PodHistoryEntry, Profile } from "@/types/database";

export type PodHistoryEntryWithHost = PodHistoryEntry & {
  host: Pick<Profile, "id" | "username" | "avatar_url" | "discord_handle">;
};

interface HistoryListProps {
  title: string;
  emptyLabel: string;
  /** Not awaited by the page — HistoryEntriesList suspends on it. */
  gamesPlayedCountPromise: Promise<number>;
  /** Not awaited by the page — HistoryEntriesList suspends on it. */
  entriesPromise: Promise<PodHistoryEntryWithHost[]>;
}

function HistoryListSkeleton() {
  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton
          key={index}
          variant="rounded"
          height={80}
          sx={{ borderRadius: 2 }}
        />
      ))}
    </div>
  );
}

// The title/refresh button render synchronously and instantly on
// navigation — only the actual entries (owned by HistoryEntriesList)
// suspend, via <Suspense> below, so clicking into the History tab never
// blocks on the Supabase round-trips page.tsx kicks off (and doesn't
// await) for it.
export function HistoryList({
  title,
  emptyLabel,
  gamesPlayedCountPromise,
  entriesPromise,
}: HistoryListProps) {
  const { t } = useTranslation();
  const listRef = useRef<HistoryEntriesListHandle>(null);

  return (
    <>
      <div className="flex items-center gap-1">
        <Typography
          component="h1"
          sx={{ fontSize: "1.5rem", fontWeight: 700, color: "text.primary" }}
        >
          {title}
        </Typography>
        <RefreshButton
          onRefresh={() => listRef.current?.refetch() ?? Promise.resolve()}
          ariaLabel={t("historyPage.refresh")}
        />
      </div>
      <Suspense fallback={<HistoryListSkeleton />}>
        <HistoryEntriesList
          ref={listRef}
          emptyLabel={emptyLabel}
          gamesPlayedCountPromise={gamesPlayedCountPromise}
          entriesPromise={entriesPromise}
        />
      </Suspense>
    </>
  );
}

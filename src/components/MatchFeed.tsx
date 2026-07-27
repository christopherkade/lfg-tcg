"use client";

import { Suspense, useRef, useState } from "react";
import { Skeleton, Typography } from "@mui/material";
import { PodFilters } from "@/components/PodFilters";
import { RefreshButton } from "@/components/RefreshButton";
import { MatchFeedList, type MatchFeedListHandle } from "@/components/MatchFeedList";
import { getInitialFilters } from "@/lib/pods/matchFeed";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { PodFiltersValue } from "@/components/PodFilters";
import type { PodWithRelations, Profile } from "@/types/database";

interface MatchFeedProps {
  profile: Profile;
  currentUserId: string;
  /** Not awaited by PodsView — see MatchFeedList, which suspends on it. */
  initialSharedPodPromise: Promise<{ data: PodWithRelations | null; error: unknown } | null>;
  /** Not awaited by PodsView — see MatchFeedList, which suspends on it. */
  initialPodsPromise: Promise<PodWithRelations[]>;
}

function MatchFeedSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton
          key={index}
          variant="rounded"
          height={96}
          sx={{ borderRadius: 2 }}
        />
      ))}
    </div>
  );
}

// The filter bar and title render synchronously and instantly on
// navigation — only the actual feed data (owned by MatchFeedList) suspends,
// via <Suspense> below, so clicking into the Pods tab never blocks on the
// Supabase round-trips PodsView kicks off (and doesn't await) for it.
export function MatchFeed({
  profile,
  currentUserId,
  initialSharedPodPromise,
  initialPodsPromise,
}: MatchFeedProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<PodFiltersValue>(() =>
    getInitialFilters(profile),
  );
  const listRef = useRef<MatchFeedListHandle>(null);

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-8">
      <div className="w-full">
        <PodFilters value={filters} onChange={setFilters} />
      </div>
      <div className="flex w-full max-w-md flex-col gap-3">
        <div className="flex items-center gap-1">
          <Typography
            component="h2"
            sx={{
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "text.primary",
            }}
          >
            {t("matchFeed.title")}
          </Typography>
          <RefreshButton
            onRefresh={() => listRef.current?.refetch() ?? Promise.resolve()}
            ariaLabel={t("matchFeed.refresh")}
          />
        </div>
        {!profile.city && (
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
            {t("matchFeed.noCityHint")}
          </Typography>
        )}
        <Suspense fallback={<MatchFeedSkeleton />}>
          <MatchFeedList
            ref={listRef}
            profile={profile}
            currentUserId={currentUserId}
            filters={filters}
            initialPodsPromise={initialPodsPromise}
            initialSharedPodPromise={initialSharedPodPromise}
          />
        </Suspense>
      </div>
    </div>
  );
}

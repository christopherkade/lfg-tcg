import { Suspense } from "react";
import { Box } from "@mui/material";
import type { createClient } from "@/lib/supabase/server";
import { OwnPodPanel } from "@/components/OwnPodPanel";
import { MatchFeed } from "@/components/MatchFeed";
import { fetchActivePodsData, getInitialFilters } from "@/lib/pods/matchFeed";
import type { Profile } from "@/types/database";

interface PodsViewProps {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profile: Profile;
  highlightOwn?: boolean;
  sharedPodId?: string;
}

export function PodsView({
  supabase,
  userId,
  profile,
  highlightOwn = false,
  sharedPodId,
}: PodsViewProps) {
  // None of these three are awaited here — each Promise is handed straight
  // to a client component that suspends on it via React's use(), so the
  // filter bar / title chrome around them (MatchFeed) and the whole rest of
  // this page can render immediately instead of blocking on these Supabase
  // round-trips. See MatchFeed/MatchFeedList and OwnPodPanel.
  // Wrapped in Promise.resolve() — Supabase's query builders are thenable
  // but not real Promise instances (missing .catch/.finally), which
  // React's use() and plain prop typing both expect.
  const ownPodPromise = Promise.resolve(
    supabase
      .from("pods")
      .select("*, profiles(*), pod_joins(*, profiles(*))")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle(),
  );

  const sharedPodPromise = sharedPodId
    ? Promise.resolve(
        supabase
          .from("pods")
          .select("*, profiles(*), pod_joins(*, profiles(*))")
          .eq("id", sharedPodId)
          .maybeSingle(),
      )
    : Promise.resolve(null);

  const initialPodsPromise = fetchActivePodsData(
    supabase,
    userId,
    profile,
    getInitialFilters(profile),
  );

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center gap-8 px-6 py-10"
    >
      <Suspense fallback={null}>
        <OwnPodPanel
          currentUserId={userId}
          initialPodPromise={ownPodPromise}
          initialHighlight={highlightOwn}
        />
      </Suspense>
      <MatchFeed
        profile={profile}
        currentUserId={userId}
        initialSharedPodPromise={sharedPodPromise}
        initialPodsPromise={initialPodsPromise}
      />
    </Box>
  );
}

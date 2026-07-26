import { Box } from "@mui/material";
import type { createClient } from "@/lib/supabase/server";
import { OwnPodPanel } from "@/components/OwnPodPanel";
import { MatchFeed } from "@/components/MatchFeed";
import { fetchActivePodsData, getInitialFilters } from "@/lib/pods/matchFeed";
import type { PodWithRelations, Profile } from "@/types/database";

interface PodsViewProps {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profile: Profile;
  highlightOwn?: boolean;
  sharedPodId?: string;
}

export async function PodsView({
  supabase,
  userId,
  profile,
  highlightOwn = false,
  sharedPodId,
}: PodsViewProps) {
  // Run independently of each other — and of the feed's own query below —
  // instead of sequentially, since none of them depend on another's result.
  const [ownPodResult, sharedPodResult, initialPods] = await Promise.all([
    supabase
      .from("pods")
      .select("*, profiles(*), pod_joins(*, profiles(*))")
      .eq("user_id", userId)
      .eq("status", "ACTIVE")
      .maybeSingle(),
    sharedPodId
      ? supabase
          .from("pods")
          .select("*, profiles(*), pod_joins(*, profiles(*))")
          .eq("id", sharedPodId)
          .maybeSingle()
      : Promise.resolve(null),
    // Seeds MatchFeed's initial render with the same default filters it
    // would otherwise fetch client-side on mount — avoids a loading flash
    // and a client round-trip on every /pods navigation (see MatchFeed's
    // `initialPods` prop and OwnPodPanel's equivalent `initialPod`).
    fetchActivePodsData(supabase, userId, profile, getInitialFilters(profile)),
  ]);

  const { data: ownPod } = ownPodResult;
  const sharedPod = sharedPodResult
    ? (sharedPodResult.data as PodWithRelations | null)
    : null;

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center gap-8 px-6 py-10"
    >
      <OwnPodPanel
        currentUserId={userId}
        initialPod={ownPod as PodWithRelations | null}
        initialHighlight={highlightOwn}
      />
      <MatchFeed
        profile={profile}
        currentUserId={userId}
        initialSharedPod={sharedPod}
        initialPods={initialPods}
      />
    </Box>
  );
}

import { Box } from "@mui/material";
import type { createClient } from "@/lib/supabase/server";
import { OwnPodPanel } from "@/components/OwnPodPanel";
import { MatchFeed } from "@/components/MatchFeed";
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
  const { data: ownPod } = await supabase
    .from("pods")
    .select("*, profiles(*), pod_joins(*, profiles(*))")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  let sharedPod: PodWithRelations | null = null;
  if (sharedPodId) {
    const { data } = await supabase
      .from("pods")
      .select("*, profiles(*), pod_joins(*, profiles(*))")
      .eq("id", sharedPodId)
      .maybeSingle();
    sharedPod = data as PodWithRelations | null;
  }

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
      <MatchFeed profile={profile} currentUserId={userId} initialSharedPod={sharedPod} />
    </Box>
  );
}

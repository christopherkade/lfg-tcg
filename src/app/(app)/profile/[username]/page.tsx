import { notFound } from "next/navigation";
import { requireTrustedProfile } from "@/lib/session";
import { fetchPublicProfile } from "@/lib/profile/fetchPublicProfile";
import { PodsView } from "../../pods/PodsView";
import { SharedProfilePanel } from "@/components/SharedProfilePanel";

interface PublicProfilePageProps {
  params: Promise<{ username: string }>;
}

// Only reached on a direct/fresh visit (pasted link, new tab, refresh) — an
// in-app click opens the same panel as an overlay via UserProfilePanelContext
// instead, without a real navigation (see that file's docstring for why).
// Renders the real Active Pods screen (PodsView, shared with /pods and
// /pods/[id]) behind the panel rather than a blank page, so a shared
// profile link both keeps its own URL and lands somewhere real — mirroring
// how /pods/[id] renders the same PodsView behind an auto-opened
// PodDetailDialog for a shared pod link.
export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { username } = await params;
  const { supabase, userId, profile } = await requireTrustedProfile(
    `/profile/${username}`,
  );

  const data = await fetchPublicProfile(supabase, username);
  if (!data) {
    notFound();
  }

  return (
    <>
      <PodsView supabase={supabase} userId={userId} profile={profile} />
      <SharedProfilePanel data={data} />
    </>
  );
}

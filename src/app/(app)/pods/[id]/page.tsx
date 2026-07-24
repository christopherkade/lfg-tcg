import { requireProfile } from "@/lib/session";
import { PodsView } from "../PodsView";

interface PodPageProps {
  params: Promise<{ id: string }>;
}

export default async function PodPage({ params }: PodPageProps) {
  const { id } = await params;
  const { supabase, user, profile } = await requireProfile(`/pods/${id}`);

  return (
    <PodsView
      supabase={supabase}
      userId={user.id}
      profile={profile}
      sharedPodId={id}
    />
  );
}

import { requireTrustedProfile } from "@/lib/session";
import { PodsView } from "./PodsView";

interface PodsPageProps {
  searchParams: Promise<{ highlight?: string }>;
}

export default async function PodsPage({ searchParams }: PodsPageProps) {
  const { supabase, userId, profile } = await requireTrustedProfile("/pods");
  const { highlight } = await searchParams;

  return (
    <PodsView
      supabase={supabase}
      userId={userId}
      profile={profile}
      highlightOwn={highlight === "own"}
    />
  );
}

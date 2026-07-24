import { requireProfile } from "@/lib/session";
import { PodsView } from "./PodsView";

interface PodsPageProps {
  searchParams: Promise<{ highlight?: string }>;
}

export default async function PodsPage({ searchParams }: PodsPageProps) {
  const { supabase, user, profile } = await requireProfile("/pods");
  const { highlight } = await searchParams;

  return (
    <PodsView
      supabase={supabase}
      userId={user.id}
      profile={profile}
      highlightOwn={highlight === "own"}
    />
  );
}

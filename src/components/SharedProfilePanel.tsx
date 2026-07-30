"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { UserProfilePanel } from "@/components/UserProfilePanel";
import type { PublicProfileData } from "@/lib/profile/fetchPublicProfile";

interface SharedProfilePanelProps {
  data: PublicProfileData;
}

// Renders the profile panel on top of the real Active Pods screen for a
// direct/fresh visit to /profile/[username] (a pasted link, a new tab) —
// see PublicProfilePage, which renders PodsView behind this the same way
// pods/[id]/page.tsx does for a shared pod link. This is what lets a shared
// profile link both keep its own URL and show real content (not a blank
// page) behind the panel, with TabBar's effectiveActiveHref already
// treating this route as the Active Pods tab. Closing goes there too, to
// match.
export function SharedProfilePanel({ data }: SharedProfilePanelProps) {
  const router = useRouter();

  const handleClose = useCallback(() => {
    router.push("/pods");
  }, [router]);

  return <UserProfilePanel data={data} onClose={handleClose} />;
}

import { Box } from "@mui/material";
import { requireTrustedProfile } from "@/lib/session";
import { LfgButton } from "@/components/LfgButton";

export default async function LfgPage() {
  const { profile } = await requireTrustedProfile();

  // ownPod/hasActiveJoin are deliberately not fetched here — LfgButton
  // renders everything it needs from `profile` alone, then fetches these
  // itself client-side on mount (same functions it already uses for
  // realtime resync). Blocking the whole page on two more sequential
  // queries just to seed a value the button can fetch itself in parallel
  // with painting isn't worth the added navigation latency.
  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center justify-center gap-6 px-6"
    >
      <LfgButton profile={profile} />
    </Box>
  );
}

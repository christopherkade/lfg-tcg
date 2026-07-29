"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Box, Button, Typography } from "@mui/material";
import { RotateCw } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleContext";

// Root-level error boundary — catches unexpected render-time exceptions
// anywhere under the root layout that aren't already handled by a more
// specific boundary. Server actions in this app return typed { error }
// strings instead of throwing (see src/app/actions/*), so this is only
// ever expected to fire for genuinely unanticipated failures (a Supabase
// client-init error, an unexpected null-deref, etc.) rather than routine
// validation failures.
//
// This custom Next.js build's error.js prefers `unstable_retry` over the
// classic `reset` prop (see node_modules/next/dist/docs/.../error.md) — it
// re-fetches and re-renders the failed segment instead of just clearing
// local error state.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("[error.tsx] unexpected error:", error);
  }, [error]);

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center"
    >
      <Image
        src="/PodFinder_Mascot_Sad.png"
        alt=""
        width={220}
        height={280}
        priority
        aria-hidden
      />
      <div className="flex flex-col gap-2">
        <Typography
          component="h1"
          sx={{ fontSize: "1.875rem", fontWeight: 700, color: "text.primary" }}
        >
          {t("error.title")}
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 360 }}>
          {t("error.description")}
        </Typography>
      </div>
      <div className="flex items-center gap-3">
        <Button
          onClick={() => unstable_retry()}
          variant="contained"
          startIcon={<RotateCw className="h-5 w-5" />}
          sx={{ px: 3, py: 1.5 }}
        >
          {t("error.retry")}
        </Button>
        <Button href="/" variant="outlined" sx={{ px: 3, py: 1.5 }}>
          {t("error.cta")}
        </Button>
      </div>
    </Box>
  );
}

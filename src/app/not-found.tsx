"use client";

import Image from "next/image";
import { Box, Button, Typography } from "@mui/material";
import { Home } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleContext";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center"
    >
      <Image
        src="/PodFinder_Mascot_Confused.png"
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
          {t("notFound.title")}
        </Typography>
        <Typography sx={{ color: "text.secondary", maxWidth: 360 }}>
          {t("notFound.description")}
        </Typography>
      </div>
      <Button
        href="/"
        variant="contained"
        startIcon={<Home className="h-5 w-5" />}
        sx={{ px: 3, py: 1.5 }}
      >
        {t("notFound.cta")}
      </Button>
    </Box>
  );
}

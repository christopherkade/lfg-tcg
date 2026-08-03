"use client";

import { useEffect, useState, type ComponentType } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Gamepad2, Globe, MapPin, Users } from "lucide-react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "@/lib/i18n/LocaleContext";

const MotionBox = motion.create(Box);

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

// Animates 0 -> target once on mount, skipped under reduced motion (renders
// the final value immediately instead). Shared by every real stat card so
// they all animate identically without copy-pasting the effect per card.
function useCountUp(target: number, prefersReducedMotion: boolean | null) {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const controls = animate(0, target, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (value) => setAnimatedValue(Math.round(value)),
    });
    return () => controls.stop();
  }, [target, prefersReducedMotion]);

  return prefersReducedMotion ? target : animatedValue;
}

interface StatCardProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}

// Module-scope so its component identity is stable across ProfileStats
// re-renders (defining it inside the render body would force a remount +
// re-trigger the mount-in `variants` animation on every parent re-render).
function StatCard({ icon: Icon, label, value }: StatCardProps) {
  return (
    <MotionBox
      variants={cardVariants}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
      className="flex flex-col gap-1 p-4"
    >
      <Box sx={{ color: "primary.main" }} className="inline-flex">
        <Icon className="h-5 w-5" />
      </Box>
      <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, color: "text.primary" }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
        {label}
      </Typography>
    </MotionBox>
  );
}

interface ProfileStatsProps {
  gamesPlayedCount: number;
  peopleMet: number;
  irlCount: number;
  onlineCount: number;
}

export function ProfileStats({
  gamesPlayedCount,
  peopleMet,
  irlCount,
  onlineCount,
}: ProfileStatsProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();

  const displayedGamesPlayed = useCountUp(gamesPlayedCount, prefersReducedMotion);
  const displayedPeopleMet = useCountUp(peopleMet, prefersReducedMotion);
  const displayedIrlCount = useCountUp(irlCount, prefersReducedMotion);
  const displayedOnlineCount = useCountUp(onlineCount, prefersReducedMotion);

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <Typography
        sx={{
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          color: "text.secondary",
          textTransform: "uppercase",
        }}
      >
        {t("profileStats.sectionLabel")}
      </Typography>

      <motion.div
        initial={prefersReducedMotion ? false : "hidden"}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.06 } } }}
        className="grid grid-cols-2 gap-3"
      >
        <StatCard
          icon={Gamepad2}
          label={t("profileStats.gamesPlayed")}
          value={displayedGamesPlayed}
        />
        <StatCard
          icon={Users}
          label={t("profileStats.peopleMet")}
          value={displayedPeopleMet}
        />
        <StatCard
          icon={MapPin}
          label={t("profileStats.irlGames")}
          value={displayedIrlCount}
        />
        <StatCard
          icon={Globe}
          label={t("profileStats.onlineGames")}
          value={displayedOnlineCount}
        />
      </motion.div>
    </div>
  );
}

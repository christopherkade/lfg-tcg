"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Zap, History, UserCircle, type LucideIcon } from "lucide-react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { NotificationBell } from "@/components/NotificationBell";
import { SettingsDialog } from "@/components/SettingsDialog";
import { TutorialDialog } from "@/components/TutorialDialog";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { useProfileLock } from "@/lib/ProfileLockContext";
import type { TranslationKey } from "@/lib/i18n";

interface Tab {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { href: "/pods", labelKey: "tabBar.pods", icon: Users },
  { href: "/", labelKey: "tabBar.lfg", icon: Zap },
  { href: "/history", labelKey: "tabBar.history", icon: History },
  { href: "/profile", labelKey: "tabBar.profile", icon: UserCircle },
];

// A direct/shared /profile/<username> visit (SharedProfilePanel, rendered
// over PodsView by that route) is anchored to the Active Pods tab — closing
// the panel returns there — so this treats that route as if /pods were the
// current path, rather than leaving every tab unhighlighted. Only matches
// the public profile route (a segment after /profile/), not the plain
// /profile screen itself, which is its own tab and shouldn't be remapped.
function effectiveActiveHref(pathname: string): string {
  return /^\/profile\/[^/]+$/.test(pathname) ? "/pods" : pathname;
}

export function TabBar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const theme = useTheme();
  const { usernameMissing, requestBlock } = useProfileLock();

  // Highlights the clicked tab immediately on click rather than waiting for
  // usePathname() to reflect the new route (which only happens once the
  // destination page's data is ready) — reconciles back to the real
  // pathname as soon as navigation actually lands.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);
  const activeHref = pendingHref ?? effectiveActiveHref(pathname);

  return (
    <>
      {/* Mobile top bar: app title + notification bell (the bottom tab bar
          below handles navigation, so this bar exists solely to give the
          bell a home on small screens, mirroring "to the right of the
          header" on desktop). */}
      <Box
        component="header"
        sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.default" }}
        className="flex items-center justify-between px-4 py-3 sm:hidden"
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Image src="/mascot.svg" alt="" width={22} height={30} aria-hidden />
          <Typography
            sx={{ fontSize: "1rem", fontWeight: 700, color: "primary.main" }}
          >
            PodFinder
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SettingsDialog />
          <TutorialDialog />
          <NotificationBell />
        </Box>
      </Box>

      {/* Desktop top navbar */}
      <Box
        component="nav"
        sx={{ borderBottom: 1, borderColor: "divider", bgcolor: "background.default" }}
        className="hidden sm:block"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Image src="/mascot.svg" alt="" width={28} height={39} aria-hidden />
            <Typography
              sx={{ fontSize: "1.125rem", fontWeight: 700, color: "primary.main" }}
            >
              PodFinder
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              {TABS.map((tab) => {
                const isActive = activeHref === tab.href;
                const isLocked = usernameMissing && tab.href !== "/profile";
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.href}
                    component={Link}
                    href={tab.href}
                    onNavigate={(e: { preventDefault: () => void }) => {
                      if (isLocked) {
                        e.preventDefault();
                        requestBlock();
                      }
                    }}
                    onClick={() => {
                      if (!isLocked) setPendingHref(tab.href);
                    }}
                    startIcon={<Icon className="h-4 w-4" />}
                    sx={{
                      px: 2,
                      py: 1,
                      bgcolor: isActive ? "primary.main" : "transparent",
                      color: isActive ? "primary.contrastText" : "text.primary",
                      "&:hover": {
                        bgcolor: isActive ? "primary.light" : "action.hover",
                        color: isActive ? "primary.contrastText" : "text.primary",
                      },
                    }}
                  >
                    {t(tab.labelKey)}
                  </Button>
                );
              })}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <SettingsDialog />
              <TutorialDialog />
              <NotificationBell />
            </Box>
          </Box>
        </div>
      </Box>

      {/* Mobile bottom tab bar */}
      <Box
        component="nav"
        sx={{ borderTop: 1, borderColor: "divider", bgcolor: "background.default" }}
        className="fixed inset-x-0 bottom-0 z-10 flex sm:hidden"
      >
        {TABS.map((tab) => {
          const isActive = activeHref === tab.href;
          const isLocked = usernameMissing && tab.href !== "/profile";
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onNavigate={(e) => {
                if (isLocked) {
                  e.preventDefault();
                  requestBlock();
                }
              }}
              onClick={() => {
                if (!isLocked) setPendingHref(tab.href);
              }}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                isActive ? "text-ember" : ""
              }`}
              style={isActive ? undefined : { color: theme.palette.text.primary }}
            >
              <Icon className="h-5 w-5" />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </Box>
    </>
  );
}

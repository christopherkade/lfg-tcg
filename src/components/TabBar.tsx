"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Zap, UserCircle, type LucideIcon } from "lucide-react";
import { Box, Button, Typography } from "@mui/material";
import { NotificationBell } from "@/components/NotificationBell";
import { TutorialDialog } from "@/components/TutorialDialog";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";

interface Tab {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
}

interface TabBarProps {
  currentUserId: string;
}

const TABS: Tab[] = [
  { href: "/pods", labelKey: "tabBar.pods", icon: Users },
  { href: "/", labelKey: "tabBar.lfg", icon: Zap },
  { href: "/profile", labelKey: "tabBar.profile", icon: UserCircle },
];

export function TabBar({ currentUserId }: TabBarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <>
      {/* Mobile top bar: app title + notification bell (the bottom tab bar
          below handles navigation, so this bar exists solely to give the
          bell a home on small screens, mirroring "to the right of the
          header" on desktop). */}
      <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3 sm:hidden">
        <Typography
          sx={{ fontSize: "1rem", fontWeight: 700, color: "#F2762E" }}
        >
          PodMaker
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <TutorialDialog />
          <NotificationBell currentUserId={currentUserId} />
        </Box>
      </header>

      {/* Desktop top navbar */}
      <nav className="hidden border-b border-zinc-800 bg-zinc-950 sm:block">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Typography
            sx={{ fontSize: "1.125rem", fontWeight: 700, color: "#F2762E" }}
          >
            PodMaker
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              {TABS.map((tab) => {
                const isActive = pathname === tab.href;
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.href}
                    component={Link}
                    href={tab.href}
                    startIcon={<Icon className="h-4 w-4" />}
                    sx={{
                      px: 2,
                      py: 1,
                      bgcolor: isActive ? "#F2762E" : "transparent",
                      color: isActive ? "#ffffff" : "#a1a1aa",
                      "&:hover": {
                        bgcolor: isActive ? "#F79A5D" : "#18181b",
                        color: isActive ? "#ffffff" : "#e4e4e7",
                      },
                    }}
                  >
                    {t(tab.labelKey)}
                  </Button>
                );
              })}
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <TutorialDialog />
              <NotificationBell currentUserId={currentUserId} />
            </Box>
          </Box>
        </div>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-zinc-800 bg-zinc-950 sm:hidden">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                isActive ? "text-ember" : "text-zinc-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

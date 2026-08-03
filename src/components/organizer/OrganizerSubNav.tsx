"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, History, Settings, type LucideIcon } from "lucide-react";
import { Box, useTheme } from "@mui/material";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";

interface SubNavItem {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
}

const ITEMS: SubNavItem[] = [
  { href: "/organizer", labelKey: "organizer.subNav.tables", icon: LayoutGrid },
  {
    href: "/organizer/history",
    labelKey: "organizer.subNav.history",
    icon: History,
  },
  {
    href: "/organizer/settings",
    labelKey: "organizer.subNav.settings",
    icon: Settings,
  },
];

// Left sidebar on desktop, horizontal scrollable tab strip on mobile — same
// desktop/mobile split convention as TabBar, kept separate from it since
// this only ever appears within /organizer/* and shouldn't compete with the
// app's primary navigation.
export function OrganizerSubNav() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <>
      <Box
        component="nav"
        sx={{ borderColor: "divider", bgcolor: "background.default" }}
        className="hidden w-58 shrink-0 flex-col gap-1 border-r p-4 sm:flex"
      >
        {ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive
                  ? "rgba(245, 158, 11, 0.12)"
                  : "transparent",
                color: isActive ? "#F59E0B" : theme.palette.text.primary,
              }}
            >
              <Icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </Box>

      <Box
        component="nav"
        sx={{ borderColor: "divider", bgcolor: "background.default" }}
        className="flex gap-1 overflow-x-auto border-b p-2 sm:hidden"
      >
        {ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: isActive
                  ? "rgba(245, 158, 11, 0.12)"
                  : "transparent",
                color: isActive ? "#F59E0B" : theme.palette.text.primary,
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </Box>
    </>
  );
}

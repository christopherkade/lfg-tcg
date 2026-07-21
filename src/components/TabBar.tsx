"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Zap, UserCircle, type LucideIcon } from "lucide-react";
import { Box, Button, Typography } from "@mui/material";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { href: "/beacons", label: "Beacons", icon: Users },
  { href: "/", label: "LFG", icon: Zap },
  { href: "/profile", label: "Profile", icon: UserCircle },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop top navbar */}
      <nav className="hidden border-b border-zinc-800 bg-zinc-950 sm:block">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Typography
            sx={{ fontSize: "1.125rem", fontWeight: 700, color: "#fafafa" }}
          >
            ManaMatch
          </Typography>
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
                    bgcolor: isActive ? "#fafafa" : "transparent",
                    color: isActive ? "#09090b" : "#a1a1aa",
                    "&:hover": {
                      bgcolor: isActive ? "#e4e4e7" : "#18181b",
                      color: isActive ? "#09090b" : "#e4e4e7",
                    },
                  }}
                >
                  {tab.label}
                </Button>
              );
            })}
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
                isActive ? "text-zinc-50" : "text-zinc-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

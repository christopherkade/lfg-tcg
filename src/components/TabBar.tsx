"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Zap, UserCircle, type LucideIcon } from "lucide-react";

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
          <span className="text-lg font-bold text-zinc-50">ManaMatch</span>
          <div className="flex gap-2">
            {TABS.map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-zinc-50 text-zinc-950"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
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

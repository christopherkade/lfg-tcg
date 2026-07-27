"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { IconButton } from "@mui/material";
import { RefreshCw } from "lucide-react";

const COOLDOWN_MS = 2000;
// Tailwind's animate-spin runs one full rotation per second — if onRefresh()
// resolves faster than that, cutting the class immediately stops the icon
// mid-rotation. Holding the spin open for at least one full cycle keeps it
// visually complete regardless of how fast the underlying refresh is.
const MIN_SPIN_MS = 1000;

interface RefreshButtonProps {
  onRefresh: () => void | Promise<void>;
  ariaLabel: string;
}

// Shared by the Pods/History list headers. Spins while `onRefresh` is in
// flight and stays disabled for a short cooldown after that resolves, so
// rapid re-clicking can't fire off a burst of refetches.
export function RefreshButton({ onRefresh, ariaLabel }: RefreshButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [cooldown, setCooldown] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleClick() {
    if (isPending || cooldown) return;
    startTransition(async () => {
      await Promise.all([
        onRefresh(),
        new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS)),
      ]);
      setCooldown(true);
      timeoutRef.current = setTimeout(() => setCooldown(false), COOLDOWN_MS);
    });
  }

  return (
    <IconButton
      onClick={handleClick}
      disabled={isPending || cooldown}
      aria-label={ariaLabel}
      size="small"
      sx={{ color: "text.primary" }}
    >
      <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
    </IconButton>
  );
}

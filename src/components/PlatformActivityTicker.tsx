"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Box, Typography } from "@mui/material";
import { Activity } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import {
  getPlatformActivityStats,
  getRecentPlatformActivity,
  type PlatformActivityEvent,
  type PlatformActivityStats,
} from "@/app/actions/platformActivity";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import type { Locale, TranslationKey } from "@/lib/i18n";

const POLL_INTERVAL_MS = 45_000;
const EVENT_ROTATE_MS = 4_000;

interface PlatformActivityTickerProps {
  /** Server-fetched seed (e.g. from the Login page) for an instant first paint. */
  initialStats?: PlatformActivityStats | null;
  initialEvents?: PlatformActivityEvent[];
}

function formatEventText(
  event: PlatformActivityEvent,
  locale: Locale,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const game = GAMES_CONFIG[event.gameKey];
  const gameLabel = game?.shortName ?? game?.name ?? event.gameKey;
  const formatLabel =
    game?.formats.find((f) => f.key === event.formatKey)?.label ??
    event.formatKey;
  const duration = formatDistanceToNowStrict(new Date(event.eventAt), {
    addSuffix: true,
    locale: locale === "fr" ? fr : undefined,
  });

  return t(
    event.eventType === "CREATED"
      ? "platformActivity.eventCreated"
      : "platformActivity.eventMatched",
    { game: gameLabel, format: formatLabel, duration },
  );
}

/**
 * Ambient "the platform is alive" signal, sourced entirely from real
 * first-party data (supabase/sql/platform_activity_stats.sql) — no seeded
 * or fake activity. Dropped into the Match Feed's empty state and the Login
 * page. Polls on an interval rather than subscribing to Supabase Realtime,
 * matching this project's own documented Realtime-unreliability workaround
 * (see PodRealtimeProvider/MatchedPodWatcher) — this data is non-actionable
 * ambient reassurance, not something a user needs to react to within seconds.
 */
export function PlatformActivityTicker({
  initialStats = null,
  initialEvents = [],
}: PlatformActivityTickerProps) {
  const { t, locale } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [stats, setStats] = useState<PlatformActivityStats | null>(
    initialStats,
  );
  const [events, setEvents] = useState<PlatformActivityEvent[]>(
    initialEvents,
  );
  const [eventIndex, setEventIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const [nextStats, nextEvents] = await Promise.all([
        getPlatformActivityStats(),
        getRecentPlatformActivity(),
      ]);
      if (!cancelled) {
        setStats(nextStats);
        setEvents(nextEvents);
        setEventIndex(0);
      }
    }

    // Only kick off an immediate fetch when there's no server-seeded data
    // to show yet (e.g. mounted inside MatchFeedList, which has none) —
    // the Login page's props already cover the first paint.
    if (initialStats === null && initialEvents.length === 0) {
      refresh();
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") refresh();
    }

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // Intentionally runs once — this component owns its own refresh loop,
    // it doesn't re-fetch when initialStats/initialEvents props change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (events.length < 2) return;
    const rotate = setInterval(() => {
      setEventIndex((index) => (index + 1) % events.length);
    }, EVENT_ROTATE_MS);
    return () => clearInterval(rotate);
  }, [events.length]);

  // A "0 active, 0 matched" line undermines the exact trust goal this
  // component exists for — render nothing rather than an empty platform.
  if (!stats || (stats.activePodCount === 0 && stats.matchedLast24h === 0)) {
    return null;
  }

  const currentEvent = events[eventIndex % events.length];
  const shouldAnimate = !prefersReducedMotion;

  return (
    <Box
      sx={{
        bgcolor: "rgba(242, 118, 46, 0.08)",
        borderColor: "rgba(242, 118, 46, 0.3)",
        px: 3,
        py: 2.5,
      }}
      className="flex flex-col items-center gap-1 rounded-2xl border"
    >
      <div className="flex items-center gap-1.5">
        <motion.div
          className="flex items-center"
          animate={shouldAnimate ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
          transition={
            shouldAnimate
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0 }
          }
        >
          <Activity
            className="h-4 w-4"
            style={{ color: "var(--color-ember)" }}
          />
        </motion.div>
        <Typography
          sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "text.primary" }}
        >
          {t("platformActivity.activeNow", { count: stats.activePodCount })}
          {" · "}
          {t("platformActivity.matchedToday", { count: stats.matchedLast24h })}
        </Typography>
      </div>
      {currentEvent &&
        (prefersReducedMotion ? (
          <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
            {formatEventText(currentEvent, locale, t)}
          </Typography>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={eventIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <Typography
                sx={{ fontSize: "0.6875rem", color: "text.secondary" }}
              >
                {formatEventText(currentEvent, locale, t)}
              </Typography>
            </motion.div>
          </AnimatePresence>
        ))}
    </Box>
  );
}

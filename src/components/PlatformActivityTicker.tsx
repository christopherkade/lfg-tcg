"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Box, IconButton, Typography } from "@mui/material";
import { Activity, X } from "lucide-react";
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
// Heuristic px/char-equivalent pace for the marquee: scales the loop
// duration with how much text there is to read, instead of a fixed
// duration that would feel rushed with many events or crawl with few.
const MARQUEE_SECONDS_PER_CHAR = 0.3;
const MARQUEE_MIN_SECONDS = 25;

interface EventParts {
  gameLabel: string;
  infoText: string;
}

// Kept to "Game: info" at a glance — the game name carries the bold visual
// weight (rendered by the caller), everything else is one short clause.
function getEventParts(
  event: PlatformActivityEvent,
  locale: Locale,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): EventParts {
  const game = GAMES_CONFIG[event.gameKey];
  const gameLabel = game?.shortName ?? game?.name ?? event.gameKey;
  const formatLabel =
    game?.formats.find((f) => f.key === event.formatKey)?.label ??
    event.formatKey;
  const duration = formatDistanceToNowStrict(new Date(event.eventAt), {
    addSuffix: true,
    locale: locale === "fr" ? fr : undefined,
  });

  const infoText = t(
    event.eventType === "CREATED"
      ? "platformActivity.eventCreated"
      : "platformActivity.eventMatched",
    { format: formatLabel, duration },
  );

  return { gameLabel, infoText };
}

function EventItem({ gameLabel, infoText }: EventParts) {
  return (
    <Typography
      component="span"
      sx={{ fontSize: "0.8125rem", color: "text.secondary" }}
    >
      <Typography
        component="span"
        sx={{ fontSize: "inherit", fontWeight: 700, color: "text.primary" }}
      >
        {gameLabel}
      </Typography>
      {`: ${infoText}`}
    </Typography>
  );
}

// Generous, fixed gap between one sentence and the next (and between the
// end of one marquee loop and its repeat) — a dot alone read as cramped.
function EventSeparator() {
  return (
    <Typography
      component="span"
      aria-hidden
      sx={{ fontSize: "0.8125rem", color: "text.secondary", mx: 3, flexShrink: 0 }}
    >
      •
    </Typography>
  );
}

function renderEventList(parts: EventParts[], keyPrefix: string) {
  return parts.map((part, index) => (
    <Fragment key={`${keyPrefix}-${index}`}>
      <EventItem {...part} />
      <EventSeparator />
    </Fragment>
  ));
}

/**
 * Ambient "the platform is alive" signal, sourced entirely from real
 * first-party data (supabase/sql/platform_activity_stats.sql) — no seeded
 * or fake activity. Rendered as an always-on banner at the top of the Pods
 * screen, flush against the header. Polls on an interval rather than
 * subscribing to Supabase Realtime, matching this project's own documented
 * Realtime-unreliability workaround (see PodRealtimeProvider/
 * MatchedPodWatcher) — this data is non-actionable ambient reassurance, not
 * something a user needs to react to within seconds.
 */
export function PlatformActivityTicker() {
  const { t, locale } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [stats, setStats] = useState<PlatformActivityStats | null>(null);
  const [events, setEvents] = useState<PlatformActivityEvent[]>([]);
  const [dismissed, setDismissed] = useState(false);

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
      }
    }

    refresh();

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
  }, []);

  const eventParts = useMemo(
    () => events.map((event) => getEventParts(event, locale, t)),
    [events, locale, t],
  );

  // A "0 active, 0 matched" line undermines the exact trust goal this
  // component exists for — render nothing rather than an empty platform.
  if (
    dismissed ||
    !stats ||
    (stats.activePodCount === 0 && stats.matchedLast24h === 0)
  ) {
    return null;
  }

  const shouldAnimate = !prefersReducedMotion;
  const approxLength = eventParts.reduce(
    (total, part) => total + part.gameLabel.length + part.infoText.length,
    0,
  );
  const marqueeDuration = Math.max(
    MARQUEE_MIN_SECONDS,
    approxLength * MARQUEE_SECONDS_PER_CHAR,
  );

  return (
    <Box
      sx={{
        bgcolor: "rgba(59, 130, 246, 0.08)",
      }}
      className="flex w-full items-center gap-2 px-4 py-2"
    >
      <motion.div
        className="flex shrink-0 items-center"
        animate={shouldAnimate ? { opacity: [0.5, 1, 0.5] } : { opacity: 1 }}
        transition={
          shouldAnimate
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0 }
        }
      >
        <Activity className="h-4 w-4" style={{ color: "#3B82F6" }} />
      </motion.div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden whitespace-nowrap">
        <Typography
          component="span"
          sx={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "text.primary",
            flexShrink: 0,
          }}
        >
          {t("platformActivity.activeNow", { count: stats.activePodCount })}
          {" · "}
          {t("platformActivity.matchedToday", { count: stats.matchedLast24h })}
        </Typography>
        {eventParts.length > 0 && (
          <>
            <Typography
              component="span"
              sx={{
                fontSize: "0.8125rem",
                color: "text.secondary",
                flexShrink: 0,
              }}
            >
              ·
            </Typography>
            {prefersReducedMotion ? (
              <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {renderEventList(eventParts, "static")}
              </div>
            ) : (
              <div className="min-w-0 flex-1 overflow-hidden">
                <motion.div
                  className="flex w-max items-center whitespace-nowrap"
                  animate={{ x: ["0%", "-50%"] }}
                  transition={{
                    duration: marqueeDuration,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                >
                  {renderEventList(eventParts, "copy-a")}
                  <div className="flex items-center" aria-hidden>
                    {renderEventList(eventParts, "copy-b")}
                  </div>
                </motion.div>
              </div>
            )}
          </>
        )}
      </div>
      <IconButton
        size="small"
        aria-label={t("platformActivity.dismissAria")}
        onClick={() => setDismissed(true)}
        sx={{
          flexShrink: 0,
          color: "text.primary",
          "&:hover": { color: "text.secondary" },
        }}
      >
        <X className="h-4 w-4" />
      </IconButton>
    </Box>
  );
}

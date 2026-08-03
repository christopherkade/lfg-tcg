"use client";

import { use, useState } from "react";
import { Avatar, IconButton, Typography, useTheme } from "@mui/material";
import { Trash2 } from "lucide-react";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { CITY_MAP } from "@/constants/citiesConfig";
import { formatPodWhen } from "@/lib/date";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { TranslationKey } from "@/lib/i18n";
import { deletePodHistoryEntry } from "@/app/actions/history";
import type { PodHistoryEntry } from "@/types/database";

interface OrganizerTableHistoryListProps {
  /** Not awaited by the page — this component suspends on it via use(). */
  entriesPromise: Promise<PodHistoryEntry[]>;
}

export function OrganizerTableHistoryList({
  entriesPromise,
}: OrganizerTableHistoryListProps) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const [entries, setEntries] = useState(use(entriesPromise));

  const handleDelete = (entryId: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== entryId));
    deletePodHistoryEntry(entryId);
  };

  if (entries.length === 0) {
    return (
      <Typography sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
        {t("organizer.history.empty")}
      </Typography>
    );
  }

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      {entries.map((entry) => {
        const game = GAMES_CONFIG[entry.game_key];
        const when = formatPodWhen(
          { scheduled_at: entry.scheduled_at, created_at: entry.pod_created_at },
          locale,
          t,
        );

        return (
          <div
            key={entry.id}
            className="flex flex-col gap-2 rounded-2xl border p-4"
            style={{
              borderColor: theme.palette.divider,
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col">
                <Typography sx={{ fontWeight: 600, color: "text.primary" }}>
                  {entry.store_name}
                </Typography>
                <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                  {game?.name ?? entry.game_key} ·{" "}
                  {t(`format.${entry.format_key}` as TranslationKey)}
                </Typography>
              </div>
              <div className="flex items-center gap-1">
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                  {when}
                </Typography>
                <IconButton
                  size="small"
                  aria-label={t("organizer.history.delete")}
                  onClick={() => handleDelete(entry.id)}
                  sx={{ color: "text.secondary" }}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            {entry.location_name && (
              <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                {entry.location_name}
                {entry.city && CITY_MAP[entry.city]
                  ? ` (${CITY_MAP[entry.city].label})`
                  : ""}
              </Typography>
            )}

            <div
              className="flex flex-col gap-1.5 pt-2"
              style={{ borderTop: `1px solid ${theme.palette.divider}` }}
            >
              <Typography
                sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary" }}
              >
                {t("organizer.history.attendees", { count: entry.members.length })}
              </Typography>
              {entry.members.length === 0 ? (
                <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                  {t("organizer.history.noAttendees")}
                </Typography>
              ) : (
                entry.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <Avatar
                      src={member.avatar_url ?? undefined}
                      sx={{ width: 20, height: 20, fontSize: "0.6875rem" }}
                    >
                      {member.username[0]?.toUpperCase()}
                    </Avatar>
                    <Typography sx={{ fontSize: "0.8125rem", color: "text.primary" }}>
                      {member.username}
                    </Typography>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

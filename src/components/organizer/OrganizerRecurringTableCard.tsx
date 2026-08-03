"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  IconButton,
  Switch,
  Typography,
  useTheme,
} from "@mui/material";
import { Check, Edit2, Pause, Play, Trash2, UserX, X } from "lucide-react";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { CITY_MAP } from "@/constants/citiesConfig";
import { createClient } from "@/lib/supabase/client";
import { POD_RELATIONS_SELECT } from "@/lib/pods/ownPod";
import { usePodRealtime } from "@/components/PodRealtimeProvider";
import { ConfirmRemoveMemberDialog } from "@/components/ConfirmRemoveMemberDialog";
import {
  deleteRecurringTable,
  setRecurringTableActive,
  setRecurringTableAutoAccept,
} from "@/app/actions/organizer";
import { respondToJoin, removeMember } from "@/app/actions/joins";
import { cancelPod } from "@/app/actions/pods";
import { OrganizerRecurringTableFormDialog } from "@/components/organizer/OrganizerRecurringTableFormDialog";
import { dayOfWeekLabel, startTimeLabel } from "@/lib/date";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { useUserProfilePanel } from "@/lib/UserProfilePanelContext";
import type { TranslationKey } from "@/lib/i18n";
import type {
  PodJoinWithProfile,
  PodWithRelations,
  RecurringTable,
} from "@/types/database";

interface OrganizerRecurringTableCardProps {
  table: RecurringTable;
  onChanged: () => void;
}

// The only place an organiser manages join requests for a recurring
// table's currently-spawned session (accept/reject pending, remove a
// member, cancel) — the personal OwnPodPanel deliberately excludes
// recurring pods (see fetchOwnPodData), so there's no other UI for this.
export function OrganizerRecurringTableCard({
  table,
  onChanged,
}: OrganizerRecurringTableCardProps) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  const { subscribePods, subscribePodJoins } = usePodRealtime();
  const { openUserProfile } = useUserProfilePanel();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pod, setPod] = useState<PodWithRelations | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PodJoinWithProfile | null>(
    null,
  );
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removePending, setRemovePending] = useState(false);

  const fetchUpcomingPod = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("pods")
      .select(`*, ${POD_RELATIONS_SELECT}`)
      .eq("recurring_table_id", table.id)
      .eq("status", "ACTIVE")
      .maybeSingle();
    setPod((data as PodWithRelations) ?? null);
  }, [table.id]);

  const fetchUpcomingPodRef = useRef(fetchUpcomingPod);
  useEffect(() => {
    fetchUpcomingPodRef.current = fetchUpcomingPod;
  }, [fetchUpcomingPod]);

  // Resilience fallback, mirroring OwnPodPanel's exact reasoning: Supabase
  // Realtime's postgres_changes delivery has been observed to be
  // unreliable in this project (channel stays SUBSCRIBED, but specific
  // events occasionally never arrive). An organiser waiting on a join
  // request is typically staring at an already-focused /organizer tab the
  // whole time — a focus/visibility listener alone would never fire — so
  // this also polls on an interval while the tab is visible, in addition
  // to on mount and focus/visibility. 25s (not 10s) since this is purely a
  // safety net for realtime's own occasional delivery misses, not the
  // primary update path (the realtime subscription below still is).
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        fetchUpcomingPodRef.current();
      }
    }
    fetchUpcomingPodRef.current();
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchUpcomingPodRef.current();
      }
    }, 25_000);
    return () => {
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
      clearInterval(intervalId);
    };
  }, [table.id]);

  useEffect(() => {
    const unsubscribePods = subscribePods(() => fetchUpcomingPodRef.current());
    const unsubscribePodJoins = subscribePodJoins(() =>
      fetchUpcomingPodRef.current(),
    );
    return () => {
      unsubscribePods();
      unsubscribePodJoins();
    };
  }, [subscribePods, subscribePodJoins]);

  const game = GAMES_CONFIG[table.game_key];

  async function handleToggleActive() {
    setPending(true);
    setError(null);
    const result = await setRecurringTableActive(table.id, !table.is_active);
    if (result.error) setError(result.error);
    else onChanged();
    setPending(false);
  }

  async function handleToggleAutoAccept() {
    setPending(true);
    setError(null);
    const result = await setRecurringTableAutoAccept(
      table.id,
      !table.auto_accept,
    );
    if (result.error) setError(result.error);
    else onChanged();
    setPending(false);
  }

  async function handleDelete() {
    setPending(true);
    setError(null);
    const result = await deleteRecurringTable(table.id);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    onChanged();
  }

  async function handleRespond(joinId: string, decision: "ACCEPTED" | "REJECTED") {
    setPending(true);
    setError(null);
    const result = await respondToJoin(joinId, decision);
    if (result.error) setError(result.error);
    else await fetchUpcomingPod();
    setPending(false);
  }

  async function handleRemoveMember() {
    if (!removeTarget) return;
    setRemovePending(true);
    setRemoveError(null);
    const result = await removeMember(removeTarget.id);
    if (result.error) {
      setRemoveError(result.error);
    } else {
      setRemoveTarget(null);
      await fetchUpcomingPod();
    }
    setRemovePending(false);
  }

  async function handleCancelSession() {
    if (!pod) return;
    setPending(true);
    setError(null);
    const result = await cancelPod(pod.id);
    if (result.error) setError(result.error);
    else await fetchUpcomingPod();
    setPending(false);
  }

  const pendingJoins = pod?.pod_joins.filter((j) => j.status === "PENDING") ?? [];
  const acceptedJoins = pod?.pod_joins.filter((j) => j.status === "ACCEPTED") ?? [];

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border p-4"
      style={{
        borderColor: theme.palette.divider,
        backgroundColor: theme.palette.background.paper,
        opacity: table.is_active ? 1 : 0.6,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <Typography sx={{ fontWeight: 700, color: "text.primary" }}>
            {game?.name ?? table.game_key} ·{" "}
            {t(`format.${table.format_key}` as TranslationKey)}
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
            {dayOfWeekLabel(table.day_of_week, locale)} ·{" "}
            {startTimeLabel(table.start_time, locale)} –{" "}
            {startTimeLabel(table.end_time, locale)}
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
            {table.location_name}
            {CITY_MAP[table.city] ? ` (${CITY_MAP[table.city].label})` : ""}
          </Typography>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            size="small"
            onClick={() => setEditOpen(true)}
            aria-label={t("organizer.table.edit")}
          >
            <Edit2 className="h-4 w-4" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleToggleActive}
            disabled={pending}
            aria-label={
              table.is_active
                ? t("organizer.table.pause")
                : t("organizer.table.resume")
            }
          >
            {table.is_active ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setConfirmingDelete(true)}
            disabled={pending}
            aria-label={t("organizer.table.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
        style={{ backgroundColor: theme.palette.action.hover }}
      >
        <div className="flex flex-col">
          <Typography
            sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "text.primary" }}
          >
            {t("organizer.table.autoAccept")}
          </Typography>
          <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
            {t("organizer.table.autoAcceptHint")}
          </Typography>
        </div>
        <Switch
          checked={table.auto_accept}
          onChange={handleToggleAutoAccept}
          disabled={pending}
        />
      </div>

      {confirmingDelete && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
          <Typography sx={{ fontSize: "0.8125rem", color: "text.primary" }}>
            {t("organizer.table.deleteConfirm")}
          </Typography>
          <div className="flex gap-2">
            <Button
              size="small"
              variant="outlined"
              onClick={() => setConfirmingDelete(false)}
              disabled={pending}
            >
              {t("organizer.table.cancel")}
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={handleDelete}
              disabled={pending}
            >
              {t("organizer.table.confirmDelete")}
            </Button>
          </div>
        </div>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {pod && (
        <div
          className="flex flex-col gap-2 pt-2"
          style={{ borderTop: `1px solid ${theme.palette.divider}` }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Typography
                sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary" }}
              >
                {t("organizer.table.upcomingSession", {
                  count: acceptedJoins.length + 1,
                  max: pod.max_players,
                })}
              </Typography>
              {pendingJoins.length > 0 && (
                <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-300">
                  {pendingJoins.length === 1
                    ? t("myPodPanel.joinRequestCount", { count: pendingJoins.length })
                    : t("myPodPanel.joinRequestCountPlural", { count: pendingJoins.length })}
                </span>
              )}
            </div>
            <Button
              size="small"
              color="error"
              onClick={handleCancelSession}
              disabled={pending}
            >
              {t("organizer.table.cancelSession")}
            </Button>
          </div>

          {pendingJoins.length > 0 && (
            <div className="flex flex-col gap-2">
              <span
                className="text-sm font-medium"
                style={{ color: theme.palette.text.secondary }}
              >
                {t("myPodPanel.joinRequests")}
              </span>
              {pendingJoins.map((join) => (
                <div
                  key={join.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ border: `1px solid ${theme.palette.divider}` }}
                >
                  <button
                    type="button"
                    onClick={() => openUserProfile(join.profiles.username)}
                    aria-label={t("userProfilePanel.viewProfile", {
                      username: join.profiles.username,
                    })}
                    className="group flex items-center gap-2 text-left"
                  >
                    <Avatar
                      src={join.profiles.avatar_url ?? undefined}
                      sx={{ width: 32, height: 32 }}
                    >
                      {join.profiles.username[0]?.toUpperCase()}
                    </Avatar>
                    <div className="flex flex-col">
                      <span
                        className="group-hover:underline group-focus-visible:underline"
                        style={{ color: theme.palette.text.primary }}
                      >
                        {join.profiles.username}
                      </span>
                      <span className="text-xs" style={{ color: theme.palette.text.secondary }}>
                        {join.profiles.discord_handle}
                      </span>
                    </div>
                  </button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => handleRespond(join.id, "ACCEPTED")}
                      size="small"
                      startIcon={<Check className="h-4 w-4" />}
                      sx={{
                        bgcolor: "rgba(16, 185, 129, 0.1)",
                        color: "#34d399",
                        minWidth: "auto",
                        px: 1.5,
                        "&:hover": { bgcolor: "rgba(16, 185, 129, 0.2)" },
                        "&.Mui-disabled": { color: "#34d399", opacity: 0.4 },
                      }}
                    >
                      {t("myPodPanel.accept")}
                    </Button>
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => handleRespond(join.id, "REJECTED")}
                      size="small"
                      startIcon={<X className="h-4 w-4" />}
                      sx={{
                        bgcolor: "rgba(239, 68, 68, 0.1)",
                        color: "#f87171",
                        minWidth: "auto",
                        px: 1.5,
                        "&:hover": { bgcolor: "rgba(239, 68, 68, 0.2)" },
                        "&.Mui-disabled": { color: "#f87171", opacity: 0.4 },
                      }}
                    >
                      {t("myPodPanel.reject")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {acceptedJoins.length > 0 && (
            <div className="flex flex-col gap-2">
              <span
                className="text-sm font-medium"
                style={{ color: theme.palette.text.secondary }}
              >
                {t("myPodPanel.groupMembers")}
              </span>
              {acceptedJoins.map((join) => (
                <div
                  key={join.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                  style={{ border: `1px solid ${theme.palette.divider}` }}
                >
                  <button
                    type="button"
                    onClick={() => openUserProfile(join.profiles.username)}
                    aria-label={t("userProfilePanel.viewProfile", {
                      username: join.profiles.username,
                    })}
                    className="group flex items-center gap-2 text-left"
                  >
                    <Avatar
                      src={join.profiles.avatar_url ?? undefined}
                      sx={{ width: 32, height: 32 }}
                    >
                      {join.profiles.username[0]?.toUpperCase()}
                    </Avatar>
                    <div className="flex flex-col">
                      <span
                        className="group-hover:underline group-focus-visible:underline"
                        style={{ color: theme.palette.text.primary }}
                      >
                        {join.profiles.username}
                      </span>
                      <span className="text-sm" style={{ color: theme.palette.text.secondary }}>
                        {join.profiles.discord_handle}
                      </span>
                    </div>
                  </button>
                  <Button
                    type="button"
                    onClick={() => {
                      setRemoveError(null);
                      setRemoveTarget(join);
                    }}
                    size="small"
                    startIcon={<UserX className="h-3.5 w-3.5" />}
                    sx={{
                      flexShrink: 0,
                      minWidth: 0,
                      px: 1.5,
                      py: 0.75,
                      fontSize: "0.75rem",
                      bgcolor: "rgba(239, 68, 68, 0.1)",
                      color: "#f87171",
                      "&:hover": { bgcolor: "rgba(239, 68, 68, 0.2)" },
                    }}
                  >
                    {t("myPodPanel.remove")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <OrganizerRecurringTableFormDialog
        open={editOpen}
        editTable={table}
        onClose={() => setEditOpen(false)}
        onSuccess={() => {
          setEditOpen(false);
          onChanged();
        }}
      />

      <ConfirmRemoveMemberDialog
        open={removeTarget !== null}
        memberName={removeTarget?.profiles.username ?? null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveMember}
        pending={removePending}
        error={removeError}
      />
    </div>
  );
}

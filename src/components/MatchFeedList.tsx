"use client";

import {
  use,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SearchX, Store } from "lucide-react";
import { Alert, Avatar, Typography, useTheme } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { usePodRealtime } from "@/components/PodRealtimeProvider";
import { requestJoin, leavePod } from "@/app/actions/joins";
import { PodDetailDialog } from "@/components/PodDetailDialog";
import { ReservedSlotAvatar } from "@/components/ReservedSlotAvatar";
import { CITY_MAP } from "@/constants/citiesConfig";
import { formatPodEndTime, formatPodWhen } from "@/lib/date";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import { useUserProfilePanel } from "@/lib/UserProfilePanelContext";
import type { TranslationKey } from "@/lib/i18n";
import { consumePrefetchedActivePods, fetchActivePodsData } from "@/lib/pods/matchFeed";
import { POD_RELATIONS_SELECT } from "@/lib/pods/ownPod";
import type { PodFiltersValue } from "@/components/PodFilters";
import type { PodWithRelations, Profile } from "@/types/database";

export interface MatchFeedListHandle {
  refetch: () => Promise<void>;
}

interface MatchFeedListProps {
  ref?: React.Ref<MatchFeedListHandle>;
  profile: Profile;
  currentUserId: string;
  filters: PodFiltersValue;
  onChangeFilters: (value: PodFiltersValue) => void;
  initialPodsPromise: Promise<PodWithRelations[]>;
  initialSharedPodPromise: Promise<{ data: PodWithRelations | null; error: unknown } | null>;
}

// Owns everything that depends on the feed's data — split out of MatchFeed
// so that component's filter bar / title chrome can render synchronously
// while this suspends (via use()) on the initial server-seeded promises.
// See MatchFeed.tsx for the <Suspense> boundary wrapping this.
export function MatchFeedList({
  ref,
  profile,
  currentUserId,
  filters,
  onChangeFilters,
  initialPodsPromise,
  initialSharedPodPromise,
}: MatchFeedListProps) {
  const { t, locale } = useTranslation();
  const { subscribePods, subscribePodJoins } = usePodRealtime();
  const { openUserProfile } = useUserProfilePanel();
  const router = useRouter();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Prefer an already-in-flight (likely already-resolved) prefetch — e.g.
  // LfgButton kicks one off right after creating a pod, well before the
  // redirect here — over the server-seeded `initialPodsPromise`, so this
  // doesn't suspend (and MatchFeed's skeleton never flashes) when we already
  // know where the user was headed. Lazy-initialized so the check (and its
  // one-time cache consumption) only ever runs once per mount, not on every
  // render/retry.
  const [initialPodsSource] = useState(
    () => consumePrefetchedActivePods(currentUserId) ?? initialPodsPromise,
  );
  const initialPods = use(initialPodsSource);
  const initialSharedPodResult = use(initialSharedPodPromise);
  const initialSharedPod = initialSharedPodResult
    ? (initialSharedPodResult.data as PodWithRelations | null)
    : null;

  const [pods, setPods] = useState<PodWithRelations[]>(initialPods);
  const [pendingPodId, setPendingPodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPodId, setSelectedPodId] = useState<string | null>(
    initialSharedPod?.id ?? null,
  );

  // A pod opened via a shared /pods/<id> link isn't necessarily part of the
  // viewer's own feed (it may not match their filters, or may even be their
  // own pod, which the feed query below always excludes) — so it's tracked
  // separately from `pods` and only merged in for the dialog lookup below,
  // rather than being forced into the visible feed list.
  const [pinnedPod, setPinnedPod] = useState<PodWithRelations | null>(
    initialSharedPod,
  );
  const pinnedPodIdRef = useRef(initialSharedPod?.id ?? null);

  const fetchActivePods = useCallback(
    async (activeFilters: PodFiltersValue) => {
      const supabase = createClient();

      // Keep the shared/pinned pod (opened via /pods/<id>) fresh across every
      // refetch trigger below (realtime events, focus resync, post-join/leave
      // refetch) so its join status in the dialog never goes stale — it's
      // intentionally excluded from the feed rows since it may not match
      // the viewer's filters or may be their own pod.
      const [rows, pinnedResult] = await Promise.all([
        fetchActivePodsData(supabase, currentUserId, profile, activeFilters),
        pinnedPodIdRef.current
          ? supabase
              .from("pods")
              .select(`*, ${POD_RELATIONS_SELECT}`)
              .eq("id", pinnedPodIdRef.current)
              .maybeSingle()
          : Promise.resolve(null),
      ]);

      setPods([...rows]);

      if (pinnedResult) {
        setPinnedPod((pinnedResult.data as PodWithRelations) ?? null);
      }
    },
    [profile, currentUserId],
  );

  // Filters live in a ref (mirrored from the prop below) so the
  // realtime/focus callbacks further down — which only ever call the
  // *latest* fetch via fetchActivePodsRef — always refetch against the
  // current filters rather than whatever was in scope when the
  // subscription was set up.
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  // MatchFeed (the parent) only calls setFilters — it no longer refetches
  // directly, since that logic lives here now. Skip the very first run:
  // the initial data already came from initialPodsPromise above, so only
  // *subsequent* filter changes should trigger a refetch.
  const isFirstFiltersRender = useRef(true);
  useEffect(() => {
    if (isFirstFiltersRender.current) {
      isFirstFiltersRender.current = false;
      return;
    }
    fetchActivePods(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Routed through a ref (rather than listed as an effect dependency)
  // because `fetchActivePods` gets a new identity whenever `profile`
  // is refetched server-side (e.g. `preferred_brackets` is a fresh array
  // reference every time, even with identical contents) — which happens
  // on essentially every pod/join mutation elsewhere in the app that
  // calls `revalidatePath("/pods")`. Depending on it directly would
  // tear down and resubscribe this channel constantly, opening gaps where
  // realtime events get silently missed. The ref keeps the subscription
  // itself stable for the component's full lifetime while still always
  // calling the latest (correctly-filtered) fetch logic.
  const fetchActivePodsRef = useRef(fetchActivePods);
  useEffect(() => {
    fetchActivePodsRef.current = fetchActivePods;
  }, [fetchActivePods]);

  useImperativeHandle(
    ref,
    () => ({
      refetch: () => fetchActivePodsRef.current(filtersRef.current),
    }),
    [],
  );

  // Resilience fallback: Supabase Realtime's postgres_changes delivery has
  // been observed to be unreliable in this project (channel stays
  // SUBSCRIBED, but specific events occasionally never arrive — see repo
  // memory). Resync whenever the tab regains focus/visibility so a missed
  // event (e.g. "Request to Join" not flipping to "Pending" live) self-heals
  // without the user needing to manually reload. Also polls on an interval
  // (mirroring OwnPodPanel/OrganizerRecurringTableCard) since a pod closing
  // (status ACTIVE -> EXPIRED) fails the `pods` SELECT RLS check for any
  // viewer who isn't the host or an accepted member, so Realtime never
  // delivers that event to them at all — focus/visibility alone isn't
  // enough for a browsing user who never blurs the tab.
  useEffect(() => {
    function handleFocusOrVisible() {
      if (document.visibilityState === "visible") {
        fetchActivePodsRef.current(filtersRef.current);
      }
    }
    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchActivePodsRef.current(filtersRef.current);
      }
    }, 25_000);
    return () => {
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
      clearInterval(intervalId);
    };
  }, []);

  // Registers with the shared pods/pod_joins channel (PodRealtimeProvider,
  // mounted once in the (app) layout) instead of opening its own channel —
  // see that file's docstring for why the three components that used to
  // each open an identical unfiltered channel now share one. No initial
  // fetch here — initialPodsPromise (seeded server-side by PodsView)
  // already covers first paint; only subscribe.
  useEffect(() => {
    const unsubscribePods = subscribePods(() =>
      fetchActivePodsRef.current(filtersRef.current),
    );
    const unsubscribePodJoins = subscribePodJoins(() =>
      fetchActivePodsRef.current(filtersRef.current),
    );
    return () => {
      unsubscribePods();
      unsubscribePodJoins();
    };
  }, [subscribePods, subscribePodJoins]);

  // Each card has its own onClick opening PodDetailDialog — stopPropagation
  // keeps clicking a name from also doing that.
  function handleViewProfile(event: React.MouseEvent, username: string) {
    event.stopPropagation();
    openUserProfile(username);
  }

  async function handleRequestJoin(podId: string) {
    setPendingPodId(podId);
    setError(null);
    const result = await requestJoin(podId);
    if (result.error) {
      setError(result.error);
    }
    // Refetch even on failure — a rejection like "no longer active" or
    // "locked" means our local `pods` state is stale, and without this the
    // same now-defunct card stays clickable and reproduces the identical
    // error on every retry until some unrelated trigger happens to refresh it.
    await fetchActivePodsRef.current(filtersRef.current);
    setPendingPodId(null);
  }

  async function handleLeave(podId: string) {
    setPendingPodId(podId);
    setError(null);
    const result = await leavePod(podId);
    if (result.error) {
      setError(result.error);
    }
    await fetchActivePodsRef.current(filtersRef.current);
    setPendingPodId(null);
  }

  const selectedPod =
    pods.find((pod) => pod.id === selectedPodId) ??
    (pinnedPod?.id === selectedPodId ? pinnedPod : null);

  return (
    <>
      {error && <Alert severity="error">{error}</Alert>}
      {pods.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <SearchX
            className="h-8 w-8"
            style={{ color: theme.palette.text.secondary }}
          />
          {filters.matchType === "IRL" && profile.city && CITY_MAP[profile.city] ? (
            <>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "text.primary",
                }}
              >
                {t("matchFeed.empty.noCityPods.title", {
                  city: CITY_MAP[profile.city].label,
                })}
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                {t("matchFeed.empty.noCityPods.subtitle")}
              </Typography>
              <button
                type="button"
                onClick={() => onChangeFilters({ ...filters, matchType: "ALL" })}
                className="mt-1 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 transition-colors hover:border-blue-500/60 hover:bg-blue-500/20"
              >
                {t("matchFeed.empty.broadenCta")}
              </button>
            </>
          ) : (
            <>
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "text.primary",
                }}
              >
                {t("matchFeed.empty.title")}
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                {t("matchFeed.empty.subtitle")}
              </Typography>
            </>
          )}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {pods.map((pod) => {
            const acceptedMembers = pod.pod_joins.filter(
              (j) => j.status === "ACCEPTED",
            );
            const ownJoin = pod.pod_joins.find(
              (j) => j.user_id === currentUserId,
            );
            const isJoined = ownJoin?.status === "ACCEPTED";

            return (
              <motion.div
                key={pod.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onClick={() => setSelectedPodId(pod.id)}
                className={`flex cursor-pointer flex-col gap-2 rounded-2xl border p-4 transition-colors ${
                  isJoined
                    ? "border-green-500/50 hover:border-green-500/70"
                    : isDark
                      ? "border-zinc-800 hover:border-zinc-700"
                      : "border-zinc-200 hover:border-zinc-300"
                }`}
                style={{ backgroundColor: theme.palette.background.paper }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* store_name, not recurring_table_id — see ownPod.ts's
                        fetchOwnPodData for why recurring_table_id alone
                        isn't a stable "organiser pod" signal. */}
                    {pod.store_name ? (
                      <span
                        title={t("matchFeed.storeEvent")}
                        className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500"
                      >
                        <Store className="h-3.5 w-3.5" />
                        {pod.store_name}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(event) => handleViewProfile(event, pod.profiles.username)}
                        aria-label={t("userProfilePanel.viewProfile", {
                          username: pod.profiles.username,
                        })}
                        className="group flex items-center gap-2"
                      >
                        <Avatar
                          src={pod.profiles.avatar_url ?? undefined}
                          sx={{ width: 24, height: 24, fontSize: "0.75rem" }}
                        >
                          {pod.profiles.username[0]?.toUpperCase()}
                        </Avatar>
                        <span
                          className="font-medium group-hover:underline group-focus-visible:underline"
                          style={{ color: theme.palette.text.primary }}
                        >
                          {pod.profiles.username}
                        </span>
                      </button>
                    )}
                    {isJoined && (
                      <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-green-400">
                        {t("matchFeed.joined")}
                      </span>
                    )}
                    {ownJoin?.status === "REJECTED" && (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-red-400">
                        {t("matchFeed.declined")}
                      </span>
                    )}
                    {!isJoined && pod.locked_at && (
                      <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-400">
                        {t("organizer.table.locked")}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-xs"
                    style={{ color: theme.palette.text.secondary }}
                  >
                    {t("myPodPanel.playersCount", {
                      // store_name != null => organiser recurring-table pod,
                      // where the host is never counted toward capacity.
                      count:
                        acceptedMembers.length +
                        (pod.store_name ? 0 : 1) +
                        pod.reserved_slots,
                      max: pod.max_players,
                    })}
                  </span>
                </div>
                <div
                  className="flex flex-wrap gap-2 text-xs"
                  style={{ color: theme.palette.text.secondary }}
                >
                  <span>{t(`format.${pod.format_key}` as TranslationKey)}</span>
                  <span>&middot;</span>
                  <span>
                    {pod.type === "IRL"
                      ? t("podFilters.matchTypeIrl")
                      : t("podFilters.matchTypeOnline")}
                  </span>
                  {pod.power_tiers && pod.power_tiers.length > 0 && (
                    <>
                      <span>&middot;</span>
                      <span>
                        {t("matchFeed.bracket", {
                          brackets: pod.power_tiers.join(", "),
                        })}
                      </span>
                    </>
                  )}
                  {pod.location_name && (
                    <>
                      <span>&middot;</span>
                      <span>
                        {pod.location_name}
                        {pod.city && CITY_MAP[pod.city]
                          ? ` (${CITY_MAP[pod.city].label})`
                          : ""}
                      </span>
                    </>
                  )}
                  <span>&middot;</span>
                  <span>
                    {formatPodWhen(pod, locale, t)}
                    {pod.store_name
                      ? ` – ${formatPodEndTime(pod, locale)}`
                      : ""}
                  </span>
                </div>

                {(acceptedMembers.length > 0 || pod.reserved_slots > 0) && (
                  <div
                    className="flex flex-col gap-1 pt-2"
                    style={{
                      borderTop: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    {Array.from({ length: pod.reserved_slots }).map(
                      (_, index) => (
                        <div
                          key={`reserved-${index}`}
                          className="flex items-center gap-1.5 text-xs"
                          style={{ color: theme.palette.text.secondary }}
                        >
                          <ReservedSlotAvatar size={18} />
                          <span>{t("podDetailDialog.reservedSlotLabel")}</span>
                        </div>
                      ),
                    )}
                    {acceptedMembers.map((join) => (
                      <div
                        key={join.id}
                        className="flex items-center justify-between text-xs"
                        style={{ color: theme.palette.text.secondary }}
                      >
                        <button
                          type="button"
                          onClick={(event) =>
                            handleViewProfile(event, join.profiles.username)
                          }
                          aria-label={t("userProfilePanel.viewProfile", {
                            username: join.profiles.username,
                          })}
                          className="group flex items-center gap-1.5"
                        >
                          <Avatar
                            src={join.profiles.avatar_url ?? undefined}
                            sx={{
                              width: 18,
                              height: 18,
                              fontSize: "0.625rem",
                            }}
                          >
                            {join.profiles.username[0]?.toUpperCase()}
                          </Avatar>
                          <span className="group-hover:underline group-focus-visible:underline">
                            {join.profiles.username}
                          </span>
                        </button>
                        <span>{join.profiles.discord_handle}</span>
                      </div>
                    ))}
                  </div>
                )}

                {ownJoin && (
                  <button
                    type="button"
                    disabled={pendingPodId === pod.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleLeave(pod.id);
                    }}
                    className="self-start rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:border-red-500/60 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {pendingPodId === pod.id
                      ? t("matchFeed.leaving")
                      : ownJoin.status === "PENDING"
                        ? t("matchFeed.cancelRequest")
                        : ownJoin.status === "REJECTED"
                          ? t("matchFeed.dismiss")
                          : t("matchFeed.leave")}
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}

      <PodDetailDialog
        pod={selectedPod}
        currentUserId={currentUserId}
        onClose={() => {
          setSelectedPodId(null);
          // Only strip the URL back to /pods once the viewer closes out of
          // a pod they opened via a shared /pods/<id> link — doing this
          // eagerly on mount instead (the previous approach) navigated away
          // from the dynamic route immediately, remounting this component
          // without `initialSharedPod` and closing the dialog right after
          // it flashed open.
          if (pinnedPodIdRef.current) {
            router.replace("/pods", { scroll: false });
          }
        }}
        onRequestJoin={handleRequestJoin}
        onLeave={handleLeave}
        pending={selectedPod != null && pendingPodId === selectedPod.id}
        error={error}
      />
    </>
  );
}

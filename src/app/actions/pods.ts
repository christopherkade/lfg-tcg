"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { getServerLocale } from "@/lib/i18n/server";
import { translate, type Locale } from "@/lib/i18n";
import type { MatchType, PlaystyleKey } from "@/types/database";

export interface PodActionResult {
  error?: string;
}

export interface StartSearchInput {
  gameKey: string;
  formatKey: string;
  playstyleKey: PlaystyleKey;
  brackets: number[];
  matchType: MatchType;
  locationName: string;
  scheduledDate: string;
  scheduledTime: string;
  maxPlayers: number;
  notes: string;
}

interface NormalizedPodInput {
  brackets: number[] | null;
  locationName: string | null;
  scheduledAt: string | null;
  notes: string | null;
}

/**
 * Shared validation/normalization for both createPod and updatePod —
 * the same StartSearchInput shape (and rules) is used by the "Search"
 * dialog whether it's starting a brand new pod or editing an existing
 * (still ACTIVE) one.
 */
function validateStartSearchInput(
  input: StartSearchInput,
  locale: Locale,
): { error: string } | { data: NormalizedPodInput } {
  const game = GAMES_CONFIG[input.gameKey];
  if (!game) {
    return { error: translate(locale, "errors.invalidGame") };
  }
  if (!game.formats.some((format) => format.key === input.formatKey)) {
    return { error: translate(locale, "errors.invalidFormat") };
  }
  if (game.hasPowerTiers && input.brackets.length === 0) {
    return { error: translate(locale, "errors.powerBracketRequired") };
  }
  if (
    game.hasPowerTiers &&
    input.brackets.some((tier) => tier < 1 || tier > 5)
  ) {
    return { error: translate(locale, "errors.powerBracketRange") };
  }
  if (input.matchType === "IRL" && !input.locationName.trim()) {
    return { error: translate(locale, "errors.locationRequired") };
  }
  let scheduledAt: string | null = null;
  if (input.matchType === "IRL") {
    if (!input.scheduledDate || !input.scheduledTime) {
      return { error: translate(locale, "errors.dateTimeRequired") };
    }
    const parsed = new Date(`${input.scheduledDate}T${input.scheduledTime}`);
    if (Number.isNaN(parsed.getTime())) {
      return { error: translate(locale, "errors.dateTimeInvalid") };
    }
    scheduledAt = parsed.toISOString();
  }
  if (input.maxPlayers < 2 || input.maxPlayers > 6) {
    return { error: translate(locale, "errors.maxPlayersRange") };
  }
  if (input.notes.trim().length > 300) {
    return { error: translate(locale, "errors.notesTooLong") };
  }

  return {
    data: {
      brackets: game.hasPowerTiers ? input.brackets : null,
      locationName:
        input.matchType === "IRL" ? input.locationName.trim() : null,
      scheduledAt,
      notes: input.notes.trim() || null,
    },
  };
}

/**
 * Starts a new LFG search using the settings chosen in the LFG tab's
 * "Search" dialog. These are also persisted onto the user's profile
 * (preferred_*) so the dialog pre-fills with the last search next time,
 * and so the Match Feed keeps filtering meaningfully off `profiles`.
 */
export async function createPod(
  input: StartSearchInput,
): Promise<PodActionResult> {
  const { supabase, user, profile } = await requireProfile();
  const locale = await getServerLocale();

  const validated = validateStartSearchInput(input, locale);
  if ("error" in validated) {
    return { error: validated.error };
  }
  const { brackets, locationName, scheduledAt, notes } = validated.data;

  // Block starting a new search while the user already has a PENDING
  // request on (or has been ACCEPTED into) someone else's still-ACTIVE
  // pod — mirrors the client-side check in LfgButton, which shows
  // CantStartSearchDialog instead of even opening the search dialog.
  const { data: activeJoin } = await supabase
    .from("pod_joins")
    .select("id, pods!inner(status)")
    .eq("user_id", user.id)
    .in("status", ["PENDING", "ACCEPTED"])
    .eq("pods.status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  if (activeJoin) {
    return {
      error: translate(locale, "errors.alreadyInGroup"),
    };
  }

  // Persist as the new "last used" search settings, keeping the dialog's
  // pre-fill and the Match Feed's filtering in sync with this search.
  await supabase
    .from("profiles")
    .update({
      preferred_game: input.gameKey,
      preferred_format: input.formatKey,
      preferred_playstyle: input.playstyleKey,
      preferred_brackets: brackets,
      preferred_match_type: input.matchType,
      preferred_location_name: locationName,
      preferred_max_players: input.maxPlayers,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  // Expire any existing active pod for this user before starting a new search
  // (a single new insert would otherwise violate pods_one_active_per_user).
  const { error: expireError } = await supabase
    .from("pods")
    .update({ status: "EXPIRED" })
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");

  if (expireError) {
    console.error(
      "createPod: failed to expire previous pod:",
      expireError,
    );
    return {
      error: translate(locale, "errors.startSearchFailed", {
        reason: expireError.message,
      }),
    };
  }

  const { error } = await supabase.from("pods").insert({
    user_id: user.id,
    game_key: input.gameKey,
    format_key: input.formatKey,
    playstyle_key: input.playstyleKey,
    power_tiers: brackets,
    type: input.matchType,
    location_name: locationName,
    // Snapshot of profiles.city at creation time — lets the Match Feed
    // (Section 6) scope IRL pods to the viewer's city via a plain
    // column filter, without joining back to profiles.
    city: profile.city,
    scheduled_at: scheduledAt,
    max_players: input.maxPlayers,
    notes,
  });

  if (error) {
    if (error.message?.includes("RATE_LIMITED_POD_CREATE")) {
      return { error: translate(locale, "errors.rateLimitedPodCreate") };
    }
    console.error("createPod: failed to insert pod:", error);
    return {
      error: translate(locale, "errors.startSearchFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/");
  revalidatePath("/pods");
  return {};
}

/**
 * Lets the host edit the settings of their own still-ACTIVE pod in
 * place (rather than cancelling and starting a new search). Unlike
 * createPod, this does NOT touch the user's `preferred_*` profile
 * columns — those track the last *new search* settings, not one-off edits
 * to an already-live pod. Realtime subscribers (MatchFeed, OwnPodPanel,
 * PodDetailDialog) already refetch on any `pods` row change, so the
 * update is reflected live everywhere without further wiring.
 */
export async function updatePod(
  podId: string,
  input: StartSearchInput,
): Promise<PodActionResult> {
  const { supabase, user, profile } = await requireProfile();
  const locale = await getServerLocale();

  const validated = validateStartSearchInput(input, locale);
  if ("error" in validated) {
    return { error: validated.error };
  }
  const { brackets, locationName, scheduledAt, notes } = validated.data;

  // Guard against shrinking max_players below the group's current accepted
  // size — without this, a host could edit an already-filling pod down
  // to fewer slots than it already has accepted members, silently pushing
  // it over its own cap.
  const { count: acceptedCount, error: countError } = await supabase
    .from("pod_joins")
    .select("id", { count: "exact", head: true })
    .eq("pod_id", podId)
    .eq("status", "ACCEPTED");

  if (countError) {
    console.error(
      "updatePod: failed to check accepted member count:",
      countError,
    );
    return {
      error: translate(locale, "errors.groupSizeCheckFailed"),
    };
  }

  const currentGroupSize = (acceptedCount ?? 0) + 1; // + host
  if (input.maxPlayers < currentGroupSize) {
    return {
      error: translate(locale, "errors.maxPlayersBelowGroupSize", {
        count: currentGroupSize,
      }),
    };
  }

  const { error } = await supabase
    .from("pods")
    .update({
      game_key: input.gameKey,
      format_key: input.formatKey,
      playstyle_key: input.playstyleKey,
      power_tiers: brackets,
      type: input.matchType,
      location_name: locationName,
      // Re-snapshot in case the host updated their profile's city since
      // this pod was first created.
      city: profile.city,
      scheduled_at: scheduledAt,
      max_players: input.maxPlayers,
      notes,
    })
    .eq("id", podId)
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");

  if (error) {
    console.error("updatePod failed:", error);
    return {
      error: translate(locale, "errors.podUpdateFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/");
  revalidatePath("/pods");
  return {};
}

export async function cancelPod(
  podId: string,
): Promise<PodActionResult> {
  const { supabase, user } = await requireProfile();
  const locale = await getServerLocale();

  const { error } = await supabase
    .from("pods")
    .update({ status: "EXPIRED" })
    .eq("id", podId)
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");

  if (error) {
    console.error("cancelPod failed:", error);
    return {
      error: translate(locale, "errors.podCancelFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/");
  revalidatePath("/pods");
  return {};
}

export async function markPodMatched(
  podId: string,
): Promise<PodActionResult> {
  const { supabase, user } = await requireProfile();
  const locale = await getServerLocale();

  const { error } = await supabase
    .from("pods")
    .update({ status: "MATCHED", matched_at: new Date().toISOString() })
    .eq("id", podId)
    .eq("user_id", user.id);

  if (error) {
    console.error("markPodMatched failed:", error);
    return {
      error: translate(locale, "errors.podMarkMatchedFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/");
  revalidatePath("/pods");
  return {};
}

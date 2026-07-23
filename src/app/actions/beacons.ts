"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/session";
import { GAMES_CONFIG } from "@/constants/gamesConfig";
import type { MatchType, PlaystyleKey } from "@/types/database";

export interface BeaconActionResult {
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

interface NormalizedBeaconInput {
  brackets: number[] | null;
  locationName: string | null;
  scheduledAt: string | null;
  notes: string | null;
}

/**
 * Shared validation/normalization for both createBeacon and updateBeacon —
 * the same StartSearchInput shape (and rules) is used by the "Search"
 * dialog whether it's starting a brand new beacon or editing an existing
 * (still ACTIVE) one.
 */
function validateStartSearchInput(
  input: StartSearchInput,
): { error: string } | { data: NormalizedBeaconInput } {
  const game = GAMES_CONFIG[input.gameKey];
  if (!game) {
    return { error: "Please select a valid game." };
  }
  if (!game.formats.some((format) => format.key === input.formatKey)) {
    return { error: "Please select a valid format." };
  }
  if (game.hasPowerTiers && input.brackets.length === 0) {
    return { error: "Please select at least one power bracket for this game." };
  }
  if (
    game.hasPowerTiers &&
    input.brackets.some((tier) => tier < 1 || tier > 5)
  ) {
    return { error: "Power brackets must be between 1 and 5." };
  }
  if (input.matchType === "IRL" && !input.locationName.trim()) {
    return { error: "Please provide a location name for in-person matches." };
  }
  let scheduledAt: string | null = null;
  if (input.matchType === "IRL") {
    if (!input.scheduledDate || !input.scheduledTime) {
      return { error: "Please provide a date and time for in-person matches." };
    }
    const parsed = new Date(`${input.scheduledDate}T${input.scheduledTime}`);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Please provide a valid date and time." };
    }
    scheduledAt = parsed.toISOString();
  }
  if (input.maxPlayers < 2 || input.maxPlayers > 6) {
    return { error: "Players needed must be between 2 and 6." };
  }
  if (input.notes.trim().length > 300) {
    return { error: "Notes must be 300 characters or fewer." };
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
export async function createBeacon(
  input: StartSearchInput,
): Promise<BeaconActionResult> {
  const { supabase, user, profile } = await requireProfile();

  const validated = validateStartSearchInput(input);
  if ("error" in validated) {
    return { error: validated.error };
  }
  const { brackets, locationName, scheduledAt, notes } = validated.data;

  // Block starting a new search while the user already has a PENDING
  // request on (or has been ACCEPTED into) someone else's still-ACTIVE
  // beacon — mirrors the client-side check in LfgButton, which shows
  // CantStartSearchDialog instead of even opening the search dialog.
  const { data: activeJoin } = await supabase
    .from("beacon_joins")
    .select("id, beacons!inner(status)")
    .eq("user_id", user.id)
    .in("status", ["PENDING", "ACCEPTED"])
    .eq("beacons.status", "ACTIVE")
    .limit(1)
    .maybeSingle();

  if (activeJoin) {
    return {
      error:
        "You can't start a new search while you have a pending request on (or have joined) another beacon. Leave it first.",
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

  // Expire any existing active beacon for this user before starting a new search
  // (a single new insert would otherwise violate beacons_one_active_per_user).
  const { error: expireError } = await supabase
    .from("beacons")
    .update({ status: "EXPIRED" })
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");

  if (expireError) {
    console.error(
      "createBeacon: failed to expire previous beacon:",
      expireError,
    );
    return {
      error: `Something went wrong starting your search: ${expireError.message}`,
    };
  }

  const { error } = await supabase.from("beacons").insert({
    user_id: user.id,
    game_key: input.gameKey,
    format_key: input.formatKey,
    playstyle_key: input.playstyleKey,
    power_tiers: brackets,
    type: input.matchType,
    location_name: locationName,
    // Snapshot of profiles.city at creation time — lets the Match Feed
    // (Section 6) scope IRL beacons to the viewer's city via a plain
    // column filter, without joining back to profiles.
    city: profile.city,
    scheduled_at: scheduledAt,
    max_players: input.maxPlayers,
    notes,
  });

  if (error) {
    console.error("createBeacon: failed to insert beacon:", error);
    return {
      error: `Something went wrong starting your search: ${error.message}`,
    };
  }

  revalidatePath("/");
  revalidatePath("/beacons");
  return {};
}

/**
 * Lets the host edit the settings of their own still-ACTIVE beacon in
 * place (rather than cancelling and starting a new search). Unlike
 * createBeacon, this does NOT touch the user's `preferred_*` profile
 * columns — those track the last *new search* settings, not one-off edits
 * to an already-live beacon. Realtime subscribers (MatchFeed, OwnBeaconPanel,
 * BeaconDetailDialog) already refetch on any `beacons` row change, so the
 * update is reflected live everywhere without further wiring.
 */
export async function updateBeacon(
  beaconId: string,
  input: StartSearchInput,
): Promise<BeaconActionResult> {
  const { supabase, user, profile } = await requireProfile();

  const validated = validateStartSearchInput(input);
  if ("error" in validated) {
    return { error: validated.error };
  }
  const { brackets, locationName, scheduledAt, notes } = validated.data;

  // Guard against shrinking max_players below the group's current accepted
  // size — without this, a host could edit an already-filling beacon down
  // to fewer slots than it already has accepted members, silently pushing
  // it over its own cap.
  const { count: acceptedCount, error: countError } = await supabase
    .from("beacon_joins")
    .select("id", { count: "exact", head: true })
    .eq("beacon_id", beaconId)
    .eq("status", "ACCEPTED");

  if (countError) {
    console.error(
      "updateBeacon: failed to check accepted member count:",
      countError,
    );
    return {
      error: "Could not verify your current group size. Please try again.",
    };
  }

  const currentGroupSize = (acceptedCount ?? 0) + 1; // + host
  if (input.maxPlayers < currentGroupSize) {
    return {
      error: `Players needed can't be lower than your current group size (${currentGroupSize}).`,
    };
  }

  const { error } = await supabase
    .from("beacons")
    .update({
      game_key: input.gameKey,
      format_key: input.formatKey,
      playstyle_key: input.playstyleKey,
      power_tiers: brackets,
      type: input.matchType,
      location_name: locationName,
      // Re-snapshot in case the host updated their profile's city since
      // this beacon was first created.
      city: profile.city,
      scheduled_at: scheduledAt,
      max_players: input.maxPlayers,
      notes,
    })
    .eq("id", beaconId)
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");

  if (error) {
    console.error("updateBeacon failed:", error);
    return { error: `Could not update your beacon: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/beacons");
  return {};
}

export async function cancelBeacon(
  beaconId: string,
): Promise<BeaconActionResult> {
  const { supabase, user } = await requireProfile();

  const { error } = await supabase
    .from("beacons")
    .update({ status: "EXPIRED" })
    .eq("id", beaconId)
    .eq("user_id", user.id)
    .eq("status", "ACTIVE");

  if (error) {
    console.error("cancelBeacon failed:", error);
    return { error: `Could not cancel your search: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/beacons");
  return {};
}

export async function markBeaconMatched(
  beaconId: string,
): Promise<BeaconActionResult> {
  const { supabase, user } = await requireProfile();

  const { error } = await supabase
    .from("beacons")
    .update({ status: "MATCHED" })
    .eq("id", beaconId)
    .eq("user_id", user.id);

  if (error) {
    console.error("markBeaconMatched failed:", error);
    return {
      error: `Could not mark this beacon as matched: ${error.message}`,
    };
  }

  revalidatePath("/");
  revalidatePath("/beacons");
  return {};
}

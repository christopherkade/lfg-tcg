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
  maxPlayers: number;
  notes: string;
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
  const { supabase, user } = await requireProfile();

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
  if (input.maxPlayers < 2 || input.maxPlayers > 6) {
    return { error: "Players needed must be between 2 and 6." };
  }
  if (input.notes.trim().length > 300) {
    return { error: "Notes must be 300 characters or fewer." };
  }

  const brackets = game.hasPowerTiers ? input.brackets : null;
  const locationName =
    input.matchType === "IRL" ? input.locationName.trim() : null;
  const notes = input.notes.trim() || null;

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

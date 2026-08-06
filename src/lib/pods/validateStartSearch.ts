import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { translate, type Locale } from "@/lib/i18n";
import { zonedTimeToUtc } from "@/lib/timezone";
import type { MatchType, PlaystyleKey } from "@/types/database";

export interface StartSearchInput {
  gameKey: string;
  formatKey: string;
  playstyleKey: PlaystyleKey;
  brackets: number[];
  matchType: MatchType;
  locationName: string;
  scheduledDate: string;
  scheduledTime: string;
  // IANA identifier (e.g. "Europe/Paris"), captured silently from the
  // submitter's browser — see zonedTimeToUtc.
  timezone: string;
  maxPlayers: number;
  reservedSlots: number;
  notes: string;
}

export interface NormalizedPodInput {
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
export function validateStartSearchInput(
  input: StartSearchInput,
  locale: Locale,
  city: string | null,
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
  if (input.matchType === "IRL" && !city) {
    return { error: translate(locale, "errors.cityRequired") };
  }
  if (input.matchType === "IRL" && !input.locationName.trim()) {
    return { error: translate(locale, "errors.locationRequired") };
  }
  let scheduledAt: string | null = null;
  if (input.matchType === "IRL") {
    if (!input.scheduledDate || !input.scheduledTime) {
      return { error: translate(locale, "errors.dateTimeRequired") };
    }
    const parsed = zonedTimeToUtc(
      input.scheduledDate,
      input.scheduledTime,
      input.timezone,
    );
    if (Number.isNaN(parsed.getTime())) {
      return { error: translate(locale, "errors.dateTimeInvalid") };
    }
    scheduledAt = parsed.toISOString();
  }
  if (input.maxPlayers < 2 || input.maxPlayers > 6) {
    return { error: translate(locale, "errors.maxPlayersRange") };
  }
  if (
    input.reservedSlots < 0 ||
    input.reservedSlots > input.maxPlayers - 2
  ) {
    return { error: translate(locale, "errors.reservedSlotsRange") };
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

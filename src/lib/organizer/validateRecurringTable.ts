import { GAMES_CONFIG } from "@/constants/gamesConfig";
import { translate, type Locale } from "@/lib/i18n";
import type { PlaystyleKey } from "@/types/database";

export interface RecurringTableInput {
  gameKey: string;
  formatKey: string;
  playstyleKey: PlaystyleKey;
  brackets: number[];
  dayOfWeek: number; // 0 (Sunday) .. 6 (Saturday), matches JS Date#getDay()
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"; <= startTime means the event spans midnight
  maxPlayers: number;
  notes: string;
  autoAccept: boolean;
  leadTimeHours: number;
}

export interface NormalizedRecurringTableInput {
  brackets: number[] | null;
  notes: string | null;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Validation/normalization for organiser recurring-table create/edit —
 * mirrors validateStartSearchInput's discriminated-union pattern and reuses
 * its GAMES_CONFIG-driven checks. Location/city are NOT part of this input
 * — a recurring table always happens at its organiser's own store, so
 * organizer.store_name/organizer.city are written directly by the caller
 * (src/app/actions/organizer.ts) rather than being collected here.
 */
export function validateRecurringTableInput(
  input: RecurringTableInput,
  locale: Locale,
): { error: string } | { data: NormalizedRecurringTableInput } {
  const game = GAMES_CONFIG[input.gameKey];
  if (!game) {
    return { error: translate(locale, "errors.invalidGame") };
  }
  if (!game.formats.some((format) => format.key === input.formatKey)) {
    return { error: translate(locale, "errors.invalidFormat") };
  }
  // Power Bracket is optional for a recurring table (unlike the ad hoc LFG
  // dialog's validateStartSearchInput) — a store's standing public event
  // doesn't need a specific power level to be meaningful; an empty
  // selection just means "all power levels welcome".
  if (
    game.hasPowerTiers &&
    input.brackets.some((tier) => tier < 1 || tier > 5)
  ) {
    return { error: translate(locale, "errors.powerBracketRange") };
  }
  if (
    !Number.isInteger(input.dayOfWeek) ||
    input.dayOfWeek < 0 ||
    input.dayOfWeek > 6
  ) {
    return { error: translate(locale, "errors.dayOfWeekInvalid") };
  }
  if (!TIME_PATTERN.test(input.startTime)) {
    return { error: translate(locale, "errors.startTimeInvalid") };
  }
  if (!TIME_PATTERN.test(input.endTime)) {
    return { error: translate(locale, "errors.endTimeInvalid") };
  }
  if (input.endTime === input.startTime) {
    return { error: translate(locale, "errors.endTimeEqualsStartTime") };
  }
  if (input.maxPlayers < 2 || input.maxPlayers > 200) {
    return { error: translate(locale, "errors.maxPlayersRangeHigh") };
  }
  if (input.notes.trim().length > 300) {
    return { error: translate(locale, "errors.notesTooLong") };
  }
  if (
    !Number.isInteger(input.leadTimeHours) ||
    input.leadTimeHours < 1 ||
    input.leadTimeHours > 336
  ) {
    return { error: translate(locale, "errors.leadTimeHoursRange") };
  }

  return {
    data: {
      brackets: game.hasPowerTiers && input.brackets.length > 0 ? input.brackets : null,
      notes: input.notes.trim() || null,
    },
  };
}

import { CITY_MAP } from "@/constants/citiesConfig";
import { translate, type Locale } from "@/lib/i18n";

export interface ProfileInput {
  username: string;
  discordHandle: string;
  city: string;
}

export interface NormalizedProfileInput {
  username: string;
  discordHandle: string;
  city: string | null;
}

/**
 * Validation/normalization for `upsertProfile` — `city` is optional (a
 * user who only ever plays Online doesn't need one) but, when provided,
 * must be one of `CITIES_CONFIG`'s slugs — this is what lets the Match
 * Feed filter IRL pods by plain equality instead of fuzzy free-text
 * matching.
 */
export function validateProfileInput(
  input: ProfileInput,
  locale: Locale,
): { error: string } | { data: NormalizedProfileInput } {
  if (!input.username) {
    return { error: translate(locale, "errors.usernameRequired") };
  }
  if (!input.discordHandle) {
    return { error: translate(locale, "errors.discordHandleRequired") };
  }
  if (input.city && !CITY_MAP[input.city]) {
    return { error: translate(locale, "errors.invalidCity") };
  }

  return {
    data: {
      username: input.username,
      discordHandle: input.discordHandle,
      city: input.city || null,
    },
  };
}

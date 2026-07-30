import { CITY_MAP } from "@/constants/citiesConfig";
import { translate, type Locale } from "@/lib/i18n";

/** Validation for `updateUsername` — the only rule is non-empty (DB enforces uniqueness). */
export function validateUsername(
  username: string,
  locale: Locale,
): { error: string } | { data: { username: string } } {
  if (!username) {
    return { error: translate(locale, "errors.usernameRequired") };
  }
  return { data: { username } };
}

/**
 * Validation/normalization for `updateCity` — optional (a user who only ever
 * plays Online doesn't need one) but, when provided, must be one of
 * `CITIES_CONFIG`'s slugs — this is what lets the Match Feed filter IRL pods
 * by plain equality instead of fuzzy free-text matching.
 */
export function validateCity(
  city: string,
  locale: Locale,
): { error: string } | { data: { city: string | null } } {
  if (city && !CITY_MAP[city]) {
    return { error: translate(locale, "errors.invalidCity") };
  }
  return { data: { city: city || null } };
}

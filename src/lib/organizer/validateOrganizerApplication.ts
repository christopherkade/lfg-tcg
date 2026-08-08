import { translate, type Locale } from "@/lib/i18n";
import {
  validateOrganizerProfileInput,
  type OrganizerProfileInput,
} from "@/lib/organizer/validateOrganizerProfile";

export interface OrganizerApplicationInput extends OrganizerProfileInput {
  email: string;
}

export interface NormalizedOrganizerApplicationInput {
  storeName: string;
  city: string;
  description: string | null;
  verificationUrl: string;
  email: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Wraps validateOrganizerProfileInput (shared with the settings-edit form)
 * with the extra `email` field only /organizer/apply collects — it's used
 * to notify the applicant of the admin's decision, so it doesn't belong on
 * the shared organizer profile input/organizers table.
 */
export function validateOrganizerApplicationInput(
  input: OrganizerApplicationInput,
  locale: Locale,
): { error: string } | { data: NormalizedOrganizerApplicationInput } {
  const profileResult = validateOrganizerProfileInput(input, locale);
  if ("error" in profileResult) {
    return profileResult;
  }

  const email = input.email.trim();
  if (!email) {
    return { error: translate(locale, "errors.emailRequired") };
  }
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    return { error: translate(locale, "errors.emailInvalid") };
  }

  return { data: { ...profileResult.data, email } };
}

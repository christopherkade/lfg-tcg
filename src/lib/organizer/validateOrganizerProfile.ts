import { translate, type Locale } from "@/lib/i18n";

export interface OrganizerProfileInput {
  storeName: string;
  city: string;
  description: string;
  verificationUrl: string;
}

export interface NormalizedOrganizerProfileInput {
  storeName: string;
  city: string;
  description: string | null;
  verificationUrl: string;
}

const URL_PATTERN = /^https?:\/\/.+/i;

/**
 * Validation/normalization shared by the /organizer/apply onboarding form
 * and the /organizer/settings edit form — same input shape either way.
 */
export function validateOrganizerProfileInput(
  input: OrganizerProfileInput,
  locale: Locale,
): { error: string } | { data: NormalizedOrganizerProfileInput } {
  const storeName = input.storeName.trim();
  if (!storeName) {
    return { error: translate(locale, "errors.storeNameRequired") };
  }
  if (storeName.length > 80) {
    return { error: translate(locale, "errors.storeNameTooLong") };
  }
  if (!input.city) {
    return { error: translate(locale, "errors.invalidCity") };
  }
  if (input.description.trim().length > 500) {
    return { error: translate(locale, "errors.descriptionTooLong") };
  }

  const verificationUrl = input.verificationUrl.trim();
  if (!verificationUrl) {
    return { error: translate(locale, "errors.verificationUrlRequired") };
  }
  if (verificationUrl.length > 500) {
    return { error: translate(locale, "errors.verificationUrlTooLong") };
  }
  if (!URL_PATTERN.test(verificationUrl)) {
    return { error: translate(locale, "errors.verificationUrlInvalid") };
  }

  return {
    data: {
      storeName,
      city: input.city,
      description: input.description.trim() || null,
      verificationUrl,
    },
  };
}

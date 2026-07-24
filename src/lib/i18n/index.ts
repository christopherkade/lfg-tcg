import en from "@/lib/i18n/dictionaries/en.json";
import fr from "@/lib/i18n/dictionaries/fr.json";

export type Locale = "en" | "fr";

export const LOCALES: Locale[] = ["en", "fr"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "pm_locale";

type Dictionary = typeof en;
export type TranslationKey = keyof Dictionary;

const dictionaries: Record<Locale, Dictionary> = { en, fr };

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "fr";
}

export function translate(
  locale: Locale,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const template = dictionaries[locale][key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

export type ThemeMode = "light" | "dark";

export const DEFAULT_THEME_MODE: ThemeMode = "light";
export const THEME_COOKIE = "pm_theme";

export function isThemeMode(value: string | undefined | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

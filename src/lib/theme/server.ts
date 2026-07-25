import { cookies } from "next/headers";
import {
  DEFAULT_THEME_MODE,
  isThemeMode,
  THEME_COOKIE,
  type ThemeMode,
} from "@/lib/theme";

export async function getServerThemeMode(): Promise<ThemeMode> {
  const cookieStore = await cookies();
  const value = cookieStore.get(THEME_COOKIE)?.value;
  return isThemeMode(value) ? value : DEFAULT_THEME_MODE;
}

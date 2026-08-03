import { addDays, format, formatDistanceToNowStrict, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import type { Locale, TranslationKey } from "@/lib/i18n";

// An arbitrary Sunday (UTC, to avoid local-timezone drift shifting which
// weekday it lands on) used purely as a formatting anchor — see
// dayOfWeekLabel below.
const REFERENCE_SUNDAY = new Date(Date.UTC(2023, 0, 1));

const RELATIVE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type Translate = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

// Effective date is scheduled_at when set (IRL pods, a future meeting
// time) or created_at otherwise (ONLINE pods, a "posted" timestamp).
export function formatPodWhen(
  pod: {
    scheduled_at: string | null;
    created_at: string;
  },
  locale: Locale,
  t: Translate,
): string {
  const dateFnsLocale = locale === "fr" ? fr : undefined;
  const hasSchedule = pod.scheduled_at != null;
  const date = new Date(pod.scheduled_at ?? pod.created_at);
  const diffMs = date.getTime() - Date.now();

  if (hasSchedule) {
    if (diffMs > 0 && diffMs <= RELATIVE_WINDOW_MS) {
      return t("date.startsIn", {
        duration: formatDistanceToNowStrict(date, { locale: dateFnsLocale }),
      });
    }
    return isToday(date)
      ? t("date.today", { time: format(date, "p", { locale: dateFnsLocale }) })
      : format(date, "MMM d, p", { locale: dateFnsLocale });
  }

  if (diffMs >= -RELATIVE_WINDOW_MS) {
    return t("date.posted", {
      duration: formatDistanceToNowStrict(date, {
        addSuffix: true,
        locale: dateFnsLocale,
      }),
    });
  }
  return isToday(date)
    ? t("date.today", { time: format(date, "p", { locale: dateFnsLocale }) })
    : format(date, "MMM d, p", { locale: dateFnsLocale });
}

/** Localized weekday name for a RecurringTable.day_of_week (0=Sunday..6=Saturday, matches JS Date#getDay()). */
export function dayOfWeekLabel(dayOfWeek: number, locale: Locale): string {
  const dateFnsLocale = locale === "fr" ? fr : undefined;
  return format(addDays(REFERENCE_SUNDAY, dayOfWeek), "EEEE", {
    locale: dateFnsLocale,
  });
}

/** Localized time-of-day label for a RecurringTable.start_time ("HH:MM:SS" or "HH:MM"). */
export function startTimeLabel(startTime: string, locale: Locale): string {
  const dateFnsLocale = locale === "fr" ? fr : undefined;
  const [hours, minutes] = startTime.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return format(date, "p", { locale: dateFnsLocale });
}

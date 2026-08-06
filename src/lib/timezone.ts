/**
 * Returns how far `timeZone`'s wall clock is ahead of UTC at `instant`,
 * in milliseconds (positive east of UTC) — DST-aware since it reads the
 * zone's actual offset at that specific instant via Intl, not a fixed value.
 */
function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const wallTimeAsUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );

  return wallTimeAsUtcMs - instant.getTime();
}

/**
 * Converts a wall-clock date + time *as observed in `timeZone`* to the real
 * UTC instant it represents, DST-aware. E.g. "2026-08-01" + "11:00" in
 * "Europe/Paris" (UTC+2 in August) returns the instant for 09:00 UTC.
 *
 * Falls back to naive `new Date(`${dateStr}T${timeStr}`)` parsing (the old,
 * timezone-blind behavior) if `dateStr`/`timeStr` don't parse or `timeZone`
 * isn't a recognized IANA identifier — a defensive boundary fallback for
 * malformed client input, not a new user-facing error path.
 */
export function zonedTimeToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): Date {
  const naiveFallback = () => new Date(`${dateStr}T${timeStr}`);

  const dateParts = dateStr.split("-").map(Number);
  const timeParts = timeStr.split(":").map(Number);
  if (
    dateParts.length !== 3 ||
    timeParts.length < 2 ||
    dateParts.some(Number.isNaN) ||
    timeParts.some(Number.isNaN)
  ) {
    return naiveFallback();
  }
  const [year, month, day] = dateParts;
  const [hours, minutes, seconds = 0] = timeParts;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    return naiveFallback();
  }

  const wallTimeAsUtcMs = Date.UTC(year, month - 1, day, hours, minutes, seconds);

  // Two-pass correction: the first offset lookup is evaluated at the wrong
  // instant (the wall time treated as if it were already UTC), which can
  // land on the wrong side of a DST transition right around the transition
  // itself. Re-deriving the offset from that first estimate's actual UTC
  // instant resolves it for all but genuinely ambiguous/skipped local times.
  const firstOffsetMs = getTimeZoneOffsetMs(new Date(wallTimeAsUtcMs), timeZone);
  const refinedOffsetMs = getTimeZoneOffsetMs(
    new Date(wallTimeAsUtcMs - firstOffsetMs),
    timeZone,
  );
  return new Date(wallTimeAsUtcMs - refinedOffsetMs);
}

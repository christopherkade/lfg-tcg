import { describe, expect, it } from "vitest";
import { zonedTimeToUtc } from "@/lib/timezone";

describe("zonedTimeToUtc", () => {
  it("treats a UTC zone as a plain passthrough", () => {
    const result = zonedTimeToUtc("2026-08-01", "18:00", "UTC");
    expect(result.toISOString()).toBe("2026-08-01T18:00:00.000Z");
  });

  it("converts summer (CEST, UTC+2) Europe/Paris wall time to UTC", () => {
    const result = zonedTimeToUtc("2026-08-01", "11:00", "Europe/Paris");
    expect(result.toISOString()).toBe("2026-08-01T09:00:00.000Z");
  });

  it("converts winter (CET, UTC+1) Europe/Paris wall time to UTC", () => {
    const result = zonedTimeToUtc("2026-01-15", "11:00", "Europe/Paris");
    expect(result.toISOString()).toBe("2026-01-15T10:00:00.000Z");
  });

  it("is DST-aware across the spring-forward transition", () => {
    // 2026-03-29 is the EU spring-forward date: 02:00 CET -> 03:00 CEST.
    const beforeSwitch = zonedTimeToUtc("2026-03-29", "01:00", "Europe/Paris");
    const afterSwitch = zonedTimeToUtc("2026-03-29", "10:00", "Europe/Paris");
    expect(beforeSwitch.toISOString()).toBe("2026-03-29T00:00:00.000Z"); // still CET, UTC+1
    expect(afterSwitch.toISOString()).toBe("2026-03-29T08:00:00.000Z"); // now CEST, UTC+2
  });

  it("falls back to naive parsing for an invalid timezone identifier", () => {
    const result = zonedTimeToUtc("2026-08-01", "18:00", "Not/AZone");
    expect(result.toISOString()).toBe(
      new Date("2026-08-01T18:00").toISOString(),
    );
  });

  it("falls back to naive parsing for a malformed date/time", () => {
    const result = zonedTimeToUtc("not-a-date", "18:00", "UTC");
    expect(Number.isNaN(result.getTime())).toBe(true);
  });
});

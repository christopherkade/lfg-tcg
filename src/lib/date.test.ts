process.env.TZ = "UTC";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatPodWhen } from "@/lib/date";

const NOW = "2026-07-29T12:00:00.000Z";

describe("formatPodWhen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'startsIn' when an IRL pod's scheduled time is within the next hour", () => {
    const t = vi.fn(() => "translated");
    formatPodWhen(
      { scheduled_at: "2026-07-29T12:20:00.000Z", created_at: NOW },
      "en",
      t,
    );
    expect(t).toHaveBeenCalledWith("date.startsIn", { duration: "20 minutes" });
  });

  it("returns 'today' when an IRL pod is scheduled later the same day, beyond the 1h window", () => {
    const t = vi.fn(() => "translated");
    formatPodWhen(
      { scheduled_at: "2026-07-29T18:45:00.000Z", created_at: NOW },
      "en",
      t,
    );
    expect(t).toHaveBeenCalledWith("date.today", { time: "6:45 PM" });
  });

  it("returns a formatted date (bypassing translate) when an IRL pod is scheduled on a future day", () => {
    const t = vi.fn(() => "translated");
    const result = formatPodWhen(
      { scheduled_at: "2026-08-02T09:15:00.000Z", created_at: NOW },
      "en",
      t,
    );
    expect(result).toBe("Aug 2, 9:15 AM");
    expect(t).not.toHaveBeenCalled();
  });

  it("formats a future-day date in 24h clock style for the fr locale", () => {
    const t = vi.fn(() => "translated");
    const result = formatPodWhen(
      { scheduled_at: "2026-08-02T09:15:00.000Z", created_at: NOW },
      "fr",
      t,
    );
    expect(result).not.toMatch(/AM|PM/);
    expect(result).toContain("09:15");
  });

  it("returns 'posted' when an online pod was created within the last hour", () => {
    const t = vi.fn(() => "translated");
    formatPodWhen(
      { scheduled_at: null, created_at: "2026-07-29T11:55:00.000Z" },
      "en",
      t,
    );
    expect(t).toHaveBeenCalledWith("date.posted", { duration: "5 minutes ago" });
  });

  it("returns 'today' when an online pod was created earlier the same day, beyond the 1h window", () => {
    const t = vi.fn(() => "translated");
    formatPodWhen(
      { scheduled_at: null, created_at: "2026-07-29T08:00:00.000Z" },
      "en",
      t,
    );
    expect(t).toHaveBeenCalledWith("date.today", { time: "8:00 AM" });
  });

  it("returns a formatted date (bypassing translate) when an online pod was created on a prior day", () => {
    const t = vi.fn(() => "translated");
    const result = formatPodWhen(
      { scheduled_at: null, created_at: "2026-07-28T09:30:00.000Z" },
      "en",
      t,
    );
    expect(result).toBe("Jul 28, 9:30 AM");
    expect(t).not.toHaveBeenCalled();
  });
});

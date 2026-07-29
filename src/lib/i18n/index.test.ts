import { describe, expect, it } from "vitest";
import { isLocale, translate } from "@/lib/i18n";

describe("translate", () => {
  it("returns the dictionary string for a known key", () => {
    expect(translate("en", "errors.usernameRequired")).toBe(
      "Username is required.",
    );
  });

  it("resolves both supported locales", () => {
    expect(translate("en", "errors.groupFull")).toBe(
      "This group is already full.",
    );
    expect(translate("fr", "errors.groupFull")).not.toBe(
      translate("en", "errors.groupFull"),
    );
  });

  it("interpolates a single variable", () => {
    expect(
      translate("en", "date.startsIn", { duration: "5 minutes" }),
    ).toBe("Starts in 5 minutes");
  });

  it("interpolates multiple variables", () => {
    expect(
      translate("en", "errors.maxPlayersBelowGroupSize", { count: 4 }),
    ).toBe("Players needed can't be lower than your current group size (4).");
  });

  it("replaces every occurrence of a repeated variable", () => {
    const result = translate("en", "date.today", { time: "3pm" });
    expect(result).toBe("Today, 3pm");
  });

  it("falls back to the key itself when the key is missing from the dictionary", () => {
    // @ts-expect-error intentionally passing an unknown key to exercise the fallback
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
  });
});

describe("isLocale", () => {
  it("accepts supported locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(true);
  });

  it("rejects unsupported values", () => {
    expect(isLocale("de")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

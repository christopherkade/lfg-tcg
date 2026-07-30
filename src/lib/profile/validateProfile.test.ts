import { describe, expect, it } from "vitest";
import { validateCity, validateUsername } from "@/lib/profile/validateProfile";

describe("validateUsername", () => {
  it("requires a username", () => {
    const result = validateUsername("", "en");
    expect(result).toEqual({ error: "Username is required." });
  });

  it("passes through a non-empty username", () => {
    const result = validateUsername("player1", "en");
    expect(result).toEqual({ data: { username: "player1" } });
  });
});

describe("validateCity", () => {
  it("rejects a city that isn't a known slug", () => {
    const result = validateCity("atlantis", "en");
    expect(result).toEqual({ error: "Please select a valid city." });
  });

  it("allows an empty city (optional field)", () => {
    const result = validateCity("", "en");
    expect(result).toEqual({ data: { city: null } });
  });

  it("normalizes a valid known city slug through unchanged", () => {
    const result = validateCity("abbeville", "en");
    expect(result).toEqual({ data: { city: "abbeville" } });
  });
});

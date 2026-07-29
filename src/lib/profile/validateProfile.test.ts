import { describe, expect, it } from "vitest";
import { validateProfileInput } from "@/lib/profile/validateProfile";

describe("validateProfileInput", () => {
  it("requires a username", () => {
    const result = validateProfileInput(
      { username: "", discordHandle: "user#1234", city: "" },
      "en",
    );
    expect(result).toEqual({ error: "Username is required." });
  });

  it("requires a discord handle", () => {
    const result = validateProfileInput(
      { username: "player1", discordHandle: "", city: "" },
      "en",
    );
    expect(result).toEqual({
      error: "Couldn't read your Discord identity. Please sign out and back in.",
    });
  });

  it("rejects a city that isn't a known slug", () => {
    const result = validateProfileInput(
      { username: "player1", discordHandle: "user#1234", city: "atlantis" },
      "en",
    );
    expect(result).toEqual({ error: "Please select a valid city." });
  });

  it("allows an empty city (optional field)", () => {
    const result = validateProfileInput(
      { username: "player1", discordHandle: "user#1234", city: "" },
      "en",
    );
    expect(result).toEqual({
      data: { username: "player1", discordHandle: "user#1234", city: null },
    });
  });

  it("normalizes a valid known city slug through unchanged", () => {
    const result = validateProfileInput(
      { username: "player1", discordHandle: "user#1234", city: "abbeville" },
      "en",
    );
    expect(result).toEqual({
      data: {
        username: "player1",
        discordHandle: "user#1234",
        city: "abbeville",
      },
    });
  });
});

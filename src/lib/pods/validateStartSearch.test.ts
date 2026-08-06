import { describe, expect, it } from "vitest";
import {
  validateStartSearchInput,
  type StartSearchInput,
} from "@/lib/pods/validateStartSearch";

function baseOnlineInput(
  overrides: Partial<StartSearchInput> = {},
): StartSearchInput {
  return {
    gameKey: "ONE_PIECE",
    formatKey: "STANDARD",
    playstyleKey: "casual",
    brackets: [],
    matchType: "ONLINE",
    locationName: "",
    scheduledDate: "",
    scheduledTime: "",
    timezone: "UTC",
    maxPlayers: 4,
    reservedSlots: 0,
    notes: "",
    ...overrides,
  };
}

function baseIrlInput(overrides: Partial<StartSearchInput> = {}): StartSearchInput {
  return baseOnlineInput({
    matchType: "IRL",
    locationName: "Local Game Store",
    scheduledDate: "2026-08-01",
    scheduledTime: "18:00",
    ...overrides,
  });
}

describe("validateStartSearchInput", () => {
  it("rejects an unknown game key", () => {
    const result = validateStartSearchInput(
      baseOnlineInput({ gameKey: "NOT_A_GAME" }),
      "en",
      null,
    );
    expect(result).toEqual({ error: "Please select a valid game." });
  });

  it("rejects a format that doesn't belong to the selected game", () => {
    const result = validateStartSearchInput(
      baseOnlineInput({ formatKey: "MODERN" }),
      "en",
      null,
    );
    expect(result).toEqual({ error: "Please select a valid format." });
  });

  it("requires at least one power bracket for games that use them", () => {
    const result = validateStartSearchInput(
      baseOnlineInput({ gameKey: "MTG", formatKey: "COMMANDER", brackets: [] }),
      "en",
      null,
    );
    expect(result).toEqual({
      error: "Please select at least one power bracket for this game.",
    });
  });

  it("rejects power brackets outside the 1-5 range", () => {
    const result = validateStartSearchInput(
      baseOnlineInput({
        gameKey: "MTG",
        formatKey: "COMMANDER",
        brackets: [6],
      }),
      "en",
      null,
    );
    expect(result).toEqual({
      error: "Power brackets must be between 1 and 5.",
    });
  });

  it("requires a profile city for IRL matches", () => {
    const result = validateStartSearchInput(baseIrlInput(), "en", null);
    expect(result).toEqual({
      error: "Set your city on your profile to create an in-person pod.",
    });
  });

  it("requires a location name for IRL matches", () => {
    const result = validateStartSearchInput(
      baseIrlInput({ locationName: "   " }),
      "en",
      "paris",
    );
    expect(result).toEqual({
      error: "Please provide a location name for in-person matches.",
    });
  });

  it("requires a date and time for IRL matches", () => {
    const result = validateStartSearchInput(
      baseIrlInput({ scheduledTime: "" }),
      "en",
      "paris",
    );
    expect(result).toEqual({
      error: "Please provide a date and time for in-person matches.",
    });
  });

  it("rejects an invalid date/time combination for IRL matches", () => {
    const result = validateStartSearchInput(
      baseIrlInput({ scheduledDate: "not-a-date", scheduledTime: "18:00" }),
      "en",
      "paris",
    );
    expect(result).toEqual({
      error: "Please provide a valid date and time.",
    });
  });

  it("rejects maxPlayers outside the 2-6 range", () => {
    const tooFew = validateStartSearchInput(
      baseOnlineInput({ maxPlayers: 1 }),
      "en",
      null,
    );
    const tooMany = validateStartSearchInput(
      baseOnlineInput({ maxPlayers: 7 }),
      "en",
      null,
    );
    expect(tooFew).toEqual({ error: "Players needed must be between 2 and 6." });
    expect(tooMany).toEqual({ error: "Players needed must be between 2 and 6." });
  });

  it("rejects reservedSlots that leave no open slot to search for", () => {
    const negative = validateStartSearchInput(
      baseOnlineInput({ maxPlayers: 4, reservedSlots: -1 }),
      "en",
      null,
    );
    const tooMany = validateStartSearchInput(
      baseOnlineInput({ maxPlayers: 4, reservedSlots: 3 }),
      "en",
      null,
    );
    expect(negative).toEqual({
      error: "Already-filled seats must leave at least one open slot to search for.",
    });
    expect(tooMany).toEqual({
      error: "Already-filled seats must leave at least one open slot to search for.",
    });
  });

  it("rejects notes over 300 trimmed characters", () => {
    const result = validateStartSearchInput(
      baseOnlineInput({ notes: `  ${"x".repeat(301)}  ` }),
      "en",
      null,
    );
    expect(result).toEqual({ error: "Notes must be 300 characters or fewer." });
  });

  it("normalizes a valid ONLINE input for a non-power-tier game", () => {
    const result = validateStartSearchInput(
      baseOnlineInput({ notes: "  looking for a chill game  " }),
      "en",
      null,
    );
    expect(result).toEqual({
      data: {
        brackets: null,
        locationName: null,
        scheduledAt: null,
        notes: "looking for a chill game",
      },
    });
  });

  it("normalizes a valid IRL input for a power-tier game, preserving brackets and parsing the schedule", () => {
    const result = validateStartSearchInput(
      baseIrlInput({
        gameKey: "MTG",
        formatKey: "COMMANDER",
        brackets: [2, 3],
        locationName: "  Local Game Store  ",
        notes: "",
      }),
      "en",
      "paris",
    );
    expect(result).toEqual({
      data: {
        brackets: [2, 3],
        locationName: "Local Game Store",
        scheduledAt: "2026-08-01T18:00:00.000Z",
        notes: null,
      },
    });
  });

  it("converts the scheduled date/time from a non-UTC timezone to the correct UTC instant", () => {
    const result = validateStartSearchInput(
      baseIrlInput({ timezone: "Europe/Paris" }), // UTC+2 (CEST) in August
      "en",
      "paris",
    );
    expect(result).toEqual({
      data: {
        brackets: null,
        locationName: "Local Game Store",
        scheduledAt: "2026-08-01T16:00:00.000Z",
        notes: null,
      },
    });
  });
});

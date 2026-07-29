import { describe, expect, it } from "vitest";
import { GAMES_CONFIG } from "@/constants/gamesConfig";

describe("GAMES_CONFIG", () => {
  const games = Object.entries(GAMES_CONFIG);

  it("defines at least one game", () => {
    expect(games.length).toBeGreaterThan(0);
  });

  it.each(games)("%s has at least one format with a key and label", (_key, game) => {
    expect(game.formats.length).toBeGreaterThan(0);
    for (const format of game.formats) {
      expect(format.key.length).toBeGreaterThan(0);
      expect(format.label.length).toBeGreaterThan(0);
    }
  });

  it.each(games)("%s has unique format keys", (_key, game) => {
    const keys = game.formats.map((format) => format.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(games)(
    "%s declares a sane maxTier when it uses power tiers",
    (_key, game) => {
      if (!game.hasPowerTiers) return;
      expect(game.maxTier).toBeDefined();
      expect(game.maxTier as number).toBeGreaterThanOrEqual(1);
      expect(game.maxTier as number).toBeLessThanOrEqual(5);
    },
  );

  it.each(games)("%s points its logo at a public asset path", (_key, game) => {
    expect(game.logo.startsWith("/")).toBe(true);
  });
});

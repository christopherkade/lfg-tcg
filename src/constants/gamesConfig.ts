export interface GameSetting {
  name: string;
  /** Compact label for narrow layouts (mobile game pills) where the full
   *  `name` would wrap to two lines. Falls back to `name` if omitted. */
  shortName?: string;
  themeColor: string; // Tailwind color classes
  glowColor: string; // RGBA value for custom Framer Motion shadows
  formats: { key: string; label: string }[];
  hasPowerTiers: boolean;
  tierLabel?: string;
  maxTier?: number;
}

export const GAMES_CONFIG: Record<string, GameSetting> = {
  MTG: {
    name: "Magic: The Gathering",
    shortName: "MTG",
    themeColor: "text-amber-500 border-amber-500/30 bg-amber-500/10",
    glowColor: "rgba(245, 158, 11, 0.4)",
    formats: [
      { key: "COMMANDER", label: "Commander" },
      { key: "STANDARD", label: "Standard" },
      // { key: "MODERN", label: "Modern" },
    ],
    hasPowerTiers: true,
    tierLabel: "Power Bracket",
    maxTier: 5,
  },
  ONE_PIECE: {
    name: "One Piece TCG",
    shortName: "One Piece",
    themeColor: "text-blue-500 border-blue-500/30 bg-blue-500/10",
    glowColor: "rgba(59, 130, 246, 0.4)",
    formats: [{ key: "STANDARD", label: "Standard" }],
    hasPowerTiers: false,
  },
  POKEMON: {
    name: "Pokémon TCG",
    shortName: "Pokémon",
    themeColor: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    glowColor: "rgba(234, 179, 8, 0.4)",
    formats: [
      { key: "STANDARD", label: "Standard" },
      { key: "EXPANDED", label: "Expanded" },
    ],
    hasPowerTiers: false,
  },
  LORCANA: {
    name: "Disney Lorcana",
    shortName: "Lorcana",
    themeColor: "text-purple-500 border-purple-500/30 bg-purple-500/10",
    glowColor: "rgba(168, 85, 247, 0.4)",
    formats: [{ key: "CONSTRUCTED", label: "Core Constructed" }],
    hasPowerTiers: false,
  },
};

// Idle/no-game-selected glow for the LfgButton — the app's ember brand
// accent, at the same alpha convention as the per-game glows above.
export const DEFAULT_GLOW_COLOR = "rgba(242, 118, 46, 0.4)";

export const PLAYSTYLE_OPTIONS = [
  { key: "casual", label: "Casual" },
  { key: "competitive", label: "Competitive" },
] as const;

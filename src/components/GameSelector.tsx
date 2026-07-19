"use client";

import { GAMES_CONFIG } from "@/constants/gamesConfig";

interface GameSelectorProps {
  value: string;
  onChange: (gameKey: string) => void;
}

export function GameSelector({ value, onChange }: GameSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Object.entries(GAMES_CONFIG).map(([key, game]) => {
        const isActive = key === value;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`rounded-xl border px-3 py-4 text-sm font-medium transition-colors ${
              isActive
                ? game.themeColor
                : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
            }`}
          >
            {game.name}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { PLAYSTYLE_OPTIONS } from "@/constants/gamesConfig";
import type { PlaystyleKey } from "@/types/database";

interface PlaystyleToggleProps {
  value: PlaystyleKey;
  onChange: (playstyle: PlaystyleKey) => void;
}

export function PlaystyleToggle({ value, onChange }: PlaystyleToggleProps) {
  return (
    <div className="flex rounded-full border border-zinc-800 bg-zinc-900 p-1">
      {PLAYSTYLE_OPTIONS.map((option) => {
        const isActive = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-zinc-50 text-zinc-950"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

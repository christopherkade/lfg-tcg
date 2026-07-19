"use client";

import { AnimatePresence, motion } from "framer-motion";

interface PowerBracketPickerProps {
  visible: boolean;
  value: number[];
  onChange: (brackets: number[]) => void;
  maxTier?: number;
  label?: string;
}

export function PowerBracketPicker({
  visible,
  value,
  onChange,
  maxTier = 5,
  label = "Power Brackets",
}: PowerBracketPickerProps) {
  const tiers = Array.from({ length: maxTier }, (_, i) => i + 1);

  function toggleTier(tier: number) {
    if (value.includes(tier)) {
      onChange(value.filter((t) => t !== tier));
    } else {
      onChange([...value, tier].sort((a, b) => a - b));
    }
  }

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-2 pt-4">
            <span className="text-sm font-medium text-zinc-400">
              {label}{" "}
              <span className="text-zinc-600">
                (select all you&apos;ll play)
              </span>
            </span>
            <div className="flex gap-2">
              {tiers.map((tier) => {
                const isActive = value.includes(tier);
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => toggleTier(tier)}
                    aria-pressed={isActive}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                      isActive
                        ? "border-amber-500 bg-amber-500/10 text-amber-500"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    {tier}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

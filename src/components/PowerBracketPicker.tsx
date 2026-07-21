"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

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
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pt: 2 }}>
            <Typography
              variant="body2"
              sx={{ color: "#a1a1aa", fontWeight: 500 }}
            >
              {label}{" "}
              <Box component="span" sx={{ color: "#52525b" }}>
                (select all you&apos;ll play)
              </Box>
            </Typography>
            <ToggleButtonGroup
              value={value}
              onChange={(_event, next: number[]) =>
                onChange([...next].sort((a, b) => a - b))
              }
              sx={{ bgcolor: "transparent", border: 0, p: 0, gap: 1 }}
            >
              {tiers.map((tier) => (
                <ToggleButton
                  key={tier}
                  value={tier}
                  sx={{
                    height: 40,
                    width: 40,
                    borderRadius: "9999px !important",
                    border: "1px solid #27272a !important",
                    marginLeft: "0px !important",
                    bgcolor: "#18181b",
                    color: "#a1a1aa",
                    fontWeight: 600,
                    "&.Mui-selected": {
                      borderColor: "rgba(245, 158, 11, 0.5) !important",
                      bgcolor: "rgba(245, 158, 11, 0.1)",
                      color: "#f59e0b",
                    },
                    "&.Mui-selected:hover": {
                      bgcolor: "rgba(245, 158, 11, 0.16)",
                    },
                  }}
                >
                  {tier}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

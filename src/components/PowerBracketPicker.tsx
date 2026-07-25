"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useTranslation } from "@/lib/i18n/LocaleContext";

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
  label,
}: PowerBracketPickerProps) {
  const { t } = useTranslation();
  const resolvedLabel = label ?? t("powerBracketPicker.defaultLabel");
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
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: "text.primary", fontWeight: 500 }}
            >
              {resolvedLabel}{" "}
              <Box component="span" sx={{ color: "text.secondary" }}>
                {t("powerBracketPicker.hint")}
              </Box>
            </Typography>
            <ToggleButtonGroup
              value={value}
              fullWidth
              size="small"
              onChange={(_event, next: number[]) =>
                onChange([...next].sort((a, b) => a - b))
              }
              sx={{ bgcolor: "transparent", border: 0, p: 0, gap: 1 }}
            >
              {tiers.map((tier) => (
                <ToggleButton
                  key={tier}
                  value={tier}
                  sx={(theme) => ({
                    fontSize: "0.75rem",
                    px: 0,
                    gap: 0.5,
                    borderRadius: "8px !important",
                    border: `1px solid ${theme.palette.divider} !important`,
                    marginLeft: "0px !important",
                    bgcolor: theme.palette.background.paper,
                  })}
                >
                  {value.includes(tier) && <Check className="h-3 w-3" />}
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

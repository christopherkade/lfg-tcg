"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ban } from "lucide-react";
import { Button } from "@mui/material";
import { useTranslation } from "@/lib/i18n/LocaleContext";

interface CantStartSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shown instead of opening LfgDialog when the user clicks the LFG button
 * while they already have a PENDING request on (or have been ACCEPTED
 * into) someone else's still-ACTIVE pod. Mirrors createPod's
 * server-side check of the same rule — this is just the friendlier
 * client-side heads up so the user isn't left guessing why "Search"
 * failed after filling out the whole dialog.
 */
export function CantStartSearchDialog({
  open,
  onClose,
}: CantStartSearchDialogProps) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4 sm:p-8"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <Ban className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-zinc-50">
                  {t("cantStartSearchDialog.title")}
                </h2>
                <p className="text-sm text-white">
                  {t("cantStartSearchDialog.body")}
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={onClose}
              variant="contained"
              fullWidth
              sx={{ py: 1.5 }}
            >
              {t("cantStartSearchDialog.gotIt")}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

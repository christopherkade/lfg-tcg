"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SearchX } from "lucide-react";
import { Alert, Button, useTheme } from "@mui/material";
import { useTranslation } from "@/lib/i18n/LocaleContext";

interface NoUsersFoundDialogProps {
  open: boolean;
  onUnlist: () => void;
  onKeepSearching: () => void;
  pendingAction: "unlist" | "extend" | null;
  error: string | null;
}

/**
 * Shown once a pod's search window (`expires_at`) lapses with zero
 * pod_joins ever recorded — at that point the pod is already invisible to
 * every other searcher (the Match Feed filters on expires_at), so silently
 * leaving it ACTIVE just strands the host on a dead "Searching..." state
 * until the unrelated 12h inactivity sweep eventually deletes it. No
 * backdrop dismiss: unlike MatchedDialog this needs an explicit decision,
 * not just an acknowledgement.
 */
export function NoUsersFoundDialog({
  open,
  onUnlist,
  onKeepSearching,
  pendingAction,
  error,
}: NoUsersFoundDialogProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4 sm:p-8"
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex w-full max-w-md flex-col gap-4 rounded-2xl p-6"
            style={{
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <SearchX className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold" style={{ color: theme.palette.text.primary }}>
                  {t("noUsersFoundDialog.title")}
                </h2>
                <p className="text-sm" style={{ color: theme.palette.text.secondary }}>
                  {t("noUsersFoundDialog.body")}
                </p>
              </div>
            </div>

            {error && <Alert severity="error">{error}</Alert>}

            <div className="mt-2 flex gap-3">
              <Button
                type="button"
                onClick={onUnlist}
                disabled={pendingAction !== null}
                variant="outlined"
                fullWidth
                sx={{ py: 1.5, borderColor: "divider", color: "text.secondary" }}
              >
                {pendingAction === "unlist"
                  ? t("noUsersFoundDialog.unlisting")
                  : t("noUsersFoundDialog.unlistPod")}
              </Button>
              <Button
                type="button"
                onClick={onKeepSearching}
                disabled={pendingAction !== null}
                variant="contained"
                fullWidth
                sx={{ py: 1.5 }}
              >
                {pendingAction === "extend"
                  ? t("noUsersFoundDialog.extending")
                  : t("noUsersFoundDialog.keepSearching")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

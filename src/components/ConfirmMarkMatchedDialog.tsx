"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Alert, Button } from "@mui/material";
import { useTranslation } from "@/lib/i18n/LocaleContext";

interface ConfirmMarkMatchedDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: string | null;
}

/**
 * A lightweight warning shown before actually marking a pod as MATCHED
 * (which removes it from the match feed). It's just a reminder/confirm —
 * the actual Discord handles + copy actions live directly on the Group
 * Members list in MyPodPanel, not in this dialog.
 */
export function ConfirmMarkMatchedDialog({
  open,
  onClose,
  onConfirm,
  pending,
  error,
}: ConfirmMarkMatchedDialogProps) {
  const { t } = useTranslation();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4 sm:p-8"
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
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-zinc-50">
                  {t("confirmMarkMatchedDialog.title")}
                </h2>
                <p className="text-sm text-white">
                  {t("confirmMarkMatchedDialog.body")}
                </p>
              </div>
            </div>

            {error && <Alert severity="error">{error}</Alert>}

            <div className="mt-2 flex gap-3">
              <Button
                type="button"
                onClick={onClose}
                variant="outlined"
                fullWidth
                sx={{ py: 1.5, borderColor: "#52525b", color: "#d4d4d8" }}
              >
                {t("confirmMarkMatchedDialog.notYet")}
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                variant="contained"
                fullWidth
                sx={{ py: 1.5 }}
              >
                {pending
                  ? t("confirmMarkMatchedDialog.matching")
                  : t("confirmMarkMatchedDialog.markAsMatched")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

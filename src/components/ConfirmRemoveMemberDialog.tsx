"use client";

import { AnimatePresence, motion } from "framer-motion";
import { UserX } from "lucide-react";
import { Alert, Button, useTheme } from "@mui/material";
import { useTranslation } from "@/lib/i18n/LocaleContext";

interface ConfirmRemoveMemberDialogProps {
  open: boolean;
  memberName: string | null;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: string | null;
}

/**
 * Confirmation gate before a host removes an already-ACCEPTED member from
 * their pod (`removeMember`) — mirrors `ConfirmMarkMatchedDialog`'s
 * lightweight warning pattern since this is also a destructive action that
 * frees up a spot but can't be silently undone by the host.
 */
export function ConfirmRemoveMemberDialog({
  open,
  memberName,
  onClose,
  onConfirm,
  pending,
  error,
}: ConfirmRemoveMemberDialogProps) {
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
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="flex w-full max-w-md flex-col gap-4 rounded-2xl p-6"
            style={{
              border: `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.paper,
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <UserX className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold" style={{ color: theme.palette.text.primary }}>
                  {t("confirmRemoveMemberDialog.title", {
                    name: memberName ?? t("confirmRemoveMemberDialog.titleFallback"),
                  })}
                </h2>
                <p className="text-sm" style={{ color: theme.palette.text.secondary }}>
                  {t("confirmRemoveMemberDialog.body")}
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
                sx={{ py: 1.5, borderColor: "divider", color: "text.secondary" }}
              >
                {t("confirmRemoveMemberDialog.cancel")}
              </Button>
              <Button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                variant="contained"
                fullWidth
                color="error"
                sx={{ py: 1.5 }}
              >
                {pending
                  ? t("confirmRemoveMemberDialog.removing")
                  : t("confirmRemoveMemberDialog.remove")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

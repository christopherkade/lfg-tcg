"use client";

import { AnimatePresence, motion } from "framer-motion";
import { UserX } from "lucide-react";
import { Alert, Button } from "@mui/material";

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
 * their beacon (`removeMember`) — mirrors `ConfirmMarkMatchedDialog`'s
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
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                <UserX className="h-5 w-5 text-red-400" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-zinc-50">
                  Remove {memberName ?? "this member"}?
                </h2>
                <p className="text-sm text-zinc-500">
                  They&apos;ll be dropped from the group and free up a spot.
                  They can request to join again afterwards if you change your
                  mind.
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
                sx={{ py: 1.5, borderColor: "#27272a", color: "#a1a1aa" }}
              >
                Cancel
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
                {pending ? "Removing..." : "Remove"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

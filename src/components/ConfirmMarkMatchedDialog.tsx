"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface ConfirmMarkMatchedDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: string | null;
}

/**
 * A lightweight warning shown before actually marking a beacon as MATCHED
 * (which removes it from the match feed). It's just a reminder/confirm —
 * the actual Discord handles + copy actions live directly on the Group
 * Members list in MyBeaconPanel, not in this dialog.
 */
export function ConfirmMarkMatchedDialog({
  open,
  onClose,
  onConfirm,
  pending,
  error,
}: ConfirmMarkMatchedDialogProps) {
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
                  Got everyone on Discord?
                </h2>
                <p className="text-sm text-zinc-500">
                  Marking as matched removes this beacon from the match feed for
                  good. Make sure you&apos;ve added everyone via Discord&apos;s
                  Add Friend search (copy their handles from the Group Members
                  list) before you continue.
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="mt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-zinc-800 px-6 py-3 font-medium text-zinc-400 transition-colors hover:border-zinc-700"
              >
                Not Yet
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className="flex-1 rounded-full bg-zinc-50 px-6 py-3 font-medium text-zinc-950 transition-opacity disabled:opacity-40"
              >
                {pending ? "Matching..." : "Mark as Matched"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

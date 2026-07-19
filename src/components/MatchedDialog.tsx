"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PartyPopper } from "lucide-react";

interface MatchedDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shown to an accepted member (not the host — they already know, they're
 * the one who clicked Mark as Matched) when a beacon they joined
 * transitions to MATCHED. Since MATCHED beacons drop out of every match
 * feed query (which filters on status = 'ACTIVE'), this is the only cue a
 * joiner gets that the card they were watching is gone for good — so it's
 * a blocking dialog rather than a dismissable snackbar.
 */
export function MatchedDialog({ open, onClose }: MatchedDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 sm:p-8"
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
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <PartyPopper className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-zinc-50">
                  You&apos;re Matched!
                </h2>
                <p className="text-sm text-zinc-500">
                  The host marked this beacon as matched. Head to Discord to say
                  hi to your group, and don&apos;t be surprised when its card
                  disappears from the match feed — it&apos;s been removed now
                  that the group is set.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-zinc-50 px-6 py-3 font-medium text-zinc-950 transition-opacity"
            >
              Got It
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

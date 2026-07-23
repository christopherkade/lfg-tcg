"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PartyPopper } from "lucide-react";
import { Button } from "@mui/material";

interface MatchedDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shown to an accepted member (not the host — they already know, they're
 * the one who clicked Mark as Matched) when a pod they joined
 * transitions to MATCHED. Tells them to check their Discord DMs, since the
 * host reaches out to the group over Discord (see MyPodPanel's "Copy
 * Handle"/"Add Friend" flow — Discord's API doesn't allow this app to send
 * DMs itself). Since MATCHED pods also drop out of every match feed
 * query (which filters on status = 'ACTIVE'), this is the only cue a
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
                  The host marked this pod as matched. Check your Discord DMs —
                  the host should be reaching out (or sending a friend request)
                  shortly. Also don&apos;t be surprised when its card disappears
                  from the match feed — it&apos;s been removed now that the
                  group is set.
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
              Got It
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

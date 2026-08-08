"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Alert, Button, useTheme } from "@mui/material";
import { Check, X } from "lucide-react";
import { CITY_MAP } from "@/constants/citiesConfig";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { OrganizerApplicationWithApplicant } from "@/types/database";

interface AdminApplicationDetailDialogProps {
  application: OrganizerApplicationWithApplicant | null;
  onClose: () => void;
  onApprove: (applicationId: string) => void;
  onReject: (applicationId: string) => void;
  pending: boolean;
  error: string | null;
}

// Mirrors PodDetailDialog's overlay pattern (framer-motion AnimatePresence,
// not a route/modal library) — this app has no dedicated modal component,
// every detail view follows this same shape.
export function AdminApplicationDetailDialog({
  application,
  onClose,
  onApprove,
  onReject,
  pending,
  error,
}: AdminApplicationDetailDialogProps) {
  const { t, locale } = useTranslation();
  const theme = useTheme();

  return (
    <AnimatePresence>
      {application && (
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
            <div className="flex flex-col">
              <h2
                className="text-lg font-semibold"
                style={{ color: theme.palette.text.primary }}
              >
                {application.store_name}
              </h2>
              <span className="text-sm" style={{ color: theme.palette.text.secondary }}>
                {t("admin.applications.applicant", {
                  username: application.profiles.username,
                  handle: application.profiles.discord_handle,
                })}
              </span>
            </div>

            <div
              className="flex flex-col gap-2 text-sm"
              style={{ color: theme.palette.text.primary }}
            >
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>
                  {t("admin.applications.city")}
                </span>
                <span>
                  {CITY_MAP[application.city]?.label ?? application.city}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>
                  {t("admin.applications.email")}
                </span>
                <span>{application.email}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: theme.palette.text.secondary }}>
                  {t("admin.applications.submittedAt")}
                </span>
                <span>
                  {new Date(application.created_at).toLocaleDateString(locale)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span style={{ color: theme.palette.text.secondary }}>
                  {t("admin.applications.verificationUrl")}
                </span>
                <a
                  href={application.verification_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate underline"
                  style={{ color: theme.palette.primary.main }}
                >
                  {application.verification_url}
                </a>
              </div>
            </div>

            {application.description && (
              <div
                className="flex flex-col gap-1 pt-3"
                style={{ borderTop: `1px solid ${theme.palette.divider}` }}
              >
                <span
                  className="text-sm font-medium"
                  style={{ color: theme.palette.text.secondary }}
                >
                  {t("admin.applications.description")}
                </span>
                <p
                  className="whitespace-pre-wrap text-sm"
                  style={{ color: theme.palette.text.primary }}
                >
                  {application.description}
                </p>
              </div>
            )}

            {error && <Alert severity="error">{error}</Alert>}

            <div className="mt-2 flex gap-3">
              <Button
                type="button"
                disabled={pending}
                onClick={() => onReject(application.id)}
                variant="outlined"
                fullWidth
                startIcon={<X className="h-4 w-4" />}
                sx={{
                  py: 1.5,
                  borderColor: "rgba(239, 68, 68, 0.4)",
                  color: "#f87171",
                  "&:hover": {
                    borderColor: "#ef4444",
                    bgcolor: "rgba(239, 68, 68, 0.1)",
                  },
                }}
              >
                {t("admin.applications.refuse")}
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => onApprove(application.id)}
                variant="contained"
                fullWidth
                startIcon={<Check className="h-4 w-4" />}
                sx={{ py: 1.5 }}
              >
                {t("admin.applications.accept")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { use, useState } from "react";
import { Typography } from "@mui/material";
import { AdminApplicationCard } from "@/components/admin/AdminApplicationCard";
import { AdminApplicationDetailDialog } from "@/components/admin/AdminApplicationDetailDialog";
import {
  approveOrganizerApplication,
  rejectOrganizerApplication,
} from "@/app/actions/admin";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { OrganizerApplicationWithApplicant } from "@/types/database";

interface AdminApplicationListProps {
  applicationsPromise: Promise<OrganizerApplicationWithApplicant[]>;
}

// Owns everything that depends on the applications data, mirroring
// OrganizerRecurringTableList: suspends via use() so the page's
// title/subtitle render synchronously, and owns the selected-application
// state that drives AdminApplicationDetailDialog (mirrors MatchFeedList's
// PodDetailDialog wiring).
export function AdminApplicationList({
  applicationsPromise,
}: AdminApplicationListProps) {
  const { t } = useTranslation();
  const initialApplications = use(applicationsPromise);
  const [applications, setApplications] = useState(initialApplications);
  const [selected, setSelected] =
    useState<OrganizerApplicationWithApplicant | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function removeReviewed(applicationId: string) {
    setApplications((current) =>
      current.filter((application) => application.id !== applicationId),
    );
    setSelected(null);
  }

  async function handleApprove(applicationId: string) {
    setPending(true);
    setError(null);
    const result = await approveOrganizerApplication(applicationId);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    removeReviewed(applicationId);
    setPending(false);
  }

  async function handleReject(applicationId: string) {
    setPending(true);
    setError(null);
    const result = await rejectOrganizerApplication(applicationId);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    removeReviewed(applicationId);
    setPending(false);
  }

  if (applications.length === 0) {
    return (
      <Typography sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
        {t("admin.applications.empty")}
      </Typography>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {applications.map((application) => (
          <AdminApplicationCard
            key={application.id}
            application={application}
            onClick={() => {
              setError(null);
              setSelected(application);
            }}
          />
        ))}
      </div>
      <AdminApplicationDetailDialog
        application={selected}
        onClose={() => setSelected(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        pending={pending}
        error={error}
      />
    </>
  );
}

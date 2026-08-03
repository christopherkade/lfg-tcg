"use client";

import { Suspense, useRef, useState } from "react";
import { Button, Skeleton, Typography } from "@mui/material";
import { Plus } from "lucide-react";
import { RefreshButton } from "@/components/RefreshButton";
import {
  OrganizerRecurringTableList,
  type OrganizerRecurringTableListHandle,
} from "@/components/organizer/OrganizerRecurringTableList";
import { OrganizerRecurringTableFormDialog } from "@/components/organizer/OrganizerRecurringTableFormDialog";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { RecurringTable } from "@/types/database";

interface OrganizerDashboardProps {
  organizerId: string;
  /** Not awaited by the page — OrganizerRecurringTableList suspends on it. */
  recurringTablesPromise: Promise<RecurringTable[]>;
}

function OrganizerDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 2 }).map((_, index) => (
        <Skeleton
          key={index}
          variant="rounded"
          height={140}
          sx={{ borderRadius: 2 }}
        />
      ))}
    </div>
  );
}

// The title/new-table button render synchronously and instantly on
// navigation — only the actual table list (owned by
// OrganizerRecurringTableList) suspends, via <Suspense> below.
export function OrganizerDashboard({
  organizerId,
  recurringTablesPromise,
}: OrganizerDashboardProps) {
  const { t } = useTranslation();
  const listRef = useRef<OrganizerRecurringTableListHandle>(null);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Typography
            component="h1"
            sx={{ fontSize: "1.25rem", fontWeight: 700, color: "text.primary" }}
          >
            {t("organizer.dashboard.title")}
          </Typography>
          <RefreshButton
            onRefresh={() => listRef.current?.refetch() ?? Promise.resolve()}
            ariaLabel={t("organizer.dashboard.refresh")}
          />
        </div>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          variant="contained"
          startIcon={<Plus className="h-4 w-4" />}
          sx={{ bgcolor: "#F59E0B", "&:hover": { bgcolor: "#D97706" } }}
        >
          {t("organizer.dashboard.newTable")}
        </Button>
      </div>

      <Suspense fallback={<OrganizerDashboardSkeleton />}>
        <OrganizerRecurringTableList
          ref={listRef}
          organizerId={organizerId}
          recurringTablesPromise={recurringTablesPromise}
        />
      </Suspense>

      <OrganizerRecurringTableFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          listRef.current?.refetch();
        }}
      />
    </div>
  );
}

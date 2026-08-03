"use client";

import { use, useCallback, useImperativeHandle, useState } from "react";
import { Typography } from "@mui/material";
import { createClient } from "@/lib/supabase/client";
import { OrganizerRecurringTableCard } from "@/components/organizer/OrganizerRecurringTableCard";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { RecurringTable } from "@/types/database";

export interface OrganizerRecurringTableListHandle {
  refetch: () => Promise<void>;
}

interface OrganizerRecurringTableListProps {
  ref?: React.Ref<OrganizerRecurringTableListHandle>;
  organizerId: string;
  /** Not awaited by OrganizerDashboard — this suspends on it via use(). */
  recurringTablesPromise: Promise<RecurringTable[]>;
}

// Owns everything that depends on the recurring-tables data — split out of
// OrganizerDashboard so that component's title/new-table button can render
// synchronously while this suspends. Mirrors MatchFeedList/HistoryEntriesList.
export function OrganizerRecurringTableList({
  ref,
  organizerId,
  recurringTablesPromise,
}: OrganizerRecurringTableListProps) {
  const { t } = useTranslation();
  const initialTables = use(recurringTablesPromise);
  const [tables, setTables] = useState(initialTables);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("recurring_tables")
      .select("*")
      .eq("organizer_id", organizerId)
      .order("day_of_week", { ascending: true });
    setTables((data ?? []) as RecurringTable[]);
  }, [organizerId]);

  useImperativeHandle(ref, () => ({ refetch }), [refetch]);

  if (tables.length === 0) {
    return (
      <Typography sx={{ color: "text.secondary", textAlign: "center", py: 4 }}>
        {t("organizer.dashboard.empty")}
      </Typography>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {tables.map((table) => (
        <OrganizerRecurringTableCard key={table.id} table={table} onChanged={refetch} />
      ))}
    </div>
  );
}

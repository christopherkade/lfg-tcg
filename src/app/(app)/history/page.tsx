import { Box } from "@mui/material";
import { requireTrustedProfile } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { HistoryList, type PodHistoryEntryWithHost } from "@/components/HistoryList";

export default async function HistoryPage() {
  const { supabase } = await requireTrustedProfile("/history");
  const locale = await getServerLocale();

  // Neither of these is awaited here — HistoryEntriesList suspends on them
  // itself, so the title/refresh button (HistoryList) can render
  // immediately instead of blocking on these two Supabase round-trips.
  // Wrapped in Promise.resolve() — Supabase's query builders are thenable
  // but not real Promise instances (missing .catch/.finally), which
  // React's use() and plain prop typing both expect.
  const gamesPlayedCountPromise = Promise.resolve(
    supabase.rpc("get_games_played_count").then(({ data }) => data ?? 0),
  );

  const entriesPromise = Promise.resolve(
    supabase
      .from("pod_history")
      .select("*, host:profiles!host_id(id, username, avatar_url, discord_handle)")
      .order("matched_at", { ascending: false })
      .limit(50)
      .then(({ data }) => (data ?? []) as PodHistoryEntryWithHost[]),
  );

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center gap-8 px-6 py-10"
    >
      <HistoryList
        title={translate(locale, "historyPage.title")}
        emptyLabel={translate(locale, "historyPage.empty")}
        gamesPlayedCountPromise={gamesPlayedCountPromise}
        entriesPromise={entriesPromise}
      />
    </Box>
  );
}

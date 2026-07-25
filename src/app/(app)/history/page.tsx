import { Box, Typography } from "@mui/material";
import { requireProfile } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { HistoryList, type PodHistoryEntryWithHost } from "@/components/HistoryList";

export default async function HistoryPage() {
  const { supabase } = await requireProfile("/history");
  const locale = await getServerLocale();
  const { data: gamesPlayedCount } = await supabase.rpc(
    "get_games_played_count",
  );

  const { data: entries } = await supabase
    .from("pod_history")
    .select("*, host:profiles!host_id(id, username, avatar_url, discord_handle)")
    .order("matched_at", { ascending: false })
    .limit(50);

  const history = (entries ?? []) as PodHistoryEntryWithHost[];

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center gap-8 px-6 py-10"
    >
      <Typography
        component="h1"
        sx={{ fontSize: "1.5rem", fontWeight: 700, color: "text.primary" }}
      >
        {translate(locale, "historyPage.title")}
      </Typography>
      <Typography sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
        {translate(locale, "historyPage.gamesPlayed", {
          count: gamesPlayedCount ?? 0,
        })}
      </Typography>

      <HistoryList
        initialEntries={history}
        emptyLabel={translate(locale, "historyPage.empty")}
      />
    </Box>
  );
}

import { Box } from "@mui/material";
import { requireUser, getProfile } from "@/lib/session";
import { ProfileForm } from "@/components/ProfileForm";
import { ProfileHeader } from "@/components/ProfileHeader";
import { ProfileStats } from "@/components/ProfileStats";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();

  const [profile, gamesPlayedCount, profilePodStats] = await Promise.all([
    getProfile(supabase, user.id),
    supabase.rpc("get_games_played_count").then(({ data }) => data ?? 0),
    supabase
      .rpc("get_profile_pod_stats")
      .then(
        ({ data }) =>
          data?.[0] ?? { people_met: 0, irl_count: 0, online_count: 0 },
      ),
  ]);

  const defaultDiscordHandle =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.preferred_username as string | undefined) ??
    "";
  const defaultAvatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <Box
      sx={{ bgcolor: "background.default" }}
      className="flex flex-1 flex-col items-center gap-8 px-6 py-16"
    >
      <ProfileHeader
        username={profile?.username ?? null}
        discordHandle={profile?.discord_handle ?? defaultDiscordHandle}
        avatarUrl={profile?.avatar_url ?? defaultAvatarUrl}
      />
      <ProfileStats
        gamesPlayedCount={gamesPlayedCount}
        peopleMet={profilePodStats.people_met}
        irlCount={profilePodStats.irl_count}
        onlineCount={profilePodStats.online_count}
      />
      <ProfileForm initialProfile={profile} />
    </Box>
  );
}

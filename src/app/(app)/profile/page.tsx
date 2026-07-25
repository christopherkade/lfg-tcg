import { Box, Typography } from "@mui/material";
import { requireUser, getProfile } from "@/lib/session";
import { ProfileForm } from "@/components/ProfileForm";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);
  const locale = await getServerLocale();

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
      <div className="flex flex-col items-center gap-2 text-center">
        <Typography
          component="h1"
          sx={{ fontSize: "1.5rem", fontWeight: 700, color: "text.primary" }}
        >
          {profile
            ? translate(locale, "profilePage.editTitle")
            : translate(locale, "profilePage.setupTitle")}
        </Typography>
      </div>
      <ProfileForm
        initialProfile={profile}
        defaultDiscordHandle={defaultDiscordHandle}
        defaultAvatarUrl={defaultAvatarUrl}
      />
    </Box>
  );
}

import { requireUser, getProfile } from "@/lib/session";
import { ProfileForm } from "@/components/ProfileForm";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const profile = await getProfile(supabase, user.id);

  const defaultDiscordHandle =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.preferred_username as string | undefined) ??
    "";

  return (
    <div className="flex flex-1 flex-col items-center gap-8 bg-zinc-950 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold text-zinc-50">
          {profile ? "Edit Profile" : "Set Up Your Profile"}
        </h1>
      </div>
      <ProfileForm
        initialProfile={profile}
        defaultDiscordHandle={defaultDiscordHandle}
      />
    </div>
  );
}

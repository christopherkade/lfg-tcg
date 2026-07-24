"use client";

import { useActionState, useState } from "react";
import { LogOut } from "lucide-react";
import { Alert, Avatar, Button, TextField } from "@mui/material";
import {
  upsertProfile,
  signOut,
  type ProfileFormState,
} from "@/app/actions/profile";
import { CitySelector } from "@/components/CitySelector";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { useTranslation } from "@/lib/i18n/LocaleContext";
import type { Profile } from "@/types/database";

interface ProfileFormProps {
  initialProfile: Profile | null;
  defaultDiscordHandle: string;
  defaultAvatarUrl: string | null;
}

const initialState: ProfileFormState = {};

export function ProfileForm({
  initialProfile,
  defaultDiscordHandle,
  defaultAvatarUrl,
}: ProfileFormProps) {
  const { t } = useTranslation();
  const [state, formAction, pending] = useActionState(
    upsertProfile,
    initialState,
  );
  const [city, setCity] = useState<string | null>(initialProfile?.city ?? null);
  const avatarUrl = initialProfile?.avatar_url ?? defaultAvatarUrl ?? undefined;

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <div className="flex justify-center">
        <Avatar
          src={avatarUrl}
          sx={{ width: 72, height: 72 }}
        >
          {(initialProfile?.username ?? defaultDiscordHandle)?.[0]?.toUpperCase()}
        </Avatar>
      </div>
      <form action={formAction} className="flex flex-col gap-6">
        <TextField
          id="username"
          name="username"
          label={t("profileForm.username")}
          defaultValue={initialProfile?.username ?? ""}
          required
          fullWidth
          size="small"
        />

        <TextField
          id="discord_handle"
          name="discord_handle"
          label={t("profileForm.discordHandle")}
          defaultValue={initialProfile?.discord_handle ?? defaultDiscordHandle}
          required
          fullWidth
          size="small"
        />

        <input type="hidden" name="city" value={city ?? ""} />
        <CitySelector value={city} onChange={setCity} />

        <LocaleSwitcher />

        {state?.error && <Alert severity="error">{state.error}</Alert>}

        <Button
          type="submit"
          disabled={pending}
          variant="contained"
          fullWidth
          sx={{ py: 1.5 }}
        >
          {pending ? t("profileForm.save.pending") : t("profileForm.save.idle")}
        </Button>
      </form>

      <form action={signOut}>
        <Button
          type="submit"
          variant="outlined"
          color="error"
          fullWidth
          startIcon={<LogOut className="h-4 w-4" />}
          sx={{
            py: 1.5,
            borderColor: "rgba(239, 68, 68, 0.3)",
            bgcolor: "rgba(239, 68, 68, 0.1)",
            "&:hover": {
              bgcolor: "rgba(239, 68, 68, 0.2)",
              borderColor: "rgba(239, 68, 68, 0.3)",
            },
          }}
        >
          {t("profileForm.signOut")}
        </Button>
      </form>
    </div>
  );
}

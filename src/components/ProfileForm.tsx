"use client";

import { useActionState, useState } from "react";
import { LogOut } from "lucide-react";
import { Alert, Button, TextField } from "@mui/material";
import {
  upsertProfile,
  signOut,
  type ProfileFormState,
} from "@/app/actions/profile";
import { CitySelector } from "@/components/CitySelector";
import type { Profile } from "@/types/database";

interface ProfileFormProps {
  initialProfile: Profile | null;
  defaultDiscordHandle: string;
}

const initialState: ProfileFormState = {};

export function ProfileForm({
  initialProfile,
  defaultDiscordHandle,
}: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(
    upsertProfile,
    initialState,
  );
  const [city, setCity] = useState<string | null>(initialProfile?.city ?? null);

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-6">
        <TextField
          id="username"
          name="username"
          label="Username"
          defaultValue={initialProfile?.username ?? ""}
          required
          fullWidth
          size="small"
        />

        <TextField
          id="discord_handle"
          name="discord_handle"
          label="Discord Handle"
          defaultValue={initialProfile?.discord_handle ?? defaultDiscordHandle}
          required
          fullWidth
          size="small"
        />

        <input type="hidden" name="city" value={city ?? ""} />
        <CitySelector value={city} onChange={setCity} />

        {state?.error && <Alert severity="error">{state.error}</Alert>}

        <Button
          type="submit"
          disabled={pending}
          variant="contained"
          fullWidth
          sx={{ py: 1.5 }}
        >
          {pending ? "Saving..." : "Save Profile"}
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
          Sign Out
        </Button>
      </form>
    </div>
  );
}

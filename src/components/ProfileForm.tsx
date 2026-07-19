"use client";

import { useActionState } from "react";
import { LogOut } from "lucide-react";
import {
  upsertProfile,
  signOut,
  type ProfileFormState,
} from "@/app/actions/profile";
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

  return (
    <div className="flex w-full max-w-md flex-col gap-8">
      <form action={formAction} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="username"
            className="text-sm font-medium text-zinc-400"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            defaultValue={initialProfile?.username ?? ""}
            required
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-zinc-50 outline-none focus:border-zinc-600"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="discord_handle"
            className="text-sm font-medium text-zinc-400"
          >
            Discord Handle
          </label>
          <input
            id="discord_handle"
            name="discord_handle"
            defaultValue={
              initialProfile?.discord_handle ?? defaultDiscordHandle
            }
            required
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-zinc-50 outline-none focus:border-zinc-600"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-red-400" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-zinc-50 px-6 py-3 font-medium text-zinc-950 transition-opacity disabled:opacity-40"
        >
          {pending ? "Saving..." : "Save Profile"}
        </button>
      </form>

      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-6 py-3 font-medium text-red-400 transition-colors hover:bg-red-500/20"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </form>
    </div>
  );
}

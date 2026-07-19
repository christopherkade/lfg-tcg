"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";

export interface ProfileFormState {
  error?: string;
}

/**
 * Saves identity fields only (username, discord handle). Game/search
 * settings are edited via the "Search" dialog on the LFG tab instead —
 * see src/app/actions/beacons.ts `createBeacon`.
 */
export async function upsertProfile(
  _prevState: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();

  const username = String(formData.get("username") ?? "").trim();
  const discordHandle = String(formData.get("discord_handle") ?? "").trim();

  if (!username) {
    return { error: "Username is required." };
  }
  if (!discordHandle) {
    return { error: "Discord handle is required." };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username,
      discord_handle: discordHandle,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("upsertProfile failed:", error);
    if (error.code === "23505") {
      return { error: "That username is already taken." };
    }
    return {
      error: `Something went wrong saving your profile: ${error.message}`,
    };
  }

  revalidatePath("/");
  revalidatePath("/beacons");
  redirect("/");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}

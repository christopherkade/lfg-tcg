"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { CITY_MAP } from "@/constants/citiesConfig";

export interface ProfileFormState {
  error?: string;
}

/**
 * Saves identity fields only (username, discord handle, city). Game/search
 * settings are edited via the "Search" dialog on the LFG tab instead —
 * see src/app/actions/beacons.ts `createBeacon`. `city` is optional (a
 * user who only ever plays Online doesn't need one) but, when provided,
 * must be one of `CITIES_CONFIG`'s slugs — this is what lets the Match
 * Feed (Section 6) filter IRL beacons by plain equality instead of fuzzy
 * free-text matching.
 */
export async function upsertProfile(
  _prevState: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();

  const username = String(formData.get("username") ?? "").trim();
  const discordHandle = String(formData.get("discord_handle") ?? "").trim();
  const cityInput = String(formData.get("city") ?? "").trim();

  if (!username) {
    return { error: "Username is required." };
  }
  if (!discordHandle) {
    return { error: "Discord handle is required." };
  }
  if (cityInput && !CITY_MAP[cityInput]) {
    return { error: "Please select a valid city." };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username,
      discord_handle: discordHandle,
      city: cityInput || null,
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

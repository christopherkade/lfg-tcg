"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { CITY_MAP } from "@/constants/citiesConfig";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";

export interface ProfileFormState {
  error?: string;
}

/**
 * Saves identity fields only (username, discord handle, city). Game/search
 * settings are edited via the "Search" dialog on the LFG tab instead —
 * see src/app/actions/pods.ts `createPod`. `city` is optional (a
 * user who only ever plays Online doesn't need one) but, when provided,
 * must be one of `CITIES_CONFIG`'s slugs — this is what lets the Match
 * Feed (Section 6) filter IRL pods by plain equality instead of fuzzy
 * free-text matching.
 */
export async function upsertProfile(
  _prevState: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();
  const locale = await getServerLocale();

  const username = String(formData.get("username") ?? "").trim();
  const discordHandle = String(formData.get("discord_handle") ?? "").trim();
  const cityInput = String(formData.get("city") ?? "").trim();
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ?? null;

  if (!username) {
    return { error: translate(locale, "errors.usernameRequired") };
  }
  if (!discordHandle) {
    return { error: translate(locale, "errors.discordHandleRequired") };
  }
  if (cityInput && !CITY_MAP[cityInput]) {
    return { error: translate(locale, "errors.invalidCity") };
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username,
      discord_handle: discordHandle,
      avatar_url: avatarUrl,
      city: cityInput || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("upsertProfile failed:", error);
    if (error.code === "23505") {
      return { error: translate(locale, "errors.usernameTaken") };
    }
    return {
      error: translate(locale, "errors.profileSaveFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/");
  revalidatePath("/pods");
  redirect("/");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Permanently deletes the caller's account via the `delete_own_account`
 * SECURITY DEFINER RPC (supabase/sql/account_deletion.sql). That RPC
 * anonymizes this user's entries in other people's pod_history snapshots,
 * then deletes the auth.users row — which cascades through profiles to
 * every other table (pods, pod_joins, notifications, pod_history as host).
 */
export async function deleteAccount(): Promise<ProfileFormState> {
  const { supabase } = await requireUser();
  const locale = await getServerLocale();

  const { error } = await supabase.rpc("delete_own_account");

  if (error) {
    console.error("deleteAccount failed:", error);
    return {
      error: translate(locale, "errors.deleteAccountFailed", {
        reason: error.message,
      }),
    };
  }

  await supabase.auth.signOut();
  redirect("/login");
}

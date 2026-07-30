"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import { validateCity, validateUsername } from "@/lib/profile/validateProfile";

export interface ProfileFormState {
  error?: string;
}

/**
 * Saves the username only — edited inline in `ProfileHeader` (pencil icon).
 * No `profiles` row exists yet for a first-time user (nothing inserts one on
 * signup), so this both creates the row on first save (`insert`, with
 * `discord_handle`/`avatar_url` sourced from Discord OAuth metadata, same as
 * `updateCity` relies on already existing) and renames it on every later
 * save (`update`, touching only `username`) — city/search-preference columns
 * are never touched here either way. Doesn't redirect: the header stays
 * open on the same page, and Next re-renders the current route (including
 * `(app)/layout.tsx`'s onboarding lock) automatically once this resolves.
 */
export async function updateUsername(
  _prevState: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();
  const locale = await getServerLocale();

  const username = String(formData.get("username") ?? "").trim();
  const validated = validateUsername(username, locale);
  if ("error" in validated) {
    return { error: validated.error };
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  let error;
  if (existingProfile) {
    ({ error } = await supabase
      .from("profiles")
      .update({
        username: validated.data.username,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id));
  } else {
    const discordHandle =
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      (user.user_metadata?.preferred_username as string | undefined) ??
      "";
    if (!discordHandle) {
      return { error: translate(locale, "errors.discordHandleRequired") };
    }
    ({ error } = await supabase.from("profiles").insert({
      id: user.id,
      username: validated.data.username,
      discord_handle: discordHandle,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      updated_at: new Date().toISOString(),
    }));
  }

  if (error) {
    console.error("updateUsername failed:", error);
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
  revalidatePath("/history");
  revalidatePath("/profile");
  return {};
}

/**
 * Saves the city only, auto-triggered by `ProfileForm` every time
 * `CitySelector` selects or clears a value (no manual save button). Only
 * ever called once a `profiles` row already exists (that section is gated
 * on `initialProfile` — see `ProfileForm`), so a plain `update` is enough;
 * it never needs to create the row the way `updateUsername` does. Doesn't
 * redirect — the user stays on the Profile screen and `ProfileForm` shows
 * inline saving/saved/error feedback next to the selector instead.
 */
export async function updateCity(
  _prevState: ProfileFormState | undefined,
  formData: FormData,
): Promise<ProfileFormState> {
  const { supabase, user } = await requireUser();
  const locale = await getServerLocale();

  const cityInput = String(formData.get("city") ?? "").trim();
  const validated = validateCity(cityInput, locale);
  if ("error" in validated) {
    return { error: validated.error };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      city: validated.data.city,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("updateCity failed:", error);
    return {
      error: translate(locale, "errors.profileSaveFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/");
  revalidatePath("/pods");
  revalidatePath("/profile");
  return {};
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

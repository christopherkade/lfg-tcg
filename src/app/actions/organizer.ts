"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireOrganizerProfile } from "@/lib/session";
import { getServerLocale } from "@/lib/i18n/server";
import { translate } from "@/lib/i18n";
import {
  validateRecurringTableInput,
  type RecurringTableInput,
} from "@/lib/organizer/validateRecurringTable";
import {
  validateOrganizerProfileInput,
  type OrganizerProfileInput,
} from "@/lib/organizer/validateOrganizerProfile";

export interface OrganizerActionResult {
  error?: string;
  recurringTableId?: string;
}

/**
 * Onboards the current user as an organiser. Guarded by requireProfile()
 * only — the whole point is granting organiser status to someone who
 * doesn't have it yet. The real authorization boundary for who can reach
 * this action at all is /organizer/apply being an unlisted route (see
 * SPECS.md); there's no invite code or approval step in this MVP.
 */
export async function applyAsOrganizer(
  input: OrganizerProfileInput,
): Promise<OrganizerActionResult> {
  const { supabase, user } = await requireProfile();
  const locale = await getServerLocale();

  const { data: existing } = await supabase
    .from("organizers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    return { error: translate(locale, "errors.alreadyOrganizer") };
  }

  const validated = validateOrganizerProfileInput(input, locale);
  if ("error" in validated) {
    return { error: validated.error };
  }

  const { error } = await supabase.from("organizers").insert({
    id: user.id,
    store_name: validated.data.storeName,
    city: validated.data.city,
    description: validated.data.description,
    verification_url: validated.data.verificationUrl,
  });

  if (error) {
    console.error("applyAsOrganizer failed:", error);
    return {
      error: translate(locale, "errors.applyAsOrganizerFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/");
  revalidatePath("/organizer");
  return {};
}

// Everything below requires an existing, active organiser record.

export async function updateOrganizerProfile(
  input: OrganizerProfileInput,
): Promise<OrganizerActionResult> {
  const { supabase, organizer } = await requireOrganizerProfile();
  const locale = await getServerLocale();

  const validated = validateOrganizerProfileInput(input, locale);
  if ("error" in validated) {
    return { error: validated.error };
  }

  // Deliberately does NOT touch store_name already snapshotted onto
  // existing recurring_tables/pods/pod_history rows — same point-in-time
  // snapshot convention as profiles.city -> pods.city. Only newly
  // created/spawned rows pick up the change.
  const { error } = await supabase
    .from("organizers")
    .update({
      store_name: validated.data.storeName,
      city: validated.data.city,
      description: validated.data.description,
      verification_url: validated.data.verificationUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizer.id);

  if (error) {
    console.error("updateOrganizerProfile failed:", error);
    return {
      error: translate(locale, "errors.organizerProfileSaveFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/organizer/settings");
  return {};
}

export async function createRecurringTable(
  input: RecurringTableInput,
): Promise<OrganizerActionResult> {
  const { supabase, organizer } = await requireOrganizerProfile();
  const locale = await getServerLocale();

  const validated = validateRecurringTableInput(input, locale);
  if ("error" in validated) {
    return { error: validated.error };
  }

  const { data: created, error } = await supabase
    .from("recurring_tables")
    .insert({
      organizer_id: organizer.id,
      // A recurring table always happens at its organiser's own store —
      // location_name/city are never client-supplied, always the
      // organiser's current profile values (same denormalize-at-write
      // convention as store_name).
      store_name: organizer.store_name,
      location_name: organizer.store_name,
      city: organizer.city,
      game_key: input.gameKey,
      format_key: input.formatKey,
      playstyle_key: input.playstyleKey,
      power_tiers: validated.data.brackets,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
      max_players: input.maxPlayers,
      notes: validated.data.notes,
      auto_accept: input.autoAccept,
      lead_time_hours: input.leadTimeHours,
    })
    .select("id")
    .single();

  if (error) {
    console.error("createRecurringTable failed:", error);
    return {
      error: translate(locale, "errors.recurringTableSaveFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/organizer");
  return { recurringTableId: created.id };
}

export async function updateRecurringTable(
  id: string,
  input: RecurringTableInput,
): Promise<OrganizerActionResult> {
  const { supabase, organizer } = await requireOrganizerProfile();
  const locale = await getServerLocale();

  const validated = validateRecurringTableInput(input, locale);
  if ("error" in validated) {
    return { error: validated.error };
  }

  const { error } = await supabase
    .from("recurring_tables")
    .update({
      // Re-synced to the organiser's current store settings on every edit,
      // same reasoning as createRecurringTable above.
      store_name: organizer.store_name,
      location_name: organizer.store_name,
      city: organizer.city,
      game_key: input.gameKey,
      format_key: input.formatKey,
      playstyle_key: input.playstyleKey,
      power_tiers: validated.data.brackets,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
      max_players: input.maxPlayers,
      notes: validated.data.notes,
      auto_accept: input.autoAccept,
      lead_time_hours: input.leadTimeHours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organizer_id", organizer.id);

  if (error) {
    console.error("updateRecurringTable failed:", error);
    return {
      error: translate(locale, "errors.recurringTableSaveFailed", {
        reason: error.message,
      }),
    };
  }

  await syncAutoAcceptToActivePod(supabase, id, input.autoAccept);

  revalidatePath("/organizer");
  return {};
}

/**
 * pods.auto_accept is a denormalized snapshot copied from
 * recurring_tables.auto_accept only at spawn time (spawn_due_recurring_pods()),
 * and a pod is typically spawned well ahead of its event (lead_time_hours).
 * Without this, toggling auto-accept on an already-live table would only
 * affect *future* spawns — the currently visible, joinable pod would keep
 * whatever value it had when it was spawned, so players could still
 * instantly join (or still have to wait) regardless of what the organiser
 * just changed. Best-effort: the template update above already succeeded,
 * so a failure here is logged but not surfaced as the action's own error.
 */
async function syncAutoAcceptToActivePod(
  supabase: Awaited<ReturnType<typeof requireOrganizerProfile>>["supabase"],
  recurringTableId: string,
  autoAccept: boolean,
) {
  const { error } = await supabase
    .from("pods")
    .update({ auto_accept: autoAccept })
    .eq("recurring_table_id", recurringTableId)
    .eq("status", "ACTIVE");

  if (error) {
    console.error("syncAutoAcceptToActivePod failed:", error);
  }
}

export async function setRecurringTableActive(
  id: string,
  isActive: boolean,
): Promise<OrganizerActionResult> {
  const { supabase, organizer } = await requireOrganizerProfile();
  const locale = await getServerLocale();

  const { error } = await supabase
    .from("recurring_tables")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organizer_id", organizer.id);

  if (error) {
    console.error("setRecurringTableActive failed:", error);
    return {
      error: translate(locale, "errors.recurringTableSaveFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/organizer");
  return {};
}

export async function setRecurringTableAutoAccept(
  id: string,
  autoAccept: boolean,
): Promise<OrganizerActionResult> {
  const { supabase, organizer } = await requireOrganizerProfile();
  const locale = await getServerLocale();

  const { error } = await supabase
    .from("recurring_tables")
    .update({ auto_accept: autoAccept, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organizer_id", organizer.id);

  if (error) {
    console.error("setRecurringTableAutoAccept failed:", error);
    return {
      error: translate(locale, "errors.recurringTableSaveFailed", {
        reason: error.message,
      }),
    };
  }

  await syncAutoAcceptToActivePod(supabase, id, autoAccept);

  revalidatePath("/organizer");
  return {};
}

export async function deleteRecurringTable(
  id: string,
): Promise<OrganizerActionResult> {
  const { supabase, organizer } = await requireOrganizerProfile();
  const locale = await getServerLocale();

  // ON DELETE SET NULL on pods.recurring_table_id / pod_history.recurring_table_id
  // means an already-spawned, already-joined pod (and any history logged
  // from it) is safe to leave dangling rather than needing cleanup here.
  const { error } = await supabase
    .from("recurring_tables")
    .delete()
    .eq("id", id)
    .eq("organizer_id", organizer.id);

  if (error) {
    console.error("deleteRecurringTable failed:", error);
    return {
      error: translate(locale, "errors.recurringTableDeleteFailed", {
        reason: error.message,
      }),
    };
  }

  revalidatePath("/organizer");
  return {};
}

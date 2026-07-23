"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import type { BeaconActionResult } from "@/app/actions/beacons";

export async function requestJoin(
  beaconId: string,
): Promise<BeaconActionResult> {
  const { supabase, user } = await requireUser();

  const { data: beacon } = await supabase
    .from("beacons")
    .select("id, user_id, status, max_players, beacon_joins(status)")
    .eq("id", beaconId)
    .maybeSingle();

  if (!beacon || beacon.status !== "ACTIVE") {
    return { error: "This beacon is no longer active." };
  }
  if (beacon.user_id === user.id) {
    return { error: "You can't join your own beacon." };
  }

  const acceptedCount = beacon.beacon_joins.filter(
    (join) => join.status === "ACCEPTED",
  ).length;
  if (acceptedCount + 1 >= beacon.max_players) {
    return { error: "This group is already full." };
  }

  const { error } = await supabase.from("beacon_joins").insert({
    beacon_id: beaconId,
    user_id: user.id,
    status: "PENDING",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already requested to join this beacon." };
    }
    return { error: "Could not send join request. Please try again." };
  }

  revalidatePath("/");
  return {};
}

/**
 * Lets a user leave a beacon they've joined — whether their request is
 * still PENDING (cancels the request) or already ACCEPTED (leaves the
 * group). Simply deletes their own beacon_joins row; the unique
 * (beacon_id, user_id) constraint means they're free to request to join
 * again afterwards if they change their mind.
 */
export async function leaveBeacon(
  beaconId: string,
): Promise<BeaconActionResult> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("beacon_joins")
    .delete()
    .eq("beacon_id", beaconId)
    .eq("user_id", user.id);

  if (error) {
    console.error("leaveBeacon failed:", error);
    return { error: `Could not leave this beacon: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/beacons");
  return {};
}
/**
 * Lets the host remove an already-ACCEPTED member from their own beacon
 * (e.g. a no-show or bad fit). Only affects ACCEPTED rows — pending
 * requests are handled via `respondToJoin`'s Reject action instead.
 * Simply deletes the beacon_joins row, same as `leaveBeacon`, so the
 * removed user is free to request to join again afterwards if the host
 * reconsiders.
 */
export async function removeMember(
  joinId: string,
): Promise<BeaconActionResult> {
  const { supabase, user } = await requireUser();

  const { data: join } = await supabase
    .from("beacon_joins")
    .select("id, status, beacons(user_id)")
    .eq("id", joinId)
    .maybeSingle();

  if (!join || !join.beacons) {
    return { error: "This member no longer exists." };
  }

  const hostBeacon = Array.isArray(join.beacons)
    ? join.beacons[0]
    : join.beacons;
  if (!hostBeacon || hostBeacon.user_id !== user.id) {
    return { error: "Only the host can remove a member." };
  }
  if (join.status !== "ACCEPTED") {
    return { error: "Only accepted members can be removed." };
  }

  const { error } = await supabase
    .from("beacon_joins")
    .delete()
    .eq("id", joinId);

  if (error) {
    console.error("removeMember failed:", error);
    return { error: `Could not remove this member: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/beacons");
  return {};
}
export async function respondToJoin(
  joinId: string,
  decision: "ACCEPTED" | "REJECTED",
): Promise<BeaconActionResult> {
  const { supabase, user } = await requireUser();

  const { data: join } = await supabase
    .from("beacon_joins")
    .select(
      "id, beacon_id, beacons(user_id, max_players, beacon_joins(status))",
    )
    .eq("id", joinId)
    .maybeSingle();

  if (!join || !join.beacons) {
    return { error: "This join request no longer exists." };
  }

  const hostBeacon = Array.isArray(join.beacons)
    ? join.beacons[0]
    : join.beacons;
  if (!hostBeacon) {
    return { error: "This join request no longer exists." };
  }
  if (hostBeacon.user_id !== user.id) {
    return { error: "Only the host can respond to join requests." };
  }

  if (decision === "ACCEPTED") {
    const acceptedCount = hostBeacon.beacon_joins.filter(
      (j: { status: string }) => j.status === "ACCEPTED",
    ).length;
    if (acceptedCount + 1 >= hostBeacon.max_players) {
      return { error: "This group is already full." };
    }
  }

  const { error } = await supabase
    .from("beacon_joins")
    .update({ status: decision })
    .eq("id", joinId);

  if (error) {
    console.error("respondToJoin failed:", error);
    return {
      error: `Could not update the join request: ${error.message}`,
    };
  }

  revalidatePath("/");
  return {};
}

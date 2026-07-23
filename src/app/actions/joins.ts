"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import type { PodActionResult } from "@/app/actions/pods";

export async function requestJoin(
  podId: string,
): Promise<PodActionResult> {
  const { supabase, user } = await requireUser();

  const { data: pod } = await supabase
    .from("pods")
    .select("id, user_id, status, max_players, pod_joins(status)")
    .eq("id", podId)
    .maybeSingle();

  if (!pod || pod.status !== "ACTIVE") {
    return { error: "This pod is no longer active." };
  }
  if (pod.user_id === user.id) {
    return { error: "You can't join your own pod." };
  }

  const acceptedCount = pod.pod_joins.filter(
    (join) => join.status === "ACCEPTED",
  ).length;
  if (acceptedCount + 1 >= pod.max_players) {
    return { error: "This group is already full." };
  }

  const { error } = await supabase.from("pod_joins").insert({
    pod_id: podId,
    user_id: user.id,
    status: "PENDING",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already requested to join this pod." };
    }
    return { error: "Could not send join request. Please try again." };
  }

  revalidatePath("/");
  return {};
}

/**
 * Lets a user leave a pod they've joined — whether their request is
 * still PENDING (cancels the request) or already ACCEPTED (leaves the
 * group). Simply deletes their own pod_joins row; the unique
 * (pod_id, user_id) constraint means they're free to request to join
 * again afterwards if they change their mind.
 */
export async function leavePod(
  podId: string,
): Promise<PodActionResult> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("pod_joins")
    .delete()
    .eq("pod_id", podId)
    .eq("user_id", user.id);

  if (error) {
    console.error("leavePod failed:", error);
    return { error: `Could not leave this pod: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/pods");
  return {};
}
/**
 * Lets the host remove an already-ACCEPTED member from their own pod
 * (e.g. a no-show or bad fit). Only affects ACCEPTED rows — pending
 * requests are handled via `respondToJoin`'s Reject action instead.
 * Simply deletes the pod_joins row, same as `leavePod`, so the
 * removed user is free to request to join again afterwards if the host
 * reconsiders.
 */
export async function removeMember(
  joinId: string,
): Promise<PodActionResult> {
  const { supabase, user } = await requireUser();

  const { data: join } = await supabase
    .from("pod_joins")
    .select("id, status, pods(user_id)")
    .eq("id", joinId)
    .maybeSingle();

  if (!join || !join.pods) {
    return { error: "This member no longer exists." };
  }

  const hostPod = Array.isArray(join.pods)
    ? join.pods[0]
    : join.pods;
  if (!hostPod || hostPod.user_id !== user.id) {
    return { error: "Only the host can remove a member." };
  }
  if (join.status !== "ACCEPTED") {
    return { error: "Only accepted members can be removed." };
  }

  const { error } = await supabase
    .from("pod_joins")
    .delete()
    .eq("id", joinId);

  if (error) {
    console.error("removeMember failed:", error);
    return { error: `Could not remove this member: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/pods");
  return {};
}
export async function respondToJoin(
  joinId: string,
  decision: "ACCEPTED" | "REJECTED",
): Promise<PodActionResult> {
  const { supabase, user } = await requireUser();

  const { data: join } = await supabase
    .from("pod_joins")
    .select(
      "id, pod_id, pods(user_id, max_players, pod_joins(status))",
    )
    .eq("id", joinId)
    .maybeSingle();

  if (!join || !join.pods) {
    return { error: "This join request no longer exists." };
  }

  const hostPod = Array.isArray(join.pods)
    ? join.pods[0]
    : join.pods;
  if (!hostPod) {
    return { error: "This join request no longer exists." };
  }
  if (hostPod.user_id !== user.id) {
    return { error: "Only the host can respond to join requests." };
  }

  if (decision === "ACCEPTED") {
    const acceptedCount = hostPod.pod_joins.filter(
      (j: { status: string }) => j.status === "ACCEPTED",
    ).length;
    if (acceptedCount + 1 >= hostPod.max_players) {
      return { error: "This group is already full." };
    }
  }

  const { error } = await supabase
    .from("pod_joins")
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

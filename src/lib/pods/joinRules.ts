import type { TranslationKey } from "@/lib/i18n";

interface JoinablePod {
  status: string;
  user_id: string;
  locked_at?: string | null;
}

/**
 * Authorization rule for `requestJoin`, given the target pod already
 * fetched from the DB: the pod must still be ACTIVE, must not be locked
 * (host has closed off new joins via toggleLockPod, src/app/actions/pods.ts
 * — reversible, unlike status), and the requester can't join their own pod.
 */
export function isPodJoinable(
  pod: JoinablePod,
  userId: string,
): TranslationKey | null {
  if (pod.status !== "ACTIVE") {
    return "errors.podNotActive";
  }
  if (pod.locked_at) {
    return "errors.podLocked";
  }
  if (pod.user_id === userId) {
    return "errors.cantJoinOwnPod";
  }
  return null;
}

/**
 * Capacity rule shared by `requestJoin` and `respondToJoin`. For ad hoc
 * pods the host occupies one of the slots (never inserted as a pod_joins
 * row, but still counted), so the group is full once accepted + host
 * reaches `maxPlayers`. For organiser recurring-table pods, `maxPlayers`
 * is "joiners needed" and deliberately excludes the organiser entirely —
 * pass `countsHost: false` so the group is full once accepted alone
 * reaches `maxPlayers`.
 */
export function isGroupFull(
  acceptedCount: number,
  maxPlayers: number,
  countsHost: boolean,
): boolean {
  return acceptedCount + (countsHost ? 1 : 0) >= maxPlayers;
}

interface RemovableJoin {
  status: string;
}

interface HostPod {
  user_id: string;
}

/**
 * Authorization rule for `removeMember`: only the pod's host can remove a
 * member, and only an already-ACCEPTED member (pending requests go
 * through `respondToJoin`'s Reject action instead).
 */
export function canRemoveMember(
  join: RemovableJoin,
  hostPod: HostPod | null,
  userId: string,
): TranslationKey | null {
  if (!hostPod || hostPod.user_id !== userId) {
    return "errors.onlyHostCanRemove";
  }
  if (join.status !== "ACCEPTED") {
    return "errors.onlyAcceptedCanBeRemoved";
  }
  return null;
}

/**
 * Authorization rule for `respondToJoin`: only the pod's host can accept
 * or reject a join request. The row must also still be PENDING to be
 * transitioned — that's enforced by the guarded update in `respondToJoin`
 * itself (and mirrored in RLS), not here, since it depends on the row's
 * current status rather than the caller's identity.
 */
export function canRespondToJoin(
  hostPod: HostPod | null,
  userId: string,
): TranslationKey | null {
  if (!hostPod) {
    return "errors.joinRequestNotFound";
  }
  if (hostPod.user_id !== userId) {
    return "errors.onlyHostCanRespond";
  }
  return null;
}

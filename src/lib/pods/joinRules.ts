import type { TranslationKey } from "@/lib/i18n";

interface JoinablePod {
  status: string;
  user_id: string;
}

/**
 * Authorization rule for `requestJoin`, given the target pod already
 * fetched from the DB: the pod must still be ACTIVE, and the requester
 * can't join their own pod.
 */
export function isPodJoinable(
  pod: JoinablePod,
  userId: string,
): TranslationKey | null {
  if (pod.status !== "ACTIVE") {
    return "errors.podNotActive";
  }
  if (pod.user_id === userId) {
    return "errors.cantJoinOwnPod";
  }
  return null;
}

/**
 * Capacity rule shared by `requestJoin` and `respondToJoin` — the host
 * counts as one of the slots, so the group is full once the accepted
 * count plus the host reaches `maxPlayers`.
 */
export function isGroupFull(acceptedCount: number, maxPlayers: number): boolean {
  return acceptedCount + 1 >= maxPlayers;
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
 * or reject a join request.
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

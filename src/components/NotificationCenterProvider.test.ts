import { describe, expect, it } from "vitest";
import { describeNotification } from "@/components/NotificationCenterProvider";
import { translate } from "@/lib/i18n";
import type { NotificationType, NotificationWithRelations } from "@/types/database";

function baseNotification(
  type: NotificationType,
  overrides: Partial<NotificationWithRelations> = {},
): NotificationWithRelations {
  return {
    id: "notif-1",
    recipient_id: "user-1",
    actor_id: "actor-1",
    type,
    pod_id: "pod-1",
    read_at: null,
    created_at: "2026-07-29T12:00:00.000Z",
    actor: { id: "actor-1", username: "Alice", avatar_url: null },
    pod: {
      id: "pod-1",
      game_key: "MTG",
      format_key: "COMMANDER",
      store_name: null,
      recurring_table_id: null,
    },
    ...overrides,
  };
}

const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
  translate("en", key, vars);

describe("describeNotification", () => {
  const cases: [NotificationType, string][] = [
    ["JOIN_REQUEST", "Alice wants to join your pod"],
    ["JOIN_ACCEPTED", "You've been accepted into Alice's pod!"],
    ["JOIN_REJECTED", "Alice declined your request to join their pod"],
    ["MEMBER_LEFT", "Alice left your pod"],
    ["REMOVED_FROM_POD", "Alice removed you from their pod"],
    ["POD_UPDATED", "Alice updated the details of a pod you joined"],
    [
      "POD_UPDATED_PENDING",
      "Alice updated the details of a pod you requested to join",
    ],
    ["POD_DESTROYED", "Alice's pod was cancelled before finding a match"],
    [
      "POD_EXPIRED_INACTIVITY",
      "A pod expired after 12 hours of inactivity and was removed",
    ],
  ];

  it.each(cases)("describes %s notifications", (type, expected) => {
    expect(describeNotification(baseNotification(type), t)).toBe(expected);
  });

  it("falls back to 'Someone' when there's no actor", () => {
    const result = describeNotification(
      baseNotification("JOIN_REQUEST", { actor: null }),
      t,
    );
    expect(result).toBe("Someone wants to join your pod");
  });

  const organizerPod = {
    id: "pod-1",
    game_key: "MTG" as const,
    format_key: "COMMANDER",
    store_name: "Card Kingdom",
    recurring_table_id: "table-1",
  };

  it("uses the store name (not the host's username) for host-actor notifications on organizer-hosted pods", () => {
    const result = describeNotification(
      baseNotification("JOIN_ACCEPTED", { pod: organizerPod }),
      t,
    );
    expect(result).toBe("You've been accepted into Card Kingdom's pod!");
  });

  it("still uses the player's username for player-actor notifications on organizer-hosted pods", () => {
    const result = describeNotification(
      baseNotification("JOIN_REQUEST", { pod: organizerPod }),
      t,
    );
    expect(result).toBe("Alice wants to join your pod");
  });
});

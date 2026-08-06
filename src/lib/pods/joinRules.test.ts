import { describe, expect, it } from "vitest";
import {
  canRemoveMember,
  canRespondToJoin,
  isGroupFull,
  isPodJoinable,
} from "@/lib/pods/joinRules";

describe("isPodJoinable", () => {
  it("rejects a pod that isn't ACTIVE", () => {
    expect(
      isPodJoinable({ status: "MATCHED", user_id: "host-1" }, "user-2"),
    ).toBe("errors.podNotActive");
  });

  it("rejects the host trying to join their own pod", () => {
    expect(
      isPodJoinable({ status: "ACTIVE", user_id: "host-1" }, "host-1"),
    ).toBe("errors.cantJoinOwnPod");
  });

  it("rejects a locked pod", () => {
    expect(
      isPodJoinable(
        { status: "ACTIVE", user_id: "host-1", locked_at: "2026-08-05T00:00:00Z" },
        "user-2",
      ),
    ).toBe("errors.podLocked");
  });

  it("allows a different user to join an ACTIVE, unlocked pod", () => {
    expect(
      isPodJoinable(
        { status: "ACTIVE", user_id: "host-1", locked_at: null },
        "user-2",
      ),
    ).toBeNull();
  });

  it("allows a different user to join an ACTIVE pod", () => {
    expect(
      isPodJoinable({ status: "ACTIVE", user_id: "host-1" }, "user-2"),
    ).toBeNull();
  });
});

describe("isGroupFull", () => {
  describe("countsHost: true (ad hoc pods)", () => {
    it("is not full below capacity", () => {
      // 2 accepted + host = 3, under max of 4
      expect(isGroupFull(2, 4, true)).toBe(false);
    });

    it("is full once accepted + host reaches capacity", () => {
      // 3 accepted + host = 4, at max of 4
      expect(isGroupFull(3, 4, true)).toBe(true);
    });

    it("is full when already over capacity", () => {
      expect(isGroupFull(5, 4, true)).toBe(true);
    });
  });

  describe("countsHost: false (organiser recurring-table pods)", () => {
    it("is not full below capacity", () => {
      // 1 accepted, under max of 2 joiners needed
      expect(isGroupFull(1, 2, false)).toBe(false);
    });

    it("is not full with zero joiners", () => {
      expect(isGroupFull(0, 2, false)).toBe(false);
    });

    it("is full once accepted alone reaches capacity", () => {
      // 2 accepted, at max of 2 joiners needed — host isn't counted
      expect(isGroupFull(2, 2, false)).toBe(true);
    });

    it("is full when already over capacity", () => {
      expect(isGroupFull(5, 4, false)).toBe(true);
    });
  });
});

describe("canRemoveMember", () => {
  const acceptedJoin = { status: "ACCEPTED" };

  it("rejects a caller who isn't the host", () => {
    expect(
      canRemoveMember(acceptedJoin, { user_id: "host-1" }, "user-2"),
    ).toBe("errors.onlyHostCanRemove");
  });

  it("rejects when there's no resolvable host pod", () => {
    expect(canRemoveMember(acceptedJoin, null, "host-1")).toBe(
      "errors.onlyHostCanRemove",
    );
  });

  it("rejects removing a member whose join isn't ACCEPTED", () => {
    expect(
      canRemoveMember({ status: "PENDING" }, { user_id: "host-1" }, "host-1"),
    ).toBe("errors.onlyAcceptedCanBeRemoved");
  });

  it("allows the host to remove an ACCEPTED member", () => {
    expect(
      canRemoveMember(acceptedJoin, { user_id: "host-1" }, "host-1"),
    ).toBeNull();
  });
});

describe("canRespondToJoin", () => {
  it("rejects when the host pod can't be resolved", () => {
    expect(canRespondToJoin(null, "host-1")).toBe("errors.joinRequestNotFound");
  });

  it("rejects a caller who isn't the host", () => {
    expect(canRespondToJoin({ user_id: "host-1" }, "user-2")).toBe(
      "errors.onlyHostCanRespond",
    );
  });

  it("allows the host to respond", () => {
    expect(canRespondToJoin({ user_id: "host-1" }, "host-1")).toBeNull();
  });
});

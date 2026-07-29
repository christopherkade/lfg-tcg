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

  it("allows a different user to join an ACTIVE pod", () => {
    expect(
      isPodJoinable({ status: "ACTIVE", user_id: "host-1" }, "user-2"),
    ).toBeNull();
  });
});

describe("isGroupFull", () => {
  it("is not full below capacity", () => {
    // 2 accepted + host = 3, under max of 4
    expect(isGroupFull(2, 4)).toBe(false);
  });

  it("is full once accepted + host reaches capacity", () => {
    // 3 accepted + host = 4, at max of 4
    expect(isGroupFull(3, 4)).toBe(true);
  });

  it("is full when already over capacity", () => {
    expect(isGroupFull(5, 4)).toBe(true);
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

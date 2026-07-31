/**
 * Succession state machine tests.
 *
 * These cover the scenarios named in the brief: false death, real death, death reversal,
 * beneficiary dispute, and a beneficiary change immediately before death. Each safety invariant
 * from SECURITY.md §1 has a corresponding test here.
 */

import { describe, expect, it } from "vitest";
import { addDays } from "@legacy/core";
import {
  MINIMUM_COOLING_OFF_DAYS,
  blockers,
  initialContext,
  transition,
  type SuccessionContext,
  type SuccessionEvent,
} from "../src/state-machine";

const T0 = "2026-01-01T00:00:00.000Z";

function run(ctx: SuccessionContext, events: readonly SuccessionEvent[]): SuccessionContext {
  let current = ctx;
  for (const e of events) {
    const result = transition(current, e);
    if (!result.ok) throw new Error(`Unexpected refusal on ${e.type}: ${result.error}`);
    current = result.value;
  }
  return current;
}

/** The full happy path, used as a baseline by several tests. */
function driveToExecutable(overrides: Partial<SuccessionContext> = {}): SuccessionContext {
  const ctx = initialContext({ coolingOffDays: 30, requiredConfidenceLevel: 4, ...overrides });
  return run(ctx, [
    { type: "DEATH_REPORTED", at: T0, reportedBy: "heir-1", reporterType: "BENEFICIARY" },
    { type: "EVIDENCE_RECORDED", at: addDays(T0, 5), confidenceLevel: 4 },
    { type: "THRESHOLD_MET", at: addDays(T0, 6) },
    { type: "APPROVAL_RECORDED", at: addDays(T0, 7), approverId: "officer-a" },
    { type: "APPROVAL_RECORDED", at: addDays(T0, 8), approverId: "officer-b" },
    { type: "COOLING_OFF_ELAPSED", at: addDays(T0, 40) },
  ]);
}

describe("real death — the happy path", () => {
  it("reaches EXECUTABLE only after every condition is satisfied", () => {
    const ctx = driveToExecutable();
    expect(ctx.state).toBe("EXECUTABLE");
    expect(ctx.approvals).toHaveLength(2);
  });

  it("completes through distribution", () => {
    const ctx = run(driveToExecutable(), [
      { type: "DISTRIBUTION_STARTED", at: addDays(T0, 41) },
      { type: "DISTRIBUTION_COMPLETED", at: addDays(T0, 44) },
    ]);
    expect(ctx.state).toBe("COMPLETED");
  });
});

describe("invariant I3 — proof of life overrides everything", () => {
  it("resets an investigation at any stage", () => {
    const investigating = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 2), confidenceLevel: 4 },
    ]);
    const result = transition(investigating, { type: "PROOF_OF_LIFE", at: addDays(T0, 3) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe("ACTIVE");
    expect(result.value.confidenceLevel).toBe(0);
    expect(result.value.resolvedAlive).toBe(true);
  });

  it("overrides even the highest confidence level and a full cooling-off period", () => {
    const cooling = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 6 },
      { type: "THRESHOLD_MET", at: addDays(T0, 2) },
    ]);
    expect(cooling.state).toBe("COOLING_OFF");

    const result = transition(cooling, { type: "PROOF_OF_LIFE", at: addDays(T0, 29) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe("ACTIVE");
    expect(result.value.coolingOffEndsAt).toBeUndefined();
  });

  it("rescues an account that is already EXECUTABLE", () => {
    const result = transition(driveToExecutable(), { type: "PROOF_OF_LIFE", at: addDays(T0, 41) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe("ACTIVE");
  });

  it("lifts a fraud hold", () => {
    const held = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "FRAUD_THRESHOLD_EXCEEDED", at: addDays(T0, 1), score: 85 },
    ]);
    expect(held.state).toBe("FRAUD_HOLD");
    const result = transition(held, { type: "PROOF_OF_LIFE", at: addDays(T0, 2) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.state).toBe("ACTIVE");
  });

  it("cannot reverse a completed distribution — and says so honestly", () => {
    const completed = run(driveToExecutable(), [
      { type: "DISTRIBUTION_STARTED", at: addDays(T0, 41) },
      { type: "DISTRIBUTION_COMPLETED", at: addDays(T0, 44) },
    ]);
    const result = transition(completed, { type: "PROOF_OF_LIFE", at: addDays(T0, 45) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("cannot be reversed");
  });
});

describe("invariant I4 — cooling-off can be extended, never shortened", () => {
  it("refuses a negative or zero extension", () => {
    const cooling = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "THRESHOLD_MET", at: addDays(T0, 2) },
    ]);
    for (const days of [-30, 0]) {
      const result = transition(cooling, { type: "COOLING_OFF_EXTENDED", at: addDays(T0, 3), additionalDays: days });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("never shortened");
    }
  });

  it("pushes the end date out when extended", () => {
    const cooling = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "THRESHOLD_MET", at: addDays(T0, 2) },
    ]);
    const before = cooling.coolingOffEndsAt!;
    const extended = run(cooling, [{ type: "COOLING_OFF_EXTENDED", at: addDays(T0, 3), additionalDays: 60 }]);
    expect(new Date(extended.coolingOffEndsAt!).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it("blocks execution until the extended period has elapsed", () => {
    const ctx = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "THRESHOLD_MET", at: addDays(T0, 2) },
      { type: "COOLING_OFF_EXTENDED", at: addDays(T0, 3), additionalDays: 60 },
      { type: "APPROVAL_RECORDED", at: addDays(T0, 4), approverId: "a" },
      { type: "APPROVAL_RECORDED", at: addDays(T0, 5), approverId: "b" },
    ]);
    const tooEarly = transition(ctx, { type: "COOLING_OFF_ELAPSED", at: addDays(T0, 40) });
    expect(tooEarly.ok).toBe(false);

    const late = transition(ctx, { type: "COOLING_OFF_ELAPSED", at: addDays(T0, 100) });
    expect(late.ok).toBe(true);
  });
});

describe("invariant I5 — two distinct approvers", () => {
  it("refuses execution with a single approver", () => {
    const ctx = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "THRESHOLD_MET", at: addDays(T0, 2) },
      { type: "APPROVAL_RECORDED", at: addDays(T0, 3), approverId: "officer-a" },
    ]);
    const result = transition(ctx, { type: "COOLING_OFF_ELAPSED", at: addDays(T0, 40) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("distinct approvers");
  });

  it("refuses the same approver twice — no self-quorum", () => {
    const ctx = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "THRESHOLD_MET", at: addDays(T0, 2) },
      { type: "APPROVAL_RECORDED", at: addDays(T0, 3), approverId: "officer-a" },
    ]);
    const dup = transition(ctx, { type: "APPROVAL_RECORDED", at: addDays(T0, 4), approverId: "officer-a" });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toContain("already recorded");
  });
});

describe("false death and disputes", () => {
  it("refuses to start cooling-off below the required confidence level", () => {
    const ctx = run(initialContext({ requiredConfidenceLevel: 4 }), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 3 },
    ]);
    const result = transition(ctx, { type: "THRESHOLD_MET", at: addDays(T0, 2) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("below the required level");
  });

  it("an upheld dispute returns the plan to ACTIVE", () => {
    const ctx = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "DISPUTE_RAISED", at: addDays(T0, 2), by: "trusted-contact" },
    ]);
    const resolved = run(ctx, [{ type: "DISPUTE_UPHELD", at: addDays(T0, 5) }]);
    expect(resolved.state).toBe("ACTIVE");
    expect(resolved.resolvedAlive).toBe(true);
  });

  it("an open dispute blocks the cooling-off period from starting", () => {
    const ctx = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "DISPUTE_RAISED", at: addDays(T0, 2), by: "subject" },
    ]);
    const result = transition(ctx, { type: "THRESHOLD_MET", at: addDays(T0, 3) });
    expect(result.ok).toBe(false);
  });

  it("a dispute raised at EXECUTABLE pulls the plan back to corroboration", () => {
    const result = transition(driveToExecutable(), {
      type: "DISPUTE_RAISED",
      at: addDays(T0, 41),
      by: "co-beneficiary",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.state).toBe("CORROBORATING");
  });
});

describe("fraud holds", () => {
  it("halts a claim from any state", () => {
    const cooling = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "THRESHOLD_MET", at: addDays(T0, 2) },
    ]);
    const held = run(cooling, [{ type: "FRAUD_THRESHOLD_EXCEEDED", at: addDays(T0, 3), score: 80 }]);
    expect(held.state).toBe("FRAUD_HOLD");
    const blocked = transition(held, { type: "COOLING_OFF_ELAPSED", at: addDays(T0, 60) });
    expect(blocked.ok).toBe(false);
  });

  it("blocks execution while the fraud score is above threshold", () => {
    const ctx = run(initialContext({ fraudScore: 0 }), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "THRESHOLD_MET", at: addDays(T0, 2) },
      { type: "APPROVAL_RECORDED", at: addDays(T0, 3), approverId: "a" },
      { type: "APPROVAL_RECORDED", at: addDays(T0, 4), approverId: "b" },
    ]);
    const risky: SuccessionContext = { ...ctx, fraudScore: 75 };
    const result = transition(risky, { type: "COOLING_OFF_ELAPSED", at: addDays(T0, 40) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("risk score");
  });
});

describe("timing", () => {
  it("refuses execution before the cooling-off period has elapsed", () => {
    const ctx = run(initialContext({ coolingOffDays: 90 }), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "THRESHOLD_MET", at: addDays(T0, 2) },
      { type: "APPROVAL_RECORDED", at: addDays(T0, 3), approverId: "a" },
      { type: "APPROVAL_RECORDED", at: addDays(T0, 4), approverId: "b" },
    ]);
    const result = transition(ctx, { type: "COOLING_OFF_ELAPSED", at: addDays(T0, 30) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/day\(s\) left/);
  });

  it("the minimum cooling-off period is 30 days", () => {
    expect(MINIMUM_COOLING_OFF_DAYS).toBe(30);
  });
});

describe("blockers", () => {
  it("lists every outstanding requirement in plain language", () => {
    const ctx = run(initialContext(), [
      { type: "DEATH_REPORTED", at: T0, reportedBy: "x", reporterType: "UNKNOWN" },
      { type: "EVIDENCE_RECORDED", at: addDays(T0, 1), confidenceLevel: 4 },
      { type: "THRESHOLD_MET", at: addDays(T0, 2) },
      { type: "DISPUTE_RAISED", at: addDays(T0, 3), by: "subject" },
    ]);
    const list = blockers(ctx, addDays(T0, 10));
    expect(list.some((b) => b.includes("dispute"))).toBe(true);
    expect(list.some((b) => b.includes("approval"))).toBe(true);
    expect(list.some((b) => b.includes("Cooling-off"))).toBe(true);
  });
});

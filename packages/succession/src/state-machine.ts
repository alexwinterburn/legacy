/**
 * Succession state machine.
 *
 * The safety-critical component. Every guard here corresponds to a numbered invariant in
 * SECURITY.md §1, and each has a test in ../test/state-machine.test.ts.
 *
 * The central design decision: `PROOF_OF_LIFE` is accepted from ANY state before COMPLETED and
 * always wins. Everything else is a delay or a check; that one is an override.
 */

import { addDays, daysBetween, type ISODate, type Result, err, ok } from "@legacy/core";
import type { ConfidenceLevel } from "@legacy/death-verification";

export type SuccessionState =
  | "ACTIVE"
  | "INVESTIGATING"
  | "CORROBORATING"
  | "COOLING_OFF"
  | "EXECUTABLE"
  | "DISTRIBUTING"
  | "COMPLETED"
  | "FRAUD_HOLD";

export const STATE_META: Record<SuccessionState, { label: string; description: string; tone: "ok" | "warn" | "danger" | "done" }> = {
  ACTIVE: { label: "Active", description: "Your plan is in place. Nothing has been triggered.", tone: "ok" },
  INVESTIGATING: { label: "Investigation open", description: "A death has been reported. Assets remain locked while we check.", tone: "warn" },
  CORROBORATING: { label: "Gathering evidence", description: "Seeking independent confirmation. Assets remain locked.", tone: "warn" },
  COOLING_OFF: { label: "Cooling-off period", description: "Verification thresholds met. A mandatory waiting period is running.", tone: "warn" },
  EXECUTABLE: { label: "Ready to execute", description: "All conditions met. Beneficiaries can begin claiming.", tone: "danger" },
  DISTRIBUTING: { label: "Distributing", description: "Distributions are being prepared and signed.", tone: "danger" },
  COMPLETED: { label: "Completed", description: "The succession plan has been carried out.", tone: "done" },
  FRAUD_HOLD: { label: "On hold — risk review", description: "Suspicious activity detected. Everything is paused pending review.", tone: "danger" },
};

export type SuccessionEvent =
  | { type: "DEATH_REPORTED"; at: ISODate; reportedBy: string; reporterType: string }
  | { type: "EVIDENCE_RECORDED"; at: ISODate; confidenceLevel: ConfidenceLevel }
  | { type: "THRESHOLD_MET"; at: ISODate }
  | { type: "PROOF_OF_LIFE"; at: ISODate }
  | { type: "DISPUTE_RAISED"; at: ISODate; by: string }
  | { type: "DISPUTE_UPHELD"; at: ISODate }
  | { type: "DISPUTE_REJECTED"; at: ISODate }
  | { type: "COOLING_OFF_ELAPSED"; at: ISODate }
  | { type: "APPROVAL_RECORDED"; at: ISODate; approverId: string }
  | { type: "FRAUD_THRESHOLD_EXCEEDED"; at: ISODate; score: number }
  | { type: "FRAUD_CLEARED"; at: ISODate }
  | { type: "COOLING_OFF_EXTENDED"; at: ISODate; additionalDays: number }
  | { type: "DISTRIBUTION_STARTED"; at: ISODate }
  | { type: "DISTRIBUTION_COMPLETED"; at: ISODate };

export interface SuccessionContext {
  readonly state: SuccessionState;
  readonly confidenceLevel: ConfidenceLevel;
  readonly requiredConfidenceLevel: ConfidenceLevel;
  readonly coolingOffDays: number;
  readonly coolingOffStartedAt?: ISODate;
  readonly coolingOffEndsAt?: ISODate;
  readonly openDisputes: number;
  readonly fraudScore: number;
  readonly fraudThreshold: number;
  /** Distinct approver ids. Two are required — invariant I5. */
  readonly approvals: readonly string[];
  readonly requiredApprovals: number;
  readonly claimOpenedAt?: ISODate;
  readonly stateEnteredAt: ISODate;
  /** Set when a claim is resolved because the subject proved they are alive. */
  readonly resolvedAlive: boolean;
}

export function initialContext(overrides: Partial<SuccessionContext> = {}): SuccessionContext {
  return {
    state: "ACTIVE",
    confidenceLevel: 0,
    requiredConfidenceLevel: 4,
    coolingOffDays: 30,
    openDisputes: 0,
    fraudScore: 0,
    fraudThreshold: 60,
    approvals: [],
    requiredApprovals: 2,
    stateEnteredAt: new Date(0).toISOString(),
    resolvedAlive: false,
    ...overrides,
  };
}

export const MINIMUM_COOLING_OFF_DAYS = 30;

/**
 * Apply an event. Returns the new context, or an error explaining why the transition was refused.
 * Pure — no I/O, fully testable, same inputs always yield the same decision.
 */
export function transition(
  ctx: SuccessionContext,
  event: SuccessionEvent,
): Result<SuccessionContext, string> {
  // --- Invariant I3: proof of life overrides everything, from any pre-completion state. ---------
  if (event.type === "PROOF_OF_LIFE") {
    if (ctx.state === "COMPLETED") {
      return err("Distribution has already completed and cannot be reversed on-chain.");
    }
    return ok({
      ...ctx,
      state: "ACTIVE",
      confidenceLevel: 0,
      openDisputes: 0,
      approvals: [],
      coolingOffStartedAt: undefined,
      coolingOffEndsAt: undefined,
      claimOpenedAt: undefined,
      resolvedAlive: true,
      stateEnteredAt: event.at,
    });
  }

  // Fraud holds preempt everything except proof of life and being cleared.
  if (event.type === "FRAUD_THRESHOLD_EXCEEDED") {
    if (ctx.state === "COMPLETED") return err("Cannot place a completed succession on hold.");
    return ok({ ...ctx, state: "FRAUD_HOLD", fraudScore: event.score, stateEnteredAt: event.at });
  }

  switch (ctx.state) {
    case "ACTIVE":
      if (event.type === "DEATH_REPORTED") {
        return ok({
          ...ctx,
          state: "INVESTIGATING",
          claimOpenedAt: event.at,
          resolvedAlive: false,
          stateEnteredAt: event.at,
        });
      }
      if (event.type === "EVIDENCE_RECORDED") {
        // Inactivity signals can raise confidence without anyone reporting a death.
        return ok({ ...ctx, confidenceLevel: event.confidenceLevel });
      }
      return err(`${event.type} is not valid while the plan is active.`);

    case "INVESTIGATING":
    case "CORROBORATING": {
      if (event.type === "EVIDENCE_RECORDED") {
        const next = event.confidenceLevel >= 3 ? "CORROBORATING" : ctx.state;
        return ok({
          ...ctx,
          state: next,
          confidenceLevel: event.confidenceLevel,
          stateEnteredAt: next === ctx.state ? ctx.stateEnteredAt : event.at,
        });
      }
      if (event.type === "DISPUTE_RAISED") {
        return ok({ ...ctx, openDisputes: ctx.openDisputes + 1 });
      }
      if (event.type === "DISPUTE_UPHELD") {
        return ok({
          ...ctx,
          state: "ACTIVE",
          confidenceLevel: 0,
          openDisputes: 0,
          resolvedAlive: true,
          stateEnteredAt: event.at,
        });
      }
      if (event.type === "DISPUTE_REJECTED") {
        return ok({ ...ctx, openDisputes: Math.max(0, ctx.openDisputes - 1) });
      }
      if (event.type === "THRESHOLD_MET") {
        if (ctx.confidenceLevel < ctx.requiredConfidenceLevel) {
          return err(
            `Confidence level ${ctx.confidenceLevel} is below the required level ${ctx.requiredConfidenceLevel}.`,
          );
        }
        if (ctx.openDisputes > 0) return err("An open dispute blocks the cooling-off period.");
        return ok({
          ...ctx,
          state: "COOLING_OFF",
          coolingOffStartedAt: event.at,
          coolingOffEndsAt: addDays(event.at, ctx.coolingOffDays),
          stateEnteredAt: event.at,
        });
      }
      return err(`${event.type} is not valid during investigation.`);
    }

    case "COOLING_OFF": {
      if (event.type === "DISPUTE_RAISED") {
        return ok({ ...ctx, openDisputes: ctx.openDisputes + 1 });
      }
      if (event.type === "DISPUTE_UPHELD") {
        return ok({
          ...ctx,
          state: "ACTIVE",
          confidenceLevel: 0,
          openDisputes: 0,
          coolingOffStartedAt: undefined,
          coolingOffEndsAt: undefined,
          resolvedAlive: true,
          stateEnteredAt: event.at,
        });
      }
      if (event.type === "DISPUTE_REJECTED") {
        return ok({ ...ctx, openDisputes: Math.max(0, ctx.openDisputes - 1) });
      }
      // --- Invariant I4: cooling-off can be extended, never shortened. --------------------------
      if (event.type === "COOLING_OFF_EXTENDED") {
        if (event.additionalDays <= 0) {
          return err("The cooling-off period can be extended but never shortened.");
        }
        return ok({
          ...ctx,
          coolingOffEndsAt: addDays(ctx.coolingOffEndsAt ?? event.at, event.additionalDays),
        });
      }
      if (event.type === "APPROVAL_RECORDED") {
        if (ctx.approvals.includes(event.approverId)) {
          return err("This approver has already recorded an approval.");
        }
        return ok({ ...ctx, approvals: [...ctx.approvals, event.approverId] });
      }
      if (event.type === "EVIDENCE_RECORDED") {
        return ok({ ...ctx, confidenceLevel: event.confidenceLevel });
      }
      if (event.type === "COOLING_OFF_ELAPSED") {
        const endsAt = ctx.coolingOffEndsAt;
        if (!endsAt) return err("No cooling-off period is running.");
        if (daysBetween(endsAt, event.at) < 0) {
          const remaining = Math.ceil(daysBetween(event.at, endsAt));
          return err(`The cooling-off period has ${remaining} day(s) left.`);
        }
        if (ctx.openDisputes > 0) return err("An open dispute blocks execution.");
        if (ctx.confidenceLevel < ctx.requiredConfidenceLevel) {
          return err("Confidence has fallen below the required level.");
        }
        if (ctx.fraudScore >= ctx.fraudThreshold) {
          return err("The risk score is above threshold. Manual review is required.");
        }
        // --- Invariant I5: two distinct approvers. ---------------------------------------------
        if (ctx.approvals.length < ctx.requiredApprovals) {
          return err(
            `${ctx.requiredApprovals} distinct approvers are required; ${ctx.approvals.length} recorded.`,
          );
        }
        return ok({ ...ctx, state: "EXECUTABLE", stateEnteredAt: event.at });
      }
      return err(`${event.type} is not valid during the cooling-off period.`);
    }

    case "EXECUTABLE":
      if (event.type === "DISTRIBUTION_STARTED") {
        return ok({ ...ctx, state: "DISTRIBUTING", stateEnteredAt: event.at });
      }
      if (event.type === "DISPUTE_RAISED") {
        return ok({ ...ctx, state: "CORROBORATING", openDisputes: ctx.openDisputes + 1, stateEnteredAt: event.at });
      }
      return err(`${event.type} is not valid once the plan is executable.`);

    case "DISTRIBUTING":
      if (event.type === "DISTRIBUTION_COMPLETED") {
        return ok({ ...ctx, state: "COMPLETED", stateEnteredAt: event.at });
      }
      return err(`${event.type} is not valid during distribution.`);

    case "FRAUD_HOLD":
      if (event.type === "FRAUD_CLEARED") {
        return ok({ ...ctx, state: "CORROBORATING", fraudScore: 0, stateEnteredAt: event.at });
      }
      if (event.type === "DISPUTE_UPHELD") {
        return ok({ ...ctx, state: "ACTIVE", confidenceLevel: 0, openDisputes: 0, resolvedAlive: true, stateEnteredAt: event.at });
      }
      return err("The account is on hold pending risk review.");

    case "COMPLETED":
      return err("This succession has already completed.");
  }
}

/** Everything blocking progression right now, in plain language for the UI. */
export function blockers(ctx: SuccessionContext, now: ISODate): readonly string[] {
  const out: string[] = [];
  if (ctx.confidenceLevel < ctx.requiredConfidenceLevel) {
    out.push(`Verification is at level ${ctx.confidenceLevel}; level ${ctx.requiredConfidenceLevel} is required.`);
  }
  if (ctx.openDisputes > 0) out.push(`${ctx.openDisputes} open dispute(s).`);
  if (ctx.fraudScore >= ctx.fraudThreshold) out.push("Risk review required.");
  if (ctx.approvals.length < ctx.requiredApprovals) {
    out.push(`${ctx.requiredApprovals - ctx.approvals.length} more independent approval(s) required.`);
  }
  if (ctx.coolingOffEndsAt) {
    const remaining = daysBetween(now, ctx.coolingOffEndsAt);
    if (remaining > 0) out.push(`Cooling-off period ends in ${Math.ceil(remaining)} day(s).`);
  }
  return out;
}

/**
 * Succession simulator — powers the "What happens if I die?" screen.
 *
 * This drives the REAL state machine and the REAL distribution maths. Nothing here is scripted:
 * if a plan would stall because confidence never reaches the threshold, the simulation stalls too,
 * and says so. A simulator that only shows the happy path is marketing, not a product feature.
 */

import { addDays, type Allocation, type Beneficiary, type ISODate } from "@legacy/core";
import type { ConfidenceLevel } from "@legacy/death-verification";
import { computeDistribution, type DistributionResult, type DistributionSnapshot } from "./distribution";
import {
  initialContext,
  transition,
  type SuccessionContext,
  type SuccessionEvent,
  type SuccessionState,
} from "./state-machine";
import type { SuccessionRule } from "./rules";

export interface SimulationStep {
  readonly index: number;
  readonly at: ISODate;
  readonly dayOffset: number;
  readonly title: string;
  readonly detail: string;
  readonly state: SuccessionState;
  readonly confidenceLevel: ConfidenceLevel;
  readonly actor: string;
  /** Set when the step could not be applied — the simulation stops and explains why. */
  readonly blockedReason?: string;
}

export interface SimulationInput {
  readonly startAt: ISODate;
  readonly coolingOffDays: number;
  readonly requiredConfidenceLevel: ConfidenceLevel;
  readonly beneficiaries: readonly Beneficiary[];
  readonly allocations: readonly Allocation[];
  readonly rules: readonly SuccessionRule[];
  readonly snapshot: DistributionSnapshot;
  /** Simulate the user proving they're alive partway through, to demonstrate the veto. */
  readonly withProofOfLifeAtStep?: number;
}

export interface SimulationResult {
  readonly steps: readonly SimulationStep[];
  readonly distribution: DistributionResult | null;
  readonly finalState: SuccessionState;
  readonly totalDays: number;
  readonly halted: boolean;
  readonly haltReason?: string;
  /** Things the simulation shows that are NOT automatic — the honest part. */
  readonly manualSteps: readonly string[];
}

export function simulateSuccession(input: SimulationInput): SimulationResult {
  const steps: SimulationStep[] = [];
  let ctx: SuccessionContext = initialContext({
    coolingOffDays: input.coolingOffDays,
    requiredConfidenceLevel: input.requiredConfidenceLevel,
    stateEnteredAt: input.startAt,
  });

  let index = 0;
  let halted = false;
  let haltReason: string | undefined;

  const script: {
    dayOffset: number;
    title: string;
    detail: string;
    actor: string;
    event: (at: ISODate) => SuccessionEvent;
  }[] = [
    {
      dayOffset: 0,
      title: "Death reported",
      detail: "A death is reported against the account. Assets stay exactly where they are — nothing moves at this point, or for a long time afterwards.",
      actor: "Reporter",
      event: (at) => ({ type: "DEATH_REPORTED", at, reportedBy: "family-member", reporterType: "BENEFICIARY" }),
    },
    {
      dayOffset: 1,
      title: "Investigation opened",
      detail: "The account enters investigation. You are notified on every channel we have: email, SMS, push and any messaging channel you've linked.",
      actor: "System",
      event: (at) => ({ type: "EVIDENCE_RECORDED", at, confidenceLevel: 3 }),
    },
    {
      dayOffset: 9,
      title: "Documentary evidence checked",
      detail: "A death certificate is submitted and checked for authenticity. This reaches level 4 — enough to proceed, but not enough to be called independently corroborated.",
      actor: "Verification specialist",
      event: (at) => ({ type: "EVIDENCE_RECORDED", at, confidenceLevel: 4 }),
    },
    {
      dayOffset: 14,
      title: "Independent corroboration",
      detail: "A second source from a genuinely different class — a medical certificate rather than another registry document — corroborates the first. Only now can confidence reach level 6.",
      actor: "Legacy Oracle",
      event: (at) => ({ type: "EVIDENCE_RECORDED", at, confidenceLevel: 6 }),
    },
    {
      dayOffset: 15,
      title: "Cooling-off period begins",
      detail: `Verification thresholds are met, so the mandatory ${input.coolingOffDays}-day waiting period starts. You can stop everything during this window with a single authenticated action.`,
      actor: "System",
      event: (at) => ({ type: "THRESHOLD_MET", at }),
    },
    {
      dayOffset: 16,
      title: "First approval recorded",
      detail: "A verification officer records an approval. One approval is never enough — a second, different person is required.",
      actor: "Verifier",
      event: (at) => ({ type: "APPROVAL_RECORDED", at, approverId: "officer-a" }),
    },
    {
      dayOffset: 17,
      title: "Second independent approval",
      detail: "A second officer independently approves. Neither of them can move funds; they are only confirming the evidence was properly checked.",
      actor: "Operator",
      event: (at) => ({ type: "APPROVAL_RECORDED", at, approverId: "officer-b" }),
    },
    {
      dayOffset: input.coolingOffDays + 15,
      title: "Cooling-off elapsed",
      detail: "The waiting period ends with no dispute and no proof of life. Only now does the plan become executable.",
      actor: "System",
      event: (at) => ({ type: "COOLING_OFF_ELAPSED", at }),
    },
    {
      dayOffset: input.coolingOffDays + 18,
      title: "Beneficiaries verified and distribution prepared",
      detail: "Each beneficiary verifies their identity and confirms where they want to receive their share. Unsigned transactions are prepared — they still need the beneficiary's own key.",
      actor: "Beneficiaries",
      event: (at) => ({ type: "DISTRIBUTION_STARTED", at }),
    },
    {
      dayOffset: input.coolingOffDays + 21,
      title: "Distribution complete",
      detail: "Signed and broadcast. Each beneficiary receives their share directly at their own address. It never passes through us.",
      actor: "Beneficiaries",
      event: (at) => ({ type: "DISTRIBUTION_COMPLETED", at }),
    },
  ];

  for (const item of script) {
    const at = addDays(input.startAt, item.dayOffset);

    // Optionally demonstrate the veto: the user proves they're alive and everything unwinds.
    if (input.withProofOfLifeAtStep !== undefined && index === input.withProofOfLifeAtStep) {
      const result = transition(ctx, { type: "PROOF_OF_LIFE", at });
      if (result.ok) {
        ctx = result.value;
        steps.push({
          index: index++,
          at,
          dayOffset: item.dayOffset,
          title: "You proved you're alive",
          detail:
            "You authenticated with your passkey. That single action outranks every other source of evidence, including a government registry. The claim is closed and your plan returns to normal.",
          state: ctx.state,
          confidenceLevel: ctx.confidenceLevel,
          actor: "You",
        });
        return {
          steps,
          distribution: null,
          finalState: ctx.state,
          totalDays: item.dayOffset,
          halted: false,
          manualSteps: manualStepsFor(input.rules),
        };
      }
    }

    const result = transition(ctx, item.event(at));
    if (!result.ok) {
      steps.push({
        index: index++,
        at,
        dayOffset: item.dayOffset,
        title: item.title,
        detail: item.detail,
        state: ctx.state,
        confidenceLevel: ctx.confidenceLevel,
        actor: item.actor,
        blockedReason: result.error,
      });
      halted = true;
      haltReason = result.error;
      break;
    }
    ctx = result.value;
    steps.push({
      index: index++,
      at,
      dayOffset: item.dayOffset,
      title: item.title,
      detail: item.detail,
      state: ctx.state,
      confidenceLevel: ctx.confidenceLevel,
      actor: item.actor,
    });
  }

  const distribution =
    ctx.state === "COMPLETED" || ctx.state === "DISTRIBUTING"
      ? computeDistribution({
          snapshot: input.snapshot,
          allocations: input.allocations,
          beneficiaries: input.beneficiaries,
        })
      : null;

  return {
    steps,
    distribution,
    finalState: ctx.state,
    totalDays: steps[steps.length - 1]?.dayOffset ?? 0,
    halted,
    haltReason,
    manualSteps: manualStepsFor(input.rules),
  };
}

/**
 * What the simulation does NOT do automatically. Shown alongside the happy path, because a
 * user who believes an executor-enforced rule is automatic has been misled.
 */
function manualStepsFor(rules: readonly SuccessionRule[]): readonly string[] {
  const out: string[] = [];
  for (const rule of rules) {
    if (rule.enforcementTier === "LEGAL") {
      out.push(
        `"${rule.type.replace(/_/g, " ").toLowerCase()}" is carried out by your executor, not by code. It depends on your will and your executor acting on it.`,
      );
    }
    if (rule.enforcementTier === "ASSISTED") {
      out.push(
        `"${rule.type.replace(/_/g, " ").toLowerCase()}" needs someone to act. If we no longer exist, your timelock path applies instead.`,
      );
    }
  }
  return out;
}

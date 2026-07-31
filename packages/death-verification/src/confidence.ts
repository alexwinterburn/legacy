/**
 * Death Confidence Engine.
 *
 * Two design decisions distinguish this from a naive "confidence percentage":
 *
 *  1. **Independence classes.** Two pieces of evidence derived from the same underlying event
 *     (a death certificate and the registry entry it was issued from) are not independent
 *     corroboration. The engine refuses to count them as such, which is what makes Level 6
 *     mean something.
 *
 *  2. **Proof of life is dispositive.** An authenticated living user outranks every other source,
 *     including a government registry, because registries contain errors and a living person's
 *     signed session does not. This is a security property, not a courtesy.
 *
 * Confidence is *advisory input* to the succession policy predicate. It never triggers anything
 * on its own. See DECISIONS.md §1 (C2).
 */

import { daysBetween, type ISODate } from "@legacy/core";

export type ConfidenceLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const CONFIDENCE_LEVEL_META: Record<
  ConfidenceLevel,
  { label: string; description: string }
> = {
  0: { label: "No evidence", description: "Nothing suggests the account holder has died." },
  1: { label: "Extended inactivity", description: "No authenticated activity for an extended period." },
  2: { label: "Suspicious inactivity", description: "Prolonged inactivity plus unanswered contact across every channel." },
  3: { label: "Third-party notification", description: "Someone has reported a death. Unverified." },
  4: { label: "Documentary evidence", description: "A death certificate or equivalent document has been provided and checked." },
  5: { label: "Registry confirmation", description: "Confirmed against an official civil registration source." },
  6: { label: "Independently corroborated", description: "Confirmed by multiple genuinely independent sources." },
};

/**
 * The class of a source, used to decide whether two sources corroborate each other.
 * Sources in the same class are treated as correlated, however many of them there are.
 */
export type IndependenceClass =
  | "CIVIL_REGISTRY" // registry entries, death certificates — same underlying registration event
  | "MEDICAL" // hospital, attending physician, coroner
  | "JUDICIAL" // court order, presumption of death, executor appointment
  | "FINANCIAL" // bank/insurer notification, estate account activity
  | "SOCIAL" // family, employer, obituary
  | "BEHAVIOURAL" // platform inactivity, unanswered contact
  | "PLATFORM"; // our own systems

export type EvidenceOutcome = "CONFIRMS" | "CONTRADICTS" | "INCONCLUSIVE";

export interface Evidence {
  readonly id: string;
  readonly sourceType: string;
  readonly providerId: string;
  readonly independenceClass: IndependenceClass;
  readonly outcome: EvidenceOutcome;
  /** The level this evidence can support on its own. */
  readonly supportsLevel: ConfidenceLevel;
  /** 0..1 — quality of this particular piece of evidence. */
  readonly quality: number;
  readonly recordedAt: ISODate;
  /** After this date the evidence is stale and contributes nothing. */
  readonly staleAfter?: ISODate;
  readonly note?: string;
}

export interface ConfidenceInput {
  readonly evidence: readonly Evidence[];
  /** Last authenticated, deliberate proof-of-life. Not passive telemetry. */
  readonly lastProofOfLifeAt: ISODate;
  readonly inactivityThresholdDays: number;
  readonly now: ISODate;
  /** A dispute raised by the subject or their trusted contact. */
  readonly disputeOpen: boolean;
}

export interface ConfidenceAssessment {
  readonly level: ConfidenceLevel;
  readonly score: number; // 0..100, for display and triage only
  readonly independentClasses: readonly IndependenceClass[];
  readonly contributing: readonly { evidenceId: string; effect: string }[];
  readonly rationale: string;
  /** True when a living user has authenticated since the evidence was recorded. */
  readonly overriddenByProofOfLife: boolean;
}

const LEVEL_BASE_SCORE: Record<ConfidenceLevel, number> = {
  0: 0,
  1: 15,
  2: 30,
  3: 45,
  4: 70,
  5: 88,
  6: 97,
};

function isStale(e: Evidence, now: ISODate): boolean {
  return e.staleAfter !== undefined && new Date(now) > new Date(e.staleAfter);
}

export function assessConfidence(input: ConfidenceInput): ConfidenceAssessment {
  const contributing: { evidenceId: string; effect: string }[] = [];
  const active = input.evidence.filter((e) => {
    if (isStale(e, input.now)) {
      contributing.push({ evidenceId: e.id, effect: "ignored — stale" });
      return false;
    }
    return true;
  });

  // --- Proof of life is dispositive. -----------------------------------------------------------
  // If the subject authenticated after the most recent confirming evidence was recorded, the
  // evidence is wrong. A living person's signed session beats a database, every time.
  const confirming = active.filter((e) => e.outcome === "CONFIRMS");
  const latestConfirmingAt = confirming.reduce<number>(
    (acc, e) => Math.max(acc, new Date(e.recordedAt).getTime()),
    0,
  );
  const proofOfLifeMs = new Date(input.lastProofOfLifeAt).getTime();
  if (confirming.length > 0 && proofOfLifeMs > latestConfirmingAt) {
    return {
      level: 0,
      score: 0,
      independentClasses: [],
      contributing: [
        { evidenceId: "-", effect: "all evidence overridden by authenticated proof of life" },
      ],
      rationale:
        "The account holder authenticated after this evidence was recorded. Confidence is reset to zero.",
      overriddenByProofOfLife: true,
    };
  }

  // --- Contradicting evidence caps the achievable level. ---------------------------------------
  const contradicting = active.filter((e) => e.outcome === "CONTRADICTS");
  for (const c of contradicting) {
    contributing.push({ evidenceId: c.id, effect: "contradicts — caps confidence at level 2" });
  }

  // --- Behavioural baseline from inactivity. ---------------------------------------------------
  const inactiveDays = daysBetween(input.lastProofOfLifeAt, input.now);
  let level: ConfidenceLevel = 0;
  if (inactiveDays >= input.inactivityThresholdDays * 2) {
    level = 2;
    contributing.push({ evidenceId: "inactivity", effect: `level 2 — inactive ${Math.floor(inactiveDays)}d` });
  } else if (inactiveDays >= input.inactivityThresholdDays) {
    level = 1;
    contributing.push({ evidenceId: "inactivity", effect: `level 1 — inactive ${Math.floor(inactiveDays)}d` });
  }

  // --- Documentary and registry evidence. ------------------------------------------------------
  for (const e of confirming) {
    if (e.supportsLevel > level) {
      level = e.supportsLevel;
      contributing.push({
        evidenceId: e.id,
        effect: `raises to level ${e.supportsLevel} (${e.independenceClass})`,
      });
    } else {
      contributing.push({ evidenceId: e.id, effect: `corroborates at level ${e.supportsLevel}` });
    }
  }

  // --- Level 6 requires genuine independence. --------------------------------------------------
  // Two sources in the same class do not corroborate each other, however strong each one is.
  const independentClasses = [
    ...new Set(confirming.filter((e) => e.supportsLevel >= 3).map((e) => e.independenceClass)),
  ];
  if (level >= 4 && independentClasses.length >= 2) {
    level = 6;
    contributing.push({
      evidenceId: "-",
      effect: `level 6 — ${independentClasses.length} independent classes: ${independentClasses.join(", ")}`,
    });
  } else if (level >= 4 && independentClasses.length < 2) {
    contributing.push({
      evidenceId: "-",
      effect: "level 6 withheld — all confirming evidence is from a single independence class",
    });
  }

  if (contradicting.length > 0 && level > 2) {
    level = 2;
  }

  if (input.disputeOpen && level > 3) {
    level = 3;
    contributing.push({ evidenceId: "-", effect: "dispute open — confidence capped at level 3" });
  }

  // Score is a display/triage aid, weighted by evidence quality. It never drives a decision.
  const qualityFactor =
    confirming.length === 0
      ? 1
      : confirming.reduce((acc, e) => acc + e.quality, 0) / confirming.length;
  const score = Math.round(LEVEL_BASE_SCORE[level] * (0.7 + 0.3 * qualityFactor));

  return {
    level,
    score: Math.max(0, Math.min(100, score)),
    independentClasses,
    contributing,
    rationale: buildRationale(level, independentClasses, contradicting.length, input.disputeOpen),
    overriddenByProofOfLife: false,
  };
}

function buildRationale(
  level: ConfidenceLevel,
  classes: readonly IndependenceClass[],
  contradictions: number,
  disputeOpen: boolean,
): string {
  if (disputeOpen) return "A dispute is open. Confidence is capped until it is resolved.";
  if (contradictions > 0) return "Evidence contradicts the reported death. Confidence is capped at level 2.";
  if (level === 6) return `Independently corroborated across ${classes.length} unrelated source types.`;
  if (level >= 4) return "Documentary evidence has been checked, but corroboration comes from a single class of source.";
  if (level === 3) return "A death has been reported but nothing has been verified yet.";
  if (level >= 1) return "Only behavioural signals so far. Inactivity alone is weak evidence.";
  return "No evidence of death.";
}

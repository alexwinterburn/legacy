/**
 * Succession Fraud Engine.
 *
 * The signature attack this defends against: change the beneficiary to an attacker-controlled
 * address, then report the account holder dead. Every other rule here is supporting fire for
 * that one. See THREAT-MODEL.md T3.
 *
 * Scores are advisory. A high score never releases anything and never blocks a living user from
 * proving they're alive — it extends cooling-off and forces human review.
 */

import { daysBetween, type ISODate } from "@legacy/core";

export type FraudSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface FraudSignals {
  readonly now: ISODate;
  /** When beneficiaries or their payout addresses were last changed. */
  readonly lastBeneficiaryChangeAt?: ISODate;
  readonly lastDestinationAddressChangeAt?: ISODate;
  readonly deathClaimAt?: ISODate;
  /** Claims opened against this subject in the last 90 days. */
  readonly deathClaimsLast90Days: number;
  /** Whether the claimant was a pre-registered beneficiary. */
  readonly claimantIsRegisteredBeneficiary: boolean;
  readonly claimantIdentityVerified: boolean;
  readonly newDevicesLast30Days: number;
  readonly failedAuthLast7Days: number;
  /** Distinct countries the account was accessed from in the last 30 days. */
  readonly distinctLoginCountriesLast30Days: number;
  readonly loginCountryMatchesResidence: boolean;
  /** Total share reallocated in the most recent change, in basis points. */
  readonly reallocatedBasisPoints: number;
  /** A change that concentrated the estate onto one new party. */
  readonly concentrationIncreasedToSingleParty: boolean;
  readonly passwordChangedLast30Days: boolean;
  readonly mfaRemovedLast30Days: boolean;
  readonly coolingOffReducedRecently: boolean;
}

export interface FraudFinding {
  readonly ruleId: string;
  readonly title: string;
  readonly severity: FraudSeverity;
  readonly score: number;
  readonly explanation: string;
}

export interface FraudAssessment {
  readonly score: number; // 0..100
  readonly severity: FraudSeverity;
  readonly findings: readonly FraudFinding[];
  readonly recommendation: string;
  readonly shouldHold: boolean;
  readonly recommendedCoolingOffExtensionDays: number;
}

export const FRAUD_HOLD_THRESHOLD = 60;

/**
 * Time-decayed weight: full weight if the two events are simultaneous, decaying to zero over
 * `windowDays`. A beneficiary change two years before a death claim is unremarkable; the same
 * change 18 hours before is the whole ballgame.
 */
function proximityWeight(changeAt: ISODate, claimAt: ISODate, windowDays: number): number {
  const gap = daysBetween(changeAt, claimAt);
  if (gap < 0) return 0; // change came after the claim; handled by a different rule
  if (gap > windowDays) return 0;
  return 1 - gap / windowDays;
}

export function assessFraud(signals: FraudSignals): FraudAssessment {
  const findings: FraudFinding[] = [];

  // --- R1: beneficiary change immediately before a death claim. The primary rule. ---------------
  if (signals.lastBeneficiaryChangeAt && signals.deathClaimAt) {
    const w = proximityWeight(signals.lastBeneficiaryChangeAt, signals.deathClaimAt, 90);
    if (w > 0) {
      const score = Math.round(45 * w);
      const gapDays = Math.max(0, daysBetween(signals.lastBeneficiaryChangeAt, signals.deathClaimAt));
      findings.push({
        ruleId: "R1_RECENT_BENEFICIARY_CHANGE",
        title: "Beneficiaries changed shortly before the death claim",
        severity: score >= 30 ? "CRITICAL" : score >= 15 ? "HIGH" : "MEDIUM",
        score,
        explanation: `Beneficiaries were changed ${gapDays < 1 ? "less than a day" : `${Math.floor(gapDays)} days`} before this claim was opened.`,
      });
    }
  }

  // --- R2: payout address change immediately before a claim. -----------------------------------
  if (signals.lastDestinationAddressChangeAt && signals.deathClaimAt) {
    const w = proximityWeight(signals.lastDestinationAddressChangeAt, signals.deathClaimAt, 60);
    if (w > 0) {
      const score = Math.round(35 * w);
      findings.push({
        ruleId: "R2_RECENT_ADDRESS_CHANGE",
        title: "Payout address changed shortly before the death claim",
        severity: score >= 25 ? "CRITICAL" : "HIGH",
        score,
        explanation: "A destination address was changed within the window preceding this claim.",
      });
    }
  }

  // --- R3: concentration onto a single new party. ----------------------------------------------
  if (signals.concentrationIncreasedToSingleParty) {
    findings.push({
      ruleId: "R3_CONCENTRATION",
      title: "Estate concentrated onto a single party",
      severity: "HIGH",
      score: 20,
      explanation: "A recent change moved a large share of the estate to one newly added party.",
    });
  }

  // --- R4: large reallocation. -----------------------------------------------------------------
  if (signals.reallocatedBasisPoints >= 5000) {
    findings.push({
      ruleId: "R4_LARGE_REALLOCATION",
      title: "Majority of the estate reallocated",
      severity: "MEDIUM",
      score: 12,
      explanation: `${(signals.reallocatedBasisPoints / 100).toFixed(0)}% of the estate was reallocated in a single change.`,
    });
  }

  // --- R5: repeated death claims. --------------------------------------------------------------
  if (signals.deathClaimsLast90Days > 1) {
    const score = Math.min(25, 10 * (signals.deathClaimsLast90Days - 1));
    findings.push({
      ruleId: "R5_REPEATED_CLAIMS",
      title: "Multiple death claims in a short window",
      severity: score >= 20 ? "HIGH" : "MEDIUM",
      score,
      explanation: `${signals.deathClaimsLast90Days} claims have been opened against this account in 90 days.`,
    });
  }

  // --- R6: unregistered claimant. --------------------------------------------------------------
  if (signals.deathClaimAt && !signals.claimantIsRegisteredBeneficiary) {
    findings.push({
      ruleId: "R6_UNREGISTERED_CLAIMANT",
      title: "Claim from someone not named in the plan",
      severity: "MEDIUM",
      score: 15,
      explanation: "The claimant is not a registered beneficiary or verified executor.",
    });
  }

  // --- R7: unverified claimant identity. -------------------------------------------------------
  if (signals.deathClaimAt && !signals.claimantIdentityVerified) {
    findings.push({
      ruleId: "R7_UNVERIFIED_CLAIMANT",
      title: "Claimant identity not verified",
      severity: "MEDIUM",
      score: 10,
      explanation: "The claimant has not completed identity verification.",
    });
  }

  // --- R8: account takeover indicators. --------------------------------------------------------
  const takeoverScore =
    (signals.newDevicesLast30Days > 1 ? 8 : 0) +
    (signals.failedAuthLast7Days > 5 ? 8 : 0) +
    (signals.passwordChangedLast30Days ? 6 : 0) +
    (signals.mfaRemovedLast30Days ? 15 : 0);
  if (takeoverScore > 0) {
    findings.push({
      ruleId: "R8_ACCOUNT_TAKEOVER_INDICATORS",
      title: "Signs of account takeover",
      severity: takeoverScore >= 20 ? "HIGH" : "MEDIUM",
      score: takeoverScore,
      explanation: [
        signals.mfaRemovedLast30Days ? "MFA was removed" : null,
        signals.passwordChangedLast30Days ? "password changed" : null,
        signals.newDevicesLast30Days > 1 ? `${signals.newDevicesLast30Days} new devices` : null,
        signals.failedAuthLast7Days > 5 ? `${signals.failedAuthLast7Days} failed sign-ins` : null,
      ]
        .filter(Boolean)
        .join(", ") + " in the recent window.",
    });
  }

  // --- R9: geographic anomaly. -----------------------------------------------------------------
  if (signals.distinctLoginCountriesLast30Days > 3 || !signals.loginCountryMatchesResidence) {
    const score = signals.distinctLoginCountriesLast30Days > 3 ? 10 : 6;
    findings.push({
      ruleId: "R9_GEOGRAPHIC_ANOMALY",
      title: "Unusual access locations",
      severity: "LOW",
      score,
      explanation: `Access from ${signals.distinctLoginCountriesLast30Days} countries in 30 days${
        signals.loginCountryMatchesResidence ? "" : ", none matching the country of residence"
      }.`,
    });
  }

  // --- R10: attempt to weaken the safety delay. ------------------------------------------------
  if (signals.coolingOffReducedRecently) {
    findings.push({
      ruleId: "R10_SAFETY_WEAKENED",
      title: "Attempt to shorten the cooling-off period",
      severity: "HIGH",
      score: 18,
      explanation:
        "An attempt was made to reduce the cooling-off period. Reductions are refused, but the attempt itself is a strong signal.",
    });
  }

  const raw = findings.reduce((acc, f) => acc + f.score, 0);
  const score = Math.min(100, raw);
  const severity: FraudSeverity =
    score >= 75 ? "CRITICAL" : score >= FRAUD_HOLD_THRESHOLD ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";

  return {
    score,
    severity,
    findings: [...findings].sort((a, b) => b.score - a.score),
    shouldHold: score >= FRAUD_HOLD_THRESHOLD,
    recommendedCoolingOffExtensionDays: score >= 75 ? 90 : score >= FRAUD_HOLD_THRESHOLD ? 60 : score >= 25 ? 30 : 0,
    recommendation: recommendationFor(score),
  };
}

function recommendationFor(score: number): string {
  if (score >= 75) {
    return "Place on hold. Notify the account holder and the previous beneficiaries on every channel. Require independent verification of both the claimant and the death before anything proceeds.";
  }
  if (score >= FRAUD_HOLD_THRESHOLD) {
    return "Place on hold and extend the cooling-off period. Escalate to manual review and re-verify the claimant's identity.";
  }
  if (score >= 25) {
    return "Proceed with an extended cooling-off period and additional notification attempts.";
  }
  return "Proceed under the standard process.";
}

import { describe, expect, it } from "vitest";
import { addDays } from "@legacy/core";
import { FRAUD_HOLD_THRESHOLD, assessFraud, type FraudSignals } from "../src/index";

const T0 = "2026-01-01T00:00:00.000Z";

function signals(overrides: Partial<FraudSignals> = {}): FraudSignals {
  return {
    now: T0,
    deathClaimsLast90Days: 0,
    claimantIsRegisteredBeneficiary: true,
    claimantIdentityVerified: true,
    newDevicesLast30Days: 0,
    failedAuthLast7Days: 0,
    distinctLoginCountriesLast30Days: 1,
    loginCountryMatchesResidence: true,
    reallocatedBasisPoints: 0,
    concentrationIncreasedToSingleParty: false,
    passwordChangedLast30Days: false,
    mfaRemovedLast30Days: false,
    coolingOffReducedRecently: false,
    ...overrides,
  };
}

describe("the signature attack: beneficiary change then death claim", () => {
  it("scores a hold when a beneficiary change is followed by a claim within 24 hours", () => {
    // The exact scenario from the brief: "Wife 50%" changed to "Unknown wallet 100%",
    // then a death claim 24 hours later.
    const result = assessFraud(
      signals({
        lastBeneficiaryChangeAt: T0,
        lastDestinationAddressChangeAt: T0,
        deathClaimAt: addDays(T0, 1),
        reallocatedBasisPoints: 10_000,
        concentrationIncreasedToSingleParty: true,
        claimantIsRegisteredBeneficiary: false,
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(FRAUD_HOLD_THRESHOLD);
    expect(result.shouldHold).toBe(true);
    expect(result.severity).toBe("CRITICAL");
    expect(result.findings[0]?.ruleId).toBe("R1_RECENT_BENEFICIARY_CHANGE");
    expect(result.recommendedCoolingOffExtensionDays).toBeGreaterThan(0);
  });

  it("decays the signal as the gap widens", () => {
    const near = assessFraud(signals({ lastBeneficiaryChangeAt: T0, deathClaimAt: addDays(T0, 2) }));
    const mid = assessFraud(signals({ lastBeneficiaryChangeAt: T0, deathClaimAt: addDays(T0, 45) }));
    const far = assessFraud(signals({ lastBeneficiaryChangeAt: T0, deathClaimAt: addDays(T0, 200) }));

    expect(near.score).toBeGreaterThan(mid.score);
    expect(mid.score).toBeGreaterThan(far.score);
    // A change 200 days before a claim is unremarkable.
    expect(far.findings.some((f) => f.ruleId === "R1_RECENT_BENEFICIARY_CHANGE")).toBe(false);
  });

  it("ignores a change that happened after the claim was opened", () => {
    const result = assessFraud(signals({ lastBeneficiaryChangeAt: addDays(T0, 10), deathClaimAt: T0 }));
    expect(result.findings.some((f) => f.ruleId === "R1_RECENT_BENEFICIARY_CHANGE")).toBe(false);
  });
});

describe("ordinary usage is not penalised", () => {
  it("scores near zero for a legitimate long-standing plan", () => {
    const result = assessFraud(
      signals({ lastBeneficiaryChangeAt: addDays(T0, -800), deathClaimAt: T0 }),
    );
    expect(result.score).toBeLessThan(25);
    expect(result.shouldHold).toBe(false);
    expect(result.severity).toBe("LOW");
  });

  it("scores zero with no claim and no changes", () => {
    expect(assessFraud(signals()).score).toBe(0);
  });
});

describe("account takeover indicators", () => {
  it("weights MFA removal most heavily", () => {
    const withMfaRemoved = assessFraud(signals({ mfaRemovedLast30Days: true }));
    const withPasswordChange = assessFraud(signals({ passwordChangedLast30Days: true }));
    expect(withMfaRemoved.score).toBeGreaterThan(withPasswordChange.score);
  });

  it("accumulates multiple weak indicators", () => {
    const result = assessFraud(
      signals({
        mfaRemovedLast30Days: true,
        passwordChangedLast30Days: true,
        newDevicesLast30Days: 3,
        failedAuthLast7Days: 12,
      }),
    );
    const finding = result.findings.find((f) => f.ruleId === "R8_ACCOUNT_TAKEOVER_INDICATORS");
    expect(finding?.severity).toBe("HIGH");
  });
});

describe("other rules", () => {
  it("flags repeated claims", () => {
    const result = assessFraud(signals({ deathClaimsLast90Days: 3, deathClaimAt: T0 }));
    expect(result.findings.some((f) => f.ruleId === "R5_REPEATED_CLAIMS")).toBe(true);
  });

  it("flags an attempt to shorten the cooling-off period", () => {
    const result = assessFraud(signals({ coolingOffReducedRecently: true }));
    const finding = result.findings.find((f) => f.ruleId === "R10_SAFETY_WEAKENED");
    expect(finding?.severity).toBe("HIGH");
  });

  it("flags an unregistered, unverified claimant", () => {
    const result = assessFraud(
      signals({ deathClaimAt: T0, claimantIsRegisteredBeneficiary: false, claimantIdentityVerified: false }),
    );
    expect(result.findings.some((f) => f.ruleId === "R6_UNREGISTERED_CLAIMANT")).toBe(true);
    expect(result.findings.some((f) => f.ruleId === "R7_UNVERIFIED_CLAIMANT")).toBe(true);
  });
});

describe("scoring behaviour", () => {
  it("caps at 100 and sorts findings by weight", () => {
    const result = assessFraud(
      signals({
        lastBeneficiaryChangeAt: T0,
        lastDestinationAddressChangeAt: T0,
        deathClaimAt: T0,
        deathClaimsLast90Days: 5,
        claimantIsRegisteredBeneficiary: false,
        claimantIdentityVerified: false,
        mfaRemovedLast30Days: true,
        passwordChangedLast30Days: true,
        newDevicesLast30Days: 5,
        failedAuthLast7Days: 20,
        distinctLoginCountriesLast30Days: 6,
        loginCountryMatchesResidence: false,
        reallocatedBasisPoints: 10_000,
        concentrationIncreasedToSingleParty: true,
        coolingOffReducedRecently: true,
      }),
    );
    expect(result.score).toBe(100);
    for (let i = 1; i < result.findings.length; i++) {
      expect(result.findings[i - 1]!.score).toBeGreaterThanOrEqual(result.findings[i]!.score);
    }
  });

  it("always returns an actionable recommendation", () => {
    for (const s of [signals(), signals({ mfaRemovedLast30Days: true }), signals({ lastBeneficiaryChangeAt: T0, deathClaimAt: T0 })]) {
      expect(assessFraud(s).recommendation.length).toBeGreaterThan(10);
    }
  });
});

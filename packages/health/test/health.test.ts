import { describe, expect, it } from "vitest";
import { addDays } from "@legacy/core";
import { makeRule } from "@legacy/succession";
import { CONTINUITY_CAP, GREEN_THRESHOLD, computeHealth, type HealthInput } from "../src/index";

const NOW = "2026-07-31T12:00:00.000Z";

/** A near-perfect plan, used to isolate the effect of each component. */
function perfect(overrides: Partial<HealthInput> = {}): HealthInput {
  return {
    beneficiaryCount: 3,
    allocationBasisPoints: 10_000,
    beneficiariesWithVerifiedContact: 3,
    walletCount: 2,
    provenWalletCount: 2,
    observedWalletCount: 2,
    rules: [
      makeRule({ id: "r1", type: "PERCENTAGE", appliesToChains: ["bitcoin"] }),
      makeRule({ id: "r2", type: "TIMELOCK_DELAY", appliesToChains: ["bitcoin"] }),
    ],
    continuityPackExportedAt: addDays(NOW, -30),
    countryVerificationTier: "AUTOMATED",
    passkeyEnabled: true,
    mfaEnabled: true,
    registeredDeviceCount: 2,
    lastProofOfLifeAt: addDays(NOW, -3),
    proofOfLifeIntervalDays: 90,
    estateDocumentCount: 3,
    executorNominated: true,
    identityVerified: true,
    keysGeographicallySeparated: true,
    now: NOW,
    ...overrides,
  };
}

describe("the Continuity Pack gate", () => {
  it("caps the score below green until the pack is exported", () => {
    const result = computeHealth(perfect({ continuityPackExportedAt: undefined }));
    expect(result.cappedByContinuityPack).toBe(true);
    expect(result.score).toBe(CONTINUITY_CAP);
    expect(result.score).toBeLessThan(GREEN_THRESHOLD);
    expect(result.band).not.toBe("green");
  });

  it("explains the cap in terms of dependency on us", () => {
    const result = computeHealth(perfect({ continuityPackExportedAt: undefined }));
    expect(result.summary).toMatch(/depends on us existing/);
  });

  it("allows green once the pack is exported", () => {
    const result = computeHealth(perfect());
    expect(result.cappedByContinuityPack).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(GREEN_THRESHOLD);
    expect(result.band).toBe("green");
  });

  it("reports export state independently of whether the cap is biting", () => {
    // Regression: callers must not infer "exported" from "not capped". An incomplete plan scores
    // below the cap, so the cap isn't biting — but the pack still hasn't been exported, and a UI
    // branching on `cappedByContinuityPack` would wrongly tell the user they're covered.
    const incompleteAndNotExported = computeHealth(
      perfect({
        continuityPackExportedAt: undefined,
        beneficiaryCount: 0,
        allocationBasisPoints: 0,
        beneficiariesWithVerifiedContact: 0,
        walletCount: 0,
        provenWalletCount: 0,
        observedWalletCount: 0,
        rules: [],
      }),
    );
    expect(incompleteAndNotExported.score).toBeLessThan(CONTINUITY_CAP);
    expect(incompleteAndNotExported.cappedByContinuityPack).toBe(false);
    expect(incompleteAndNotExported.continuityPackExported).toBe(false);

    expect(computeHealth(perfect()).continuityPackExported).toBe(true);
  });

  it("partially credits a stale pack", () => {
    const fresh = computeHealth(perfect({ continuityPackExportedAt: addDays(NOW, -30) }));
    const stale = computeHealth(perfect({ continuityPackExportedAt: addDays(NOW, -500) }));
    expect(stale.score).toBeLessThan(fresh.score);
    expect(stale.components.find((c) => c.id === "continuity_pack")!.status).toBe("PARTIAL");
  });
});

describe("component scoring", () => {
  it("penalises an incomplete allocation", () => {
    const result = computeHealth(perfect({ allocationBasisPoints: 7500 }));
    const component = result.components.find((c) => c.id === "beneficiaries")!;
    expect(component.status).toBe("PARTIAL");
    expect(component.remediation).toContain("25%");
  });

  it("distinguishes proven ownership from mere observation", () => {
    const proven = computeHealth(perfect({ provenWalletCount: 2, observedWalletCount: 2 }));
    const observedOnly = computeHealth(perfect({ provenWalletCount: 0, observedWalletCount: 2 }));
    expect(observedOnly.score).toBeLessThan(proven.score);
    expect(observedOnly.components.find((c) => c.id === "asset_proof")!.remediation).toMatch(
      /isn't proof you control it/,
    );
  });

  it("penalises a plan whose rules are all executor-enforced", () => {
    const legalOnly = computeHealth(
      perfect({ rules: [makeRule({ id: "r", type: "AGE_BASED", appliesToChains: ["bitcoin"] })] }),
    );
    const component = legalOnly.components.find((c) => c.id === "cryptographic")!;
    expect(component.status).toBe("MISSING");
    expect(component.remediation).toMatch(/depend on people rather than code/);
  });

  it("decays the proof-of-life component over time", () => {
    const recent = computeHealth(perfect({ lastProofOfLifeAt: addDays(NOW, -3) }));
    const stale = computeHealth(perfect({ lastProofOfLifeAt: addDays(NOW, -200) }));
    expect(stale.score).toBeLessThan(recent.score);
    expect(stale.components.find((c) => c.id === "proof_of_life")!.remediation).toMatch(/reset your inactivity clock/);
  });

  it("gives partial credit for manual-verification countries rather than zero", () => {
    const manual = computeHealth(perfect({ countryVerificationTier: "MANUAL" }));
    const component = manual.components.find((c) => c.id === "verification_coverage")!;
    expect(component.earned).toBeGreaterThan(0);
    expect(component.remediation).toMatch(/trusted contact/);
  });

  it("prioritises a passkey in the security remediation", () => {
    const result = computeHealth(perfect({ passkeyEnabled: false }));
    expect(result.components.find((c) => c.id === "security")!.remediation).toMatch(/passkey/i);
  });
});

describe("overall behaviour", () => {
  it("scores an empty plan in the red band", () => {
    const result = computeHealth(
      perfect({
        beneficiaryCount: 0,
        allocationBasisPoints: 0,
        beneficiariesWithVerifiedContact: 0,
        walletCount: 0,
        provenWalletCount: 0,
        observedWalletCount: 0,
        rules: [],
        continuityPackExportedAt: undefined,
        passkeyEnabled: false,
        mfaEnabled: false,
        registeredDeviceCount: 0,
        estateDocumentCount: 0,
        executorNominated: false,
        identityVerified: false,
        keysGeographicallySeparated: false,
      }),
    );
    expect(result.band).toBe("red");
    expect(result.score).toBeLessThan(30);
  });

  it("keeps the score within 0-100", () => {
    expect(computeHealth(perfect()).score).toBeLessThanOrEqual(100);
    expect(computeHealth(perfect()).score).toBeGreaterThanOrEqual(0);
  });

  it("surfaces actionable next steps, never bare deductions", () => {
    const result = computeHealth(perfect({ continuityPackExportedAt: undefined, passkeyEnabled: false }));
    expect(result.topActions.length).toBeGreaterThan(0);
    for (const action of result.topActions) {
      expect(action.remediation.length).toBeGreaterThan(10);
      expect(action.href).toBeTruthy();
    }
  });

  it("weights sum to a consistent total", () => {
    const result = computeHealth(perfect());
    expect(result.components.reduce((acc, c) => acc + c.weight, 0)).toBe(100);
  });
});

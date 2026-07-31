import { describe, expect, it } from "vitest";
import { addDays } from "@legacy/core";
import { assessConfidence, type Evidence } from "../src/confidence";
import { allProviders, providerForCountry } from "../src/providers";
import { coverageSummary, globalCoverage, project } from "../src/coverage";

const T0 = "2026-01-01T00:00:00.000Z";

function evidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: "e1",
    sourceType: "DEATH_CERTIFICATE",
    providerId: "za-default",
    independenceClass: "CIVIL_REGISTRY",
    outcome: "CONFIRMS",
    supportsLevel: 4,
    quality: 0.9,
    recordedAt: T0,
    ...overrides,
  };
}

const baseInput = {
  lastProofOfLifeAt: addDays(T0, -400),
  inactivityThresholdDays: 180,
  now: addDays(T0, 1),
  disputeOpen: false,
};

describe("proof of life is dispositive", () => {
  it("resets confidence to zero when the subject authenticates after the evidence", () => {
    const result = assessConfidence({
      ...baseInput,
      evidence: [evidence({ supportsLevel: 5, independenceClass: "CIVIL_REGISTRY" })],
      // The subject signed in the day AFTER the death certificate was recorded.
      lastProofOfLifeAt: addDays(T0, 1),
      now: addDays(T0, 2),
    });
    expect(result.level).toBe(0);
    expect(result.score).toBe(0);
    expect(result.overriddenByProofOfLife).toBe(true);
  });

  it("does not override when the proof of life predates the evidence", () => {
    const result = assessConfidence({
      ...baseInput,
      evidence: [evidence()],
      lastProofOfLifeAt: addDays(T0, -10),
      now: addDays(T0, 2),
    });
    expect(result.overriddenByProofOfLife).toBe(false);
    expect(result.level).toBeGreaterThanOrEqual(4);
  });
});

describe("source independence", () => {
  it("refuses level 6 when all evidence is from a single class", () => {
    // A death certificate AND a registry entry both derive from the same registration event.
    const result = assessConfidence({
      ...baseInput,
      evidence: [
        evidence({ id: "e1", independenceClass: "CIVIL_REGISTRY", supportsLevel: 4 }),
        evidence({ id: "e2", independenceClass: "CIVIL_REGISTRY", supportsLevel: 5 }),
      ],
    });
    expect(result.level).toBe(5);
    expect(result.contributing.some((c) => c.effect.includes("level 6 withheld"))).toBe(true);
  });

  it("reaches level 6 with genuinely independent classes", () => {
    const result = assessConfidence({
      ...baseInput,
      evidence: [
        evidence({ id: "e1", independenceClass: "CIVIL_REGISTRY", supportsLevel: 4 }),
        evidence({ id: "e2", independenceClass: "MEDICAL", supportsLevel: 4 }),
      ],
    });
    expect(result.level).toBe(6);
    expect(result.independentClasses).toHaveLength(2);
  });
});

describe("contradiction and dispute handling", () => {
  it("caps confidence at level 2 when evidence contradicts", () => {
    const result = assessConfidence({
      ...baseInput,
      evidence: [
        evidence({ id: "e1", supportsLevel: 5 }),
        evidence({ id: "e2", outcome: "CONTRADICTS", independenceClass: "SOCIAL" }),
      ],
    });
    expect(result.level).toBeLessThanOrEqual(2);
  });

  it("caps confidence at level 3 while a dispute is open", () => {
    const result = assessConfidence({
      ...baseInput,
      evidence: [
        evidence({ id: "e1", independenceClass: "CIVIL_REGISTRY" }),
        evidence({ id: "e2", independenceClass: "MEDICAL" }),
      ],
      disputeOpen: true,
    });
    expect(result.level).toBe(3);
  });
});

describe("staleness and inactivity", () => {
  it("ignores stale evidence", () => {
    const result = assessConfidence({
      ...baseInput,
      evidence: [evidence({ staleAfter: addDays(T0, 5) })],
      now: addDays(T0, 30),
      lastProofOfLifeAt: addDays(T0, -10),
      inactivityThresholdDays: 3650, // suppress the inactivity contribution
    });
    expect(result.level).toBe(0);
    expect(result.contributing.some((c) => c.effect.includes("stale"))).toBe(true);
  });

  it("raises confidence from inactivity alone, but only to level 1 or 2", () => {
    const mild = assessConfidence({
      ...baseInput,
      evidence: [],
      lastProofOfLifeAt: addDays(T0, -200),
      inactivityThresholdDays: 180,
      now: T0,
    });
    expect(mild.level).toBe(1);

    const severe = assessConfidence({
      ...baseInput,
      evidence: [],
      lastProofOfLifeAt: addDays(T0, -400),
      inactivityThresholdDays: 180,
      now: T0,
    });
    expect(severe.level).toBe(2);
  });

  it("gives level 0 for an active user with no evidence", () => {
    const result = assessConfidence({
      ...baseInput,
      evidence: [],
      lastProofOfLifeAt: addDays(T0, -5),
      now: T0,
    });
    expect(result.level).toBe(0);
  });
});

describe("providers", () => {
  it("never claims a licensed feed we do not hold", () => {
    for (const p of allProviders()) {
      expect(p.capabilities.hasLicensedFeed).toBe(false);
    }
  });

  it("falls back to manual verification for unknown countries", () => {
    const p = providerForCountry("XX", "Nowhere");
    expect(p.tier).toBe("MANUAL");
    expect(p.capabilities.methods.length).toBeGreaterThan(0);
  });

  it("documents the real barriers for countries where a feed exists", () => {
    expect(providerForCountry("US").feedBarriers).toMatch(/NTIS|certification/i);
    expect(providerForCountry("GB").feedBarriers).toMatch(/licence|assessment/i);
  });

  it("marks South Africa as manual, document-led verification", () => {
    expect(providerForCountry("ZA").tier).toBe("MANUAL");
  });
});

describe("coverage", () => {
  it("summarises tiers consistently", () => {
    const summary = coverageSummary();
    expect(summary.automated + summary.partial + summary.manual).toBe(summary.total);
    // No country is AUTOMATED, because we hold no licensed feeds.
    expect(summary.automated).toBe(0);
  });

  it("flags forced-heirship jurisdictions", () => {
    const all = globalCoverage();
    expect(all.find((c) => c.code === "FR")?.forcedHeirship).toBe(true);
    expect(all.find((c) => c.code === "ZA")?.forcedHeirship).toBe(false);
  });

  it("projects coordinates into the unit square", () => {
    expect(project(0, 0)).toEqual({ x: 0.5, y: 0.5 });
    const za = project(-30.6, 22.9);
    expect(za.x).toBeGreaterThan(0.5);
    expect(za.y).toBeGreaterThan(0.5);
  });
});

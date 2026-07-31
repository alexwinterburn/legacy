import { describe, expect, it } from "vitest";
import { addDays } from "@legacy/core";
import {
  TransparencyLog,
  buildAttestationPayload,
  evaluateQuorum,
  generateAttestorKey,
  signAttestation,
  verifyAttestation,
  type AttestorKey,
} from "../src/index";

const T0 = "2026-01-01T00:00:00.000Z";

function makeAttestation(key: AttestorKey, overrides: Partial<Parameters<typeof buildAttestationPayload>[0]> = {}) {
  const payload = buildAttestationPayload({
    subjectId: "user-1",
    planId: "plan-1",
    chainId: "bitcoin-mainnet",
    confidenceLevel: 5,
    sourceClasses: ["CIVIL_REGISTRY"],
    evidenceHashes: ["abc123"],
    assertedAt: T0,
    nonce: "nonce-1",
    ...overrides,
  });
  return signAttestation(payload, key, T0);
}

describe("attestation signing and verification", () => {
  it("verifies a well-formed attestation", () => {
    const key = generateAttestorKey("k1", "PLATFORM");
    const att = makeAttestation(key);
    expect(verifyAttestation(att, key.publicKeyPem, addDays(T0, 1)).valid).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const key = generateAttestorKey("k1", "PLATFORM");
    const att = makeAttestation(key);
    const tampered = { ...att, payload: { ...att.payload, confidenceLevel: 6 as const } };
    expect(verifyAttestation(tampered, key.publicKeyPem, addDays(T0, 1)).valid).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const key = generateAttestorKey("k1", "PLATFORM");
    const other = generateAttestorKey("k2", "JUDICIAL");
    const att = makeAttestation(key);
    const result = verifyAttestation(att, other.publicKeyPem, addDays(T0, 1));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Signature/);
  });

  it("rejects an expired attestation", () => {
    const key = generateAttestorKey("k1", "PLATFORM");
    const att = makeAttestation(key, { validityDays: 30 });
    expect(verifyAttestation(att, key.publicKeyPem, addDays(T0, 60)).valid).toBe(false);
  });

  it("asserts evidence, never an instruction to release funds", () => {
    const key = generateAttestorKey("k1", "PLATFORM");
    const att = makeAttestation(key);
    expect(att.payload.statement).toMatch(/confers no authority to move assets/);
    expect(JSON.stringify(att.payload)).not.toMatch(/release|transfer|pay/i);
  });
});

describe("transparency log", () => {
  it("chains entries and detects rewriting", () => {
    const key = generateAttestorKey("k1", "PLATFORM");
    const log = new TransparencyLog(7);
    log.publish(makeAttestation(key, { nonce: "n1" }), T0);
    log.publish(makeAttestation(key, { nonce: "n2" }), addDays(T0, 1));
    expect(log.verifyChain().valid).toBe(true);
    expect(log.head().index).toBe(1);
  });

  it("makes an attestation actionable only after the publish delay", () => {
    const key = generateAttestorKey("k1", "PLATFORM");
    const log = new TransparencyLog(7);
    const entry = log.publish(makeAttestation(key), T0);
    expect(new Date(entry.actionableAt).getTime()).toBeGreaterThan(new Date(T0).getTime());
  });
});

describe("quorum", () => {
  const policy = { requiredAttestors: 2, requiredDistinctClasses: 2, minimumConfidenceLevel: 4 as const };

  it("refuses a single signer", () => {
    const key = generateAttestorKey("k1", "PLATFORM");
    const log = new TransparencyLog(7);
    log.publish(makeAttestation(key), T0);
    const result = evaluateQuorum({
      entries: log.all(),
      keys: [key],
      policy,
      now: addDays(T0, 30),
      subjectId: "user-1",
      planId: "plan-1",
    });
    expect(result.satisfied).toBe(false);
    expect(result.reasons.some((r) => r.includes("2 attestors required"))).toBe(true);
  });

  it("refuses two signatures from the same key — no self-quorum", () => {
    const key = generateAttestorKey("k1", "PLATFORM");
    const log = new TransparencyLog(7);
    log.publish(makeAttestation(key, { nonce: "n1" }), T0);
    log.publish(makeAttestation(key, { nonce: "n2" }), T0);
    const result = evaluateQuorum({
      entries: log.all(),
      keys: [key],
      policy,
      now: addDays(T0, 30),
      subjectId: "user-1",
      planId: "plan-1",
    });
    expect(result.validAttestations).toBe(1);
    expect(result.satisfied).toBe(false);
  });

  it("refuses two signers from the same independence class", () => {
    const a = generateAttestorKey("k1", "PLATFORM");
    const b = generateAttestorKey("k2", "PLATFORM");
    const log = new TransparencyLog(7);
    log.publish(makeAttestation(a), T0);
    log.publish(makeAttestation(b), T0);
    const result = evaluateQuorum({
      entries: log.all(),
      keys: [a, b],
      policy,
      now: addDays(T0, 30),
      subjectId: "user-1",
      planId: "plan-1",
    });
    expect(result.validAttestations).toBe(2);
    expect(result.satisfied).toBe(false);
    expect(result.reasons.some((r) => r.includes("independent source classes"))).toBe(true);
  });

  it("is satisfied by two independent signers", () => {
    const a = generateAttestorKey("k1", "PLATFORM");
    const b = generateAttestorKey("k2", "JUDICIAL");
    const log = new TransparencyLog(7);
    log.publish(makeAttestation(a), T0);
    log.publish(makeAttestation(b), T0);
    const result = evaluateQuorum({
      entries: log.all(),
      keys: [a, b],
      policy,
      now: addDays(T0, 30),
      subjectId: "user-1",
      planId: "plan-1",
    });
    expect(result.satisfied).toBe(true);
    expect(result.actionable).toBe(true);
  });

  it("is satisfied but NOT actionable before the publish delay elapses", () => {
    const a = generateAttestorKey("k1", "PLATFORM");
    const b = generateAttestorKey("k2", "JUDICIAL");
    const log = new TransparencyLog(7);
    log.publish(makeAttestation(a), T0);
    log.publish(makeAttestation(b), T0);
    const result = evaluateQuorum({
      entries: log.all(),
      keys: [a, b],
      policy,
      now: addDays(T0, 2), // inside the 7-day publish delay
      subjectId: "user-1",
      planId: "plan-1",
    });
    expect(result.satisfied).toBe(true);
    expect(result.actionable).toBe(false);
  });

  it("rejects replay onto a different plan", () => {
    const a = generateAttestorKey("k1", "PLATFORM");
    const b = generateAttestorKey("k2", "JUDICIAL");
    const log = new TransparencyLog(7);
    log.publish(makeAttestation(a), T0);
    log.publish(makeAttestation(b), T0);
    const result = evaluateQuorum({
      entries: log.all(),
      keys: [a, b],
      policy,
      now: addDays(T0, 30),
      subjectId: "user-1",
      planId: "plan-DIFFERENT",
    });
    expect(result.satisfied).toBe(false);
    expect(result.reasons.some((r) => r.includes("different subject or plan"))).toBe(true);
  });

  it("rejects attestations signed after a key was revoked", () => {
    const a = generateAttestorKey("k1", "PLATFORM");
    const b: AttestorKey = { ...generateAttestorKey("k2", "JUDICIAL"), revokedAt: new Date(new Date(T0).getTime() - 1000).toISOString() };
    const log = new TransparencyLog(7);
    log.publish(makeAttestation(a), T0);
    log.publish(makeAttestation(b), T0);
    const result = evaluateQuorum({
      entries: log.all(),
      keys: [a, b],
      policy,
      now: addDays(T0, 30),
      subjectId: "user-1",
      planId: "plan-1",
    });
    expect(result.satisfied).toBe(false);
    expect(result.reasons.some((r) => r.includes("revoked"))).toBe(true);
  });

  it("rejects attestations below the required confidence level", () => {
    const a = generateAttestorKey("k1", "PLATFORM");
    const b = generateAttestorKey("k2", "JUDICIAL");
    const log = new TransparencyLog(7);
    log.publish(makeAttestation(a, { confidenceLevel: 2 }), T0);
    log.publish(makeAttestation(b, { confidenceLevel: 2 }), T0);
    const result = evaluateQuorum({
      entries: log.all(),
      keys: [a, b],
      policy,
      now: addDays(T0, 30),
      subjectId: "user-1",
      planId: "plan-1",
    });
    expect(result.satisfied).toBe(false);
  });
});

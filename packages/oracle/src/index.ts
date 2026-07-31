/**
 * Legacy Oracle — the life-event attestation layer.
 *
 * The Oracle emits *signed statements about evidence*. It never emits instructions and it has no
 * authority over funds. See ARCHITECTURE.md §7.
 *
 * Four properties, all implemented here:
 *   1. Quorum      — one signature is never enough, and signers must be in different classes.
 *   2. Transparency — every attestation is appended to a published hash chain.
 *   3. Publish-then-act — an attestation is not actionable until it has been visible long enough
 *      for the subject to see it and veto.
 *   4. Offline verifiability — verification needs only the public key and the payload, so it
 *      still works after the company is gone.
 *
 * Ed25519 is used because it is deterministic (no nonce-reuse foot-gun) and available in Node's
 * standard library, so this package has zero runtime dependencies.
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";
import { addDays, daysBetween, type ISODate } from "@legacy/core";
import { canonicalJson } from "@legacy/core/audit";
import type { ConfidenceLevel, IndependenceClass } from "@legacy/death-verification";

export const ATTESTATION_SCHEMA = "legacy.attestation.death.v1";

/**
 * The signed statement. Note what it does NOT contain: any instruction, any address, any amount.
 * It is a claim about evidence, scoped tightly enough that it cannot be replayed elsewhere.
 */
export interface AttestationPayload {
  readonly schema: typeof ATTESTATION_SCHEMA;
  readonly subjectId: string;
  readonly planId: string;
  /** Domain separation — an attestation for one chain can't be replayed on another. */
  readonly chainId: string;
  readonly confidenceLevel: ConfidenceLevel;
  readonly sourceClasses: readonly IndependenceClass[];
  readonly evidenceHashes: readonly string[];
  readonly assertedAt: ISODate;
  readonly validFrom: ISODate;
  readonly validUntil: ISODate;
  /** Replay protection. */
  readonly nonce: string;
  readonly statement: string;
}

export interface SignedAttestation {
  readonly payload: AttestationPayload;
  readonly payloadHash: string;
  readonly signerKeyId: string;
  readonly signerClass: IndependenceClass;
  readonly signature: string; // base64
  readonly signedAt: ISODate;
}

export interface AttestorKey {
  readonly keyId: string;
  readonly signerClass: IndependenceClass;
  readonly publicKeyPem: string;
  /** Present only in demo/test. In production this is an HSM key reference, never material. */
  readonly privateKey?: KeyObject;
  readonly revokedAt?: ISODate;
}

export function generateAttestorKey(keyId: string, signerClass: IndependenceClass): AttestorKey {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    keyId,
    signerClass,
    publicKeyPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey,
  };
}

export function hashPayload(payload: AttestationPayload): string {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export function signAttestation(
  payload: AttestationPayload,
  key: AttestorKey,
  signedAt: ISODate,
): SignedAttestation {
  if (!key.privateKey) throw new Error("Signing requires a private key or an HSM key reference");
  const message = Buffer.from(canonicalJson(payload), "utf8");
  const signature = nodeSign(null, message, key.privateKey).toString("base64");
  return {
    payload,
    payloadHash: hashPayload(payload),
    signerKeyId: key.keyId,
    signerClass: key.signerClass,
    signature,
    signedAt,
  };
}

/**
 * Verify a single attestation. Deliberately dependency-free and self-contained: this function is
 * the published offline verifier, and it must keep working with no platform, no network and no
 * database. See ARCHITECTURE.md §13.
 */
export function verifyAttestation(
  attestation: SignedAttestation,
  publicKeyPem: string,
  now: ISODate,
): { valid: boolean; reason?: string } {
  if (attestation.payload.schema !== ATTESTATION_SCHEMA) {
    return { valid: false, reason: "Unknown attestation schema" };
  }
  if (hashPayload(attestation.payload) !== attestation.payloadHash) {
    return { valid: false, reason: "Payload hash mismatch" };
  }
  if (new Date(now) < new Date(attestation.payload.validFrom)) {
    return { valid: false, reason: "Attestation is not yet valid" };
  }
  if (new Date(now) > new Date(attestation.payload.validUntil)) {
    return { valid: false, reason: "Attestation has expired" };
  }
  let publicKey: KeyObject;
  try {
    publicKey = createPublicKey(publicKeyPem);
  } catch {
    return { valid: false, reason: "Invalid public key" };
  }
  const message = Buffer.from(canonicalJson(attestation.payload), "utf8");
  const valid = nodeVerify(null, message, publicKey, Buffer.from(attestation.signature, "base64"));
  return valid ? { valid: true } : { valid: false, reason: "Signature verification failed" };
}

// --- Transparency log ---------------------------------------------------------------------------

export interface LogEntry {
  readonly index: number;
  readonly attestation: SignedAttestation;
  readonly publishedAt: ISODate;
  /** Not actionable until this time — the subject's window to see it and object. */
  readonly actionableAt: ISODate;
  readonly prevHash: string;
  readonly hash: string;
}

export const LOG_GENESIS = "0".repeat(64);

export class TransparencyLog {
  private entries: LogEntry[] = [];

  constructor(private readonly publishDelayDays = 7) {}

  publish(attestation: SignedAttestation, publishedAt: ISODate): LogEntry {
    const prev = this.entries[this.entries.length - 1];
    const prevHash = prev?.hash ?? LOG_GENESIS;
    const index = this.entries.length;
    const actionableAt = addDays(publishedAt, this.publishDelayDays);
    const hash = createHash("sha256")
      .update([String(index), prevHash, attestation.payloadHash, attestation.signature, publishedAt].join(" "))
      .digest("hex");
    const entry: LogEntry = { index, attestation, publishedAt, actionableAt, prevHash, hash };
    this.entries.push(entry);
    return entry;
  }

  head(): { index: number; hash: string } {
    const last = this.entries[this.entries.length - 1];
    return { index: last?.index ?? -1, hash: last?.hash ?? LOG_GENESIS };
  }

  all(): readonly LogEntry[] {
    return this.entries;
  }

  /** Detects retrospective rewriting of the log. */
  verifyChain(): { valid: boolean; brokenAt: number | null } {
    let prevHash = LOG_GENESIS;
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i]!;
      if (e.prevHash !== prevHash || e.index !== i) return { valid: false, brokenAt: i };
      const expected = createHash("sha256")
        .update([String(e.index), e.prevHash, e.attestation.payloadHash, e.attestation.signature, e.publishedAt].join(" "))
        .digest("hex");
      if (expected !== e.hash) return { valid: false, brokenAt: i };
      prevHash = e.hash;
    }
    return { valid: true, brokenAt: null };
  }
}

// --- Quorum -------------------------------------------------------------------------------------

export interface QuorumPolicy {
  readonly requiredAttestors: number;
  /** Require signers from at least this many distinct independence classes. */
  readonly requiredDistinctClasses: number;
  readonly minimumConfidenceLevel: ConfidenceLevel;
}

export interface QuorumResult {
  readonly satisfied: boolean;
  readonly validAttestations: number;
  readonly distinctClasses: readonly IndependenceClass[];
  readonly actionable: boolean;
  readonly reasons: readonly string[];
}

/**
 * Evaluate whether a set of attestations is actionable.
 *
 * Note the two separate outputs: `satisfied` (the evidence is sufficient) and `actionable`
 * (it is also past its publish delay). Both must hold. This is the publish-then-act guarantee —
 * a forged attestation is visible to the subject before it can be used.
 */
export function evaluateQuorum(input: {
  entries: readonly LogEntry[];
  keys: readonly AttestorKey[];
  policy: QuorumPolicy;
  now: ISODate;
  subjectId: string;
  planId: string;
}): QuorumResult {
  const reasons: string[] = [];
  const keyById = new Map(input.keys.map((k) => [k.keyId, k]));
  const seenSigners = new Set<string>();
  const validClasses = new Set<IndependenceClass>();
  let valid = 0;
  let actionableCount = 0;

  for (const entry of input.entries) {
    const att = entry.attestation;
    if (att.payload.subjectId !== input.subjectId || att.payload.planId !== input.planId) {
      reasons.push(`Attestation ${att.payloadHash.slice(0, 8)} is for a different subject or plan.`);
      continue;
    }
    const key = keyById.get(att.signerKeyId);
    if (!key) {
      reasons.push(`Unknown signing key ${att.signerKeyId}.`);
      continue;
    }
    if (key.revokedAt && new Date(att.signedAt) > new Date(key.revokedAt)) {
      reasons.push(`Key ${att.signerKeyId} was revoked before this attestation was signed.`);
      continue;
    }
    // Duplicate signers must not be able to fake a quorum.
    if (seenSigners.has(att.signerKeyId)) {
      reasons.push(`Key ${att.signerKeyId} signed more than once; counted once.`);
      continue;
    }
    const check = verifyAttestation(att, key.publicKeyPem, input.now);
    if (!check.valid) {
      reasons.push(`Attestation from ${att.signerKeyId} is invalid: ${check.reason}.`);
      continue;
    }
    if (att.payload.confidenceLevel < input.policy.minimumConfidenceLevel) {
      reasons.push(
        `Attestation from ${att.signerKeyId} asserts level ${att.payload.confidenceLevel}, below the required ${input.policy.minimumConfidenceLevel}.`,
      );
      continue;
    }
    seenSigners.add(att.signerKeyId);
    validClasses.add(key.signerClass);
    valid++;
    if (daysBetween(entry.actionableAt, input.now) >= 0) actionableCount++;
    else {
      const remaining = Math.ceil(daysBetween(input.now, entry.actionableAt));
      reasons.push(`Attestation is published but not actionable for another ${remaining} day(s).`);
    }
  }

  const distinctClasses = [...validClasses];
  const satisfied =
    valid >= input.policy.requiredAttestors &&
    distinctClasses.length >= input.policy.requiredDistinctClasses;

  if (valid < input.policy.requiredAttestors) {
    reasons.push(`${input.policy.requiredAttestors} attestors required; ${valid} valid.`);
  }
  if (distinctClasses.length < input.policy.requiredDistinctClasses) {
    reasons.push(
      `Attestations must come from ${input.policy.requiredDistinctClasses} independent source classes; found ${distinctClasses.length}.`,
    );
  }

  return {
    satisfied,
    validAttestations: valid,
    distinctClasses,
    actionable: satisfied && actionableCount >= input.policy.requiredAttestors,
    reasons,
  };
}

export function buildAttestationPayload(input: {
  subjectId: string;
  planId: string;
  chainId: string;
  confidenceLevel: ConfidenceLevel;
  sourceClasses: readonly IndependenceClass[];
  evidenceHashes: readonly string[];
  assertedAt: ISODate;
  validityDays?: number;
  nonce: string;
}): AttestationPayload {
  return {
    schema: ATTESTATION_SCHEMA,
    subjectId: input.subjectId,
    planId: input.planId,
    chainId: input.chainId,
    confidenceLevel: input.confidenceLevel,
    sourceClasses: input.sourceClasses,
    evidenceHashes: input.evidenceHashes,
    assertedAt: input.assertedAt,
    validFrom: input.assertedAt,
    validUntil: addDays(input.assertedAt, input.validityDays ?? 365),
    nonce: input.nonce,
    // Deliberately a statement about evidence, never an instruction to release anything.
    statement: `As of ${input.assertedAt}, the evidence available to this attestor supports death-confidence level ${input.confidenceLevel} for the subject. This attestation is evidence only and confers no authority to move assets.`,
  };
}

export { createPrivateKey };

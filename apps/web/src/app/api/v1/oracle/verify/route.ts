/**
 * POST /api/v1/oracle/verify
 *
 * A convenience verifier. Note that this endpoint is NOT the mechanism by which attestations are
 * trusted — verification requires only the public key and the payload, and the standalone verifier
 * shipped in the Continuity Pack does the same job with no network and no us. If this endpoint
 * were the only way to verify, our servers would be a dependency of somebody's inheritance.
 *
 * GET /api/v1/oracle/verify returns a live demonstration instead of a 405, because seeing a real
 * signed attestation is more useful than reading about one.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  TransparencyLog,
  buildAttestationPayload,
  evaluateQuorum,
  generateAttestorKey,
  signAttestation,
  verifyAttestation,
} from "@legacy/oracle";
import { problem } from "@/lib/api";

const Body = z.object({
  attestation: z.object({
    payload: z.record(z.unknown()),
    payloadHash: z.string(),
    signerKeyId: z.string(),
    signerClass: z.string(),
    signature: z.string(),
    signedAt: z.string(),
  }),
  publicKeyPem: z.string().min(1),
  now: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return problem(400, "invalid-json", "Request body must be valid JSON.", "Send a JSON object.");
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return problem(
      400,
      "validation-failed",
      "The request body failed validation.",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }

  const { attestation, publicKeyPem, now } = parsed.data;
  const result = verifyAttestation(
    attestation as never,
    publicKeyPem,
    now ?? new Date().toISOString(),
  );

  return NextResponse.json({
    valid: result.valid,
    reason: result.reason,
    note: "Verification requires only the public key and the payload. The verifier in your Continuity Pack does this offline.",
  });
}

/** A live, self-contained demonstration of the full attestation lifecycle. */
export async function GET() {
  const now = new Date().toISOString();

  // Ephemeral demo keys, generated per request. Never persisted, never used for anything real.
  const platform = generateAttestorKey("att_demo_platform", "PLATFORM");
  const notary = generateAttestorKey("att_demo_notary", "JUDICIAL");

  const log = new TransparencyLog(7);
  const attestations = [platform, notary].map((key, i) => {
    const payload = buildAttestationPayload({
      subjectId: "sub_demo",
      planId: "plan_demo",
      chainId: "bitcoin-mainnet",
      confidenceLevel: 5,
      sourceClasses: [key.signerClass === "PLATFORM" ? "CIVIL_REGISTRY" : "JUDICIAL"],
      evidenceHashes: [`evidence-hash-${i}`],
      assertedAt: now,
      nonce: `demo-nonce-${i}`,
    });
    return signAttestation(payload, key, now);
  });

  for (const a of attestations) log.publish(a, now);

  const policy = { requiredAttestors: 2, requiredDistinctClasses: 2, minimumConfidenceLevel: 4 as const };

  const immediate = evaluateQuorum({
    entries: log.all(),
    keys: [platform, notary],
    policy,
    now,
    subjectId: "sub_demo",
    planId: "plan_demo",
  });

  const afterDelay = evaluateQuorum({
    entries: log.all(),
    keys: [platform, notary],
    policy,
    now: new Date(new Date(now).getTime() + 8 * 86_400_000).toISOString(),
    subjectId: "sub_demo",
    planId: "plan_demo",
  });

  return NextResponse.json({
    demonstration: "Two independent attestors sign the same subject; the quorum is evaluated twice.",
    attestation: {
      payload: attestations[0]!.payload,
      signerKeyId: attestations[0]!.signerKeyId,
      signature: `${attestations[0]!.signature.slice(0, 32)}…`,
    },
    signatureVerifies: verifyAttestation(attestations[0]!, platform.publicKeyPem, now).valid,
    transparencyLog: { head: log.head(), chainIntact: log.verifyChain().valid },
    quorum: {
      immediately: {
        satisfied: immediate.satisfied,
        actionable: immediate.actionable,
        explanation:
          "Evidence is sufficient, but not yet actionable — publish-then-act gives the subject a window to see the attestation and veto it.",
      },
      afterPublishDelay: {
        satisfied: afterDelay.satisfied,
        actionable: afterDelay.actionable,
      },
      distinctClasses: afterDelay.distinctClasses,
    },
    note: "Demonstration keys are generated per request and discarded. In production these are non-exportable HSM keys.",
  });
}

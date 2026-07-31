/**
 * POST /api/v1/death-verification/confidence
 *
 * Score a set of evidence. Returns the level, the per-source contribution, and — importantly —
 * the reasons a higher level was withheld. Scoring never triggers anything on its own.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { assessConfidence, providerForCountry, type Evidence } from "@legacy/death-verification";
import { problem } from "@/lib/api";

const IndependenceClass = z.enum([
  "CIVIL_REGISTRY",
  "MEDICAL",
  "JUDICIAL",
  "FINANCIAL",
  "SOCIAL",
  "BEHAVIOURAL",
  "PLATFORM",
]);

const Body = z.object({
  countryCode: z.string().length(2).default("ZA"),
  lastProofOfLifeAt: z.string().datetime(),
  now: z.string().datetime(),
  inactivityThresholdDays: z.number().int().min(30).max(3650).default(180),
  disputeOpen: z.boolean().default(false),
  evidence: z
    .array(
      z.object({
        id: z.string().min(1),
        sourceType: z.string().min(1),
        independenceClass: IndependenceClass,
        outcome: z.enum(["CONFIRMS", "CONTRADICTS", "INCONCLUSIVE"]),
        supportsLevel: z.union([
          z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6),
        ]),
        quality: z.number().min(0).max(1).default(0.8),
        recordedAt: z.string().datetime(),
        staleAfter: z.string().datetime().optional(),
      }),
    )
    .default([]),
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

  const input = parsed.data;
  const provider = providerForCountry(input.countryCode);

  const evidence: Evidence[] = input.evidence.map((e) => ({
    ...e,
    providerId: provider.id,
  }));

  const assessment = assessConfidence({
    evidence,
    lastProofOfLifeAt: input.lastProofOfLifeAt,
    inactivityThresholdDays: input.inactivityThresholdDays,
    now: input.now,
    disputeOpen: input.disputeOpen,
  });

  return NextResponse.json({
    level: assessment.level,
    score: assessment.score,
    rationale: assessment.rationale,
    overriddenByProofOfLife: assessment.overriddenByProofOfLife,
    independentClasses: assessment.independentClasses,
    contributing: assessment.contributing,
    provider: {
      id: provider.id,
      country: provider.countryName,
      tier: provider.tier,
      hasLicensedFeed: provider.capabilities.hasLicensedFeed,
      maxAchievableLevel: provider.capabilities.maxAchievableLevel,
    },
    note: "Confidence is advisory input to a succession policy predicate. On its own it triggers nothing.",
  });
}

export async function GET() {
  return problem(405, "method-not-allowed", "Use POST.", "This endpoint accepts POST only.");
}

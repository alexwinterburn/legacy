/**
 * POST /api/v1/succession/simulate
 *
 * Pure function over a plan — no side effects, no state written. This is the same engine that
 * powers the simulator screen, exposed so an institutional client can preview a customer's
 * succession outcome without triggering anything.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { simulateSuccession, makeRule, validateAllocations, type RuleType } from "@legacy/succession";
import { DEMO_NOW, demoAssets, demoBeneficiaries } from "@legacy/demo-data";
import { problem } from "@/lib/api";

const Body = z.object({
  coolingOffDays: z.number().int().min(30).max(365).default(60),
  requiredConfidenceLevel: z.union([
    z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6),
  ]).default(4),
  allocations: z
    .array(
      z.object({
        beneficiaryId: z.string().min(1),
        basisPoints: z.number().int().min(1).max(10_000),
      }),
    )
    .min(1),
  ruleTypes: z.array(z.string()).default(["PERCENTAGE"]),
  withProofOfLifeAtStep: z.number().int().min(0).optional(),
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
  const allocations = input.allocations.map((a) => ({ ...a, scope: "ALL" }));

  const validation = validateAllocations(allocations);
  if (!validation.ok) {
    return problem(422, "allocation-invalid", "Allocations are not valid.", validation.error);
  }
  if (!validation.value.complete) {
    return problem(
      422,
      "allocation-not-100",
      "Allocations must sum to exactly 100%.",
      `Currently ${validation.value.totalBasisPoints} basis points; ${validation.value.remaining} remaining.`,
    );
  }

  const rules = input.ruleTypes.map((t, i) =>
    makeRule({ id: `rule-${i}`, type: t as RuleType, appliesToChains: ["bitcoin", "ethereum"], order: i }),
  );

  const result = simulateSuccession({
    startAt: DEMO_NOW,
    coolingOffDays: input.coolingOffDays,
    requiredConfidenceLevel: input.requiredConfidenceLevel,
    beneficiaries: demoBeneficiaries,
    allocations,
    rules,
    snapshot: { takenAt: DEMO_NOW, assets: demoAssets, note: "API simulation snapshot" },
    withProofOfLifeAtStep: input.withProofOfLifeAtStep,
  });

  return NextResponse.json({
    finalState: result.finalState,
    totalDays: result.totalDays,
    halted: result.halted,
    haltReason: result.haltReason,
    steps: result.steps.map((s) => ({
      index: s.index,
      dayOffset: s.dayOffset,
      title: s.title,
      state: s.state,
      confidenceLevel: s.confidenceLevel,
      blockedReason: s.blockedReason,
    })),
    // Amounts are strings: JSON has no bigint, and a float here would lose satoshis.
    distribution:
      result.distribution?.byBeneficiary.map((b) => ({
        beneficiaryId: b.beneficiaryId,
        beneficiaryName: b.beneficiaryName,
        basisPoints: b.basisPoints,
        lines: b.lines.map((l) => ({
          symbol: l.symbol,
          amountMinorUnits: l.amount.toString(),
          decimals: l.decimals,
          formatted: l.formattedAmount,
          needsDestination: l.needsDestination,
        })),
      })) ?? null,
    manualSteps: result.manualSteps,
    disclaimer:
      "Simulation only. This is not legal, tax or financial advice, and does not constitute a testamentary instruction.",
  });
}

export async function GET() {
  return problem(405, "method-not-allowed", "Use POST.", "This endpoint accepts POST only.");
}

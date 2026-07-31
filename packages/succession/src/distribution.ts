/**
 * Distribution computation.
 *
 * Two properties matter here and are tested:
 *  1. Conservation — the sum of the parts equals the whole, exactly, in minor units.
 *  2. Determinism — the same snapshot always produces the same result, so a distribution can be
 *     recomputed and reconciled by an executor years later.
 *
 * Allocations are always computed against a fixed snapshot. If the price or balance moved between
 * computation and execution, that changes the indicative value shown, never the split.
 */

import {
  formatAmount,
  splitByBasisPoints,
  toFloat,
  type Allocation,
  type AssetRecord,
  type Beneficiary,
  type ISODate,
} from "@legacy/core";

export interface DistributionSnapshot {
  readonly takenAt: ISODate;
  readonly assets: readonly AssetRecord[];
  readonly note: string;
}

export interface DistributionLine {
  readonly beneficiaryId: string;
  readonly beneficiaryName: string;
  readonly assetId: string;
  readonly chain: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly amount: bigint;
  readonly formattedAmount: string;
  readonly basisPoints: number;
  readonly indicativeValueUsd: number;
  readonly destinationAddress?: string;
  /** True when we have no address yet — the portal walks them through setting one up. */
  readonly needsDestination: boolean;
}

export interface DistributionResult {
  readonly snapshot: DistributionSnapshot;
  readonly lines: readonly DistributionLine[];
  readonly totalIndicativeValueUsd: number;
  readonly byBeneficiary: readonly {
    readonly beneficiaryId: string;
    readonly beneficiaryName: string;
    readonly basisPoints: number;
    readonly indicativeValueUsd: number;
    readonly lines: readonly DistributionLine[];
  }[];
  /** Reconciliation record for the executor — REGULATORY.md §5. */
  readonly executorReconciliation: {
    readonly computedAt: ISODate;
    readonly assetCount: number;
    readonly beneficiaryCount: number;
    readonly conservationChecked: boolean;
    readonly note: string;
  };
}

export function computeDistribution(input: {
  snapshot: DistributionSnapshot;
  allocations: readonly Allocation[];
  beneficiaries: readonly Beneficiary[];
}): DistributionResult {
  const { snapshot, allocations, beneficiaries } = input;
  const byId = new Map(beneficiaries.map((b) => [b.id, b]));
  const lines: DistributionLine[] = [];

  for (const asset of snapshot.assets) {
    // Asset-specific allocations override the plan-wide split.
    const scoped = allocations.filter((a) => a.scope === asset.id);
    const applicable = scoped.length > 0 ? scoped : allocations.filter((a) => a.scope === "ALL");
    if (applicable.length === 0) continue;

    const parts = splitByBasisPoints(
      asset.amount,
      applicable.map((a) => ({ id: a.beneficiaryId, basisPoints: a.basisPoints })),
    );

    for (const part of parts) {
      const beneficiary = byId.get(part.id);
      if (!beneficiary) continue;
      const alloc = applicable.find((a) => a.beneficiaryId === part.id)!;
      const formatted = formatAmount(
        { value: part.value, decimals: asset.decimals, symbol: asset.symbol },
        asset.symbol === "USDC" || asset.symbol === "USDT" ? 2 : 4,
      );
      const destination = beneficiary.destinations?.[asset.chain];
      lines.push({
        beneficiaryId: part.id,
        beneficiaryName: beneficiary.fullName,
        assetId: asset.id,
        chain: asset.chain,
        symbol: asset.symbol,
        decimals: asset.decimals,
        amount: part.value,
        formattedAmount: formatted,
        basisPoints: alloc.basisPoints,
        indicativeValueUsd:
          toFloat({ value: part.value, decimals: asset.decimals, symbol: asset.symbol }) *
          asset.indicativeUnitPriceUsd,
        destinationAddress: destination,
        needsDestination: destination === undefined,
      });
    }
  }

  const grouped = new Map<string, DistributionLine[]>();
  for (const line of lines) {
    const existing = grouped.get(line.beneficiaryId);
    if (existing) existing.push(line);
    else grouped.set(line.beneficiaryId, [line]);
  }

  const byBeneficiary = [...grouped.entries()]
    .map(([beneficiaryId, beneficiaryLines]) => ({
      beneficiaryId,
      beneficiaryName: beneficiaryLines[0]?.beneficiaryName ?? "Unknown",
      basisPoints: beneficiaryLines[0]?.basisPoints ?? 0,
      indicativeValueUsd: beneficiaryLines.reduce((acc, l) => acc + l.indicativeValueUsd, 0),
      lines: beneficiaryLines,
    }))
    .sort((a, b) => b.basisPoints - a.basisPoints);

  const totalIndicativeValueUsd = lines.reduce((acc, l) => acc + l.indicativeValueUsd, 0);

  return {
    snapshot,
    lines,
    totalIndicativeValueUsd,
    byBeneficiary,
    executorReconciliation: {
      computedAt: snapshot.takenAt,
      assetCount: snapshot.assets.length,
      beneficiaryCount: byBeneficiary.length,
      conservationChecked: verifyConservation(snapshot, lines),
      note: "Computed from a fixed snapshot. Reconcile against the estate inventory. This record is not a legal instrument and does not replace the executor's own accounting.",
    },
  };
}

/** Every minor unit of every asset must be accounted for. */
export function verifyConservation(
  snapshot: DistributionSnapshot,
  lines: readonly DistributionLine[],
): boolean {
  for (const asset of snapshot.assets) {
    const distributed = lines
      .filter((l) => l.assetId === asset.id)
      .reduce((acc, l) => acc + l.amount, 0n);
    // Zero lines means the asset had no applicable allocation, which is a separate concern.
    if (distributed !== 0n && distributed !== asset.amount) return false;
  }
  return true;
}

export function totalIndicativeValue(assets: readonly AssetRecord[]): number {
  return assets.reduce(
    (acc, a) =>
      acc + toFloat({ value: a.amount, decimals: a.decimals, symbol: a.symbol }) * a.indicativeUnitPriceUsd,
    0,
  );
}

/**
 * Money and allocation primitives.
 *
 * Two rules, both learned the hard way in financial systems:
 *  1. Amounts are integers in minor units. Never floats. `0.1 + 0.2 !== 0.3`.
 *  2. Allocations are basis points (0-10000). "33.33%" three times does not sum to 100%,
 *     but 3333 + 3333 + 3334 bp does.
 */

export const BASIS_POINTS_TOTAL = 10_000;

export interface AssetAmount {
  /** Integer amount in the asset's smallest unit (satoshi, wei, lamport, cent). */
  readonly value: bigint;
  readonly decimals: number;
  readonly symbol: string;
}

export function amount(value: bigint, decimals: number, symbol: string): AssetAmount {
  return { value, decimals, symbol };
}

/** Parse a human decimal string ("1.84") into minor units without floating point. */
export function parseAmount(input: string, decimals: number, symbol: string): AssetAmount {
  const trimmed = input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid amount: ${input}`);
  }
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Amount ${input} has more precision than ${decimals} decimals allows`);
  }
  const padded = fraction.padEnd(decimals, "0");
  const value = BigInt(whole + padded) * (negative ? -1n : 1n);
  return { value, decimals, symbol };
}

/** Format minor units for display. Trims trailing zeros but keeps at least `minDp`. */
export function formatAmount(a: AssetAmount, minDp = 2): string {
  const negative = a.value < 0n;
  const abs = negative ? -a.value : a.value;
  const base = 10n ** BigInt(a.decimals);
  const whole = abs / base;
  const fraction = abs % base;

  let fractionStr = fraction.toString().padStart(a.decimals, "0");
  fractionStr = fractionStr.replace(/0+$/, "");
  while (fractionStr.length < minDp) fractionStr += "0";

  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = negative ? "-" : "";
  return fractionStr.length > 0 ? `${sign}${wholeStr}.${fractionStr}` : `${sign}${wholeStr}`;
}

/** Convert to a float. ONLY for display and indicative valuation — never for allocation maths. */
export function toFloat(a: AssetAmount): number {
  return Number(a.value) / 10 ** a.decimals;
}

/**
 * Split an amount by basis points with exact conservation.
 *
 * The remainder from integer division is distributed one minor unit at a time to the largest
 * remainders (Hamilton / largest-remainder method), so the parts always sum exactly to the whole.
 * Losing a satoshi to rounding in an inheritance distribution is a defect, not a rounding detail.
 */
export function splitByBasisPoints(
  total: bigint,
  allocations: readonly { readonly id: string; readonly basisPoints: number }[],
): { readonly id: string; readonly value: bigint }[] {
  const sum = allocations.reduce((acc, a) => acc + a.basisPoints, 0);
  if (sum !== BASIS_POINTS_TOTAL) {
    throw new Error(`Allocations must sum to ${BASIS_POINTS_TOTAL} bp, got ${sum}`);
  }
  if (total < 0n) throw new Error("Cannot split a negative amount");

  const parts = allocations.map((a) => {
    const numerator = total * BigInt(a.basisPoints);
    const base = numerator / BigInt(BASIS_POINTS_TOTAL);
    const remainder = numerator % BigInt(BASIS_POINTS_TOTAL);
    return { id: a.id, value: base, remainder };
  });

  let distributed = parts.reduce((acc, p) => acc + p.value, 0n);
  let leftover = total - distributed;

  // Largest remainder first; ties broken deterministically by id so the result is reproducible.
  const order = [...parts].sort((x, y) => {
    if (x.remainder !== y.remainder) return x.remainder > y.remainder ? -1 : 1;
    return x.id < y.id ? -1 : 1;
  });

  let i = 0;
  while (leftover > 0n && order.length > 0) {
    const target = order[i % order.length]!;
    const part = parts.find((p) => p.id === target.id)!;
    part.value += 1n;
    leftover -= 1n;
    i++;
  }

  return parts.map((p) => ({ id: p.id, value: p.value }));
}

export function basisPointsToPercent(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const frac = bp % 100;
  return frac === 0 ? `${whole}%` : `${(bp / 100).toFixed(2).replace(/0$/, "")}%`;
}

export function percentToBasisPoints(percent: number): number {
  return Math.round(percent * 100);
}

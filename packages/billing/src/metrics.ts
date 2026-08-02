/**
 * Revenue metrics.
 *
 * Definitions are stated explicitly because "MRR" and "churn" mean different things at different
 * companies, and a dashboard number nobody can define is worse than no number.
 */

import { daysBetween, type ISODate, type TierId } from "@legacy/core";
import type { Invoice, Subscription } from "./types";
import { mrrMinor } from "./subscription";

export interface RevenueMetrics {
  /** Sum of normalised monthly value across ACTIVE and PAST_DUE subscriptions. */
  readonly mrrMinor: bigint;
  readonly arrMinor: bigint;
  /** MRR / paying subscribers. Excludes free and trialing. */
  readonly arpuMinor: bigint;
  readonly payingSubscribers: number;
  readonly trialingSubscribers: number;
  readonly freeUsers: number;
  readonly delinquentSubscribers: number;
  /** Cancellations in the window / subscribers at window start. */
  readonly churnRatePercent: number;
  /** Trial → paid conversion over the window. */
  readonly trialConversionPercent: number;
  readonly collectedMinor: bigint;
  readonly outstandingMinor: bigint;
  readonly refundedMinor: bigint;
  readonly byTier: readonly { tierId: TierId; count: number; mrrMinor: bigint }[];
  readonly currency: string;
}

export function computeRevenueMetrics(input: {
  subscriptions: readonly Subscription[];
  invoices: readonly Invoice[];
  now: ISODate;
  windowDays?: number;
  currency?: string;
}): RevenueMetrics {
  const currency = input.currency ?? "USD";
  const windowDays = input.windowDays ?? 30;
  const subs = input.subscriptions;

  const paying = subs.filter(
    (s) => (s.status === "ACTIVE" || s.status === "PAST_DUE" || s.status === "GRACE") && s.unitPriceMinor > 0n,
  );
  const trialing = subs.filter((s) => s.status === "TRIALING");
  const free = subs.filter((s) => s.tierId === "free" && s.status === "ACTIVE");
  const delinquent = subs.filter((s) => s.status === "PAST_DUE" || s.status === "GRACE");

  const mrr = subs.reduce((acc, s) => acc + mrrMinor(s), 0n);
  const arpu = paying.length > 0 ? mrr / BigInt(paying.length) : 0n;

  // Churn over the window.
  const canceledInWindow = subs.filter(
    (s) => s.canceledAt && daysBetween(s.canceledAt, input.now) <= windowDays,
  ).length;
  const activeAtWindowStart = subs.filter(
    (s) => daysBetween(s.startedAt, input.now) >= 0 && s.unitPriceMinor > 0n,
  ).length;
  const churnRatePercent =
    activeAtWindowStart > 0 ? (canceledInWindow / activeAtWindowStart) * 100 : 0;

  // Trial conversion: of subscriptions that ever had a trial, how many are now paying.
  const everTrialed = subs.filter((s) => s.trialEndsAt !== undefined || s.status === "TRIALING");
  const convertedFromTrial = subs.filter(
    (s) => s.trialEndsAt !== undefined && s.status === "ACTIVE" && s.unitPriceMinor > 0n,
  );
  const trialConversionPercent =
    everTrialed.length > 0 ? (convertedFromTrial.length / everTrialed.length) * 100 : 0;

  const collectedMinor = input.invoices
    .filter((i) => i.status === "PAID" || i.status === "PARTIALLY_REFUNDED" || i.status === "REFUNDED")
    .reduce((acc, i) => acc + i.amountPaidMinor, 0n);

  const outstanding = input.invoices
    .filter((i) => i.status === "OPEN")
    .reduce((acc, i) => acc + (i.totalMinor - i.amountPaidMinor), 0n);

  const refundedMinor = input.invoices.reduce((acc, i) => acc + i.amountRefundedMinor, 0n);

  const tierIds = [...new Set(subs.map((s) => s.tierId))];
  const byTier = tierIds
    .map((tierId) => ({
      tierId,
      count: subs.filter((s) => s.tierId === tierId && s.status !== "CANCELED").length,
      mrrMinor: subs.filter((s) => s.tierId === tierId).reduce((acc, s) => acc + mrrMinor(s), 0n),
    }))
    .sort((a, b) => Number(b.mrrMinor - a.mrrMinor));

  return {
    mrrMinor: mrr,
    arrMinor: mrr * 12n,
    arpuMinor: arpu,
    payingSubscribers: paying.length,
    trialingSubscribers: trialing.length,
    freeUsers: free.length,
    delinquentSubscribers: delinquent.length,
    churnRatePercent: Math.round(churnRatePercent * 10) / 10,
    trialConversionPercent: Math.round(trialConversionPercent * 10) / 10,
    collectedMinor,
    outstandingMinor: outstanding,
    refundedMinor,
    byTier,
    currency,
  };
}

/** Simple LTV estimate: ARPU / monthly churn rate. Labelled as an estimate wherever displayed. */
export function estimatedLtvMinor(metrics: RevenueMetrics): bigint {
  if (metrics.churnRatePercent <= 0) return 0n;
  const monthlyChurn = metrics.churnRatePercent / 100;
  return BigInt(Math.round(Number(metrics.arpuMinor) / monthlyChurn));
}

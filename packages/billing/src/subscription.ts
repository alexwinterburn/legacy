/**
 * Subscription lifecycle and proration.
 *
 * Pure functions over state — no I/O — so every billing decision is reproducible and testable,
 * and an operator can be shown exactly why a customer was charged what they were charged.
 */

import { addDays, daysBetween, tier, type ISODate, type TierId } from "@legacy/core";
import type {
  BillingInterval,
  Entitlement,
  InvoiceLine,
  Subscription,
  SubscriptionStatus,
} from "./types";

/** How long a failed payment keeps full access before features degrade. */
export const GRACE_PERIOD_DAYS = 14;
/** Attempts before we stop retrying and mark the invoice uncollectible. */
export const MAX_PAYMENT_ATTEMPTS = 4;
export const DEFAULT_TRIAL_DAYS = 14;

export function annualPriceMinor(tierId: TierId): bigint {
  const t = tier(tierId);
  if (t.annualUsd === null) return 0n; // custom-priced; billed by arrangement
  return BigInt(Math.round(t.annualUsd * 100));
}

/** Monthly is priced at a 20% premium to annual, a common and defensible convention. */
export function priceForInterval(tierId: TierId, interval: BillingInterval): bigint {
  const annual = annualPriceMinor(tierId);
  if (interval === "ANNUAL") return annual;
  return BigInt(Math.round(Number(annual) * 1.2 / 12));
}

export function periodLengthDays(interval: BillingInterval): number {
  return interval === "ANNUAL" ? 365 : 30;
}

export function createSubscription(input: {
  id: string;
  userId: string;
  tierId: TierId;
  interval: BillingInterval;
  startedAt: ISODate;
  withTrial?: boolean;
  currency?: string;
  paymentMethodId?: string;
}): Subscription {
  const currency = input.currency ?? "USD";
  const trial = input.withTrial ?? false;
  const trialEndsAt = trial ? addDays(input.startedAt, DEFAULT_TRIAL_DAYS) : undefined;
  const periodStart = input.startedAt;
  const periodEnd = addDays(periodStart, periodLengthDays(input.interval));

  return {
    id: input.id,
    userId: input.userId,
    tierId: input.tierId,
    status: trial ? "TRIALING" : input.tierId === "free" ? "ACTIVE" : "ACTIVE",
    interval: input.interval,
    currency,
    unitPriceMinor: priceForInterval(input.tierId, input.interval),
    startedAt: input.startedAt,
    currentPeriodStart: periodStart,
    currentPeriodEnd: trialEndsAt ?? periodEnd,
    trialEndsAt,
    cancelAtPeriodEnd: false,
    failedAttempts: 0,
    creditMinor: 0n,
    paymentMethodId: input.paymentMethodId,
  };
}

/**
 * Proration on a mid-cycle tier change.
 *
 * Credit the unused portion of the current plan, charge the remaining portion of the new one.
 * Computed in integer minor units by day, which is what a customer can actually check against a
 * calendar — per-second proration is more "accurate" and impossible to explain on a phone call.
 */
export function prorationLines(input: {
  subscription: Subscription;
  newTierId: TierId;
  at: ISODate;
}): readonly InvoiceLine[] {
  const { subscription, newTierId, at } = input;
  const totalDays = daysBetween(subscription.currentPeriodStart, subscription.currentPeriodEnd);
  const remainingDays = Math.max(0, daysBetween(at, subscription.currentPeriodEnd));
  if (totalDays <= 0) return [];

  const oldPrice = subscription.unitPriceMinor;
  const newPrice = priceForInterval(newTierId, subscription.interval);

  // Ratio applied to integers: (price * remainingDays) / totalDays, truncated.
  const unusedCredit = (oldPrice * BigInt(Math.round(remainingDays))) / BigInt(Math.round(totalDays));
  const newCharge = (newPrice * BigInt(Math.round(remainingDays))) / BigInt(Math.round(totalDays));

  const lines: InvoiceLine[] = [];
  if (unusedCredit > 0n) {
    lines.push({
      description: `Unused time on ${tier(subscription.tierId).name} (${Math.round(remainingDays)} days)`,
      quantity: 1,
      unitAmountMinor: -unusedCredit,
      amountMinor: -unusedCredit,
      proration: true,
    });
  }
  if (newCharge > 0n) {
    lines.push({
      description: `${tier(newTierId).name} for the remainder of this period (${Math.round(remainingDays)} days)`,
      quantity: 1,
      unitAmountMinor: newCharge,
      amountMinor: newCharge,
      proration: true,
    });
  }
  return lines;
}

export function changeTier(input: {
  subscription: Subscription;
  newTierId: TierId;
  at: ISODate;
}): { subscription: Subscription; prorationLines: readonly InvoiceLine[]; isUpgrade: boolean } {
  const { subscription, newTierId, at } = input;
  const oldPrice = subscription.unitPriceMinor;
  const newPrice = priceForInterval(newTierId, subscription.interval);
  const isUpgrade = newPrice > oldPrice;

  return {
    subscription: {
      ...subscription,
      tierId: newTierId,
      unitPriceMinor: newPrice,
      // A downgrade shouldn't reset the billing period — the customer already paid for it.
      status: subscription.status === "TRIALING" ? "TRIALING" : "ACTIVE",
    },
    prorationLines: prorationLines({ subscription, newTierId, at }),
    isUpgrade,
  };
}

export function cancelSubscription(input: {
  subscription: Subscription;
  at: ISODate;
  immediate: boolean;
}): Subscription {
  const { subscription, at, immediate } = input;
  if (immediate) {
    return { ...subscription, status: "CANCELED", canceledAt: at, cancelAtPeriodEnd: false };
  }
  // Default: keep access to the end of the paid period. They paid for it.
  return { ...subscription, cancelAtPeriodEnd: true, canceledAt: at };
}

export function resumeSubscription(subscription: Subscription): Subscription {
  return {
    ...subscription,
    status: subscription.status === "PAUSED" ? "ACTIVE" : subscription.status,
    cancelAtPeriodEnd: false,
    canceledAt: undefined,
    pausedAt: undefined,
  };
}

export function pauseSubscription(subscription: Subscription, at: ISODate): Subscription {
  return { ...subscription, status: "PAUSED", pausedAt: at };
}

export function applyCredit(subscription: Subscription, amountMinor: bigint): Subscription {
  if (amountMinor < 0n) throw new Error("Credit must be positive");
  return { ...subscription, creditMinor: subscription.creditMinor + amountMinor };
}

export function extendTrial(subscription: Subscription, days: number, at: ISODate): Subscription {
  if (days <= 0) throw new Error("Trial extension must be positive");
  const base = subscription.trialEndsAt ?? at;
  const trialEndsAt = addDays(base, days);
  return { ...subscription, status: "TRIALING", trialEndsAt, currentPeriodEnd: trialEndsAt };
}

/** Advance to the next billing period after a successful payment. */
export function renew(subscription: Subscription, at: ISODate): Subscription {
  const start = subscription.currentPeriodEnd;
  return {
    ...subscription,
    status: subscription.cancelAtPeriodEnd ? "CANCELED" : "ACTIVE",
    currentPeriodStart: start,
    currentPeriodEnd: addDays(start, periodLengthDays(subscription.interval)),
    failedAttempts: 0,
    gracePeriodEndsAt: undefined,
    trialEndsAt: undefined,
  };
}

/** Record a failed payment and move the subscription along the dunning path. */
export function recordFailedPayment(subscription: Subscription, at: ISODate): Subscription {
  const failedAttempts = subscription.failedAttempts + 1;
  const status: SubscriptionStatus =
    failedAttempts >= MAX_PAYMENT_ATTEMPTS ? "GRACE" : "PAST_DUE";
  return {
    ...subscription,
    status,
    failedAttempts,
    gracePeriodEndsAt: subscription.gracePeriodEndsAt ?? addDays(at, GRACE_PERIOD_DAYS),
  };
}

/**
 * What this subscription currently entitles the user to.
 *
 * Note what never varies: the succession plan stays active, the Continuity Pack stays available,
 * and beneficiaries can always claim — at every status, including CANCELED. Non-payment costs
 * features. It must never cost a family their inheritance, and encoding that here rather than
 * relying on everyone remembering it is the point.
 */
export function entitlementFor(subscription: Subscription, now: ISODate): Entitlement {
  const t = tier(subscription.tierId);
  const constant = {
    successionPlanRemainsActive: true as const,
    continuityPackAvailable: true as const,
    beneficiariesCanClaim: true as const,
  };

  switch (subscription.status) {
    case "TRIALING":
    case "ACTIVE":
      return {
        ...constant,
        tierId: subscription.tierId,
        canEditPlan: true,
        canAddBeneficiaries: true,
        canUploadToVault: true,
        vaultGb: t.limits.vaultGb,
        reason: subscription.status === "TRIALING" ? "Trial in progress." : "Subscription active.",
      };

    case "PAST_DUE":
      // Still fully functional. We have not yet exhausted retries; degrading now would punish
      // a customer for an expired card while their family's plan is on the line.
      return {
        ...constant,
        tierId: subscription.tierId,
        canEditPlan: true,
        canAddBeneficiaries: true,
        canUploadToVault: true,
        vaultGb: t.limits.vaultGb,
        reason: "Payment failed; retries in progress. Full access retained.",
      };

    case "GRACE": {
      const expired = subscription.gracePeriodEndsAt
        ? daysBetween(subscription.gracePeriodEndsAt, now) >= 0
        : false;
      return {
        ...constant,
        tierId: expired ? "free" : subscription.tierId,
        canEditPlan: true,
        canAddBeneficiaries: !expired,
        canUploadToVault: false,
        vaultGb: expired ? 0 : t.limits.vaultGb,
        reason: expired
          ? "Grace period ended. Downgraded to Free — your plan and Continuity Pack are unaffected."
          : "In grace period. Uploads paused; everything else intact.",
      };
    }

    case "PAUSED":
      return {
        ...constant,
        tierId: subscription.tierId,
        canEditPlan: true,
        canAddBeneficiaries: false,
        canUploadToVault: false,
        vaultGb: t.limits.vaultGb,
        reason: "Subscription paused at your request.",
      };

    case "CANCELED":
      return {
        ...constant,
        tierId: "free",
        canEditPlan: true,
        canAddBeneficiaries: true,
        canUploadToVault: false,
        vaultGb: 0,
        reason: "Subscription ended. You are on the Free plan; your succession plan still stands.",
      };
  }
}

export function isDelinquent(s: Subscription): boolean {
  return s.status === "PAST_DUE" || s.status === "GRACE";
}

/** Monthly recurring revenue contribution, normalised across intervals. */
export function mrrMinor(s: Subscription): bigint {
  if (s.status === "CANCELED" || s.status === "PAUSED" || s.status === "TRIALING") return 0n;
  const net = s.discountPercent
    ? (s.unitPriceMinor * BigInt(100 - s.discountPercent)) / 100n
    : s.unitPriceMinor;
  return s.interval === "ANNUAL" ? net / 12n : net;
}

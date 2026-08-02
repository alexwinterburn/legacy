/**
 * Billing domain types.
 *
 * Money here is in **integer minor units** (cents), same rule as everywhere else in this system.
 * A billing system that uses floats will eventually charge somebody $9.999999999 or fail to
 * reconcile against a processor by a cent, and both are worse than the inconvenience of bigint.
 */

import type { ISODate, TierId } from "@legacy/core";

/** Amount in minor units of `currency`. */
export interface Money {
  readonly amountMinor: bigint;
  readonly currency: string;
}

export const money = (amountMinor: bigint, currency = "USD"): Money => ({ amountMinor, currency });
export const zero = (currency = "USD"): Money => money(0n, currency);

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  return money(a.amountMinor + b.amountMinor, a.currency);
}

export function subMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  return money(a.amountMinor - b.amountMinor, a.currency);
}

export function formatMoney(m: Money): string {
  const negative = m.amountMinor < 0n;
  const abs = negative ? -m.amountMinor : m.amountMinor;
  const whole = abs / 100n;
  const cents = abs % 100n;
  const symbol = m.currency === "USD" ? "$" : m.currency === "ZAR" ? "R" : `${m.currency} `;
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${symbol}${wholeStr}.${cents.toString().padStart(2, "0")}`;
}

export type BillingInterval = "MONTHLY" | "ANNUAL";

/**
 * Subscription lifecycle.
 *
 * PAST_DUE is deliberately distinct from CANCELED: a failed payment must never immediately
 * revoke a succession plan. See `entitlementFor` — access degrades on a schedule, and the
 * safety-critical parts never degrade at all.
 */
export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "GRACE"
  | "CANCELED"
  | "PAUSED";

export interface Subscription {
  readonly id: string;
  readonly userId: string;
  readonly tierId: TierId;
  readonly status: SubscriptionStatus;
  readonly interval: BillingInterval;
  readonly currency: string;
  /** Unit price at the time of subscribing — price changes don't retroactively alter a contract. */
  readonly unitPriceMinor: bigint;
  readonly startedAt: ISODate;
  readonly currentPeriodStart: ISODate;
  readonly currentPeriodEnd: ISODate;
  readonly trialEndsAt?: ISODate;
  readonly canceledAt?: ISODate;
  /** Set when the user cancels but keeps access to the end of the paid period. */
  readonly cancelAtPeriodEnd: boolean;
  readonly pausedAt?: ISODate;
  /** Consecutive failed payment attempts on the current invoice. */
  readonly failedAttempts: number;
  readonly gracePeriodEndsAt?: ISODate;
  /** Account credit, applied before charging the payment method. */
  readonly creditMinor: bigint;
  readonly paymentMethodId?: string;
  readonly discountPercent?: number;
  readonly notes?: string;
}

export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "UNCOLLECTIBLE" | "VOID" | "REFUNDED" | "PARTIALLY_REFUNDED";

export interface InvoiceLine {
  readonly description: string;
  readonly quantity: number;
  readonly unitAmountMinor: bigint;
  readonly amountMinor: bigint;
  /** Set for proration lines so the UI can explain a mid-cycle change. */
  readonly proration?: boolean;
}

export interface Invoice {
  readonly id: string;
  readonly number: string;
  readonly userId: string;
  readonly subscriptionId: string;
  readonly status: InvoiceStatus;
  readonly currency: string;
  readonly lines: readonly InvoiceLine[];
  readonly subtotalMinor: bigint;
  readonly discountMinor: bigint;
  readonly taxMinor: bigint;
  readonly creditAppliedMinor: bigint;
  readonly totalMinor: bigint;
  readonly amountPaidMinor: bigint;
  readonly amountRefundedMinor: bigint;
  readonly issuedAt: ISODate;
  readonly dueAt: ISODate;
  readonly paidAt?: ISODate;
  readonly periodStart: ISODate;
  readonly periodEnd: ISODate;
  readonly attempts: readonly PaymentAttempt[];
}

export type PaymentOutcome = "SUCCEEDED" | "FAILED" | "REQUIRES_ACTION";

/**
 * Decline reasons matter operationally: a hard decline ("card is stolen") should not be retried
 * on a schedule, while a soft decline ("insufficient funds") should.
 */
export type DeclineCode =
  | "INSUFFICIENT_FUNDS"
  | "CARD_EXPIRED"
  | "DO_NOT_HONOR"
  | "LOST_OR_STOLEN"
  | "PROCESSING_ERROR"
  | "AUTHENTICATION_REQUIRED";

export const HARD_DECLINES: readonly DeclineCode[] = ["LOST_OR_STOLEN", "CARD_EXPIRED"];

export interface PaymentAttempt {
  readonly id: string;
  readonly invoiceId: string;
  readonly attemptedAt: ISODate;
  readonly outcome: PaymentOutcome;
  readonly amountMinor: bigint;
  readonly declineCode?: DeclineCode;
  readonly providerReference?: string;
  readonly attemptNumber: number;
}

export interface PaymentMethod {
  readonly id: string;
  readonly userId: string;
  readonly kind: "CARD" | "SEPA_DEBIT" | "BANK_TRANSFER";
  readonly brand?: string;
  readonly last4: string;
  readonly expiryMonth?: number;
  readonly expiryYear?: number;
  readonly isDefault: boolean;
  readonly addedAt: ISODate;
}

export interface Refund {
  readonly id: string;
  readonly invoiceId: string;
  readonly amountMinor: bigint;
  readonly reason: string;
  readonly issuedBy: string;
  readonly issuedAt: ISODate;
}

/**
 * What a subscription state actually entitles the user to.
 *
 * The critical property, and the reason this is a function rather than a flag: no billing state
 * ever revokes the succession plan itself, the Continuity Pack, or the beneficiaries' ability to
 * claim. Non-payment costs you features. It must never cost your family their inheritance.
 */
export interface Entitlement {
  readonly tierId: TierId;
  readonly canEditPlan: boolean;
  readonly canAddBeneficiaries: boolean;
  readonly canUploadToVault: boolean;
  readonly vaultGb: number;
  /** Always true. A plan that stops working because a card expired would be indefensible. */
  readonly successionPlanRemainsActive: true;
  /** Always true. Charging for the escape hatch from our own failure is not acceptable. */
  readonly continuityPackAvailable: true;
  /** Always true. Beneficiaries never pay, and never lose access. */
  readonly beneficiariesCanClaim: true;
  readonly reason: string;
}

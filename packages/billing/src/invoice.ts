/**
 * Invoice construction and payment application.
 *
 * Every total is derived, never stored independently — a stored total that disagrees with its
 * lines is the classic billing reconciliation bug.
 */

import { addDays, tier, type ISODate } from "@legacy/core";
import type { Invoice, InvoiceLine, PaymentAttempt, Subscription } from "./types";

export const PAYMENT_TERMS_DAYS = 7;

let invoiceCounter = 1000;
export function nextInvoiceNumber(prefix = "LGC"): string {
  invoiceCounter += 1;
  return `${prefix}-${invoiceCounter}`;
}

/** Reset the counter — used by tests and the demo seeder so numbering is deterministic. */
export function resetInvoiceNumbering(to = 1000): void {
  invoiceCounter = to;
}

export function buildInvoice(input: {
  id: string;
  subscription: Subscription;
  issuedAt: ISODate;
  extraLines?: readonly InvoiceLine[];
  taxRatePercent?: number;
  /** Applies the subscription's stored credit balance. */
  applyCredit?: boolean;
}): Invoice {
  const { subscription, issuedAt } = input;
  const t = tier(subscription.tierId);

  const baseLines: InvoiceLine[] =
    subscription.unitPriceMinor > 0n
      ? [
          {
            description: `${t.name} — ${subscription.interval === "ANNUAL" ? "annual" : "monthly"} subscription`,
            quantity: 1,
            unitAmountMinor: subscription.unitPriceMinor,
            amountMinor: subscription.unitPriceMinor,
          },
        ]
      : [];

  const lines = [...baseLines, ...(input.extraLines ?? [])];
  const subtotalMinor = lines.reduce((acc, l) => acc + l.amountMinor, 0n);

  const discountMinor = subscription.discountPercent
    ? (subtotalMinor * BigInt(subscription.discountPercent)) / 100n
    : 0n;

  const afterDiscount = subtotalMinor - discountMinor;
  const taxMinor = input.taxRatePercent
    ? (afterDiscount * BigInt(Math.round(input.taxRatePercent))) / 100n
    : 0n;

  const beforeCredit = afterDiscount + taxMinor;
  // Credit can reduce a bill to zero but never below it — negative invoices become credit notes,
  // which is a different document with different accounting treatment.
  const creditAppliedMinor =
    input.applyCredit !== false && beforeCredit > 0n
      ? subscription.creditMinor > beforeCredit
        ? beforeCredit
        : subscription.creditMinor
      : 0n;

  const totalMinor = beforeCredit - creditAppliedMinor;

  return {
    id: input.id,
    number: nextInvoiceNumber(),
    userId: subscription.userId,
    subscriptionId: subscription.id,
    status: totalMinor <= 0n ? "PAID" : "OPEN",
    currency: subscription.currency,
    lines,
    subtotalMinor,
    discountMinor,
    taxMinor,
    creditAppliedMinor,
    totalMinor,
    amountPaidMinor: totalMinor <= 0n ? 0n : 0n,
    amountRefundedMinor: 0n,
    issuedAt,
    dueAt: addDays(issuedAt, PAYMENT_TERMS_DAYS),
    paidAt: totalMinor <= 0n ? issuedAt : undefined,
    periodStart: subscription.currentPeriodStart,
    periodEnd: subscription.currentPeriodEnd,
    attempts: [],
  };
}

export function recordAttempt(invoice: Invoice, attempt: PaymentAttempt): Invoice {
  const attempts = [...invoice.attempts, attempt];
  if (attempt.outcome === "SUCCEEDED") {
    return {
      ...invoice,
      attempts,
      status: "PAID",
      amountPaidMinor: invoice.totalMinor,
      paidAt: attempt.attemptedAt,
    };
  }
  return { ...invoice, attempts };
}

export function markUncollectible(invoice: Invoice): Invoice {
  return { ...invoice, status: "UNCOLLECTIBLE" };
}

export function voidInvoice(invoice: Invoice): Invoice {
  if (invoice.status === "PAID") {
    throw new Error("A paid invoice cannot be voided — issue a refund instead.");
  }
  return { ...invoice, status: "VOID" };
}

export function refundInvoice(input: {
  invoice: Invoice;
  amountMinor: bigint;
}): Invoice {
  const { invoice, amountMinor } = input;
  if (invoice.status !== "PAID" && invoice.status !== "PARTIALLY_REFUNDED") {
    throw new Error(`Only a paid invoice can be refunded (status: ${invoice.status}).`);
  }
  if (amountMinor <= 0n) throw new Error("Refund amount must be positive.");

  const alreadyRefunded = invoice.amountRefundedMinor;
  const refundable = invoice.amountPaidMinor - alreadyRefunded;
  if (amountMinor > refundable) {
    throw new Error(
      `Refund of ${amountMinor} exceeds the refundable balance of ${refundable} minor units.`,
    );
  }

  const totalRefunded = alreadyRefunded + amountMinor;
  return {
    ...invoice,
    amountRefundedMinor: totalRefunded,
    status: totalRefunded >= invoice.amountPaidMinor ? "REFUNDED" : "PARTIALLY_REFUNDED",
  };
}

export function isOverdue(invoice: Invoice, now: ISODate): boolean {
  return invoice.status === "OPEN" && new Date(now) > new Date(invoice.dueAt);
}

export function outstandingMinor(invoice: Invoice): bigint {
  if (invoice.status === "PAID" || invoice.status === "VOID") return 0n;
  return invoice.totalMinor - invoice.amountPaidMinor;
}

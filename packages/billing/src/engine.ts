/**
 * Billing engine — orchestrates the pieces into the automated payment cycle.
 *
 * `runBillingCycle` is what a scheduled job would call. It is deterministic given its inputs,
 * so a disputed charge can be replayed and explained.
 */

import { addDays, daysBetween, type ISODate } from "@legacy/core";
import {
  MockPaymentProvider,
  attemptFromResult,
  idempotencyKey,
  type PaymentProvider,
} from "./provider";
import { buildInvoice, markUncollectible, recordAttempt } from "./invoice";
import { nextDunningAction } from "./dunning";
import { recordFailedPayment, renew } from "./subscription";
import type { Invoice, Subscription } from "./types";

export interface BillingCycleInput {
  readonly subscriptions: readonly Subscription[];
  readonly invoices: readonly Invoice[];
  readonly now: ISODate;
  readonly provider?: PaymentProvider;
}

export interface BillingCycleResult {
  readonly subscriptions: readonly Subscription[];
  readonly invoices: readonly Invoice[];
  readonly events: readonly BillingEvent[];
}

export interface BillingEvent {
  readonly at: ISODate;
  readonly kind:
    | "invoice.created"
    | "payment.succeeded"
    | "payment.failed"
    | "payment.requires_action"
    | "subscription.renewed"
    | "subscription.past_due"
    | "invoice.uncollectible"
    | "subscription.trial_ended"
    | "dunning.notified";
  readonly userId: string;
  readonly subscriptionId?: string;
  readonly invoiceId?: string;
  readonly detail: string;
  readonly amountMinor?: bigint;
}

let idSeq = 0;
const nextId = (prefix: string) => `${prefix}_${(++idSeq).toString().padStart(6, "0")}`;
export function resetBillingIds(): void {
  idSeq = 0;
}

/**
 * Run one billing cycle: issue invoices that are due, attempt payment on open invoices according
 * to the dunning schedule, and advance subscription state accordingly.
 */
export async function runBillingCycle(input: BillingCycleInput): Promise<BillingCycleResult> {
  const provider = input.provider ?? new MockPaymentProvider();
  const now = input.now;
  const events: BillingEvent[] = [];

  const subscriptions = new Map(input.subscriptions.map((s) => [s.id, s]));
  const invoices = new Map(input.invoices.map((i) => [i.id, i]));

  // --- 1. Issue invoices for subscriptions whose period has ended. --------------------------
  for (const sub of subscriptions.values()) {
    if (sub.status === "CANCELED" || sub.status === "PAUSED") continue;
    if (sub.unitPriceMinor <= 0n) continue; // free tier

    const periodOver = daysBetween(sub.currentPeriodEnd, now) >= 0;
    if (!periodOver) continue;

    if (sub.status === "TRIALING") {
      events.push({
        at: now,
        kind: "subscription.trial_ended",
        userId: sub.userId,
        subscriptionId: sub.id,
        detail: "Trial ended; first invoice issued.",
      });
    }

    // Never invoice the same period twice.
    //
    // Checking only for an OPEN invoice is not enough: once an invoice is written off as
    // UNCOLLECTIBLE the period end is still in the past, so the next cycle would issue another
    // one, and the next, producing a fresh invoice every day for a customer whose card is already
    // failing. Keying on the period is what actually makes this idempotent.
    const alreadyInvoicedForPeriod = [...invoices.values()].some(
      (i) =>
        i.subscriptionId === sub.id &&
        i.periodEnd === sub.currentPeriodEnd &&
        i.status !== "VOID",
    );
    if (alreadyInvoicedForPeriod) continue;

    const invoice = buildInvoice({ id: nextId("inv"), subscription: sub, issuedAt: now });
    invoices.set(invoice.id, invoice);
    events.push({
      at: now,
      kind: "invoice.created",
      userId: sub.userId,
      subscriptionId: sub.id,
      invoiceId: invoice.id,
      detail: `Invoice ${invoice.number} issued.`,
      amountMinor: invoice.totalMinor,
    });

    // A zero-total invoice (fully credited) settles immediately.
    if (invoice.status === "PAID") {
      subscriptions.set(sub.id, renew(sub, now));
      events.push({
        at: now,
        kind: "subscription.renewed",
        userId: sub.userId,
        subscriptionId: sub.id,
        detail: "Covered by account credit; renewed without a charge.",
      });
    }
  }

  // --- 2. Attempt payment on open invoices, per the dunning schedule. ------------------------
  for (const invoice of [...invoices.values()]) {
    if (invoice.status !== "OPEN") continue;
    const sub = subscriptions.get(invoice.subscriptionId);
    if (!sub) continue;

    const action = nextDunningAction({ invoice, subscription: sub, now });

    if (action.kind === "MARK_UNCOLLECTIBLE") {
      invoices.set(invoice.id, markUncollectible(invoice));
      events.push({
        at: now,
        kind: "invoice.uncollectible",
        userId: sub.userId,
        subscriptionId: sub.id,
        invoiceId: invoice.id,
        detail: action.reason,
      });
      continue;
    }

    if (action.kind === "NOTIFY_CUSTOMER" || action.kind === "REQUEST_NEW_PAYMENT_METHOD") {
      events.push({
        at: now,
        kind: "dunning.notified",
        userId: sub.userId,
        subscriptionId: sub.id,
        invoiceId: invoice.id,
        detail: action.kind === "NOTIFY_CUSTOMER" ? `Notified (${action.template}).` : action.reason,
      });
      continue;
    }

    if (action.kind !== "RETRY_PAYMENT") continue;
    if (!sub.paymentMethodId) {
      events.push({
        at: now,
        kind: "dunning.notified",
        userId: sub.userId,
        subscriptionId: sub.id,
        invoiceId: invoice.id,
        detail: "No payment method on file; requested one.",
      });
      continue;
    }

    const key = idempotencyKey(invoice.id, action.attemptNumber);
    const result = await provider.charge({
      idempotencyKey: key,
      amountMinor: invoice.totalMinor - invoice.amountPaidMinor,
      currency: invoice.currency,
      paymentMethodId: sub.paymentMethodId,
      invoiceId: invoice.id,
      attemptNumber: action.attemptNumber,
      at: now,
      description: `Invoice ${invoice.number}`,
    });

    const attempt = attemptFromResult({
      id: nextId("pay"),
      invoiceId: invoice.id,
      amountMinor: invoice.totalMinor - invoice.amountPaidMinor,
      attemptNumber: action.attemptNumber,
      at: now,
      result,
    });

    const updated = recordAttempt(invoice, attempt);
    invoices.set(invoice.id, updated);

    if (result.outcome === "SUCCEEDED") {
      subscriptions.set(sub.id, renew(sub, now));
      events.push({
        at: now,
        kind: "payment.succeeded",
        userId: sub.userId,
        subscriptionId: sub.id,
        invoiceId: invoice.id,
        detail: `Charged successfully (attempt ${action.attemptNumber}).`,
        amountMinor: attempt.amountMinor,
      });
      events.push({
        at: now,
        kind: "subscription.renewed",
        userId: sub.userId,
        subscriptionId: sub.id,
        detail: "Renewed for the next period.",
      });
    } else if (result.outcome === "REQUIRES_ACTION") {
      events.push({
        at: now,
        kind: "payment.requires_action",
        userId: sub.userId,
        subscriptionId: sub.id,
        invoiceId: invoice.id,
        detail: "The bank requires cardholder authentication.",
      });
    } else {
      const failed = recordFailedPayment(sub, now);
      subscriptions.set(sub.id, failed);
      events.push({
        at: now,
        kind: "payment.failed",
        userId: sub.userId,
        subscriptionId: sub.id,
        invoiceId: invoice.id,
        detail: `Declined (${result.declineCode ?? "unknown"}), attempt ${action.attemptNumber}.`,
        amountMinor: attempt.amountMinor,
      });
      if (failed.status === "PAST_DUE" || failed.status === "GRACE") {
        events.push({
          at: now,
          kind: "subscription.past_due",
          userId: sub.userId,
          subscriptionId: sub.id,
          detail: `Subscription is ${failed.status}. Succession plan and Continuity Pack remain unaffected.`,
        });
      }
    }
  }

  return {
    subscriptions: [...subscriptions.values()],
    invoices: [...invoices.values()],
    events,
  };
}

/** Run consecutive daily cycles — used to demonstrate the full dunning path end to end. */
export async function runBillingDays(input: {
  subscriptions: readonly Subscription[];
  invoices: readonly Invoice[];
  from: ISODate;
  days: number;
  provider?: PaymentProvider;
}): Promise<BillingCycleResult> {
  let subscriptions = input.subscriptions;
  let invoices = input.invoices;
  const events: BillingEvent[] = [];
  const provider = input.provider ?? new MockPaymentProvider();

  for (let d = 0; d < input.days; d++) {
    const now = addDays(input.from, d);
    const result = await runBillingCycle({ subscriptions, invoices, now, provider });
    subscriptions = result.subscriptions;
    invoices = result.invoices;
    events.push(...result.events);
  }

  return { subscriptions, invoices, events };
}

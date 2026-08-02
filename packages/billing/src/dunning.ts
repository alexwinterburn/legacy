/**
 * Dunning — the automated collection cycle after a failed payment.
 *
 * Two rules shape this:
 *
 *  1. **Never retry a hard decline.** A card reported lost will decline every time; retrying it
 *     four times achieves nothing and looks like harassment on the customer's statement.
 *
 *  2. **Never let collections touch succession.** Dunning can downgrade features and send email.
 *     It cannot deactivate a plan, block a Continuity Pack export, or stop a beneficiary claiming.
 *     That boundary is enforced in `entitlementFor`, and asserted in the tests.
 */

import { addDays, daysBetween, type ISODate } from "@legacy/core";
import { HARD_DECLINES, type DeclineCode, type Invoice, type Subscription } from "./types";
import { MAX_PAYMENT_ATTEMPTS } from "./subscription";

/** Days after the previous failure before the next retry. Front-loaded, then spaced out. */
export const RETRY_SCHEDULE_DAYS: readonly number[] = [1, 3, 7];

export type DunningAction =
  | { kind: "RETRY_PAYMENT"; dueAt: ISODate; attemptNumber: number }
  | { kind: "NOTIFY_CUSTOMER"; template: string; urgency: "LOW" | "MEDIUM" | "HIGH" }
  | { kind: "REQUEST_NEW_PAYMENT_METHOD"; reason: string }
  | { kind: "MARK_UNCOLLECTIBLE"; reason: string }
  | { kind: "DOWNGRADE_TO_FREE"; reason: string }
  | { kind: "NO_ACTION"; reason: string };

export interface DunningState {
  readonly invoice: Invoice;
  readonly subscription: Subscription;
  readonly now: ISODate;
}

/**
 * Decide the next collection action. Pure — an operator can be shown exactly why the system
 * chose to retry, to stop, or to ask for a new card.
 */
export function nextDunningAction(state: DunningState): DunningAction {
  const { invoice, subscription, now } = state;

  if (invoice.status === "PAID") return { kind: "NO_ACTION", reason: "Invoice is paid." };
  if (invoice.status === "VOID") return { kind: "NO_ACTION", reason: "Invoice was voided." };
  if (invoice.status === "UNCOLLECTIBLE") {
    return { kind: "DOWNGRADE_TO_FREE", reason: "Invoice written off after exhausting retries." };
  }

  const failures = invoice.attempts.filter((a) => a.outcome === "FAILED");
  const last = failures[failures.length - 1];

  if (!last) {
    return invoice.status === "OPEN"
      ? { kind: "RETRY_PAYMENT", dueAt: now, attemptNumber: 1 }
      : { kind: "NO_ACTION", reason: "Nothing due." };
  }

  // Hard declines are terminal for this payment method — retrying is pointless and abusive.
  if (last.declineCode && HARD_DECLINES.includes(last.declineCode)) {
    return {
      kind: "REQUEST_NEW_PAYMENT_METHOD",
      reason: declineExplanation(last.declineCode),
    };
  }

  if (last.outcome === "REQUIRES_ACTION" || last.declineCode === "AUTHENTICATION_REQUIRED") {
    return {
      kind: "NOTIFY_CUSTOMER",
      template: "authentication_required",
      urgency: "HIGH",
    };
  }

  const attemptNumber = failures.length + 1;
  if (attemptNumber > MAX_PAYMENT_ATTEMPTS) {
    return { kind: "MARK_UNCOLLECTIBLE", reason: `Exhausted ${MAX_PAYMENT_ATTEMPTS} attempts.` };
  }

  const waitDays = RETRY_SCHEDULE_DAYS[failures.length - 1] ?? 7;
  const nextRetryAt = addDays(last.attemptedAt, waitDays);

  if (daysBetween(nextRetryAt, now) >= 0) {
    return { kind: "RETRY_PAYMENT", dueAt: nextRetryAt, attemptNumber };
  }

  return {
    kind: "NOTIFY_CUSTOMER",
    template: failures.length === 1 ? "payment_failed_first" : "payment_failed_repeat",
    urgency: failures.length >= 3 ? "HIGH" : failures.length === 2 ? "MEDIUM" : "LOW",
  };
}

export function declineExplanation(code: DeclineCode): string {
  switch (code) {
    case "INSUFFICIENT_FUNDS":
      return "The card had insufficient funds. We'll try again shortly.";
    case "CARD_EXPIRED":
      return "The card has expired. A new payment method is needed — retrying won't help.";
    case "LOST_OR_STOLEN":
      return "The card was reported lost or stolen. A new payment method is needed.";
    case "DO_NOT_HONOR":
      return "The bank declined without a specific reason. We'll retry, then ask for another card.";
    case "PROCESSING_ERROR":
      return "A temporary processing error. This usually succeeds on retry.";
    case "AUTHENTICATION_REQUIRED":
      return "The bank requires the cardholder to authenticate before this payment can complete.";
  }
}

/** Whether a decline code is worth retrying at all. */
export function isRetryable(code: DeclineCode | undefined): boolean {
  if (!code) return true;
  return !HARD_DECLINES.includes(code);
}

export interface DunningQueueEntry {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly userId: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly failedAttempts: number;
  readonly lastDeclineCode?: DeclineCode;
  readonly action: DunningAction;
  readonly daysOverdue: number;
}

export function buildDunningQueue(input: {
  invoices: readonly Invoice[];
  subscriptions: readonly Subscription[];
  now: ISODate;
}): readonly DunningQueueEntry[] {
  const subsById = new Map(input.subscriptions.map((s) => [s.id, s]));

  return input.invoices
    .filter((i) => i.status === "OPEN" || i.status === "UNCOLLECTIBLE")
    .map((invoice) => {
      const subscription = subsById.get(invoice.subscriptionId);
      const failures = invoice.attempts.filter((a) => a.outcome === "FAILED");
      const action = subscription
        ? nextDunningAction({ invoice, subscription, now: input.now })
        : ({ kind: "NO_ACTION", reason: "No subscription found." } as DunningAction);

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        userId: invoice.userId,
        amountMinor: invoice.totalMinor - invoice.amountPaidMinor,
        currency: invoice.currency,
        failedAttempts: failures.length,
        lastDeclineCode: failures[failures.length - 1]?.declineCode,
        action,
        daysOverdue: Math.max(0, Math.floor(daysBetween(invoice.dueAt, input.now))),
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

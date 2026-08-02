/**
 * Payment provider abstraction.
 *
 * The interface is shaped so a real processor (Stripe, Adyen, Paystack) drops in without touching
 * the billing engine. Two properties matter:
 *
 *  1. **Idempotency keys on every charge.** Without them, a network timeout during a retry
 *     double-charges the customer. The key is derived from invoice + attempt number, so a retry
 *     of the same attempt is provably the same charge.
 *
 *  2. **Declines are typed.** A hard decline ("lost or stolen") must not be retried on a schedule;
 *     a soft decline ("insufficient funds") should be. Collapsing both into `false` produces
 *     either abandoned revenue or harassment of a customer whose card is gone.
 *
 * No real processor is integrated here. `MockPaymentProvider` is deterministic so tests and the
 * demo behave identically on every run.
 */

import type { DeclineCode, PaymentAttempt, PaymentOutcome } from "./types";
import type { ISODate } from "@legacy/core";

export interface ChargeRequest {
  readonly idempotencyKey: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly paymentMethodId: string;
  readonly invoiceId: string;
  readonly attemptNumber: number;
  readonly at: ISODate;
  readonly description: string;
}

export interface ChargeResult {
  readonly outcome: PaymentOutcome;
  readonly providerReference: string;
  readonly declineCode?: DeclineCode;
}

export interface PaymentProvider {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(input: { providerReference: string; amountMinor: bigint; idempotencyKey: string }): Promise<{ ok: boolean; reference: string }>;
}

export function idempotencyKey(invoiceId: string, attemptNumber: number): string {
  return `inv_${invoiceId}_attempt_${attemptNumber}`;
}

/**
 * Deterministic mock provider.
 *
 * Behaviour is driven by the payment method id so the demo and tests can exercise every path:
 *   pm_ok_*          → always succeeds
 *   pm_insufficient_* → soft decline (retryable)
 *   pm_stolen_*      → hard decline (must not be retried)
 *   pm_expired_*     → hard decline
 *   pm_3ds_*         → requires action
 *   pm_flaky_*       → fails the first two attempts, then succeeds
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";
  private readonly seen = new Map<string, ChargeResult>();

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    // Idempotency: replaying a key returns the original result rather than charging again.
    const existing = this.seen.get(request.idempotencyKey);
    if (existing) return existing;

    const pm = request.paymentMethodId;
    let result: ChargeResult;

    if (pm.startsWith("pm_insufficient")) {
      result = { outcome: "FAILED", providerReference: `ch_${request.invoiceId}_${request.attemptNumber}`, declineCode: "INSUFFICIENT_FUNDS" };
    } else if (pm.startsWith("pm_stolen")) {
      result = { outcome: "FAILED", providerReference: `ch_${request.invoiceId}_${request.attemptNumber}`, declineCode: "LOST_OR_STOLEN" };
    } else if (pm.startsWith("pm_expired")) {
      result = { outcome: "FAILED", providerReference: `ch_${request.invoiceId}_${request.attemptNumber}`, declineCode: "CARD_EXPIRED" };
    } else if (pm.startsWith("pm_3ds")) {
      result = { outcome: "REQUIRES_ACTION", providerReference: `ch_${request.invoiceId}_${request.attemptNumber}`, declineCode: "AUTHENTICATION_REQUIRED" };
    } else if (pm.startsWith("pm_flaky")) {
      result =
        request.attemptNumber <= 2
          ? { outcome: "FAILED", providerReference: `ch_${request.invoiceId}_${request.attemptNumber}`, declineCode: "PROCESSING_ERROR" }
          : { outcome: "SUCCEEDED", providerReference: `ch_${request.invoiceId}_${request.attemptNumber}` };
    } else {
      result = { outcome: "SUCCEEDED", providerReference: `ch_${request.invoiceId}_${request.attemptNumber}` };
    }

    this.seen.set(request.idempotencyKey, result);
    return result;
  }

  async refund(input: { providerReference: string; amountMinor: bigint; idempotencyKey: string }) {
    return { ok: true, reference: `re_${input.providerReference}` };
  }

  /** Test helper: how many distinct charges actually reached the "processor". */
  chargeCount(): number {
    return this.seen.size;
  }
}

export function attemptFromResult(input: {
  id: string;
  invoiceId: string;
  amountMinor: bigint;
  attemptNumber: number;
  at: ISODate;
  result: ChargeResult;
}): PaymentAttempt {
  return {
    id: input.id,
    invoiceId: input.invoiceId,
    attemptedAt: input.at,
    outcome: input.result.outcome,
    amountMinor: input.amountMinor,
    declineCode: input.result.declineCode,
    providerReference: input.result.providerReference,
    attemptNumber: input.attemptNumber,
  };
}

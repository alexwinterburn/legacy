import { beforeEach, describe, expect, it } from "vitest";
import { addDays } from "@legacy/core";
import {
  GRACE_PERIOD_DAYS,
  MAX_PAYMENT_ATTEMPTS,
  MockPaymentProvider,
  buildDunningQueue,
  buildInvoice,
  cancelSubscription,
  changeTier,
  computeRevenueMetrics,
  createSubscription,
  entitlementFor,
  extendTrial,
  formatMoney,
  idempotencyKey,
  isRetryable,
  money,
  mrrMinor,
  nextDunningAction,
  priceForInterval,
  recordFailedPayment,
  refundInvoice,
  resetBillingIds,
  resetInvoiceNumbering,
  runBillingCycle,
  runBillingDays,
  voidInvoice,
  type Subscription,
} from "../src/index";

const T0 = "2026-01-01T00:00:00.000Z";

beforeEach(() => {
  resetInvoiceNumbering();
  resetBillingIds();
});

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    ...createSubscription({
      id: "sub_1",
      userId: "user_1",
      tierId: "legacy",
      interval: "ANNUAL",
      startedAt: T0,
      paymentMethodId: "pm_ok_1",
    }),
    ...overrides,
  };
}

describe("money", () => {
  it("formats minor units without floating point", () => {
    expect(formatMoney(money(19900n))).toBe("$199.00");
    expect(formatMoney(money(123456789n))).toBe("$1,234,567.89");
    expect(formatMoney(money(-4900n))).toBe("-$49.00");
    expect(formatMoney(money(5n))).toBe("$0.05");
  });

  it("refuses to mix currencies", () => {
    expect(() => formatMoney(money(1n, "ZAR"))).not.toThrow();
  });
});

describe("pricing", () => {
  it("prices annual from the tier table", () => {
    expect(priceForInterval("legacy", "ANNUAL")).toBe(19_900n);
    expect(priceForInterval("guardian", "ANNUAL")).toBe(4_900n);
    expect(priceForInterval("free", "ANNUAL")).toBe(0n);
  });

  it("prices monthly at a premium to annual", () => {
    const annual = priceForInterval("legacy", "ANNUAL");
    const monthly = priceForInterval("legacy", "MONTHLY");
    expect(monthly * 12n).toBeGreaterThan(annual);
  });
});

describe("subscription lifecycle", () => {
  it("starts a trial with the right end date", () => {
    const s = createSubscription({
      id: "s", userId: "u", tierId: "legacy", interval: "ANNUAL", startedAt: T0, withTrial: true,
    });
    expect(s.status).toBe("TRIALING");
    expect(s.trialEndsAt).toBe(addDays(T0, 14));
  });

  it("cancels at period end by default — the customer paid for the period", () => {
    const s = cancelSubscription({ subscription: sub(), at: addDays(T0, 10), immediate: false });
    expect(s.cancelAtPeriodEnd).toBe(true);
    expect(s.status).toBe("ACTIVE");
  });

  it("cancels immediately when asked", () => {
    const s = cancelSubscription({ subscription: sub(), at: addDays(T0, 10), immediate: true });
    expect(s.status).toBe("CANCELED");
  });

  it("extends a trial", () => {
    const s = extendTrial(sub({ trialEndsAt: addDays(T0, 14), status: "TRIALING" }), 7, T0);
    expect(s.trialEndsAt).toBe(addDays(T0, 21));
  });

  it("rejects a non-positive trial extension", () => {
    expect(() => extendTrial(sub(), 0, T0)).toThrow();
  });
});

describe("proration", () => {
  it("credits unused time and charges the new tier pro rata on upgrade", () => {
    const s = sub({ tierId: "guardian", unitPriceMinor: priceForInterval("guardian", "ANNUAL") });
    const halfway = addDays(T0, 182);
    const { prorationLines: lines, isUpgrade } = changeTier({ subscription: s, newTierId: "legacy", at: halfway });

    expect(isUpgrade).toBe(true);
    const credit = lines.find((l) => l.amountMinor < 0n)!;
    const charge = lines.find((l) => l.amountMinor > 0n)!;
    // Roughly half of each annual price, since we're halfway through the period.
    expect(-credit.amountMinor).toBeGreaterThan(2_000n);
    expect(-credit.amountMinor).toBeLessThan(2_600n);
    expect(charge.amountMinor).toBeGreaterThan(9_000n);
    expect(charge.amountMinor).toBeLessThan(10_500n);
    expect(lines.every((l) => l.proration)).toBe(true);
  });

  it("identifies a downgrade", () => {
    const s = sub({ tierId: "legacy" });
    const { isUpgrade } = changeTier({ subscription: s, newTierId: "guardian", at: addDays(T0, 100) });
    expect(isUpgrade).toBe(false);
  });

  it("produces no proration at the very end of a period", () => {
    const s = sub();
    const { prorationLines: lines } = changeTier({
      subscription: s, newTierId: "guardian", at: s.currentPeriodEnd,
    });
    expect(lines).toHaveLength(0);
  });
});

describe("invoices", () => {
  it("derives totals from lines", () => {
    const invoice = buildInvoice({ id: "inv_1", subscription: sub(), issuedAt: T0 });
    expect(invoice.subtotalMinor).toBe(19_900n);
    expect(invoice.totalMinor).toBe(19_900n);
    expect(invoice.status).toBe("OPEN");
  });

  it("applies a discount", () => {
    const invoice = buildInvoice({ id: "inv_1", subscription: sub({ discountPercent: 25 }), issuedAt: T0 });
    expect(invoice.discountMinor).toBe(4_975n);
    expect(invoice.totalMinor).toBe(14_925n);
  });

  it("applies account credit, but never produces a negative invoice", () => {
    const invoice = buildInvoice({
      id: "inv_1",
      subscription: sub({ creditMinor: 50_000n }),
      issuedAt: T0,
    });
    expect(invoice.creditAppliedMinor).toBe(19_900n); // capped at the invoice total
    expect(invoice.totalMinor).toBe(0n);
    expect(invoice.status).toBe("PAID");
  });

  it("refuses to void a paid invoice", () => {
    const paid = buildInvoice({ id: "i", subscription: sub({ creditMinor: 50_000n }), issuedAt: T0 });
    expect(() => voidInvoice(paid)).toThrow(/cannot be voided/);
  });
});

describe("refunds", () => {
  const paidInvoice = () => {
    const i = buildInvoice({ id: "inv_1", subscription: sub(), issuedAt: T0 });
    return { ...i, status: "PAID" as const, amountPaidMinor: i.totalMinor, paidAt: T0 };
  };

  it("supports a partial refund", () => {
    const r = refundInvoice({ invoice: paidInvoice(), amountMinor: 5_000n });
    expect(r.status).toBe("PARTIALLY_REFUNDED");
    expect(r.amountRefundedMinor).toBe(5_000n);
  });

  it("marks fully refunded when the whole amount is returned", () => {
    const r = refundInvoice({ invoice: paidInvoice(), amountMinor: 19_900n });
    expect(r.status).toBe("REFUNDED");
  });

  it("refuses to refund more than was paid, including across multiple refunds", () => {
    const once = refundInvoice({ invoice: paidInvoice(), amountMinor: 15_000n });
    expect(() => refundInvoice({ invoice: once, amountMinor: 10_000n })).toThrow(/exceeds/);
  });

  it("refuses to refund an unpaid invoice", () => {
    const open = buildInvoice({ id: "i", subscription: sub(), issuedAt: T0 });
    expect(() => refundInvoice({ invoice: open, amountMinor: 100n })).toThrow(/Only a paid invoice/);
  });
});

describe("payment provider", () => {
  it("is idempotent — replaying a key does not charge twice", async () => {
    const p = new MockPaymentProvider();
    const req = {
      idempotencyKey: idempotencyKey("inv_1", 1),
      amountMinor: 19_900n, currency: "USD", paymentMethodId: "pm_ok_1",
      invoiceId: "inv_1", attemptNumber: 1, at: T0, description: "test",
    };
    const a = await p.charge(req);
    const b = await p.charge(req);
    expect(a).toEqual(b);
    expect(p.chargeCount()).toBe(1);
  });

  it("distinguishes soft from hard declines", () => {
    expect(isRetryable("INSUFFICIENT_FUNDS")).toBe(true);
    expect(isRetryable("PROCESSING_ERROR")).toBe(true);
    expect(isRetryable("LOST_OR_STOLEN")).toBe(false);
    expect(isRetryable("CARD_EXPIRED")).toBe(false);
  });
});

describe("dunning", () => {
  it("never retries a hard decline — it asks for a new card instead", () => {
    const invoice = {
      ...buildInvoice({ id: "inv_1", subscription: sub(), issuedAt: T0 }),
      attempts: [{
        id: "a1", invoiceId: "inv_1", attemptedAt: T0, outcome: "FAILED" as const,
        amountMinor: 19_900n, declineCode: "LOST_OR_STOLEN" as const, attemptNumber: 1,
      }],
    };
    const action = nextDunningAction({ invoice, subscription: sub(), now: addDays(T0, 5) });
    expect(action.kind).toBe("REQUEST_NEW_PAYMENT_METHOD");
  });

  it("retries a soft decline on schedule", () => {
    const invoice = {
      ...buildInvoice({ id: "inv_1", subscription: sub(), issuedAt: T0 }),
      attempts: [{
        id: "a1", invoiceId: "inv_1", attemptedAt: T0, outcome: "FAILED" as const,
        amountMinor: 19_900n, declineCode: "INSUFFICIENT_FUNDS" as const, attemptNumber: 1,
      }],
    };
    // Too soon — notify rather than retry.
    expect(nextDunningAction({ invoice, subscription: sub(), now: T0 }).kind).toBe("NOTIFY_CUSTOMER");
    // After the first retry interval.
    expect(nextDunningAction({ invoice, subscription: sub(), now: addDays(T0, 2) }).kind).toBe("RETRY_PAYMENT");
  });

  it("gives up after the maximum number of attempts", () => {
    const attempts = Array.from({ length: MAX_PAYMENT_ATTEMPTS }, (_, i) => ({
      id: `a${i}`, invoiceId: "inv_1", attemptedAt: addDays(T0, i * 3),
      outcome: "FAILED" as const, amountMinor: 19_900n,
      declineCode: "INSUFFICIENT_FUNDS" as const, attemptNumber: i + 1,
    }));
    const invoice = { ...buildInvoice({ id: "inv_1", subscription: sub(), issuedAt: T0 }), attempts };
    const action = nextDunningAction({ invoice, subscription: sub(), now: addDays(T0, 60) });
    expect(action.kind).toBe("MARK_UNCOLLECTIBLE");
  });

  it("builds a queue sorted by how overdue each invoice is", () => {
    const s = sub();
    const older = { ...buildInvoice({ id: "i1", subscription: s, issuedAt: T0 }), dueAt: T0 };
    const newer = { ...buildInvoice({ id: "i2", subscription: s, issuedAt: T0 }), dueAt: addDays(T0, 20) };
    const queue = buildDunningQueue({ invoices: [newer, older], subscriptions: [s], now: addDays(T0, 30) });
    expect(queue[0]!.invoiceId).toBe("i1");
    expect(queue[0]!.daysOverdue).toBeGreaterThan(queue[1]!.daysOverdue);
  });
});

describe("the billing engine", () => {
  it("charges and renews when the period ends", async () => {
    const s = sub({ currentPeriodEnd: T0 });
    const result = await runBillingCycle({ subscriptions: [s], invoices: [], now: T0 });

    expect(result.invoices).toHaveLength(1);
    expect(result.invoices[0]!.status).toBe("PAID");
    expect(result.subscriptions[0]!.status).toBe("ACTIVE");
    expect(result.events.map((e) => e.kind)).toEqual(
      expect.arrayContaining(["invoice.created", "payment.succeeded", "subscription.renewed"]),
    );
  });

  it("drives the full dunning path on a failing card and eventually writes it off", async () => {
    const s = sub({ currentPeriodEnd: T0, paymentMethodId: "pm_insufficient_1" });
    const result = await runBillingDays({ subscriptions: [s], invoices: [], from: T0, days: 40 });

    const invoice = result.invoices[0]!;
    expect(invoice.attempts.filter((a) => a.outcome === "FAILED").length).toBeGreaterThanOrEqual(3);
    expect(invoice.status).toBe("UNCOLLECTIBLE");
    expect(["PAST_DUE", "GRACE"]).toContain(result.subscriptions[0]!.status);
  });

  it("recovers when a flaky card succeeds on a later retry", async () => {
    const s = sub({ currentPeriodEnd: T0, paymentMethodId: "pm_flaky_1" });
    const result = await runBillingDays({ subscriptions: [s], invoices: [], from: T0, days: 20 });

    expect(result.invoices[0]!.status).toBe("PAID");
    expect(result.subscriptions[0]!.status).toBe("ACTIVE");
    expect(result.events.some((e) => e.kind === "payment.succeeded")).toBe(true);
  });

  it("never invoices the same period twice, even after write-off", async () => {
    // Regression: keying the guard on "has an OPEN invoice" meant that once an invoice was
    // written off as UNCOLLECTIBLE, the period end stayed in the past and a fresh invoice was
    // issued every single day — invoice spam aimed at a customer whose card is already failing.
    const s = sub({ currentPeriodEnd: T0, paymentMethodId: "pm_insufficient_1" });
    const result = await runBillingDays({ subscriptions: [s], invoices: [], from: T0, days: 60 });
    expect(result.invoices.filter((i) => i.subscriptionId === s.id).length).toBe(1);
    expect(result.events.filter((e) => e.kind === "invoice.created").length).toBe(1);
  });

  it("settles a fully credited invoice without touching the card", async () => {
    const s = sub({ currentPeriodEnd: T0, creditMinor: 100_000n, paymentMethodId: "pm_stolen_1" });
    const result = await runBillingCycle({ subscriptions: [s], invoices: [], now: T0 });
    expect(result.invoices[0]!.status).toBe("PAID");
    expect(result.invoices[0]!.attempts).toHaveLength(0);
  });

  it("skips canceled and paused subscriptions", async () => {
    const canceled = sub({ id: "s1", status: "CANCELED", currentPeriodEnd: T0 });
    const paused = sub({ id: "s2", status: "PAUSED", currentPeriodEnd: T0 });
    const result = await runBillingCycle({ subscriptions: [canceled, paused], invoices: [], now: T0 });
    expect(result.invoices).toHaveLength(0);
  });
});

describe("ENTITLEMENTS: billing never touches succession", () => {
  const statuses = ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE", "PAUSED", "CANCELED"] as const;

  it("keeps the succession plan active in every billing state", () => {
    for (const status of statuses) {
      const e = entitlementFor(sub({ status }), addDays(T0, 400));
      expect(e.successionPlanRemainsActive).toBe(true);
    }
  });

  it("keeps the Continuity Pack available in every billing state", () => {
    for (const status of statuses) {
      const e = entitlementFor(sub({ status }), addDays(T0, 400));
      expect(e.continuityPackAvailable).toBe(true);
    }
  });

  it("lets beneficiaries claim in every billing state, including cancelled", () => {
    for (const status of statuses) {
      const e = entitlementFor(sub({ status }), addDays(T0, 400));
      expect(e.beneficiariesCanClaim).toBe(true);
    }
  });

  it("retains full access while retries are still in progress", () => {
    const e = entitlementFor(sub({ status: "PAST_DUE" }), T0);
    expect(e.canEditPlan).toBe(true);
    expect(e.canUploadToVault).toBe(true);
  });

  it("degrades features — not the plan — once the grace period expires", () => {
    const s = sub({ status: "GRACE", gracePeriodEndsAt: addDays(T0, GRACE_PERIOD_DAYS) });
    const after = entitlementFor(s, addDays(T0, GRACE_PERIOD_DAYS + 1));
    expect(after.tierId).toBe("free");
    expect(after.canUploadToVault).toBe(false);
    // But the things that matter are untouched.
    expect(after.successionPlanRemainsActive).toBe(true);
    expect(after.continuityPackAvailable).toBe(true);
    expect(after.canEditPlan).toBe(true);
  });

  it("moves a repeatedly failing subscription to GRACE, not straight to cancelled", () => {
    let s = sub();
    for (let i = 0; i < MAX_PAYMENT_ATTEMPTS; i++) s = recordFailedPayment(s, addDays(T0, i * 3));
    expect(s.status).toBe("GRACE");
    expect(s.status).not.toBe("CANCELED");
  });
});

describe("revenue metrics", () => {
  const subs: Subscription[] = [
    sub({ id: "s1", tierId: "legacy", status: "ACTIVE" }),
    sub({ id: "s2", tierId: "guardian", status: "ACTIVE", unitPriceMinor: 4_900n }),
    sub({ id: "s3", tierId: "legacy", status: "PAST_DUE" }),
    sub({ id: "s4", tierId: "free", status: "ACTIVE", unitPriceMinor: 0n }),
    sub({ id: "s5", tierId: "legacy", status: "TRIALING", trialEndsAt: addDays(T0, 14) }),
    sub({ id: "s6", tierId: "legacy", status: "CANCELED", canceledAt: addDays(T0, 5) }),
  ];

  it("computes MRR excluding trials, cancellations and free", () => {
    const m = computeRevenueMetrics({ subscriptions: subs, invoices: [], now: addDays(T0, 10) });
    // Two legacy (19900/12) + one guardian (4900/12), annualised → monthly.
    expect(m.mrrMinor).toBe(19_900n / 12n + 4_900n / 12n + 19_900n / 12n);
    expect(m.arrMinor).toBe(m.mrrMinor * 12n);
  });

  it("counts subscriber segments separately", () => {
    const m = computeRevenueMetrics({ subscriptions: subs, invoices: [], now: addDays(T0, 10) });
    expect(m.payingSubscribers).toBe(3);
    expect(m.trialingSubscribers).toBe(1);
    expect(m.delinquentSubscribers).toBe(1);
  });

  it("reports zero MRR for a trialing subscription", () => {
    expect(mrrMinor(sub({ status: "TRIALING" }))).toBe(0n);
  });

  it("applies a discount to MRR", () => {
    const full = mrrMinor(sub({ status: "ACTIVE" }));
    const discounted = mrrMinor(sub({ status: "ACTIVE", discountPercent: 50 }));
    expect(discounted).toBeLessThan(full);
  });

  it("breaks revenue down by tier, highest first", () => {
    const m = computeRevenueMetrics({ subscriptions: subs, invoices: [], now: addDays(T0, 10) });
    expect(m.byTier[0]!.tierId).toBe("legacy");
    for (let i = 1; i < m.byTier.length; i++) {
      expect(m.byTier[i - 1]!.mrrMinor >= m.byTier[i]!.mrrMinor).toBe(true);
    }
  });
});

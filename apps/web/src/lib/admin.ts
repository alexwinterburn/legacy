/**
 * Administrative operations.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *  THE BOUNDARY
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * Staff have complete control over the commercial relationship — the account, the subscription,
 * the money — and none whatsoever over the succession mechanism.
 *
 * That split is what makes the product's central claim true. If an administrator could edit a
 * customer's beneficiaries or release their assets, then "never a sufficient party" would be
 * marketing rather than architecture. So the corresponding functions are not gated behind a
 * permission check — they are **absent**, and `FORBIDDEN_CAPABILITIES` documents why, with a
 * test asserting no such export appears.
 *
 * Everything here writes to the admin audit log, which surfaces in the affected user's own
 * timeline. Staff actions are visible to the customer they were taken against.
 */

import { addDays, tier, type TierId } from "@legacy/core";
import {
  MockPaymentProvider,
  applyCredit as applyCreditToSub,
  buildInvoice,
  cancelSubscription,
  changeTier,
  extendTrial,
  pauseSubscription,
  refundInvoice,
  resumeSubscription,
  runBillingCycle,
  voidInvoice,
  type BillingEvent,
  type Invoice,
  type Subscription,
} from "@legacy/billing";
import { appendAdminAudit, getWorld, mutate } from "./store";

export type AdminRole = "SUPPORT" | "VERIFIER" | "RISK" | "OPERATOR" | "BILLING";

export interface AdminActor {
  readonly id: string;
  readonly name: string;
  readonly role: AdminRole;
}

/** The signed-in operator in this demo. In production this comes from the session. */
export const CURRENT_ADMIN: AdminActor = { id: "officer-a", name: "R. Mbeki", role: "OPERATOR" };

/**
 * Capabilities deliberately not implemented, with the reason. Rendered in the admin UI so the
 * boundary is visible to staff rather than buried in a design document.
 */
export const FORBIDDEN_CAPABILITIES: readonly { capability: string; reason: string }[] = [
  { capability: "Edit a customer's beneficiaries or allocations", reason: "Would make us a sufficient party to redirect an estate. No write path exists." },
  { capability: "Declare a customer deceased", reason: "Staff record evidence; the confidence engine computes. No override exists." },
  { capability: "Shorten a cooling-off period", reason: "The delay is the customer's protection against a false claim, including one we cause." },
  { capability: "Release, move or freeze customer assets", reason: "We never hold sufficient key material. There is nothing to release." },
  { capability: "Export a customer's Continuity Pack on their behalf", reason: "It contains key material references. Only the account holder, after step-up auth." },
  { capability: "Read Family Vault contents", reason: "End-to-end encrypted. Our key share alone cannot decrypt anything." },
  { capability: "Rank customers by portfolio value", reason: "That report is a kidnap-and-ransom target list. Deliberately not built." },
];

function audit(input: { action: string; targetUserId?: string; detail: string; reversible: boolean }) {
  appendAdminAudit({
    actorId: CURRENT_ADMIN.id,
    actorRole: CURRENT_ADMIN.role,
    ...input,
  });
}

// --- Account controls ----------------------------------------------------------------------------

export function setUserStatus(userId: string, status: "ACTIVE" | "SUSPENDED" | "INVESTIGATING", reason: string): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.status = status;
  });
  audit({
    action: `user.${status.toLowerCase()}`,
    targetUserId: userId,
    detail: `Account status set to ${status}. ${reason}`,
    reversible: true,
  });
}

export function addInternalNote(userId: string, note: string): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.internalNotes.unshift(`${new Date().toISOString().slice(0, 10)} — ${CURRENT_ADMIN.name}: ${note}`);
  });
  audit({ action: "user.note_added", targetUserId: userId, detail: note, reversible: false });
}

export function resetMfa(userId: string, reason: string): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.mfaEnabled = false;
    user.registeredDeviceCount = 0;
  });
  audit({
    action: "user.mfa_reset",
    targetUserId: userId,
    // Worth being explicit: this restores access, it does not grant plan-editing power.
    detail: `MFA and devices cleared so the customer can re-enrol. ${reason} Plan changes still require step-up auth from the customer.`,
    reversible: false,
  });
}

export function markIdentityVerified(userId: string, verified: boolean): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.identityVerified = verified;
  });
  audit({
    action: verified ? "user.identity_verified" : "user.identity_revoked",
    targetUserId: userId,
    detail: verified ? "Identity documents reviewed and accepted." : "Identity verification revoked.",
    reversible: true,
  });
}

// --- Subscription controls -----------------------------------------------------------------------

function updateSubscription(userId: string, fn: (s: Subscription) => Subscription): Subscription {
  return mutate((w) => {
    const idx = w.subscriptions.findIndex((s) => s.userId === userId);
    if (idx < 0) throw new Error("Subscription not found");
    const next = fn(w.subscriptions[idx]!);
    w.subscriptions[idx] = next;
    return next;
  });
}

export function adminChangeTier(userId: string, newTierId: TierId, at = new Date().toISOString()): void {
  let prorationDescription = "";
  updateSubscription(userId, (s) => {
    const result = changeTier({ subscription: s, newTierId, at });
    prorationDescription = result.prorationLines.map((l) => l.description).join("; ") || "no proration";
    return result.subscription;
  });
  audit({
    action: "subscription.tier_changed",
    targetUserId: userId,
    detail: `Moved to ${tier(newTierId).name}. Proration: ${prorationDescription}.`,
    reversible: true,
  });
}

export function adminCancelSubscription(userId: string, immediate: boolean, reason: string): void {
  updateSubscription(userId, (s) => cancelSubscription({ subscription: s, at: new Date().toISOString(), immediate }));
  audit({
    action: "subscription.canceled",
    targetUserId: userId,
    detail: `${immediate ? "Cancelled immediately" : "Cancels at period end"}. ${reason} The succession plan and Continuity Pack are unaffected.`,
    reversible: true,
  });
}

export function adminResumeSubscription(userId: string): void {
  updateSubscription(userId, resumeSubscription);
  audit({ action: "subscription.resumed", targetUserId: userId, detail: "Subscription reinstated.", reversible: true });
}

export function adminPauseSubscription(userId: string, reason: string): void {
  updateSubscription(userId, (s) => pauseSubscription(s, new Date().toISOString()));
  audit({ action: "subscription.paused", targetUserId: userId, detail: reason, reversible: true });
}

export function adminApplyCredit(userId: string, amountMinor: bigint, reason: string): void {
  updateSubscription(userId, (s) => applyCreditToSub(s, amountMinor));
  audit({
    action: "subscription.credit_applied",
    targetUserId: userId,
    detail: `Applied $${(Number(amountMinor) / 100).toFixed(2)} credit. ${reason}`,
    reversible: false,
  });
}

export function adminExtendTrial(userId: string, days: number): void {
  updateSubscription(userId, (s) => extendTrial(s, days, new Date().toISOString()));
  audit({ action: "subscription.trial_extended", targetUserId: userId, detail: `Trial extended by ${days} days.`, reversible: false });
}

export function adminSetDiscount(userId: string, percent: number, reason: string): void {
  if (percent < 0 || percent > 100) throw new Error("Discount must be between 0 and 100.");
  updateSubscription(userId, (s) => ({ ...s, discountPercent: percent || undefined }));
  audit({ action: "subscription.discount_set", targetUserId: userId, detail: `Discount set to ${percent}%. ${reason}`, reversible: true });
}

// --- Invoice and payment controls ----------------------------------------------------------------

export function adminRefund(invoiceId: string, amountMinor: bigint, reason: string): void {
  const userId = mutate((w) => {
    const idx = w.invoices.findIndex((i) => i.id === invoiceId);
    if (idx < 0) throw new Error("Invoice not found");
    w.invoices[idx] = refundInvoice({ invoice: w.invoices[idx]!, amountMinor });
    return w.invoices[idx]!.userId;
  });
  audit({
    action: "invoice.refunded",
    targetUserId: userId,
    detail: `Refunded $${(Number(amountMinor) / 100).toFixed(2)} on ${invoiceId}. ${reason}`,
    reversible: false,
  });
}

export function adminVoidInvoice(invoiceId: string, reason: string): void {
  const userId = mutate((w) => {
    const idx = w.invoices.findIndex((i) => i.id === invoiceId);
    if (idx < 0) throw new Error("Invoice not found");
    w.invoices[idx] = voidInvoice(w.invoices[idx]!);
    return w.invoices[idx]!.userId;
  });
  audit({ action: "invoice.voided", targetUserId: userId, detail: `Voided ${invoiceId}. ${reason}`, reversible: false });
}

export function adminIssueInvoice(userId: string): Invoice {
  const invoice = mutate((w) => {
    const sub = w.subscriptions.find((s) => s.userId === userId);
    if (!sub) throw new Error("Subscription not found");
    const inv = buildInvoice({
      id: `inv_manual_${Math.random().toString(36).slice(2, 8)}`,
      subscription: sub,
      issuedAt: new Date().toISOString(),
    });
    w.invoices.push(inv);
    return inv;
  });
  audit({ action: "invoice.issued", targetUserId: userId, detail: `Manually issued ${invoice.number}.`, reversible: true });
  return invoice;
}

/** Force an immediate collection attempt on a specific invoice, outside the retry schedule. */
export async function adminRetryPayment(invoiceId: string): Promise<readonly BillingEvent[]> {
  const world = getWorld();
  const invoice = world.invoices.find((i) => i.id === invoiceId);
  if (!invoice) throw new Error("Invoice not found");
  const subscription = world.subscriptions.find((s) => s.id === invoice.subscriptionId);
  if (!subscription) throw new Error("Subscription not found");

  // Reset the retry clock so the dunning schedule permits an attempt right now.
  const nudged: Invoice = {
    ...invoice,
    attempts: invoice.attempts.map((a) => ({ ...a, attemptedAt: addDays(new Date().toISOString(), -30) })),
  };

  const result = await runBillingCycle({
    subscriptions: [subscription],
    invoices: [nudged],
    now: new Date().toISOString(),
    provider: new MockPaymentProvider(),
  });

  mutate((w) => {
    for (const inv of result.invoices) {
      const idx = w.invoices.findIndex((i) => i.id === inv.id);
      if (idx >= 0) w.invoices[idx] = inv;
    }
    for (const s of result.subscriptions) {
      const idx = w.subscriptions.findIndex((x) => x.id === s.id);
      if (idx >= 0) w.subscriptions[idx] = s;
    }
  });

  audit({
    action: "payment.manual_retry",
    targetUserId: invoice.userId,
    detail: `Forced a collection attempt on ${invoice.number}: ${result.events.map((e) => e.kind).join(", ") || "no action taken"}.`,
    reversible: false,
  });
  return result.events;
}

/** Run the automated billing cycle across the whole book. */
export async function runBillingForAll(): Promise<readonly BillingEvent[]> {
  const world = getWorld();
  const result = await runBillingCycle({
    subscriptions: world.subscriptions,
    invoices: world.invoices,
    now: new Date().toISOString(),
    provider: new MockPaymentProvider(),
  });

  mutate((w) => {
    w.subscriptions = [...result.subscriptions];
    w.invoices = [...result.invoices];
    w.lastBillingRunAt = new Date().toISOString();
  });

  audit({
    action: "billing.cycle_run",
    detail: `Ran the billing cycle across ${world.subscriptions.length} subscriptions; ${result.events.length} events.`,
    reversible: false,
  });
  return result.events;
}

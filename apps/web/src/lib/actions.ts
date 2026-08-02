"use server";

/**
 * Server actions.
 *
 * Every mutation the UI can perform goes through here, is validated, and writes an audit entry.
 * Errors are returned as values rather than thrown, so the UI can render them next to the field
 * that caused them instead of blowing up a page.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { token, type Chain } from "@legacy/core";
import { adapterFor } from "@legacy/blockchain";
import { makeRule, validateAllocationInput, type RuleType } from "@legacy/succession";
import * as store from "./store";
import * as admin from "./admin";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const OK = (message?: string): ActionResult => ({ ok: true, message });
const FAIL = (error: string): ActionResult => ({ ok: false, error });

function refreshOwner() {
  for (const p of ["/app", "/app/beneficiaries", "/app/assets", "/app/succession", "/app/timeline", "/app/continuity", "/app/simulator"]) {
    revalidatePath(p);
  }
}

function refreshAdmin() {
  for (const p of ["/admin", "/admin/users", "/admin/subscriptions", "/admin/payments", "/admin/dunning", "/admin/revenue"]) {
    revalidatePath(p);
  }
}

function fail(e: unknown): ActionResult {
  return FAIL(e instanceof Error ? e.message : "Something went wrong.");
}

// --- Owner: beneficiaries -------------------------------------------------------------------------

const BeneficiaryInput = z.object({
  fullName: z.string().min(2, "Enter a full name."),
  relationship: z.string().min(2, "Enter a relationship."),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
  country: z.string().min(2).max(2, "Use a two-letter country code."),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().optional(),
});

export async function addBeneficiaryAction(formData: FormData): Promise<ActionResult> {
  const parsed = BeneficiaryInput.safeParse({
    fullName: formData.get("fullName"),
    relationship: formData.get("relationship"),
    dateOfBirth: formData.get("dateOfBirth"),
    country: (formData.get("country") as string)?.toUpperCase(),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) return FAIL(parsed.error.issues[0]!.message);

  try {
    const b = store.addBeneficiary("user-alex", {
      ...parsed.data,
      contactVerified: false,
      identityVerified: false,
    });
    store.appendAudit({
      actorType: "USER", actorId: "user-alex", action: "beneficiary.added",
      payload: { name: b.fullName, share: "0%" },
    });
    refreshOwner();
    return OK(`${b.fullName} added. Allocate them a share to complete the change.`);
  } catch (e) {
    return fail(e);
  }
}

export async function removeBeneficiaryAction(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("beneficiaryId") ?? "");
  if (!id) return FAIL("Missing beneficiary.");
  try {
    const user = store.primaryUser();
    const name = user.beneficiaries.find((b) => b.id === id)?.fullName ?? id;
    store.removeBeneficiary("user-alex", id);
    store.appendAudit({
      actorType: "USER", actorId: "user-alex", action: "beneficiary.removed", payload: { name },
    });
    refreshOwner();
    return OK(`${name} removed. Reallocate the remaining share to reach 100%.`);
  } catch (e) {
    return fail(e);
  }
}

export async function verifyBeneficiaryContactAction(formData: FormData): Promise<ActionResult> {
  const id = String(formData.get("beneficiaryId") ?? "");
  try {
    store.updateBeneficiary("user-alex", id, { contactVerified: true });
    store.appendAudit({
      actorType: "USER", actorId: "user-alex", action: "beneficiary.contact_verified", payload: { id },
    });
    refreshOwner();
    return OK("Contact details confirmed.");
  } catch (e) {
    return fail(e);
  }
}

export async function setAllocationsAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = store.primaryUser();
    const allocations = user.beneficiaries.map((b) => ({
      beneficiaryId: b.id,
      basisPoints: Math.round(Number(formData.get(`share_${b.id}`) ?? 0) * 100),
    }));

    const check = validateAllocationInput(allocations);
    if (!check.ok) return FAIL(check.error);

    store.setAllocations("user-alex", allocations);
    store.appendAudit({
      actorType: "USER", actorId: "user-alex", action: "beneficiary.changed",
      payload: { allocations: allocations.map((a) => `${a.beneficiaryId}:${a.basisPoints}`).join(",") },
    });
    refreshOwner();
    return OK("Allocations updated. In production this would enter a 72-hour pending window.");
  } catch (e) {
    return fail(e);
  }
}

// --- Owner: wallets and assets --------------------------------------------------------------------

export async function addWalletAction(formData: FormData): Promise<ActionResult> {
  const chain = String(formData.get("chain") ?? "") as Chain;
  const address = String(formData.get("address") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim() || "Untitled wallet";

  if (!["bitcoin", "ethereum", "solana"].includes(chain)) return FAIL("Choose a chain.");
  if (!address) return FAIL("Enter an address.");

  const validation = adapterFor(chain).validateAddress(address);
  if (!validation.valid) return FAIL(`That isn't a valid ${chain} address: ${validation.reason}`);

  try {
    store.addWallet("user-alex", { chain, address, label });
    store.appendAudit({
      actorType: "USER", actorId: "user-alex", action: "wallet.added", payload: { chain, label },
    });
    refreshOwner();
    return OK(`${label} registered (${validation.kind}). Prove ownership to move it beyond "declared".`);
  } catch (e) {
    return fail(e);
  }
}

export async function removeWalletAction(formData: FormData): Promise<ActionResult> {
  try {
    store.removeWallet("user-alex", String(formData.get("walletId") ?? ""));
    refreshOwner();
    return OK("Wallet removed.");
  } catch (e) {
    return fail(e);
  }
}

export async function proveOwnershipAction(formData: FormData): Promise<ActionResult> {
  const walletId = String(formData.get("walletId") ?? "");
  try {
    store.proveWalletOwnership("user-alex", walletId);
    store.appendAudit({
      actorType: "USER", actorId: "user-alex", action: "wallet.ownership_proven",
      payload: { walletId, note: "Demo: signature verification is simulated." },
    });
    refreshOwner();
    return OK("Ownership proven. In production this verifies a real BIP-322 or EIP-191 signature.");
  } catch (e) {
    return fail(e);
  }
}

export async function addAssetAction(formData: FormData): Promise<ActionResult> {
  const walletId = String(formData.get("walletId") ?? "");
  const symbol = String(formData.get("symbol") ?? "").toUpperCase();
  const amount = String(formData.get("amount") ?? "").trim();

  if (!walletId) return FAIL("Choose a wallet.");
  if (!amount) return FAIL("Enter an amount.");

  try {
    const t = token(symbol);
    const { parseAmount } = await import("@legacy/core");
    const parsed = parseAmount(amount, t.decimals, symbol);
    const { INDICATIVE_PRICES } = await import("./seed");

    const user = store.primaryUser();
    const wallet = user.wallets.find((w) => w.id === walletId);
    if (!wallet) return FAIL("Wallet not found.");
    if (wallet.chain !== t.chain) {
      return FAIL(`${symbol} lives on ${t.chain}, but that wallet is a ${wallet.chain} wallet.`);
    }

    store.addAsset("user-alex", {
      walletId, symbol, amountMinor: parsed.value, decimals: t.decimals,
      chain: t.chain, priceUsd: INDICATIVE_PRICES[symbol] ?? 0,
      contractAddress: t.contractAddress,
    });
    refreshOwner();
    return OK(`${amount} ${symbol} added.`);
  } catch (e) {
    return fail(e);
  }
}

export async function removeAssetAction(formData: FormData): Promise<ActionResult> {
  try {
    store.removeAsset("user-alex", String(formData.get("assetId") ?? ""));
    refreshOwner();
    return OK("Asset removed.");
  } catch (e) {
    return fail(e);
  }
}

// --- Owner: rules and plan ------------------------------------------------------------------------

export async function addRuleAction(formData: FormData): Promise<ActionResult> {
  const type = String(formData.get("ruleType") ?? "") as RuleType;
  const chains = formData.getAll("chains").map(String) as Chain[];
  const valid: RuleType[] = ["IMMEDIATE", "PERCENTAGE", "TIMELOCK_DELAY", "CONDITIONAL_KYC", "DISPUTE_WINDOW", "AGE_BASED", "SCHEDULED", "TRUST_DIRECTED"];
  if (!valid.includes(type)) return FAIL("Choose a rule type.");
  if (chains.length === 0) return FAIL("Choose at least one chain.");

  try {
    const rule = makeRule({ id: `rule_${Math.random().toString(36).slice(2, 9)}`, type, appliesToChains: chains });
    store.addRule("user-alex", rule);
    store.appendAudit({
      actorType: "USER", actorId: "user-alex", action: "rule.added",
      payload: { type, tier: rule.enforcementTier },
    });
    refreshOwner();
    return OK(
      rule.enforcementTier === "CRYPTOGRAPHIC"
        ? "Rule added — enforced by cryptography."
        : `Rule added. Note it resolves to "${rule.enforcementTier}" on the chains you chose, not cryptographic enforcement.`,
    );
  } catch (e) {
    return fail(e);
  }
}

export async function removeRuleAction(formData: FormData): Promise<ActionResult> {
  try {
    store.removeRule("user-alex", String(formData.get("ruleId") ?? ""));
    refreshOwner();
    return OK("Rule removed.");
  } catch (e) {
    return fail(e);
  }
}

export async function updatePlanSettingsAction(formData: FormData): Promise<ActionResult> {
  const coolingOffDays = Number(formData.get("coolingOffDays"));
  const inactivityThresholdDays = Number(formData.get("inactivityThresholdDays"));
  const inheritanceDelayDays = Number(formData.get("inheritanceDelayDays"));

  if (coolingOffDays < 30) return FAIL("The cooling-off period cannot be shorter than 30 days.");

  try {
    const before = store.primaryUser().plan.coolingOffDays;
    store.updatePlanSettings("user-alex", { coolingOffDays, inactivityThresholdDays, inheritanceDelayDays });
    store.appendAudit({
      actorType: "USER", actorId: "user-alex", action: "plan.changed",
      payload: { coolingOffDays, inactivityThresholdDays, inheritanceDelayDays },
    });
    refreshOwner();
    return OK(
      coolingOffDays < before
        ? "Saved. Note that a reduction only applies to future claims — an open claim's period can never be shortened."
        : "Plan settings saved.",
    );
  } catch (e) {
    return fail(e);
  }
}

export async function proofOfLifeAction(): Promise<ActionResult> {
  try {
    store.recordProofOfLife("user-alex");
    store.appendAudit({
      actorType: "USER", actorId: "user-alex", action: "user.proof_of_life", payload: { method: "passkey" },
    });
    refreshOwner();
    return OK("Proof of life recorded. Any open claim would now be closed immediately.");
  } catch (e) {
    return fail(e);
  }
}

export async function exportContinuityPackAction(): Promise<ActionResult> {
  try {
    store.exportContinuityPack("user-alex");
    store.appendAudit({
      actorType: "USER", actorId: "user-alex", action: "continuity_pack.exported",
    });
    refreshOwner();
    return OK("Continuity Pack exported. Your plan no longer depends on us existing.");
  } catch (e) {
    return fail(e);
  }
}

export async function resetWorldAction(): Promise<ActionResult> {
  try {
    store.resetWorld();
    refreshOwner();
    refreshAdmin();
    return OK("Demo data reset.");
  } catch (e) {
    return fail(e);
  }
}

// --- Admin -----------------------------------------------------------------------------------------

export async function adminSetStatusAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "") as "ACTIVE" | "SUSPENDED" | "INVESTIGATING";
  const reason = String(formData.get("reason") ?? "").trim();
  if (!["ACTIVE", "SUSPENDED", "INVESTIGATING"].includes(status)) return FAIL("Invalid status.");
  if (status !== "ACTIVE" && reason.length < 3) return FAIL("A reason is required when restricting an account.");
  try {
    admin.setUserStatus(userId, status, reason || "Reinstated.");
    refreshAdmin();
    revalidatePath(`/admin/users/${userId}`);
    return OK(`Account set to ${status}.`);
  } catch (e) {
    return fail(e);
  }
}

export async function adminNoteAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (note.length < 3) return FAIL("Write a note first.");
  try {
    admin.addInternalNote(userId, note);
    revalidatePath(`/admin/users/${userId}`);
    return OK("Note added.");
  } catch (e) {
    return fail(e);
  }
}

export async function adminResetMfaAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const reason = String(formData.get("reason") ?? "Customer lost their device.").trim();
  try {
    admin.resetMfa(userId, reason);
    revalidatePath(`/admin/users/${userId}`);
    return OK("MFA reset. The customer must re-enrol; this grants no plan-editing power.");
  } catch (e) {
    return fail(e);
  }
}

export async function adminIdentityAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const verified = String(formData.get("verified") ?? "true") === "true";
  try {
    admin.markIdentityVerified(userId, verified);
    revalidatePath(`/admin/users/${userId}`);
    return OK(verified ? "Identity marked verified." : "Identity verification revoked.");
  } catch (e) {
    return fail(e);
  }
}

export async function adminChangeTierAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const tierId = String(formData.get("tierId") ?? "") as never;
  try {
    admin.adminChangeTier(userId, tierId);
    refreshAdmin();
    revalidatePath(`/admin/users/${userId}`);
    return OK("Tier changed, with proration applied.");
  } catch (e) {
    return fail(e);
  }
}

export async function adminSubscriptionAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const op = String(formData.get("op") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  try {
    switch (op) {
      case "cancel_period_end": admin.adminCancelSubscription(userId, false, reason); break;
      case "cancel_now": admin.adminCancelSubscription(userId, true, reason); break;
      case "resume": admin.adminResumeSubscription(userId); break;
      case "pause": admin.adminPauseSubscription(userId, reason || "Paused by support."); break;
      default: return FAIL("Unknown operation.");
    }
    refreshAdmin();
    revalidatePath(`/admin/users/${userId}`);
    return OK("Subscription updated. The succession plan is unaffected.");
  } catch (e) {
    return fail(e);
  }
}

export async function adminCreditAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const dollars = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isFinite(dollars) || dollars <= 0) return FAIL("Enter an amount greater than zero.");
  if (reason.length < 3) return FAIL("A reason is required for an account credit.");
  try {
    admin.adminApplyCredit(userId, BigInt(Math.round(dollars * 100)), reason);
    refreshAdmin();
    revalidatePath(`/admin/users/${userId}`);
    return OK(`Applied a $${dollars.toFixed(2)} credit.`);
  } catch (e) {
    return fail(e);
  }
}

export async function adminDiscountAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const percent = Number(formData.get("percent"));
  const reason = String(formData.get("reason") ?? "").trim();
  try {
    admin.adminSetDiscount(userId, percent, reason || "No reason given.");
    refreshAdmin();
    revalidatePath(`/admin/users/${userId}`);
    return OK(percent > 0 ? `${percent}% discount applied.` : "Discount removed.");
  } catch (e) {
    return fail(e);
  }
}

export async function adminExtendTrialAction(formData: FormData): Promise<ActionResult> {
  const userId = String(formData.get("userId") ?? "");
  const days = Number(formData.get("days"));
  try {
    admin.adminExtendTrial(userId, days);
    refreshAdmin();
    revalidatePath(`/admin/users/${userId}`);
    return OK(`Trial extended by ${days} days.`);
  } catch (e) {
    return fail(e);
  }
}

export async function adminRefundAction(formData: FormData): Promise<ActionResult> {
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const dollars = Number(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isFinite(dollars) || dollars <= 0) return FAIL("Enter a refund amount.");
  if (reason.length < 3) return FAIL("A reason is required for a refund.");
  try {
    admin.adminRefund(invoiceId, BigInt(Math.round(dollars * 100)), reason);
    refreshAdmin();
    return OK(`Refunded $${dollars.toFixed(2)}.`);
  } catch (e) {
    return fail(e);
  }
}

export async function adminVoidInvoiceAction(formData: FormData): Promise<ActionResult> {
  try {
    admin.adminVoidInvoice(String(formData.get("invoiceId") ?? ""), String(formData.get("reason") ?? "Voided by support."));
    refreshAdmin();
    return OK("Invoice voided.");
  } catch (e) {
    return fail(e);
  }
}

export async function adminIssueInvoiceAction(formData: FormData): Promise<ActionResult> {
  try {
    const inv = admin.adminIssueInvoice(String(formData.get("userId") ?? ""));
    refreshAdmin();
    return OK(`Issued invoice ${inv.number}.`);
  } catch (e) {
    return fail(e);
  }
}

export async function adminRetryPaymentAction(formData: FormData): Promise<ActionResult> {
  try {
    const events = await admin.adminRetryPayment(String(formData.get("invoiceId") ?? ""));
    refreshAdmin();
    const succeeded = events.some((e) => e.kind === "payment.succeeded");
    return OK(succeeded ? "Payment succeeded." : `Attempt made: ${events.map((e) => e.detail).join(" ") || "no action taken"}`);
  } catch (e) {
    return fail(e);
  }
}

export async function runBillingCycleAction(): Promise<ActionResult> {
  try {
    const events = await admin.runBillingForAll();
    refreshAdmin();
    const paid = events.filter((e) => e.kind === "payment.succeeded").length;
    const failed = events.filter((e) => e.kind === "payment.failed").length;
    const issued = events.filter((e) => e.kind === "invoice.created").length;
    return OK(`Cycle complete — ${issued} invoiced, ${paid} collected, ${failed} declined.`);
  } catch (e) {
    return fail(e);
  }
}

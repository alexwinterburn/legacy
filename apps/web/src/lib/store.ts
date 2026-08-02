/**
 * Mutable application store.
 *
 * File-backed JSON so state survives a server restart and the prototype behaves like a real
 * application rather than a set of static pages. In production this module is the only thing
 * that changes: every call site works against these functions, not against a database.
 *
 * Two rules preserved from the production design:
 *   1. Every mutation writes an audit entry to the hash chain.
 *   2. There is deliberately NO function here that lets an administrator edit a user's
 *      beneficiaries, allocations, or succession state. See `admin.ts` for what admins can do.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  AuditChain,
  type AuditEntry,
  type ActorType,
  type AuditAction,
} from "@legacy/core/audit";
import type { Allocation, AssetRecord, Beneficiary, Chain, WalletRecord, TierId } from "@legacy/core";
import type { SuccessionRule } from "@legacy/succession";
import type { Invoice, PaymentMethod, Subscription } from "@legacy/billing";
import { seedWorld, type SeededUser } from "./seed";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "world.json");

/** Mutable by design — this is the write model. Read models expose readonly projections. */
export interface UserRecord extends SeededUser {
  beneficiaries: Beneficiary[];
  allocations: Allocation[];
  wallets: WalletRecord[];
  assets: AssetRecord[];
  rules: SuccessionRule[];
}

export interface World {
  users: UserRecord[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  paymentMethods: PaymentMethod[];
  audit: AuditEntry[];
  /** Actions taken by staff, surfaced in the affected user's own timeline. */
  adminAudit: AdminAuditEntry[];
  lastBillingRunAt?: string;
}

export interface AdminAuditEntry {
  readonly id: string;
  readonly at: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly action: string;
  readonly targetUserId?: string;
  readonly detail: string;
  readonly reversible: boolean;
}

// BigInt does not survive JSON. Tag and restore it rather than silently losing precision.
const BIGINT_TAG = "__bigint__:";

function replacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? `${BIGINT_TAG}${value.toString()}` : value;
}

function reviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && value.startsWith(BIGINT_TAG)) {
    return BigInt(value.slice(BIGINT_TAG.length));
  }
  return value;
}

let cache: World | null = null;

function load(): World {
  if (cache) return cache;
  if (existsSync(DATA_FILE)) {
    try {
      cache = JSON.parse(readFileSync(DATA_FILE, "utf8"), reviver) as World;
      return cache;
    } catch {
      // A corrupt file must not brick the app — reseed rather than crash on every request.
      cache = null;
    }
  }
  cache = seedWorld();
  persist();
  return cache;
}

function persist(): void {
  if (!cache) return;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(cache, replacer, 2), "utf8");
}

export function getWorld(): World {
  return load();
}

export function resetWorld(): World {
  cache = seedWorld();
  persist();
  return cache;
}

export function mutate<T>(fn: (world: World) => T): T {
  const world = load();
  const result = fn(world);
  persist();
  return result;
}

// --- Audit ---------------------------------------------------------------------------------------

export function appendAudit(input: {
  actorType: ActorType;
  actorId: string;
  action: AuditAction;
  payload?: Record<string, unknown>;
}): void {
  mutate((w) => {
    const chain = AuditChain.fromEntries(w.audit);
    chain.append({ ...input, occurredAt: new Date().toISOString() });
    w.audit = [...chain.all()];
  });
}

export function auditChain(): AuditChain {
  return AuditChain.fromEntries(getWorld().audit);
}

export function appendAdminAudit(entry: Omit<AdminAuditEntry, "id" | "at">): void {
  mutate((w) => {
    w.adminAudit.unshift({
      ...entry,
      id: `adm_${(w.adminAudit.length + 1).toString().padStart(5, "0")}`,
      at: new Date().toISOString(),
    });
  });
}

// --- User lookup ---------------------------------------------------------------------------------

export function getUser(userId: string): UserRecord | undefined {
  return getWorld().users.find((u) => u.id === userId);
}

export function primaryUser(): UserRecord {
  const u = getWorld().users.find((x) => x.id === "user-alex");
  if (!u) throw new Error("Primary demo user missing");
  return u;
}

export function subscriptionFor(userId: string): Subscription | undefined {
  return getWorld().subscriptions.find((s) => s.userId === userId);
}

export function invoicesFor(userId: string): Invoice[] {
  return getWorld()
    .invoices.filter((i) => i.userId === userId)
    .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
}

export function paymentMethodsFor(userId: string): PaymentMethod[] {
  return getWorld().paymentMethods.filter((p) => p.userId === userId);
}

// --- Owner mutations (the user acting on their own plan) -----------------------------------------

export function addBeneficiary(userId: string, input: Omit<Beneficiary, "id" | "createdAt">): Beneficiary {
  return mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    const beneficiary: Beneficiary = {
      ...input,
      id: `ben_${Math.random().toString(36).slice(2, 10)}`,
      createdAt: new Date().toISOString(),
    };
    user.beneficiaries.push(beneficiary);
    user.allocations.push({ beneficiaryId: beneficiary.id, basisPoints: 0, scope: "ALL" });
    return beneficiary;
  });
}

export function updateBeneficiary(userId: string, beneficiaryId: string, patch: Partial<Beneficiary>): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    const idx = user.beneficiaries.findIndex((b) => b.id === beneficiaryId);
    if (idx < 0) throw new Error("Beneficiary not found");
    user.beneficiaries[idx] = { ...user.beneficiaries[idx]!, ...patch };
  });
}

export function removeBeneficiary(userId: string, beneficiaryId: string): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.beneficiaries = user.beneficiaries.filter((b) => b.id !== beneficiaryId);
    // Remove the allocation too, or the distribution engine will (correctly) refuse to compute
    // against an allocation naming somebody who no longer exists.
    user.allocations = user.allocations.filter((a) => a.beneficiaryId !== beneficiaryId);
  });
}

export function setAllocations(userId: string, allocations: { beneficiaryId: string; basisPoints: number }[]): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    const known = new Set(user.beneficiaries.map((b) => b.id));
    for (const a of allocations) {
      if (!known.has(a.beneficiaryId)) throw new Error(`Unknown beneficiary ${a.beneficiaryId}`);
    }
    user.allocations = allocations.map((a) => ({ ...a, scope: "ALL" }));
  });
}

export function addWallet(userId: string, input: { chain: Chain; address: string; label: string }): WalletRecord {
  return mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    if (user.wallets.some((x) => x.chain === input.chain && x.address === input.address)) {
      throw new Error("That wallet is already registered.");
    }
    const wallet: WalletRecord = {
      id: `wal_${Math.random().toString(36).slice(2, 10)}`,
      chain: input.chain,
      address: input.address,
      label: input.label,
      verificationState: "DECLARED",
      addedAt: new Date().toISOString(),
    };
    user.wallets.push(wallet);
    return wallet;
  });
}

export function removeWallet(userId: string, walletId: string): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.wallets = user.wallets.filter((x) => x.id !== walletId);
    user.assets = user.assets.filter((a) => a.walletId !== walletId);
  });
}

export function proveWalletOwnership(userId: string, walletId: string): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    const idx = user.wallets.findIndex((x) => x.id === walletId);
    if (idx < 0) throw new Error("Wallet not found");
    user.wallets[idx] = { ...user.wallets[idx]!, verificationState: "PROVEN" };
    for (let i = 0; i < user.assets.length; i++) {
      if (user.assets[i]!.walletId === walletId) {
        user.assets[i] = { ...user.assets[i]!, verificationState: "PROVEN" };
      }
    }
  });
}

export function addAsset(
  userId: string,
  input: { walletId: string; symbol: string; amountMinor: bigint; decimals: number; chain: Chain; priceUsd: number; contractAddress?: string },
): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    const wallet = user.wallets.find((x) => x.id === input.walletId);
    user.assets.push({
      id: `ast_${Math.random().toString(36).slice(2, 10)}`,
      walletId: input.walletId,
      chain: input.chain,
      symbol: input.symbol,
      decimals: input.decimals,
      contractAddress: input.contractAddress,
      amount: input.amountMinor,
      verificationState: wallet?.verificationState ?? "DECLARED",
      lastObservedAt: new Date().toISOString(),
      indicativeUnitPriceUsd: input.priceUsd,
    });
  });
}

export function removeAsset(userId: string, assetId: string): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.assets = user.assets.filter((a) => a.id !== assetId);
  });
}

export function addRule(userId: string, rule: SuccessionRule): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.rules.push(rule);
  });
}

export function removeRule(userId: string, ruleId: string): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.rules = user.rules.filter((r) => r.id !== ruleId);
  });
}

export function updatePlanSettings(
  userId: string,
  patch: { coolingOffDays?: number; inactivityThresholdDays?: number; inheritanceDelayDays?: number },
): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    if (patch.coolingOffDays !== undefined && patch.coolingOffDays < 30) {
      throw new Error("The cooling-off period cannot be shorter than 30 days.");
    }
    Object.assign(user.plan, patch);
  });
}

export function recordProofOfLife(userId: string): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.lastProofOfLifeAt = new Date().toISOString();
  });
}

export function exportContinuityPack(userId: string): void {
  mutate((w) => {
    const user = w.users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found");
    user.continuityPackExportedAt = new Date().toISOString();
  });
}

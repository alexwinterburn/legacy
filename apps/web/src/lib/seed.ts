/**
 * World seeder.
 *
 * Builds a realistic subscriber base so the back office has genuine variety to manage: trials,
 * healthy annual subscribers, failing cards at different stages of dunning, cancellations,
 * pauses, and a hard-declined card that must never be retried.
 *
 * All fictional. No real people, no real funds, no key material.
 */

import { AuditChain } from "@legacy/core/audit";
import { parseAmount, token, type Allocation, type AssetRecord, type Beneficiary, type TierId, type WalletRecord } from "@legacy/core";
import { makeRule, type SuccessionRule } from "@legacy/succession";
import {
  buildInvoice,
  createSubscription,
  priceForInterval,
  resetInvoiceNumbering,
  type BillingInterval,
  type Invoice,
  type PaymentMethod,
  type Subscription,
  type SubscriptionStatus,
} from "@legacy/billing";
import type { World, UserRecord, AdminAuditEntry } from "./store";

export const PRICE_SNAPSHOT_AT = "2026-07-31T09:00:00.000Z";
export const DEMO_NOW = "2026-07-31T12:00:00.000Z";

export const INDICATIVE_PRICES: Record<string, number> = {
  BTC: 115_000,
  ETH: 4_100,
  USDC: 1,
  USDT: 1,
  DAI: 1,
  SOL: 190,
};

export interface SeededUser {
  id: string;
  fullName: string;
  email: string;
  countryOfResidence: string;
  countryName: string;
  status: "ACTIVE" | "SUSPENDED" | "INVESTIGATING";
  identityVerified: boolean;
  passkeyEnabled: boolean;
  mfaEnabled: boolean;
  registeredDeviceCount: number;
  lastProofOfLifeAt: string;
  continuityPackExportedAt?: string;
  executorNominated: boolean;
  estateDocumentCount: number;
  keysGeographicallySeparated: boolean;
  createdAt: string;
  plan: {
    id: string;
    coolingOffDays: number;
    requiredConfidenceLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    inactivityThresholdDays: number;
    proofOfLifeIntervalDays: number;
    inheritanceDelayDays: number;
    requiredAttestors: number;
  };
  internalNotes: string[];
}

function iso(daysAgo: number): string {
  return new Date(new Date(DEMO_NOW).getTime() - daysAgo * 86_400_000).toISOString();
}

function baseUser(o: Partial<SeededUser> & Pick<SeededUser, "id" | "fullName" | "email">): SeededUser {
  return {
    countryOfResidence: "ZA",
    countryName: "South Africa",
    status: "ACTIVE",
    identityVerified: true,
    passkeyEnabled: true,
    mfaEnabled: true,
    registeredDeviceCount: 2,
    lastProofOfLifeAt: iso(3),
    executorNominated: true,
    estateDocumentCount: 2,
    keysGeographicallySeparated: true,
    createdAt: iso(200),
    plan: {
      id: `plan-${o.id}`,
      coolingOffDays: 60,
      requiredConfidenceLevel: 4,
      inactivityThresholdDays: 180,
      proofOfLifeIntervalDays: 90,
      inheritanceDelayDays: 180,
      requiredAttestors: 2,
    },
    internalNotes: [],
    ...o,
  };
}

/** The primary demo user — the person whose owner app you explore. */
function alex(): UserRecord {
  const beneficiaries: Beneficiary[] = [
    {
      id: "ben-christine", fullName: "Christine Winterburn", relationship: "Spouse",
      dateOfBirth: "1982-04-11", country: "ZA", email: "christine@example.com",
      phone: "+27 82 000 0001", contactVerified: true, identityVerified: true,
      destinations: { bitcoin: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" },
      createdAt: iso(168),
    },
    {
      id: "ben-arabella", fullName: "Arabella Winterburn", relationship: "Daughter",
      dateOfBirth: "2009-09-02", country: "ZA", email: "arabella@example.com",
      contactVerified: true, identityVerified: false, createdAt: iso(168),
    },
    {
      id: "ben-ava", fullName: "Ava Winterburn", relationship: "Daughter",
      dateOfBirth: "2012-01-19", country: "ZA", email: "ava@example.com",
      contactVerified: false, identityVerified: false, createdAt: iso(168),
    },
  ];

  const allocations: Allocation[] = [
    { beneficiaryId: "ben-christine", basisPoints: 5000, scope: "ALL" },
    { beneficiaryId: "ben-arabella", basisPoints: 2500, scope: "ALL" },
    { beneficiaryId: "ben-ava", basisPoints: 2500, scope: "ALL" },
  ];

  const wallets: WalletRecord[] = [
    {
      id: "wal-btc-1", chain: "bitcoin",
      address: "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
      label: "Cold storage (Taproot)", verificationState: "PROVEN",
      descriptor: "tr(xpubOWNER/0/*,{or(99@pk(xpubOWNER/0/*),9@and(older(25920),pk(xpubHEIR1/0/*)))})",
      addedAt: iso(167),
    },
    {
      id: "wal-eth-1", chain: "ethereum", address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      label: "Main Ethereum account", verificationState: "PROVEN", addedAt: iso(167),
    },
    {
      id: "wal-eth-2", chain: "ethereum", address: "0x8ba1f109551bD432803012645aC136c22C57B21",
      label: "Stablecoin account (USDC)", verificationState: "OBSERVED", addedAt: iso(59),
    },
    {
      id: "wal-eth-3", chain: "ethereum", address: "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE",
      label: "Treasury account (USDT)", verificationState: "PROVEN", addedAt: iso(27),
    },
  ];

  const mk = (id: string, walletId: string, symbol: string, human: string, state: AssetRecord["verificationState"]): AssetRecord => {
    const t = token(symbol);
    return {
      id, walletId, chain: t.chain, symbol, decimals: t.decimals,
      contractAddress: t.contractAddress,
      amount: parseAmount(human, t.decimals, symbol).value,
      verificationState: state, lastObservedAt: PRICE_SNAPSHOT_AT,
      indicativeUnitPriceUsd: INDICATIVE_PRICES[symbol] ?? 0,
    };
  };

  const assets: AssetRecord[] = [
    mk("asset-btc", "wal-btc-1", "BTC", "1.84", "PROVEN"),
    mk("asset-eth", "wal-eth-1", "ETH", "24.6", "PROVEN"),
    mk("asset-usdc", "wal-eth-2", "USDC", "420000", "OBSERVED"),
    mk("asset-usdt", "wal-eth-3", "USDT", "183000", "PROVEN"),
  ];

  const rules: SuccessionRule[] = [
    makeRule({ id: "rule-1", type: "PERCENTAGE", appliesToChains: ["bitcoin", "ethereum"], order: 0 }),
    makeRule({ id: "rule-2", type: "TIMELOCK_DELAY", appliesToChains: ["bitcoin"], config: { delayDays: 180 }, order: 1 }),
    makeRule({ id: "rule-3", type: "CONDITIONAL_KYC", appliesToChains: ["bitcoin", "ethereum"], order: 2 }),
    makeRule({
      id: "rule-4", type: "AGE_BASED", appliesToChains: ["bitcoin"],
      config: { tranches: [{ age: 21, bp: 2000 }, { age: 25, bp: 3000 }, { age: 30, bp: 5000 }] },
      order: 3,
    }),
  ];

  return {
    ...baseUser({
      id: "user-alex", fullName: "Alex Winterburn", email: "alex@example.com",
      lastProofOfLifeAt: iso(3), continuityPackExportedAt: undefined,
      estateDocumentCount: 3, createdAt: iso(168),
    }),
    beneficiaries, allocations, wallets, assets, rules,
  };
}

interface OtherUserSpec {
  id: string;
  name: string;
  email: string;
  country: [string, string];
  tier: TierId;
  interval: BillingInterval;
  status: SubscriptionStatus;
  pm: string;
  daysAgo: number;
  note?: string;
  userStatus?: SeededUser["status"];
  discountPercent?: number;
}

const OTHERS: OtherUserSpec[] = [
  { id: "user-john", name: "John Smith", email: "john@example.com", country: ["GB", "United Kingdom"], tier: "guardian", interval: "ANNUAL", status: "ACTIVE", pm: "pm_ok_2", daysAgo: 320 },
  { id: "user-sarah", name: "Sarah Jones", email: "sarah@example.com", country: ["US", "United States"], tier: "private_wealth", interval: "ANNUAL", status: "ACTIVE", pm: "pm_ok_3", daysAgo: 500 },
  { id: "user-marcus", name: "Marcus Chen", email: "marcus@example.com", country: ["SG", "Singapore"], tier: "legacy", interval: "ANNUAL", status: "ACTIVE", pm: "pm_ok_4", daysAgo: 140, userStatus: "INVESTIGATING", note: "Beneficiaries rewritten 18h before a death claim. Under risk review." },
  { id: "user-priya", name: "Priya Naidoo", email: "priya@example.com", country: ["ZA", "South Africa"], tier: "guardian", interval: "MONTHLY", status: "PAST_DUE", pm: "pm_insufficient_1", daysAgo: 95, note: "Card declining since 12 July." },
  { id: "user-tom", name: "Tom Delaney", email: "tom@example.com", country: ["IE", "Ireland"], tier: "legacy", interval: "ANNUAL", status: "GRACE", pm: "pm_expired_1", daysAgo: 400, note: "Card expired. Hard decline — do not retry; needs a new method." },
  { id: "user-yuki", name: "Yuki Tanaka", email: "yuki@example.com", country: ["JP", "Japan"], tier: "legacy", interval: "ANNUAL", status: "TRIALING", pm: "pm_ok_5", daysAgo: 6 },
  { id: "user-elena", name: "Elena Rossi", email: "elena@example.com", country: ["DE", "Germany"], tier: "guardian", interval: "ANNUAL", status: "ACTIVE", pm: "pm_ok_6", daysAgo: 210, discountPercent: 20, note: "20% founding-member discount." },
  { id: "user-david", name: "David Okafor", email: "david@example.com", country: ["NG", "Nigeria"], tier: "free", interval: "ANNUAL", status: "ACTIVE", pm: "", daysAgo: 45 },
  { id: "user-fatima", name: "Fatima Al-Rashid", email: "fatima@example.com", country: ["AE", "United Arab Emirates"], tier: "private_wealth", interval: "ANNUAL", status: "ACTIVE", pm: "pm_ok_7", daysAgo: 620 },
  { id: "user-liam", name: "Liam Murphy", email: "liam@example.com", country: ["AU", "Australia"], tier: "guardian", interval: "MONTHLY", status: "CANCELED", pm: "pm_ok_8", daysAgo: 260, note: "Cancelled — moved to a competitor." },
  { id: "user-nina", name: "Nina Petrova", email: "nina@example.com", country: ["PT", "Portugal"], tier: "legacy", interval: "ANNUAL", status: "PAUSED", pm: "pm_ok_9", daysAgo: 180, note: "Paused at customer request for 3 months." },
  { id: "user-carlos", name: "Carlos Mendes", email: "carlos@example.com", country: ["BR", "Brazil"], tier: "guardian", interval: "MONTHLY", status: "ACTIVE", pm: "pm_flaky_1", daysAgo: 70, note: "Intermittent processor errors; usually recovers on retry." },
  { id: "user-anna", name: "Anna Kowalski", email: "anna@example.com", country: ["PL", "Poland"], tier: "free", interval: "ANNUAL", status: "ACTIVE", pm: "", daysAgo: 20 },
  { id: "user-james", name: "James Whitfield", email: "james@example.com", country: ["GB", "United Kingdom"], tier: "legacy", interval: "ANNUAL", status: "ACTIVE", pm: "pm_ok_10", daysAgo: 380 },
  { id: "user-mei", name: "Mei Lin", email: "mei@example.com", country: ["SG", "Singapore"], tier: "guardian", interval: "ANNUAL", status: "ACTIVE", pm: "pm_ok_11", daysAgo: 150 },
  { id: "user-ruth", name: "Ruth Abrahams", email: "ruth@example.com", country: ["ZA", "South Africa"], tier: "legacy", interval: "ANNUAL", status: "ACTIVE", pm: "pm_ok_12", daysAgo: 290, userStatus: "SUSPENDED", note: "Suspended pending KYC re-verification." },
];

function simpleUser(spec: OtherUserSpec): UserRecord {
  const beneficiaries: Beneficiary[] = [
    {
      id: `${spec.id}-ben-1`, fullName: `${spec.name.split(" ")[0]}'s next of kin`,
      relationship: "Spouse", dateOfBirth: "1980-01-01", country: spec.country[0],
      email: `nok.${spec.id}@example.com`, contactVerified: true, identityVerified: false,
      createdAt: iso(spec.daysAgo - 1),
    },
  ];
  return {
    ...baseUser({
      id: spec.id, fullName: spec.name, email: spec.email,
      countryOfResidence: spec.country[0], countryName: spec.country[1],
      createdAt: iso(spec.daysAgo),
      lastProofOfLifeAt: iso(Math.min(spec.daysAgo, 30)),
      status: spec.userStatus ?? "ACTIVE",
      continuityPackExportedAt: spec.tier === "free" ? undefined : iso(Math.max(1, spec.daysAgo - 30)),
      internalNotes: spec.note ? [spec.note] : [],
    }),
    beneficiaries,
    allocations: [{ beneficiaryId: beneficiaries[0]!.id, basisPoints: 10_000, scope: "ALL" }],
    wallets: [],
    assets: [],
    rules: [makeRule({ id: `${spec.id}-r1`, type: "PERCENTAGE", appliesToChains: ["bitcoin"], order: 0 })],
  };
}

export function seedWorld(): World {
  resetInvoiceNumbering(4000);

  const users: UserRecord[] = [alex(), ...OTHERS.map(simpleUser)];
  const subscriptions: Subscription[] = [];
  const invoices: Invoice[] = [];
  const paymentMethods: PaymentMethod[] = [];

  // Alex — healthy annual Legacy subscriber.
  subscriptions.push({
    ...createSubscription({
      id: "sub_alex", userId: "user-alex", tierId: "legacy", interval: "ANNUAL",
      startedAt: iso(168), paymentMethodId: "pm_ok_1",
    }),
    currentPeriodStart: iso(168), currentPeriodEnd: iso(-197),
  });
  paymentMethods.push({
    id: "pm_ok_1", userId: "user-alex", kind: "CARD", brand: "Visa", last4: "4242",
    expiryMonth: 11, expiryYear: 2029, isDefault: true, addedAt: iso(168),
  });

  for (const spec of OTHERS) {
    const price = priceForInterval(spec.tier, spec.interval);
    const periodDays = spec.interval === "ANNUAL" ? 365 : 30;
    const started = iso(spec.daysAgo);

    const s: Subscription = {
      ...createSubscription({
        id: `sub_${spec.id}`, userId: spec.id, tierId: spec.tier, interval: spec.interval,
        startedAt: started, paymentMethodId: spec.pm || undefined,
        withTrial: spec.status === "TRIALING",
      }),
      status: spec.status,
      unitPriceMinor: price,
      discountPercent: spec.discountPercent,
      currentPeriodStart: iso(spec.daysAgo % periodDays),
      currentPeriodEnd: iso((spec.daysAgo % periodDays) - periodDays),
      canceledAt: spec.status === "CANCELED" ? iso(12) : undefined,
      pausedAt: spec.status === "PAUSED" ? iso(30) : undefined,
      failedAttempts: spec.status === "PAST_DUE" ? 2 : spec.status === "GRACE" ? 4 : 0,
      gracePeriodEndsAt: spec.status === "GRACE" ? iso(-4) : undefined,
    };
    subscriptions.push(s);

    if (spec.pm) {
      paymentMethods.push({
        id: spec.pm, userId: spec.id, kind: "CARD",
        brand: spec.pm.includes("expired") ? "Mastercard" : "Visa",
        last4: String(1000 + (spec.id.length * 7) % 9000).slice(0, 4),
        expiryMonth: spec.pm.includes("expired") ? 3 : 8,
        expiryYear: spec.pm.includes("expired") ? 2026 : 2029,
        isDefault: true, addedAt: started,
      });
    }

    // Paid history for healthy subscribers.
    if (price > 0n && (spec.status === "ACTIVE" || spec.status === "PAUSED" || spec.status === "CANCELED")) {
      const inv = buildInvoice({ id: `inv_${spec.id}_1`, subscription: s, issuedAt: iso(spec.daysAgo) });
      invoices.push({ ...inv, status: "PAID", amountPaidMinor: inv.totalMinor, paidAt: iso(spec.daysAgo) });
    }

    // An open, failing invoice for the delinquent accounts.
    if (spec.status === "PAST_DUE" || spec.status === "GRACE") {
      const inv = buildInvoice({ id: `inv_${spec.id}_open`, subscription: s, issuedAt: iso(18) });
      const declineCode = spec.pm.includes("expired") ? ("CARD_EXPIRED" as const) : ("INSUFFICIENT_FUNDS" as const);
      const attemptCount = spec.status === "GRACE" ? 4 : 2;
      invoices.push({
        ...inv,
        dueAt: iso(11),
        attempts: Array.from({ length: attemptCount }, (_, i) => ({
          id: `att_${spec.id}_${i}`, invoiceId: inv.id, attemptedAt: iso(18 - i * 4),
          outcome: "FAILED" as const, amountMinor: inv.totalMinor,
          declineCode, attemptNumber: i + 1,
        })),
      });
    }
  }

  // Audit chain for the primary user.
  const chain = new AuditChain();
  const u = { actorType: "USER" as const, actorId: "user-alex" };
  chain.append({ ...u, action: "user.created", occurredAt: iso(168) });
  chain.append({ ...u, action: "plan.created", occurredAt: iso(168), payload: { planId: "plan-user-alex" } });
  chain.append({ ...u, action: "beneficiary.added", occurredAt: iso(168), payload: { name: "Christine Winterburn", share: "50%" } });
  chain.append({ ...u, action: "beneficiary.added", occurredAt: iso(168), payload: { name: "Arabella Winterburn", share: "25%" } });
  chain.append({ ...u, action: "beneficiary.added", occurredAt: iso(168), payload: { name: "Ava Winterburn", share: "25%" } });
  chain.append({ ...u, action: "wallet.added", occurredAt: iso(167), payload: { chain: "bitcoin", label: "Cold storage (Taproot)" } });
  chain.append({ ...u, action: "wallet.ownership_proven", occurredAt: iso(167), payload: { chain: "bitcoin", scheme: "BIP322" } });
  chain.append({ ...u, action: "wallet.added", occurredAt: iso(167), payload: { chain: "ethereum" } });
  chain.append({ ...u, action: "wallet.ownership_proven", occurredAt: iso(167), payload: { chain: "ethereum", scheme: "EIP191" } });
  chain.append({ ...u, action: "rule.added", occurredAt: iso(166), payload: { type: "PERCENTAGE", tier: "CRYPTOGRAPHIC" } });
  chain.append({ ...u, action: "rule.added", occurredAt: iso(166), payload: { type: "TIMELOCK_DELAY", tier: "CRYPTOGRAPHIC", delayDays: 180 } });
  chain.append({ ...u, action: "beneficiary.contact_verified", occurredAt: iso(149), payload: { name: "Christine Winterburn" } });
  chain.append({ ...u, action: "wallet.added", occurredAt: iso(59), payload: { chain: "ethereum", label: "Stablecoin account (USDC)" } });
  chain.append({ ...u, action: "wallet.added", occurredAt: iso(27), payload: { chain: "ethereum", label: "Treasury account (USDT)" } });
  chain.append({ ...u, action: "wallet.ownership_proven", occurredAt: iso(27), payload: { chain: "ethereum", symbol: "USDT", scheme: "EIP191" } });
  chain.append({ ...u, action: "user.proof_of_life", occurredAt: iso(3), payload: { method: "passkey" } });

  const adminAudit: AdminAuditEntry[] = [
    { id: "adm_00003", at: iso(1), actorId: "officer-b", actorRole: "RISK", action: "fraud.review_opened", targetUserId: "user-marcus", detail: "Opened risk review after beneficiary rewrite preceding a death claim.", reversible: true },
    { id: "adm_00002", at: iso(6), actorId: "officer-a", actorRole: "SUPPORT", action: "subscription.credit_applied", targetUserId: "user-priya", detail: "Applied $15.00 goodwill credit after a billing error.", reversible: false },
    { id: "adm_00001", at: iso(14), actorId: "officer-c", actorRole: "OPERATOR", action: "user.suspended", targetUserId: "user-ruth", detail: "Suspended pending KYC re-verification.", reversible: true },
  ];

  return {
    users,
    subscriptions,
    invoices,
    paymentMethods,
    audit: [...chain.all()],
    adminAudit,
    lastBillingRunAt: undefined,
  };
}

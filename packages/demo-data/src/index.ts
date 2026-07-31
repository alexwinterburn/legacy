/**
 * Demo world.
 *
 * Everything here is fictional. There are no real funds, no real people, no private keys and no
 * network calls anywhere in this package. Addresses are well-known example/burn addresses used
 * purely so address validation has something realistic to chew on.
 *
 * Prices are a pinned snapshot with an explicit timestamp — see DECISIONS.md §1 (C8). They are
 * indicative only and never feed a control decision.
 */

import { parseAmount,
  type AssetRecord,
  type Allocation,
  type Beneficiary,
  type WalletRecord,
} from "@legacy/core";
import { AuditChain } from "@legacy/core/audit";
import { makeRule, type SuccessionRule } from "@legacy/succession";
import type { Evidence } from "@legacy/death-verification";

export const PRICE_SNAPSHOT_AT = "2026-07-31T09:00:00.000Z";

/** Indicative prices, pinned. Not a live feed and never used in a control decision. */
export const INDICATIVE_PRICES = {
  BTC: 115_000,
  ETH: 4_100,
  USDC: 1,
  SOL: 190,
} as const;

export const DEMO_NOW = "2026-07-31T12:00:00.000Z";

export interface DemoUser {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
  readonly countryOfResidence: string;
  readonly countryName: string;
  readonly identityVerified: boolean;
  readonly passkeyEnabled: boolean;
  readonly mfaEnabled: boolean;
  readonly registeredDeviceCount: number;
  readonly lastProofOfLifeAt: string;
  readonly continuityPackExportedAt?: string;
  readonly executorNominated: boolean;
  readonly estateDocumentCount: number;
  readonly keysGeographicallySeparated: boolean;
  readonly tier: string;
}

export const demoUser: DemoUser = {
  id: "user-alex",
  fullName: "Alex Winterburn",
  email: "alex@example.com",
  countryOfResidence: "ZA",
  countryName: "South Africa",
  identityVerified: true,
  passkeyEnabled: true,
  mfaEnabled: true,
  registeredDeviceCount: 2,
  lastProofOfLifeAt: "2026-07-28T08:14:00.000Z",
  // Deliberately NOT exported, so the health score demonstrates the Continuity Pack cap.
  continuityPackExportedAt: undefined,
  executorNominated: true,
  estateDocumentCount: 3,
  keysGeographicallySeparated: true,
  tier: "legacy",
};

export const demoBeneficiaries: readonly Beneficiary[] = [
  {
    id: "ben-christine",
    fullName: "Christine Winterburn",
    relationship: "Spouse",
    dateOfBirth: "1982-04-11",
    country: "ZA",
    email: "christine@example.com",
    phone: "+27 82 000 0001",
    contactVerified: true,
    identityVerified: true,
    destinations: { bitcoin: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" },
    createdAt: "2026-02-14T10:00:00.000Z",
  },
  {
    id: "ben-arabella",
    fullName: "Arabella Winterburn",
    relationship: "Daughter",
    dateOfBirth: "2009-09-02",
    country: "ZA",
    email: "arabella@example.com",
    contactVerified: true,
    identityVerified: false,
    createdAt: "2026-02-14T10:05:00.000Z",
  },
  {
    id: "ben-ava",
    fullName: "Ava Winterburn",
    relationship: "Daughter",
    dateOfBirth: "2012-01-19",
    country: "ZA",
    email: "ava@example.com",
    contactVerified: false,
    identityVerified: false,
    createdAt: "2026-02-14T10:07:00.000Z",
  },
];

export const demoAllocations: readonly Allocation[] = [
  { beneficiaryId: "ben-christine", basisPoints: 5000, scope: "ALL" },
  { beneficiaryId: "ben-arabella", basisPoints: 2500, scope: "ALL" },
  { beneficiaryId: "ben-ava", basisPoints: 2500, scope: "ALL" },
];

export const demoWallets: readonly WalletRecord[] = [
  {
    id: "wal-btc-1",
    chain: "bitcoin",
    address: "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
    label: "Cold storage (Taproot)",
    verificationState: "PROVEN",
    descriptor: "tr(xpubOWNER/0/*,{or(99@pk(xpubOWNER/0/*),9@and(older(25920),pk(xpubHEIR1/0/*)))})",
    addedAt: "2026-02-15T09:00:00.000Z",
  },
  {
    id: "wal-eth-1",
    chain: "ethereum",
    address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    label: "Main Ethereum account",
    verificationState: "PROVEN",
    addedAt: "2026-02-15T09:20:00.000Z",
  },
  {
    id: "wal-eth-2",
    chain: "ethereum",
    address: "0x8ba1f109551bD432803012645Hac136c22C57B",
    label: "Stablecoin account",
    verificationState: "OBSERVED",
    addedAt: "2026-06-02T11:30:00.000Z",
  },
];

export const demoAssets: readonly AssetRecord[] = [
  {
    id: "asset-btc",
    walletId: "wal-btc-1",
    chain: "bitcoin",
    symbol: "BTC",
    decimals: 8,
    amount: parseAmount("1.84", 8, "BTC").value,
    verificationState: "PROVEN",
    lastObservedAt: PRICE_SNAPSHOT_AT,
    indicativeUnitPriceUsd: INDICATIVE_PRICES.BTC,
  },
  {
    id: "asset-eth",
    walletId: "wal-eth-1",
    chain: "ethereum",
    symbol: "ETH",
    decimals: 18,
    amount: parseAmount("24.6", 18, "ETH").value,
    verificationState: "PROVEN",
    lastObservedAt: PRICE_SNAPSHOT_AT,
    indicativeUnitPriceUsd: INDICATIVE_PRICES.ETH,
  },
  {
    id: "asset-usdc",
    walletId: "wal-eth-2",
    chain: "ethereum",
    symbol: "USDC",
    decimals: 6,
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    amount: parseAmount("420000", 6, "USDC").value,
    verificationState: "OBSERVED",
    lastObservedAt: PRICE_SNAPSHOT_AT,
    indicativeUnitPriceUsd: INDICATIVE_PRICES.USDC,
  },
];

export const demoRules: readonly SuccessionRule[] = [
  makeRule({ id: "rule-1", type: "PERCENTAGE", appliesToChains: ["bitcoin", "ethereum"], order: 0 }),
  makeRule({ id: "rule-2", type: "TIMELOCK_DELAY", appliesToChains: ["bitcoin"], config: { delayDays: 180 }, order: 1 }),
  makeRule({ id: "rule-3", type: "CONDITIONAL_KYC", appliesToChains: ["bitcoin", "ethereum"], order: 2 }),
  // Deliberately included to demonstrate honest tiering: this resolves to LEGAL, not CRYPTOGRAPHIC.
  makeRule({
    id: "rule-4",
    type: "AGE_BASED",
    appliesToChains: ["bitcoin"],
    config: { tranches: [{ age: 21, bp: 2000 }, { age: 25, bp: 3000 }, { age: 30, bp: 5000 }] },
    order: 3,
  }),
];

export const demoPlan = {
  id: "plan-alex-1",
  coolingOffDays: 60,
  requiredConfidenceLevel: 4 as const,
  inactivityThresholdDays: 180,
  proofOfLifeIntervalDays: 90,
  inheritanceDelayDays: 180,
  requiredAttestors: 2,
};

export const demoEvidence: readonly Evidence[] = [
  {
    id: "ev-1",
    sourceType: "DEATH_CERTIFICATE",
    providerId: "za-default",
    independenceClass: "CIVIL_REGISTRY",
    outcome: "CONFIRMS",
    supportsLevel: 4,
    quality: 0.92,
    recordedAt: "2026-07-20T10:00:00.000Z",
    note: "Certified copy, authenticity checked against issuing office records.",
  },
  {
    id: "ev-2",
    sourceType: "MEDICAL_CERTIFICATE",
    providerId: "za-default",
    independenceClass: "MEDICAL",
    outcome: "CONFIRMS",
    supportsLevel: 4,
    quality: 0.88,
    recordedAt: "2026-07-22T14:30:00.000Z",
    note: "Medical certificate of cause of death — independent of the civil registration chain.",
  },
];

// --- Admin demo events (brief §42) ---------------------------------------------------------------

export interface AdminDeathEvent {
  readonly id: string;
  readonly userName: string;
  readonly userId: string;
  readonly country: string;
  readonly countryCode: string;
  readonly confidenceLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  readonly confidenceScore: number;
  readonly state: string;
  readonly claimDate: string;
  readonly coolingOffEndsAt?: string;
  readonly fraudScore: number;
  readonly sources: readonly { type: string; class: string; outcome: string; at: string }[];
  readonly beneficiaries: readonly { name: string; share: string; verified: boolean }[];
  readonly approvals: readonly string[];
  readonly note: string;
}

export const adminDeathEvents: readonly AdminDeathEvent[] = [
  {
    id: "EVT-001",
    userName: "Alex Winterburn",
    userId: "user-alex",
    country: "South Africa",
    countryCode: "ZA",
    confidenceLevel: 6,
    confidenceScore: 96,
    state: "COOLING_OFF",
    claimDate: "2026-07-18T08:00:00.000Z",
    coolingOffEndsAt: "2026-09-16T08:00:00.000Z",
    fraudScore: 12,
    sources: [
      { type: "Death certificate", class: "CIVIL_REGISTRY", outcome: "CONFIRMS", at: "2026-07-20T10:00:00.000Z" },
      { type: "Medical certificate", class: "MEDICAL", outcome: "CONFIRMS", at: "2026-07-22T14:30:00.000Z" },
    ],
    beneficiaries: [
      { name: "Christine Winterburn", share: "50%", verified: true },
      { name: "Arabella Winterburn", share: "25%", verified: false },
      { name: "Ava Winterburn", share: "25%", verified: false },
    ],
    approvals: ["officer-a"],
    note: "Two independent source classes. Cooling-off running. One further approval required.",
  },
  {
    id: "EVT-002",
    userName: "John Smith",
    userId: "user-john",
    country: "United Kingdom",
    countryCode: "GB",
    confidenceLevel: 3,
    confidenceScore: 44,
    state: "INVESTIGATING",
    claimDate: "2026-07-26T15:20:00.000Z",
    fraudScore: 28,
    sources: [{ type: "Third-party report", class: "SOCIAL", outcome: "CONFIRMS", at: "2026-07-26T15:20:00.000Z" }],
    beneficiaries: [{ name: "Margaret Smith", share: "100%", verified: false }],
    approvals: [],
    note: "Report only, nothing verified. Documentary evidence requested. Account holder notified on all channels.",
  },
  {
    id: "EVT-003",
    userName: "Sarah Jones",
    userId: "user-sarah",
    country: "United States",
    countryCode: "US",
    confidenceLevel: 6,
    confidenceScore: 98,
    state: "EXECUTABLE",
    claimDate: "2026-04-02T09:00:00.000Z",
    coolingOffEndsAt: "2026-07-01T09:00:00.000Z",
    fraudScore: 5,
    sources: [
      { type: "Death certificate", class: "CIVIL_REGISTRY", outcome: "CONFIRMS", at: "2026-04-09T11:00:00.000Z" },
      { type: "Executor attestation", class: "JUDICIAL", outcome: "CONFIRMS", at: "2026-04-18T16:40:00.000Z" },
      { type: "Medical certificate", class: "MEDICAL", outcome: "CONFIRMS", at: "2026-04-21T10:15:00.000Z" },
    ],
    beneficiaries: [
      { name: "Daniel Jones", share: "60%", verified: true },
      { name: "Emily Jones", share: "40%", verified: true },
    ],
    approvals: ["officer-a", "officer-c"],
    note: "All conditions satisfied. Beneficiaries verified. Awaiting their signatures — we cannot complete this for them.",
  },
  {
    id: "EVT-004",
    userName: "Marcus Chen",
    userId: "user-marcus",
    country: "Singapore",
    countryCode: "SG",
    confidenceLevel: 3,
    confidenceScore: 41,
    state: "FRAUD_HOLD",
    claimDate: "2026-07-29T22:10:00.000Z",
    fraudScore: 87,
    sources: [{ type: "Beneficiary claim", class: "SOCIAL", outcome: "CONFIRMS", at: "2026-07-29T22:10:00.000Z" }],
    beneficiaries: [{ name: "Unverified party", share: "100%", verified: false }],
    approvals: [],
    note: "Beneficiaries were rewritten to a single new party 18 hours before this claim. Held. Previous beneficiaries notified.",
  },
];

export interface FraudAlertRecord {
  readonly id: string;
  readonly userName: string;
  readonly severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly score: number;
  readonly title: string;
  readonly detail: string;
  readonly raisedAt: string;
  readonly state: "OPEN" | "REVIEWING" | "CLOSED";
}

export const fraudAlerts: readonly FraudAlertRecord[] = [
  {
    id: "FRD-118",
    userName: "Marcus Chen",
    severity: "CRITICAL",
    score: 87,
    title: "Beneficiaries rewritten hours before a death claim",
    detail: "100% reallocated to a single newly added party, then a death claim 18 hours later. MFA was also removed within the window.",
    raisedAt: "2026-07-29T22:12:00.000Z",
    state: "OPEN",
  },
  {
    id: "FRD-117",
    userName: "John Smith",
    severity: "MEDIUM",
    score: 28,
    title: "Claim from an unregistered party",
    detail: "The claimant is not a registered beneficiary and has not completed identity verification.",
    raisedAt: "2026-07-26T15:25:00.000Z",
    state: "REVIEWING",
  },
  {
    id: "FRD-115",
    userName: "Priya Naidoo",
    severity: "MEDIUM",
    score: 34,
    title: "Access from unusual locations",
    detail: "Sign-ins from 5 countries in 30 days, none matching the country of residence.",
    raisedAt: "2026-07-24T07:45:00.000Z",
    state: "CLOSED",
  },
];

export const platformMetrics = {
  users: 12_847,
  activePlans: 9_512,
  assetsProtectedUsd: 1_284_500_000,
  deathEventsAllTime: 214,
  pendingClaims: 11,
  openFraudAlerts: 3,
  countriesCovered: 26,
  // Honest metric: proportion of claims that reached a documented resolution, either way.
  verificationResolutionRate: 0.94,
  falseClaimsRejected: 37,
};

/** Legacy Timeline for the demo user. */
export function buildDemoAuditChain(): AuditChain {
  const chain = new AuditChain();
  const user = { actorType: "USER" as const, actorId: demoUser.id };
  const system = { actorType: "SYSTEM" as const, actorId: "system" };

  chain.append({ ...user, action: "user.created", occurredAt: "2026-02-14T09:30:00.000Z" });
  chain.append({ ...user, action: "plan.created", occurredAt: "2026-02-14T09:55:00.000Z", payload: { planId: demoPlan.id } });
  chain.append({ ...user, action: "beneficiary.added", occurredAt: "2026-02-14T10:00:00.000Z", payload: { name: "Christine Winterburn", share: "50%" } });
  chain.append({ ...user, action: "beneficiary.added", occurredAt: "2026-02-14T10:05:00.000Z", payload: { name: "Arabella Winterburn", share: "25%" } });
  chain.append({ ...user, action: "beneficiary.added", occurredAt: "2026-02-14T10:07:00.000Z", payload: { name: "Ava Winterburn", share: "25%" } });
  chain.append({ ...user, action: "wallet.added", occurredAt: "2026-02-15T09:00:00.000Z", payload: { chain: "bitcoin", label: "Cold storage (Taproot)" } });
  chain.append({ ...user, action: "wallet.ownership_proven", occurredAt: "2026-02-15T09:12:00.000Z", payload: { chain: "bitcoin", scheme: "BIP322" } });
  chain.append({ ...user, action: "wallet.added", occurredAt: "2026-02-15T09:20:00.000Z", payload: { chain: "ethereum" } });
  chain.append({ ...user, action: "wallet.ownership_proven", occurredAt: "2026-02-15T09:31:00.000Z", payload: { chain: "ethereum", scheme: "EIP191" } });
  chain.append({ ...user, action: "rule.added", occurredAt: "2026-02-16T18:02:00.000Z", payload: { type: "PERCENTAGE", tier: "CRYPTOGRAPHIC" } });
  chain.append({ ...user, action: "rule.added", occurredAt: "2026-02-16T18:06:00.000Z", payload: { type: "TIMELOCK_DELAY", tier: "CRYPTOGRAPHIC", delayDays: 180 } });
  chain.append({ ...system, action: "death_event.confidence_changed", occurredAt: "2026-03-01T00:00:00.000Z", payload: { level: 0, note: "Routine reassessment. No evidence." } });
  chain.append({ ...user, action: "beneficiary.contact_verified", occurredAt: "2026-03-04T12:40:00.000Z", payload: { name: "Christine Winterburn" } });
  chain.append({ ...user, action: "wallet.added", occurredAt: "2026-06-02T11:30:00.000Z", payload: { chain: "ethereum", label: "Stablecoin account" } });
  chain.append({ ...user, action: "user.proof_of_life", occurredAt: "2026-07-28T08:14:00.000Z", payload: { method: "passkey" } });
  return chain;
}

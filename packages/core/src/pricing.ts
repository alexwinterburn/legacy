/**
 * Pricing as data, so prices change without a code change. See PRODUCT.md §8.
 * Amounts are indicative and are not final.
 */

export type TierId = "free" | "guardian" | "legacy" | "private_wealth" | "institutional";

export interface PricingTier {
  readonly id: TierId;
  readonly name: string;
  readonly annualUsd: number | null; // null = custom pricing
  readonly tagline: string;
  readonly features: readonly string[];
  readonly limits: {
    readonly beneficiaries: number | "unlimited";
    readonly wallets: number | "unlimited";
    readonly vaultGb: number;
    readonly legacyMessages: number | "unlimited";
  };
  readonly highlighted?: boolean;
}

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    id: "free",
    name: "Free",
    annualUsd: 0,
    tagline: "Everything you need so your family isn't left with nothing.",
    features: [
      "One succession plan",
      "Up to 3 beneficiaries",
      "Declared assets",
      "Manual death verification",
      // Deliberately in the free tier: charging for the mechanism that protects users from our
      // own failure would be indefensible. See PRODUCT.md §8.
      "Continuity Pack export",
      "Executor letter",
    ],
    limits: { beneficiaries: 3, wallets: 2, vaultGb: 0, legacyMessages: 0 },
  },
  {
    id: "guardian",
    name: "Guardian",
    annualUsd: 49,
    tagline: "Cryptographic enforcement and proof of ownership.",
    features: [
      "Everything in Free",
      "Up to 10 beneficiaries",
      "On-chain ownership proofs",
      "Cryptographically enforced rules",
      "Family Vault (5 GB)",
      "Multi-channel life-event monitoring",
      "Proof-of-life reminders",
    ],
    limits: { beneficiaries: 10, wallets: 10, vaultGb: 5, legacyMessages: 5 },
    highlighted: true,
  },
  {
    id: "legacy",
    name: "Legacy",
    annualUsd: 199,
    tagline: "Multi-asset succession with advanced structures.",
    features: [
      "Everything in Guardian",
      "Unlimited beneficiaries",
      "Multi-chain coverage",
      "Advanced succession structures",
      "Unlimited legacy messages",
      "Trusted contacts",
      "Priority verification",
      "Family Vault (50 GB)",
    ],
    limits: { beneficiaries: "unlimited", wallets: "unlimited", vaultGb: 50, legacyMessages: "unlimited" },
  },
  {
    id: "private_wealth",
    name: "Private Wealth",
    annualUsd: 1000,
    tagline: "For families and family offices. From $1,000/year.",
    features: [
      "Everything in Legacy",
      "Family accounts and multi-principal governance",
      "Dedicated verification specialist",
      "Attorney and executor coordination",
      "Bespoke spending-policy design",
      "Hardware key provisioning support",
      "Annual continuity drill",
    ],
    limits: { beneficiaries: "unlimited", wallets: "unlimited", vaultGb: 500, legacyMessages: "unlimited" },
  },
  {
    id: "institutional",
    name: "Institutional",
    annualUsd: null,
    tagline: "Succession infrastructure for exchanges, banks and wealth managers.",
    features: [
      "Institutional API",
      "Attestations for consented subjects",
      "Webhooks and SLA",
      "White-label beneficiary experience",
      "Coverage reporting",
      "Dedicated support",
    ],
    limits: { beneficiaries: "unlimited", wallets: "unlimited", vaultGb: 1000, legacyMessages: "unlimited" },
  },
];

export function tier(id: TierId): PricingTier {
  const found = PRICING_TIERS.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown pricing tier: ${id}`);
  return found;
}

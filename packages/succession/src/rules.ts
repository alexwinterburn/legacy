/**
 * Succession rules.
 *
 * Every rule declares its enforcement tier. This is the honesty mechanism of the product:
 * a monthly-payment rule for Bitcoin is enforced by an executor reading a document, not by
 * cryptography, and the type system will not let us pretend otherwise.
 *
 * See DECISIONS.md §3 for why "R50,000/month for 10 years" cannot be CRYPTOGRAPHIC on Bitcoin
 * without taking custody — which the product refuses to do.
 */

import {
  BASIS_POINTS_TOTAL,
  type Allocation,
  type Chain,
  type EnforcementTier,
  type Result,
  err,
  ok,
} from "@legacy/core";

export type RuleType =
  | "IMMEDIATE"
  | "PERCENTAGE"
  | "TIMELOCK_DELAY"
  | "CONDITIONAL_KYC"
  | "DISPUTE_WINDOW"
  | "AGE_BASED"
  | "SCHEDULED"
  | "TRUST_DIRECTED";

export interface RuleDefinition {
  readonly type: RuleType;
  readonly label: string;
  readonly description: string;
  /**
   * The BEST tier this rule can achieve, on a chain that supports it. The actual tier for a
   * given plan is computed by `resolveTier`, which downgrades where the chain can't deliver.
   */
  readonly bestTier: EnforcementTier;
  /** Chains on which this rule can be cryptographically enforced at all. */
  readonly cryptographicOn: readonly Chain[];
  readonly caveat?: string;
}

export const RULE_DEFINITIONS: Record<RuleType, RuleDefinition> = {
  IMMEDIATE: {
    type: "IMMEDIATE",
    label: "Immediate distribution",
    description: "Everything passes to your beneficiaries once the process completes.",
    bestTier: "CRYPTOGRAPHIC",
    cryptographicOn: ["bitcoin", "ethereum"],
  },
  PERCENTAGE: {
    type: "PERCENTAGE",
    label: "Percentage split",
    description: "Each beneficiary receives a fixed share of each asset.",
    bestTier: "CRYPTOGRAPHIC",
    cryptographicOn: ["bitcoin", "ethereum"],
  },
  TIMELOCK_DELAY: {
    type: "TIMELOCK_DELAY",
    label: "Delayed access",
    description: "Beneficiaries can access assets only after a fixed delay, enforced on-chain.",
    bestTier: "CRYPTOGRAPHIC",
    cryptographicOn: ["bitcoin", "ethereum"],
  },
  CONDITIONAL_KYC: {
    type: "CONDITIONAL_KYC",
    label: "Release after identity verification",
    description: "A beneficiary must verify their identity before receiving anything.",
    bestTier: "ASSISTED",
    cryptographicOn: [],
    caveat: "Requires someone to check the identity. If we're gone, your timelock path applies instead.",
  },
  DISPUTE_WINDOW: {
    type: "DISPUTE_WINDOW",
    label: "Dispute window",
    description: "A fixed period during which the distribution can be challenged.",
    bestTier: "ASSISTED",
    cryptographicOn: ["ethereum"],
    caveat: "On Bitcoin this is procedural. On EVM it can be enforced by the contract.",
  },
  AGE_BASED: {
    type: "AGE_BASED",
    label: "Age-based tranches",
    description: "A beneficiary receives portions as they reach specified ages.",
    bestTier: "LEGAL",
    cryptographicOn: [],
    caveat:
      "Bitcoin cannot verify someone's age. This records your instruction for your executor or trustee to carry out.",
  },
  SCHEDULED: {
    type: "SCHEDULED",
    label: "Scheduled payments",
    description: "A regular amount paid over a defined period.",
    bestTier: "LEGAL",
    cryptographicOn: [],
    caveat:
      "Automating this would require someone to hold the assets. We won't do that, so this is an instruction to your executor or trustee.",
  },
  TRUST_DIRECTED: {
    type: "TRUST_DIRECTED",
    label: "Directed to a trust",
    description: "Assets pass to a trust, which then distributes under its own terms.",
    bestTier: "LEGAL",
    cryptographicOn: [],
    caveat: "The trust deed governs. We record the destination and notify the trustee.",
  },
};

export interface SuccessionRule {
  readonly id: string;
  readonly type: RuleType;
  readonly enforcementTier: EnforcementTier;
  readonly appliesToChains: readonly Chain[];
  readonly config: Readonly<Record<string, unknown>>;
  readonly order: number;
}

/**
 * Resolve the tier a rule genuinely achieves for the chains it applies to.
 * A rule that is CRYPTOGRAPHIC on Ethereum but applied to Solana is downgraded, not fudged.
 */
export function resolveTier(type: RuleType, chains: readonly Chain[]): EnforcementTier {
  const def = RULE_DEFINITIONS[type];
  if (def.bestTier !== "CRYPTOGRAPHIC" && def.bestTier !== "ASSISTED") return def.bestTier;
  if (chains.length === 0) return def.bestTier;
  const allSupported = chains.every((c) => def.cryptographicOn.includes(c));
  if (def.bestTier === "CRYPTOGRAPHIC") return allSupported ? "CRYPTOGRAPHIC" : "LEGAL";
  return def.bestTier;
}

export function makeRule(input: {
  id: string;
  type: RuleType;
  appliesToChains: readonly Chain[];
  config?: Record<string, unknown>;
  order?: number;
}): SuccessionRule {
  return {
    id: input.id,
    type: input.type,
    enforcementTier: resolveTier(input.type, input.appliesToChains),
    appliesToChains: input.appliesToChains,
    config: input.config ?? {},
    order: input.order ?? 0,
  };
}

export interface AllocationValidation {
  readonly totalBasisPoints: number;
  readonly remaining: number;
  readonly complete: boolean;
}

/** Validate that allocations for a scope sum to exactly 100%. */
export function validateAllocations(
  allocations: readonly Allocation[],
  scope = "ALL",
): Result<AllocationValidation, string> {
  const scoped = allocations.filter((a) => a.scope === scope);
  if (scoped.length === 0) return err("No beneficiaries have been allocated a share.");

  for (const a of scoped) {
    if (!Number.isInteger(a.basisPoints)) return err("Allocations must be whole basis points.");
    if (a.basisPoints <= 0) return err("Every beneficiary must receive more than 0%.");
    if (a.basisPoints > BASIS_POINTS_TOTAL) return err("A single allocation cannot exceed 100%.");
  }

  const ids = scoped.map((a) => a.beneficiaryId);
  if (new Set(ids).size !== ids.length) {
    return err("A beneficiary appears more than once in the same scope.");
  }

  const total = scoped.reduce((acc, a) => acc + a.basisPoints, 0);
  return ok({
    totalBasisPoints: total,
    remaining: BASIS_POINTS_TOTAL - total,
    complete: total === BASIS_POINTS_TOTAL,
  });
}

/**
 * Validate a proposed allocation edit before it is written.
 *
 * Distinct from `validateAllocations`, which checks a stored plan. This checks user input, and
 * in particular rejects a 0% share: a named beneficiary who inherits nothing is almost always a
 * mistake — either they should be allocated something, or removed — and silently accepting it
 * leaves someone in the plan who will be notified of a death and then receive nothing.
 */
export function validateAllocationInput(
  input: readonly { readonly beneficiaryId: string; readonly basisPoints: number }[],
): Result<{ totalBasisPoints: number }, string> {
  if (input.length === 0) return err("Add at least one beneficiary before allocating shares.");

  for (const a of input) {
    if (!Number.isFinite(a.basisPoints)) return err("Shares must be numbers.");
    if (!Number.isInteger(a.basisPoints)) return err("Shares are limited to two decimal places.");
    if (a.basisPoints < 0) return err("A share cannot be negative.");
    if (a.basisPoints === 0) {
      return err(
        "Every beneficiary needs a share above 0%. Give them an allocation, or remove them — otherwise they'd be notified of your death and inherit nothing.",
      );
    }
  }

  const ids = input.map((a) => a.beneficiaryId);
  if (new Set(ids).size !== ids.length) return err("A beneficiary appears more than once.");

  const total = input.reduce((acc, a) => acc + a.basisPoints, 0);
  if (total !== BASIS_POINTS_TOTAL) {
    return err(
      `Allocations must total exactly 100%. They currently total ${(total / 100).toFixed(2)}%.`,
    );
  }

  return ok({ totalBasisPoints: total });
}

/** Summarise how much of the plan is genuinely enforced by cryptography. */
export function enforcementSummary(rules: readonly SuccessionRule[]): {
  cryptographic: number;
  assisted: number;
  legal: number;
  survivesCompanyFailure: boolean;
} {
  const count = (t: EnforcementTier) => rules.filter((r) => r.enforcementTier === t).length;
  return {
    cryptographic: count("CRYPTOGRAPHIC"),
    assisted: count("ASSISTED"),
    legal: count("LEGAL"),
    // A plan survives our failure if at least one rule is cryptographically enforced.
    survivesCompanyFailure: count("CRYPTOGRAPHIC") > 0,
  };
}

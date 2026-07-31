/** Shared domain types. */

export type Chain = "bitcoin" | "ethereum" | "solana";

export type ISODate = string;

/**
 * How much the platform is trusted with. See ARCHITECTURE.md §4.
 *
 * CUSTODIAN is deliberately absent. If it is ever added, every trust claim in the product copy
 * becomes false and the regulatory position (REGULATORY.md §1) changes completely.
 */
export type PlatformRole = "ATTESTOR_ONLY" | "COSIGNER";

/**
 * How a succession rule is actually enforced. The honesty mechanism of the whole product —
 * see DECISIONS.md §3. Never optional.
 */
export type EnforcementTier = "CRYPTOGRAPHIC" | "ASSISTED" | "LEGAL";

export const ENFORCEMENT_TIER_META: Record<
  EnforcementTier,
  { label: string; description: string; survivesCompanyFailure: boolean }
> = {
  CRYPTOGRAPHIC: {
    label: "Enforced by cryptography",
    description:
      "Enforced by the spending policy on-chain. Works even if we cease to exist.",
    survivesCompanyFailure: true,
  },
  ASSISTED: {
    label: "Requires a counterparty",
    description:
      "Needs someone to act — usually us. If we're gone, this falls back to your timelock path.",
    survivesCompanyFailure: false,
  },
  LEGAL: {
    label: "Enforced by your executor",
    description:
      "Not technically enforced. This records your instruction for your executor to carry out.",
    survivesCompanyFailure: true,
  },
};

/** Wallet/asset verification state. Reading a balance is not proof of ownership. */
export type VerificationState = "DECLARED" | "OBSERVED" | "PROVEN";

export const VERIFICATION_STATE_META: Record<
  VerificationState,
  { label: string; description: string }
> = {
  DECLARED: { label: "Declared", description: "You told us about it. We haven't checked." },
  OBSERVED: {
    label: "Observed on-chain",
    description: "We can see this balance on-chain, but ownership hasn't been proven.",
  },
  PROVEN: {
    label: "Ownership proven",
    description: "You signed a challenge with this address's key.",
  },
};

export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export interface Beneficiary {
  readonly id: string;
  readonly fullName: string;
  readonly relationship: string;
  readonly dateOfBirth: ISODate;
  readonly country: string;
  readonly email: string;
  readonly phone?: string;
  readonly contactVerified: boolean;
  readonly identityVerified: boolean;
  /** Destination addresses by chain. Absent means "we'll help them set one up at claim time". */
  readonly destinations?: Partial<Record<Chain, string>>;
  readonly createdAt: ISODate;
  /** Set when this record supersedes an earlier version — the fraud engine reads this. */
  readonly supersedesId?: string;
}

export interface Allocation {
  readonly beneficiaryId: string;
  readonly basisPoints: number;
  /** "ALL" or a specific asset id. */
  readonly scope: string;
}

export interface WalletRecord {
  readonly id: string;
  readonly chain: Chain;
  readonly address: string;
  readonly label: string;
  readonly verificationState: VerificationState;
  /** Bitcoin output descriptor, where the wallet is policy-based rather than a single address. */
  readonly descriptor?: string;
  readonly addedAt: ISODate;
}

export interface AssetRecord {
  readonly id: string;
  readonly walletId: string;
  readonly chain: Chain;
  readonly symbol: string;
  readonly decimals: number;
  readonly contractAddress?: string;
  /** Minor units. */
  readonly amount: bigint;
  readonly verificationState: VerificationState;
  readonly lastObservedAt?: ISODate;
  /** Indicative unit price for display only. Never used in a control decision. */
  readonly indicativeUnitPriceUsd: number;
}

export function utcNow(): ISODate {
  return new Date().toISOString();
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
}

export function addDays(date: ISODate, days: number): ISODate {
  return new Date(new Date(date).getTime() + days * 86_400_000).toISOString();
}

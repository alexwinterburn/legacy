/**
 * DeathVerificationProvider — country-agnostic abstraction.
 *
 * IMPORTANT: no provider in this file contains an HTTP client to a government API, because for
 * death verification those APIs overwhelmingly do not exist. See REGULATORY.md §3 for the
 * research behind each provider's capability declaration.
 *
 * A provider is a **capability declaration plus a workflow definition**, not a fake integration.
 * `hasLicensedFeed` is false for every provider shipped here; where a feed genuinely exists it is
 * documented with its real access constraints (cost, certification, latency), and it is batch,
 * never real-time.
 *
 * Adding a country must never require touching the succession engine.
 */

import type { IndependenceClass, ConfidenceLevel } from "./confidence";

export type VerificationTier = "AUTOMATED" | "PARTIAL" | "MANUAL";

export type VerificationMethod =
  | "GOVERNMENT_REGISTRY_FEED"
  | "DEATH_CERTIFICATE"
  | "EXECUTOR_ATTESTATION"
  | "NOTARY_ATTESTATION"
  | "ATTORNEY_ATTESTATION"
  | "MEDICAL_CERTIFICATE"
  | "COURT_ORDER"
  | "APPROVED_THIRD_PARTY"
  | "FUNERAL_DIRECTOR";

export interface MethodDefinition {
  readonly method: VerificationMethod;
  readonly independenceClass: IndependenceClass;
  readonly maxLevel: ConfidenceLevel;
  /** Typical wall-clock time to obtain this evidence, in days. Informs cooling-off guidance. */
  readonly typicalLatencyDays: number;
  readonly requiresHumanReview: boolean;
  readonly notes: string;
}

export interface ProviderCapabilities {
  /**
   * True only where a real, purchasable, contracted data feed exists AND we hold the licence.
   * False for every provider in this repository — we hold no such licences.
   */
  readonly hasLicensedFeed: boolean;
  /** Even licensed feeds are batch files, not APIs. This records the honest cadence. */
  readonly feedCadence?: "REALTIME" | "DAILY" | "WEEKLY" | "MONTHLY";
  readonly feedLagDays?: number;
  readonly maxAchievableLevel: ConfidenceLevel;
  readonly methods: readonly MethodDefinition[];
}

export interface DeathVerificationProvider {
  readonly id: string;
  readonly countryCode: string;
  readonly countryName: string;
  readonly tier: VerificationTier;
  readonly capabilities: ProviderCapabilities;
  /** Accessible summary of what is actually possible in this country, shown in the admin tower. */
  readonly summary: string;
  /** Barriers to reaching a licensed feed here — real cost/certification requirements. */
  readonly feedBarriers?: string;
}

const CERTIFICATE: MethodDefinition = {
  method: "DEATH_CERTIFICATE",
  independenceClass: "CIVIL_REGISTRY",
  maxLevel: 4,
  typicalLatencyDays: 14,
  requiresHumanReview: true,
  notes: "Certified copy checked for authenticity. Same underlying registration event as a registry entry, so it does not independently corroborate one.",
};

const EXECUTOR: MethodDefinition = {
  method: "EXECUTOR_ATTESTATION",
  independenceClass: "JUDICIAL",
  maxLevel: 4,
  typicalLatencyDays: 30,
  requiresHumanReview: true,
  notes: "Attestation by an appointed executor, evidenced by letters of appointment.",
};

const NOTARY: MethodDefinition = {
  method: "NOTARY_ATTESTATION",
  independenceClass: "JUDICIAL",
  maxLevel: 4,
  typicalLatencyDays: 10,
  requiresHumanReview: true,
  notes: "Notarised statement of death. Independent of the civil registry chain.",
};

const MEDICAL: MethodDefinition = {
  method: "MEDICAL_CERTIFICATE",
  independenceClass: "MEDICAL",
  maxLevel: 4,
  typicalLatencyDays: 5,
  requiresHumanReview: true,
  notes: "Medical certificate of cause of death. Genuinely independent of the registry.",
};

const FUNERAL: MethodDefinition = {
  method: "FUNERAL_DIRECTOR",
  independenceClass: "SOCIAL",
  maxLevel: 3,
  typicalLatencyDays: 5,
  requiresHumanReview: true,
  notes: "Confirmation from a licensed funeral director.",
};

const COURT: MethodDefinition = {
  method: "COURT_ORDER",
  independenceClass: "JUDICIAL",
  maxLevel: 5,
  typicalLatencyDays: 180,
  requiresHumanReview: true,
  notes: "Court declaration of death — used for presumption of death where no body is found.",
};

/** 🇿🇦 South Africa — likely launch market. */
export const southAfricaProvider: DeathVerificationProvider = {
  id: "za-default",
  countryCode: "ZA",
  countryName: "South Africa",
  tier: "MANUAL",
  summary:
    "The DHA National Population Register is not exposed as a general commercial death API. Verification is document-led: certified death certificate plus an independent attestation.",
  feedBarriers:
    "NPR access is intermediated and identity-verification oriented rather than a death feed. No commercial death-notification product is assumed to exist.",
  capabilities: {
    hasLicensedFeed: false,
    maxAchievableLevel: 6,
    methods: [CERTIFICATE, EXECUTOR, NOTARY, MEDICAL, FUNERAL, COURT],
  },
};

/** 🇺🇸 United States — LADMF is real but restricted, expensive and batch. */
export const unitedStatesProvider: DeathVerificationProvider = {
  id: "us-default",
  countryCode: "US",
  countryName: "United States",
  tier: "PARTIAL",
  summary:
    "The SSA Limited Access Death Master File exists but requires NTIS certification and is a batch file, not an API. State vital records vary widely. Document-led verification remains primary.",
  feedBarriers:
    "LADMF requires NTIS subscriber certification (annual fee, order of USD 2,930), an independent ACAB security assessment, and a triennial systems-safeguards attestation under §203 of the Bipartisan Budget Act 2013. Uncertified access excludes deaths within the preceding three calendar years.",
  capabilities: {
    // Set true only once the certification is actually held. It is not.
    hasLicensedFeed: false,
    feedCadence: "WEEKLY",
    feedLagDays: 7,
    maxAchievableLevel: 6,
    methods: [
      {
        method: "GOVERNMENT_REGISTRY_FEED",
        independenceClass: "CIVIL_REGISTRY",
        maxLevel: 5,
        typicalLatencyDays: 14,
        requiresHumanReview: false,
        notes: "LADMF batch file. Requires certification we do not currently hold.",
      },
      CERTIFICATE,
      EXECUTOR,
      NOTARY,
      MEDICAL,
      FUNERAL,
      COURT,
    ],
  },
};

/** 🇬🇧 United Kingdom — GRO DDRI is real but tightly restricted and expensive. */
export const unitedKingdomProvider: DeathVerificationProvider = {
  id: "uk-default",
  countryCode: "GB",
  countryName: "United Kingdom",
  tier: "PARTIAL",
  summary:
    "GRO Disclosure of Death Registration Information is available to a very small number of approved organisations as a weekly file. Onward bulk disclosure is prohibited, which constrains the institutional product.",
  feedBarriers:
    "DDRI requires a security assessment with a non-refundable assessment fee and an annual licence fee in the tens of thousands of pounds. Data arrives weekly with roughly a 7-day lag from registration. Bulk onward disclosure to third parties is contractually prohibited.",
  capabilities: {
    hasLicensedFeed: false,
    feedCadence: "WEEKLY",
    feedLagDays: 7,
    maxAchievableLevel: 6,
    methods: [
      {
        method: "GOVERNMENT_REGISTRY_FEED",
        independenceClass: "CIVIL_REGISTRY",
        maxLevel: 5,
        typicalLatencyDays: 7,
        requiresHumanReview: false,
        notes: "GRO DDRI weekly file. Licence not currently held.",
      },
      CERTIFICATE,
      EXECUTOR,
      NOTARY,
      MEDICAL,
      FUNERAL,
      COURT,
    ],
  },
};

/** 🇦🇺 Australia — state and territory registries, no national feed. */
export const australiaProvider: DeathVerificationProvider = {
  id: "au-default",
  countryCode: "AU",
  countryName: "Australia",
  tier: "PARTIAL",
  summary:
    "Death registration is state and territory based. Some jurisdictions offer certificate validation services. There is no single national feed.",
  capabilities: {
    hasLicensedFeed: false,
    maxAchievableLevel: 6,
    methods: [CERTIFICATE, EXECUTOR, NOTARY, MEDICAL, FUNERAL, COURT],
  },
};

/** 🇨🇦 Canada — provincial vital statistics. */
export const canadaProvider: DeathVerificationProvider = {
  id: "ca-default",
  countryCode: "CA",
  countryName: "Canada",
  tier: "PARTIAL",
  summary:
    "Vital statistics are administered provincially. Certificate verification is available in some provinces; there is no national feed.",
  capabilities: {
    hasLicensedFeed: false,
    maxAchievableLevel: 6,
    methods: [CERTIFICATE, EXECUTOR, NOTARY, MEDICAL, FUNERAL, COURT],
  },
};

/** 🇪🇺 European member states — fragmented civil registration. */
export function europeanProvider(countryCode: string, countryName: string): DeathVerificationProvider {
  return {
    id: `eu-${countryCode.toLowerCase()}`,
    countryCode,
    countryName,
    tier: "MANUAL",
    summary:
      "Civil registration is member-state specific and highly fragmented. Document-led verification, with eIDAS trust services as a possible future route to cross-border legal effect.",
    capabilities: {
      hasLicensedFeed: false,
      maxAchievableLevel: 6,
      methods: [CERTIFICATE, EXECUTOR, NOTARY, MEDICAL, FUNERAL, COURT],
    },
  };
}

/**
 * Fallback for every country without a specific implementation — which is most of the world.
 * This is the primary path, not an edge case.
 */
export function genericManualProvider(
  countryCode: string,
  countryName: string,
): DeathVerificationProvider {
  return {
    id: `generic-${countryCode.toLowerCase()}`,
    countryCode,
    countryName,
    tier: "MANUAL",
    summary:
      "No automated source is assumed. Verification is by certified documentation plus independent attestation, reviewed by a human.",
    capabilities: {
      hasLicensedFeed: false,
      maxAchievableLevel: 6,
      methods: [CERTIFICATE, EXECUTOR, NOTARY, MEDICAL, FUNERAL],
    },
  };
}

const REGISTRY = new Map<string, DeathVerificationProvider>(
  [
    southAfricaProvider,
    unitedStatesProvider,
    unitedKingdomProvider,
    australiaProvider,
    canadaProvider,
    europeanProvider("DE", "Germany"),
    europeanProvider("FR", "France"),
    europeanProvider("NL", "Netherlands"),
    europeanProvider("ES", "Spain"),
    europeanProvider("PT", "Portugal"),
    europeanProvider("IE", "Ireland"),
  ].map((p) => [p.countryCode, p]),
);

/** Never throws — an unknown country falls back to manual verification, which always works. */
export function providerForCountry(
  countryCode: string,
  countryName = countryCode,
): DeathVerificationProvider {
  return REGISTRY.get(countryCode.toUpperCase()) ?? genericManualProvider(countryCode, countryName);
}

export function allProviders(): readonly DeathVerificationProvider[] {
  return [...REGISTRY.values()];
}

export function registerProvider(provider: DeathVerificationProvider): void {
  REGISTRY.set(provider.countryCode.toUpperCase(), provider);
}

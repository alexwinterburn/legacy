/**
 * Read models over the live store.
 *
 * Every page reads through these, so the moment a mutation lands the whole app reflects it.
 * Previously this returned frozen fixtures; it now projects real mutable state.
 */

import { totalIndicativeValue, validateAllocations } from "@legacy/succession";
import { computeHealth, type HealthResult } from "@legacy/health";
import { assessConfidence, providerForCountry } from "@legacy/death-verification";
import { assessFraud } from "@legacy/fraud";
import { buildSuccessionPolicy, computeProofOfLife } from "@legacy/bitcoin";
import { entitlementFor } from "@legacy/billing";
import { DEMO_NOW, PRICE_SNAPSHOT_AT } from "./seed";
import { auditChain, invoicesFor, primaryUser, subscriptionFor } from "./store";

export { DEMO_NOW, PRICE_SNAPSHOT_AT };

export const OWNER_ID = "user-alex";

export function owner() {
  return primaryUser();
}

export const demoUser = () => primaryUser();
export const demoBeneficiaries = () => primaryUser().beneficiaries;
export const demoAllocations = () => primaryUser().allocations;
export const demoWallets = () => primaryUser().wallets;
export const demoAssets = () => primaryUser().assets;
export const demoRules = () => primaryUser().rules;
export const demoPlan = () => primaryUser().plan;

export function getProvider() {
  const u = primaryUser();
  return providerForCountry(u.countryOfResidence, u.countryName);
}

export function getSubscription() {
  return subscriptionFor(OWNER_ID);
}

export function getEntitlement() {
  const sub = subscriptionFor(OWNER_ID);
  return sub ? entitlementFor(sub, new Date().toISOString()) : undefined;
}

export function getInvoices() {
  return invoicesFor(OWNER_ID);
}

export function getHealth(): HealthResult {
  const u = primaryUser();
  return computeHealth({
    beneficiaryCount: u.beneficiaries.length,
    allocationBasisPoints: u.allocations.reduce((acc, a) => acc + a.basisPoints, 0),
    beneficiariesWithVerifiedContact: u.beneficiaries.filter((b) => b.contactVerified).length,
    walletCount: u.wallets.length,
    provenWalletCount: u.wallets.filter((w) => w.verificationState === "PROVEN").length,
    observedWalletCount: u.wallets.filter((w) => w.verificationState !== "DECLARED").length,
    rules: u.rules,
    continuityPackExportedAt: u.continuityPackExportedAt,
    countryVerificationTier: getProvider().tier,
    passkeyEnabled: u.passkeyEnabled,
    mfaEnabled: u.mfaEnabled,
    registeredDeviceCount: u.registeredDeviceCount,
    lastProofOfLifeAt: u.lastProofOfLifeAt,
    proofOfLifeIntervalDays: u.plan.proofOfLifeIntervalDays,
    estateDocumentCount: u.estateDocumentCount,
    executorNominated: u.executorNominated,
    identityVerified: u.identityVerified,
    keysGeographicallySeparated: u.keysGeographicallySeparated,
    now: new Date().toISOString(),
  });
}

export function getPortfolioValue(): number {
  return totalIndicativeValue(primaryUser().assets);
}

export function getAllocationStatus() {
  const allocations = primaryUser().allocations;
  if (allocations.length === 0) {
    return { totalBasisPoints: 0, remaining: 10_000, complete: false };
  }
  const result = validateAllocations(allocations);
  if (result.ok) return result.value;
  const total = allocations.reduce((acc, a) => acc + a.basisPoints, 0);
  return { totalBasisPoints: total, remaining: 10_000 - total, complete: false };
}

export function getBitcoinPolicy() {
  const u = primaryUser();
  const heirs = u.beneficiaries.slice(0, 2).map((b, i) => ({
    role: "HEIR" as const,
    label: `${b.fullName.split(" ")[0]}'s key`,
    keyExpression: `xpub…HEIR${i + 1}`,
  }));

  return buildSuccessionPolicy({
    owner: { role: "OWNER", label: "Your key", keyExpression: "xpub…OWNER" },
    heirs: heirs.length > 0 ? heirs : [{ role: "HEIR", label: "Heir key", keyExpression: "xpub…HEIR1" }],
    inheritanceDelayDays: u.plan.inheritanceDelayDays,
    fallbackDelayDays: 365,
    heirThreshold: Math.min(2, Math.max(1, heirs.length)),
  });
}

export function getProofOfLife() {
  const u = primaryUser();
  const currentBlock = 908_400;
  return computeProofOfLife({
    utxos: [
      { txid: "3a1f…9c2b", confirmedAtBlock: currentBlock - 19_000, amountSats: 120_000_000n },
      { txid: "7e44…01af", confirmedAtBlock: currentBlock - 4_200, amountSats: 64_000_000n },
    ],
    currentBlock,
    delayBlocks: u.plan.inheritanceDelayDays * 144,
    warnWithinDays: 60,
  });
}

export function getCurrentConfidence() {
  const u = primaryUser();
  return assessConfidence({
    evidence: [],
    lastProofOfLifeAt: u.lastProofOfLifeAt,
    inactivityThresholdDays: u.plan.inactivityThresholdDays,
    now: new Date().toISOString(),
    disputeOpen: false,
  });
}

export const demoEvidence = [
  {
    id: "ev-1", sourceType: "DEATH_CERTIFICATE", providerId: "za-default",
    independenceClass: "CIVIL_REGISTRY" as const, outcome: "CONFIRMS" as const,
    supportsLevel: 4 as const, quality: 0.92, recordedAt: "2026-07-20T10:00:00.000Z",
    note: "Certified copy, authenticity checked against issuing office records.",
  },
  {
    id: "ev-2", sourceType: "MEDICAL_CERTIFICATE", providerId: "za-default",
    independenceClass: "MEDICAL" as const, outcome: "CONFIRMS" as const,
    supportsLevel: 4 as const, quality: 0.88, recordedAt: "2026-07-22T14:30:00.000Z",
    note: "Medical certificate of cause of death — independent of the civil registration chain.",
  },
];

export function getSimulatedConfidence() {
  return assessConfidence({
    evidence: demoEvidence,
    lastProofOfLifeAt: "2026-07-15T00:00:00.000Z",
    inactivityThresholdDays: primaryUser().plan.inactivityThresholdDays,
    now: "2026-07-25T00:00:00.000Z",
    disputeOpen: false,
  });
}

export function getFraudBaseline() {
  return assessFraud({
    now: DEMO_NOW,
    lastBeneficiaryChangeAt: "2026-03-04T12:40:00.000Z",
    deathClaimsLast90Days: 0,
    claimantIsRegisteredBeneficiary: true,
    claimantIdentityVerified: true,
    newDevicesLast30Days: 0,
    failedAuthLast7Days: 0,
    distinctLoginCountriesLast30Days: 1,
    loginCountryMatchesResidence: true,
    reallocatedBasisPoints: 0,
    concentrationIncreasedToSingleParty: false,
    passwordChangedLast30Days: false,
    mfaRemovedLast30Days: false,
    coolingOffReducedRecently: false,
  });
}

export function getFraudHostileScenario() {
  return assessFraud({
    now: DEMO_NOW,
    lastBeneficiaryChangeAt: "2026-07-29T04:00:00.000Z",
    lastDestinationAddressChangeAt: "2026-07-29T04:05:00.000Z",
    deathClaimAt: "2026-07-29T22:10:00.000Z",
    deathClaimsLast90Days: 1,
    claimantIsRegisteredBeneficiary: false,
    claimantIdentityVerified: false,
    newDevicesLast30Days: 2,
    failedAuthLast7Days: 8,
    distinctLoginCountriesLast30Days: 4,
    loginCountryMatchesResidence: false,
    reallocatedBasisPoints: 10_000,
    concentrationIncreasedToSingleParty: true,
    passwordChangedLast30Days: true,
    mfaRemovedLast30Days: true,
    coolingOffReducedRecently: true,
  });
}

export function getTimeline() {
  return auditChain();
}

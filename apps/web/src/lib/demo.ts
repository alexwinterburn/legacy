/**
 * Demo state layer.
 *
 * Runs entirely in memory so the prototype can be demonstrated anywhere — no database, no RPC,
 * no keys, no network. In production these functions become repository calls; the shapes they
 * return are the same, which is why every page consumes them rather than the raw demo data.
 */

import { totalIndicativeValue, validateAllocations } from "@legacy/succession";
import { computeHealth, type HealthResult } from "@legacy/health";
import { assessConfidence, providerForCountry } from "@legacy/death-verification";
import { assessFraud } from "@legacy/fraud";
import { buildSuccessionPolicy, computeProofOfLife } from "@legacy/bitcoin";
import {
  DEMO_NOW,
  PRICE_SNAPSHOT_AT,
  buildDemoAuditChain,
  demoAllocations,
  demoAssets,
  demoBeneficiaries,
  demoEvidence,
  demoPlan,
  demoRules,
  demoUser,
  demoWallets,
} from "@legacy/demo-data";

export {
  DEMO_NOW,
  PRICE_SNAPSHOT_AT,
  demoAllocations,
  demoAssets,
  demoBeneficiaries,
  demoPlan,
  demoRules,
  demoUser,
  demoWallets,
  demoEvidence,
};

export function getProvider() {
  return providerForCountry(demoUser.countryOfResidence, demoUser.countryName);
}

export function getHealth(overrides: { continuityPackExported?: boolean } = {}): HealthResult {
  return computeHealth({
    beneficiaryCount: demoBeneficiaries.length,
    allocationBasisPoints: demoAllocations.reduce((acc, a) => acc + a.basisPoints, 0),
    beneficiariesWithVerifiedContact: demoBeneficiaries.filter((b) => b.contactVerified).length,
    walletCount: demoWallets.length,
    provenWalletCount: demoWallets.filter((w) => w.verificationState === "PROVEN").length,
    observedWalletCount: demoWallets.filter((w) => w.verificationState !== "DECLARED").length,
    rules: demoRules,
    continuityPackExportedAt: overrides.continuityPackExported ? "2026-07-01T00:00:00.000Z" : demoUser.continuityPackExportedAt,
    countryVerificationTier: getProvider().tier,
    passkeyEnabled: demoUser.passkeyEnabled,
    mfaEnabled: demoUser.mfaEnabled,
    registeredDeviceCount: demoUser.registeredDeviceCount,
    lastProofOfLifeAt: demoUser.lastProofOfLifeAt,
    proofOfLifeIntervalDays: demoPlan.proofOfLifeIntervalDays,
    estateDocumentCount: demoUser.estateDocumentCount,
    executorNominated: demoUser.executorNominated,
    identityVerified: demoUser.identityVerified,
    keysGeographicallySeparated: demoUser.keysGeographicallySeparated,
    now: DEMO_NOW,
  });
}

export function getPortfolioValue(): number {
  return totalIndicativeValue(demoAssets);
}

export function getAllocationStatus() {
  const result = validateAllocations(demoAllocations);
  return result.ok ? result.value : { totalBasisPoints: 0, remaining: 10_000, complete: false };
}

export function getBitcoinPolicy() {
  return buildSuccessionPolicy({
    owner: { role: "OWNER", label: "Your key", keyExpression: "xpub…OWNER" },
    heirs: [
      { role: "HEIR", label: "Christine's key", keyExpression: "xpub…HEIR1" },
      { role: "HEIR", label: "Arabella's key", keyExpression: "xpub…HEIR2" },
    ],
    inheritanceDelayDays: demoPlan.inheritanceDelayDays,
    fallbackDelayDays: 365,
    heirThreshold: 2,
  });
}

/**
 * Proof-of-life status for the demo wallet. Block heights are illustrative; the arithmetic
 * is the real implementation from @legacy/bitcoin.
 */
export function getProofOfLife() {
  const currentBlock = 908_400;
  return computeProofOfLife({
    utxos: [
      { txid: "3a1f…9c2b", confirmedAtBlock: currentBlock - 19_000, amountSats: 120_000_000n },
      { txid: "7e44…01af", confirmedAtBlock: currentBlock - 4_200, amountSats: 64_000_000n },
    ],
    currentBlock,
    delayBlocks: demoPlan.inheritanceDelayDays * 144,
    warnWithinDays: 60,
  });
}

/** Current confidence for the demo user — no death reported, so this should be level 0. */
export function getCurrentConfidence() {
  return assessConfidence({
    evidence: [],
    lastProofOfLifeAt: demoUser.lastProofOfLifeAt,
    inactivityThresholdDays: demoPlan.inactivityThresholdDays,
    now: DEMO_NOW,
    disputeOpen: false,
  });
}

/** Confidence as it would stand if the demo evidence were submitted. Used by the simulator. */
export function getSimulatedConfidence() {
  return assessConfidence({
    evidence: demoEvidence,
    lastProofOfLifeAt: "2026-07-15T00:00:00.000Z",
    inactivityThresholdDays: demoPlan.inactivityThresholdDays,
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

/** The hostile scenario from the brief, scored by the real engine. */
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
  return buildDemoAuditChain();
}

export function getAssetsByChain() {
  const map = new Map<string, typeof demoAssets>();
  for (const asset of demoAssets) {
    const existing = map.get(asset.chain);
    map.set(asset.chain, existing ? ([...existing, asset] as typeof demoAssets) : ([asset] as unknown as typeof demoAssets));
  }
  return map;
}

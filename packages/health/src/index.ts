/**
 * Legacy Health Score.
 *
 * Framed as "what's missing", never as a safety guarantee. See PRODUCT.md §7.
 *
 * The critical mechanic: the score is CAPPED below green until the Continuity Pack has been
 * exported. A user must never be told they're protected while their plan silently depends on
 * this company continuing to exist. That gate is the product mechanism that makes the
 * "we can disappear" claim true rather than aspirational.
 */

import { daysBetween, type ISODate } from "@legacy/core";
import { enforcementSummary, type SuccessionRule } from "@legacy/succession";

export type HealthStatus = "COMPLETE" | "PARTIAL" | "MISSING";

export interface HealthComponent {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly earned: number;
  readonly status: HealthStatus;
  /** What the user should do next. Every component has an actionable next step. */
  readonly remediation: string;
  readonly href?: string;
}

export interface HealthInput {
  readonly beneficiaryCount: number;
  readonly allocationBasisPoints: number;
  readonly beneficiariesWithVerifiedContact: number;
  readonly walletCount: number;
  readonly provenWalletCount: number;
  readonly observedWalletCount: number;
  readonly rules: readonly SuccessionRule[];
  readonly continuityPackExportedAt?: ISODate;
  readonly countryVerificationTier: "AUTOMATED" | "PARTIAL" | "MANUAL";
  readonly passkeyEnabled: boolean;
  readonly mfaEnabled: boolean;
  readonly registeredDeviceCount: number;
  readonly lastProofOfLifeAt: ISODate;
  readonly proofOfLifeIntervalDays: number;
  readonly estateDocumentCount: number;
  readonly executorNominated: boolean;
  readonly identityVerified: boolean;
  /** User has told us their keys are stored in more than one physical location. */
  readonly keysGeographicallySeparated: boolean;
  readonly now: ISODate;
}

export interface HealthResult {
  readonly score: number;
  readonly band: "green" | "amber" | "red";
  readonly components: readonly HealthComponent[];
  readonly topActions: readonly HealthComponent[];
  /**
   * Whether the pack has actually been exported. Distinct from `cappedByContinuityPack`, which is
   * only true when the cap is *biting* — i.e. everything else is complete. Callers must branch on
   * this to describe export state, or a plan that is simply incomplete gets reported as exported.
   */
  readonly continuityPackExported: boolean;
  readonly cappedByContinuityPack: boolean;
  readonly summary: string;
}

/** The green band is unreachable without the Continuity Pack. */
export const GREEN_THRESHOLD = 80;
export const CONTINUITY_CAP = 79;

export function computeHealth(input: HealthInput): HealthResult {
  const components: HealthComponent[] = [];

  // 1. Beneficiaries and allocation (12)
  {
    const weight = 12;
    const allocationComplete = input.allocationBasisPoints === 10_000;
    const earned = input.beneficiaryCount === 0 ? 0 : allocationComplete ? weight : weight * 0.4;
    components.push({
      id: "beneficiaries",
      label: "Beneficiaries and allocation",
      weight,
      earned,
      status: earned === weight ? "COMPLETE" : earned === 0 ? "MISSING" : "PARTIAL",
      remediation:
        input.beneficiaryCount === 0
          ? "Add at least one beneficiary."
          : allocationComplete
            ? "Your estate is fully allocated."
            : `Allocate the remaining ${((10_000 - input.allocationBasisPoints) / 100).toFixed(0)}%.`,
      href: "/app/beneficiaries",
    });
  }

  // 2. Beneficiary contact verified (8)
  {
    const weight = 8;
    const ratio = input.beneficiaryCount === 0 ? 0 : input.beneficiariesWithVerifiedContact / input.beneficiaryCount;
    const earned = weight * ratio;
    components.push({
      id: "beneficiary_contact",
      label: "Beneficiary contact verified",
      weight,
      earned,
      status: ratio === 1 ? "COMPLETE" : ratio === 0 ? "MISSING" : "PARTIAL",
      remediation:
        ratio === 1
          ? "We can reach every beneficiary."
          : `${input.beneficiaryCount - input.beneficiariesWithVerifiedContact} beneficiary contact detail(s) still need confirming — if we can't reach them, they can't claim.`,
      href: "/app/beneficiaries",
    });
  }

  // 3. Asset ownership proven (12) — observation is not proof
  {
    const weight = 12;
    const proven = input.provenWalletCount;
    const ratio = input.walletCount === 0 ? 0 : proven / input.walletCount;
    const observedCredit = input.walletCount === 0 ? 0 : (input.observedWalletCount / input.walletCount) * 0.4;
    const earned = Math.min(weight, weight * Math.max(ratio, observedCredit));
    components.push({
      id: "asset_proof",
      label: "Asset ownership proven",
      weight,
      earned,
      status: ratio === 1 ? "COMPLETE" : earned === 0 ? "MISSING" : "PARTIAL",
      remediation:
        input.walletCount === 0
          ? "Add the wallets you want covered."
          : ratio === 1
            ? "Every wallet has a signed ownership proof."
            : `Sign an ownership challenge for ${input.walletCount - proven} wallet(s). Seeing a balance isn't proof you control it.`,
      href: "/app/assets",
    });
  }

  // 4. Succession rules defined (10)
  {
    const weight = 10;
    const earned = input.rules.length === 0 ? 0 : weight;
    components.push({
      id: "rules",
      label: "Succession rules defined",
      weight,
      earned,
      status: earned === weight ? "COMPLETE" : "MISSING",
      remediation: input.rules.length === 0 ? "Define how your assets should be distributed." : "Your rules are defined.",
      href: "/app/succession",
    });
  }

  // 5. Cryptographic enforcement (12)
  {
    const weight = 12;
    const summary = enforcementSummary(input.rules);
    const total = summary.cryptographic + summary.assisted + summary.legal;
    const ratio = total === 0 ? 0 : summary.cryptographic / total;
    const earned = weight * ratio;
    components.push({
      id: "cryptographic",
      label: "Cryptographic enforcement",
      weight,
      earned,
      status: ratio >= 0.99 ? "COMPLETE" : ratio === 0 ? "MISSING" : "PARTIAL",
      remediation:
        ratio >= 0.99
          ? "Your plan is enforced by cryptography."
          : `${summary.legal + summary.assisted} of your ${total} rules depend on people rather than code. That's sometimes unavoidable — just make sure your executor knows.`,
      href: "/app/succession",
    });
  }

  // 6. Continuity Pack (12) — the gate
  {
    const weight = 12;
    const exported = input.continuityPackExportedAt !== undefined;
    const ageDays = exported ? daysBetween(input.continuityPackExportedAt!, input.now) : Infinity;
    const stale = ageDays > 365;
    const earned = !exported ? 0 : stale ? weight * 0.5 : weight;
    components.push({
      id: "continuity_pack",
      label: "Continuity Pack exported",
      weight,
      earned,
      status: earned === weight ? "COMPLETE" : earned === 0 ? "MISSING" : "PARTIAL",
      remediation: !exported
        ? "Download your Continuity Pack. It's what lets your plan work even if we cease to exist — until you have it, your plan depends on us."
        : stale
          ? "Your Continuity Pack is over a year old. Export a fresh copy so it matches your current plan."
          : "Your plan survives without us.",
      href: "/app/continuity",
    });
  }

  // 7. Death verification coverage (8)
  {
    const weight = 8;
    const earned = input.countryVerificationTier === "AUTOMATED" ? weight : input.countryVerificationTier === "PARTIAL" ? weight * 0.7 : weight * 0.45;
    components.push({
      id: "verification_coverage",
      label: "Verification coverage in your country",
      weight,
      earned,
      status: earned === weight ? "COMPLETE" : "PARTIAL",
      remediation:
        input.countryVerificationTier === "MANUAL"
          ? "Your country has no automated death registry we can use, so verification is document-led. Naming a trusted contact and an executor materially speeds this up."
          : "Verification sources are available in your country.",
      href: "/app/verification",
    });
  }

  // 8. Account security (8)
  {
    const weight = 8;
    let earned = 0;
    if (input.passkeyEnabled) earned += weight * 0.55;
    if (input.mfaEnabled) earned += weight * 0.25;
    if (input.registeredDeviceCount >= 2) earned += weight * 0.2;
    components.push({
      id: "security",
      label: "Account security",
      weight,
      earned: Math.min(weight, earned),
      status: earned >= weight ? "COMPLETE" : earned === 0 ? "MISSING" : "PARTIAL",
      remediation: !input.passkeyEnabled
        ? "Add a passkey. It's the strongest protection against someone impersonating you — and the fastest way to prove you're alive."
        : input.registeredDeviceCount < 2
          ? "Register a second device so you can always prove you're alive, even if you lose one."
          : "Your account is well protected.",
      href: "/app/security",
    });
  }

  // 9. Recent proof of life (6)
  {
    const weight = 6;
    const days = daysBetween(input.lastProofOfLifeAt, input.now);
    const ratio = Math.max(0, 1 - days / (input.proofOfLifeIntervalDays * 1.5));
    const earned = weight * Math.min(1, ratio);
    components.push({
      id: "proof_of_life",
      label: "Recent proof of life",
      weight,
      earned,
      status: ratio >= 0.9 ? "COMPLETE" : ratio <= 0.1 ? "MISSING" : "PARTIAL",
      remediation:
        days > input.proofOfLifeIntervalDays
          ? `It's been ${Math.floor(days)} days since you last checked in. Sign in to reset your inactivity clock.`
          : "You've checked in recently.",
      href: "/app",
    });
  }

  // 10. Estate documents and executor (7)
  {
    const weight = 7;
    let earned = 0;
    if (input.estateDocumentCount > 0) earned += weight * 0.5;
    if (input.executorNominated) earned += weight * 0.5;
    components.push({
      id: "estate_documents",
      label: "Estate documents and executor",
      weight,
      earned,
      status: earned >= weight ? "COMPLETE" : earned === 0 ? "MISSING" : "PARTIAL",
      remediation: !input.executorNominated
        ? "Name your executor. This platform doesn't replace a will — the two need to agree with each other."
        : input.estateDocumentCount === 0
          ? "Upload your will or estate documents so your executor has everything in one place."
          : "Your estate documents are on file.",
      href: "/app/vault",
    });
  }

  // 11. Identity verified + key separation (5)
  {
    const weight = 5;
    let earned = 0;
    if (input.identityVerified) earned += weight * 0.6;
    if (input.keysGeographicallySeparated) earned += weight * 0.4;
    components.push({
      id: "identity",
      label: "Identity verified and keys separated",
      weight,
      earned,
      status: earned >= weight ? "COMPLETE" : earned === 0 ? "MISSING" : "PARTIAL",
      remediation: !input.identityVerified
        ? "Verify your identity so your beneficiaries can be matched to you at claim time."
        : !input.keysGeographicallySeparated
          ? "Store your backup keys in separate locations. Three keys in one drawer is a single key."
          : "Verified, with keys held separately.",
      href: "/app/security",
    });
  }

  const totalWeight = components.reduce((acc, c) => acc + c.weight, 0);
  const earnedTotal = components.reduce((acc, c) => acc + c.earned, 0);
  const raw = Math.round((earnedTotal / totalWeight) * 100);

  const continuityExported = input.continuityPackExportedAt !== undefined;
  const cappedByContinuityPack = !continuityExported && raw > CONTINUITY_CAP;
  const score = cappedByContinuityPack ? CONTINUITY_CAP : raw;

  const band: HealthResult["band"] = score >= GREEN_THRESHOLD ? "green" : score >= 55 ? "amber" : "red";

  const topActions = [...components]
    .filter((c) => c.status !== "COMPLETE")
    .sort((a, b) => b.weight - a.weight - (a.earned - b.earned))
    .slice(0, 4);

  return {
    score,
    band,
    components,
    topActions,
    continuityPackExported: continuityExported,
    cappedByContinuityPack,
    summary: cappedByContinuityPack
      ? "Your plan is well built, but it still depends on us existing. Export your Continuity Pack to remove that dependency."
      : band === "green"
        ? "Your legacy is comprehensively set up."
        : band === "amber"
          ? "Your plan works, but some important pieces are missing."
          : "Your plan has significant gaps. Start with the actions below.",
  };
}

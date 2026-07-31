/**
 * Bitcoin succession policy construction.
 *
 * Builds miniscript policies and output descriptors for the reference design in
 * ARCHITECTURE.md §5. This module is deliberately string-level and dependency-free: it composes
 * and analyses policies but never touches key material, never signs, and never broadcasts.
 *
 * The design decision that matters most here is **relative** timelocks (`older()`, BIP-68/CSV)
 * rather than absolute ones (`after()`, CLTV). A relative timelock resets every time the owner
 * moves the UTXO, so ordinary wallet use IS the proof-of-life mechanism. An absolute timelock
 * needs active re-anchoring on a calendar and silently expires if the owner forgets.
 *
 * This is the mechanism that makes "we can disappear and your legacy still executes" true.
 */

export const BLOCKS_PER_DAY = 144;

/** BIP-68 caps a relative block height timelock at 65535 blocks (~455 days). */
export const MAX_CSV_BLOCKS = 65_535;

export interface KeyRef {
  readonly role: "OWNER" | "HEIR" | "PLATFORM" | "RECOVERY";
  readonly label: string;
  /** An xpub or descriptor key expression. Never a private key. */
  readonly keyExpression: string;
}

export interface SuccessionPolicyInput {
  readonly owner: KeyRef;
  readonly heirs: readonly KeyRef[];
  /** Omitted entirely under PlatformRole.ATTESTOR_ONLY — the recommended launch posture. */
  readonly platform?: KeyRef;
  /** Delay before heirs can spend without the owner. */
  readonly inheritanceDelayDays: number;
  /** Longer fallback for the multi-heir path. */
  readonly fallbackDelayDays?: number;
  /** How many heirs must agree on the fallback path. */
  readonly heirThreshold?: number;
}

export interface PolicyAnalysis {
  readonly policy: string;
  readonly descriptor: string;
  readonly spendingPaths: readonly SpendingPath[];
  readonly survivesCompanyFailure: boolean;
  readonly platformIsSufficient: boolean;
  readonly platformIsNecessary: boolean;
  readonly warnings: readonly string[];
  readonly inheritanceDelayBlocks: number;
}

export interface SpendingPath {
  readonly name: string;
  readonly requires: readonly string[];
  readonly delayBlocks: number;
  readonly delayDays: number;
  readonly description: string;
  readonly requiresPlatform: boolean;
}

export function daysToBlocks(days: number): number {
  return Math.round(days * BLOCKS_PER_DAY);
}

export function blocksToDays(blocks: number): number {
  return blocks / BLOCKS_PER_DAY;
}

/**
 * Build the succession policy.
 *
 * Shape (see ARCHITECTURE.md §5.1):
 *   or(
 *     99@pk(OWNER),                                    ← key path: cheap, private, everyday use
 *     or(
 *       9@and(older(DELAY), pk(HEIR)),                 ← the backstop; no platform involvement
 *       1@thresh(2, OWNER, PLATFORM, HEIR)             ← assisted early recovery
 *     )
 *   )
 *
 * The `99@` / `9@` / `1@` weights are probability hints to the compiler, telling it which branch
 * to optimise for. The owner spending normally is overwhelmingly the common case.
 */
export function buildSuccessionPolicy(input: SuccessionPolicyInput): PolicyAnalysis {
  const warnings: string[] = [];
  const delayBlocks = daysToBlocks(input.inheritanceDelayDays);

  if (input.heirs.length === 0) {
    throw new Error("At least one heir key is required to build a succession policy");
  }
  if (delayBlocks > MAX_CSV_BLOCKS) {
    warnings.push(
      `A ${input.inheritanceDelayDays}-day delay exceeds the BIP-68 maximum of ${MAX_CSV_BLOCKS} blocks (~455 days). Use an absolute timelock instead, and accept that it needs periodic re-anchoring.`,
    );
  }
  if (input.inheritanceDelayDays < 90) {
    warnings.push(
      "An inheritance delay under 90 days leaves little room to notice and reverse a mistaken or hostile claim. 180 days is a common choice.",
    );
  }

  const heirThreshold = input.heirThreshold ?? Math.min(2, input.heirs.length);
  const fallbackBlocks = daysToBlocks(input.fallbackDelayDays ?? input.inheritanceDelayDays * 2);

  const primaryHeir = input.heirs[0]!;
  const heirBranch = `and(older(${delayBlocks}),pk(${primaryHeir.keyExpression}))`;

  const branches: string[] = [`99@pk(${input.owner.keyExpression})`, `9@${heirBranch}`];

  if (input.platform) {
    branches.push(
      `1@thresh(2,pk(${input.owner.keyExpression}),pk(${input.platform.keyExpression}),pk(${primaryHeir.keyExpression}))`,
    );
  }

  if (input.heirs.length > 1) {
    const heirKeys = input.heirs.map((h) => `pk(${h.keyExpression})`).join(",");
    branches.push(`1@and(older(${fallbackBlocks}),thresh(${heirThreshold},${heirKeys}))`);
  } else {
    warnings.push(
      "Only one heir key is configured. If that key is lost, the inheritance path is lost with it. Consider a second heir or a recovery key.",
    );
  }

  const policy = branches.length === 2 ? `or(${branches.join(",")})` : `or(${branches[0]},or(${branches.slice(1).join(",")}))`;

  const spendingPaths: SpendingPath[] = [
    {
      name: "Owner (key path)",
      requires: [input.owner.label],
      delayBlocks: 0,
      delayDays: 0,
      description:
        "You spend normally. On-chain this looks like any other Taproot spend — nobody can tell a succession plan exists until it's used.",
      requiresPlatform: false,
    },
    {
      name: "Inheritance backstop",
      requires: [primaryHeir.label],
      delayBlocks,
      delayDays: input.inheritanceDelayDays,
      description: `After ${input.inheritanceDelayDays} days without the coins moving, your heir can spend alone. This needs nothing from us — it's what makes your plan survive our disappearance.`,
      requiresPlatform: false,
    },
  ];

  if (input.platform) {
    spendingPaths.push({
      name: "Assisted recovery",
      requires: [`2 of: ${input.owner.label}, ${input.platform.label}, ${primaryHeir.label}`],
      delayBlocks: 0,
      delayDays: 0,
      description:
        "Any two of the three keys can spend immediately. We hold one — never enough on our own, and never required.",
      requiresPlatform: false, // 2-of-3 can be satisfied by owner+heir without us
    });
  }

  if (input.heirs.length > 1) {
    spendingPaths.push({
      name: "Multi-heir fallback",
      requires: [`${heirThreshold} of ${input.heirs.length} heirs`],
      delayBlocks: fallbackBlocks,
      delayDays: blocksToDays(fallbackBlocks),
      description: `If the primary heir key is lost, ${heirThreshold} of your ${input.heirs.length} heirs can act together after a longer delay.`,
      requiresPlatform: false,
    });
  }

  const platformIsSufficient = false; // by construction — no branch is satisfied by the platform alone
  const platformIsNecessary = spendingPaths.every((p) => p.requiresPlatform);

  return {
    policy,
    descriptor: buildDescriptor(policy, input.owner),
    spendingPaths,
    survivesCompanyFailure: spendingPaths.some((p) => !p.requiresPlatform),
    platformIsSufficient,
    platformIsNecessary,
    warnings,
    inheritanceDelayBlocks: delayBlocks,
  };
}

/**
 * Wrap a policy into a Taproot output descriptor.
 *
 * The owner's key becomes the internal key so the common case is a key-path spend: cheapest, and
 * it reveals nothing about the succession structure. In production the script tree is produced by
 * a miniscript compiler; this renders the descriptor form.
 */
export function buildDescriptor(policy: string, owner: KeyRef): string {
  return `tr(${owner.keyExpression},{${policy}})`;
}

// --- Proof of life ------------------------------------------------------------------------------

export interface UtxoTimelockState {
  readonly txid: string;
  readonly confirmedAtBlock: number;
  readonly amountSats: bigint;
}

export interface ProofOfLifeStatus {
  /** Blocks until the EARLIEST UTXO becomes heir-spendable. */
  readonly blocksRemaining: number;
  readonly daysRemaining: number;
  readonly earliestUnlockTxid: string | null;
  readonly needsReanchor: boolean;
  readonly message: string;
}

/**
 * Compute proof-of-life status across a UTXO set.
 *
 * Relative timelocks are PER-UTXO, each with its own clock. A user who received coins six months
 * ago and again yesterday has one UTXO close to unlocking and one far away. The honest number to
 * show is the MINIMUM remaining across the set — the point at which any part of the balance
 * becomes heir-spendable. Showing an average would understate the urgency.
 */
export function computeProofOfLife(input: {
  utxos: readonly UtxoTimelockState[];
  currentBlock: number;
  delayBlocks: number;
  warnWithinDays?: number;
}): ProofOfLifeStatus {
  if (input.utxos.length === 0) {
    return {
      blocksRemaining: input.delayBlocks,
      daysRemaining: blocksToDays(input.delayBlocks),
      earliestUnlockTxid: null,
      needsReanchor: false,
      message: "No coins are currently held under this policy.",
    };
  }

  let minRemaining = Number.POSITIVE_INFINITY;
  let earliest: string | null = null;

  for (const utxo of input.utxos) {
    const age = input.currentBlock - utxo.confirmedAtBlock;
    const remaining = input.delayBlocks - age;
    if (remaining < minRemaining) {
      minRemaining = remaining;
      earliest = utxo.txid;
    }
  }

  const blocksRemaining = Math.max(0, minRemaining);
  const daysRemaining = blocksToDays(blocksRemaining);
  const warnWithin = input.warnWithinDays ?? 60;

  return {
    blocksRemaining,
    daysRemaining,
    earliestUnlockTxid: earliest,
    needsReanchor: daysRemaining <= warnWithin,
    message:
      blocksRemaining === 0
        ? "Part of your balance is now spendable by your heir. If you're still using this wallet, re-anchor to reset the clock."
        : daysRemaining <= warnWithin
          ? `Your inheritance backstop unlocks in about ${Math.floor(daysRemaining)} days. Re-anchor — a send to yourself — resets it.`
          : `Your inheritance backstop unlocks in about ${Math.floor(daysRemaining)} days.`,
  };
}

/** Hardware wallet miniscript support is genuinely uneven. Assuming it is an onboarding failure. */
export interface DeviceCompatibility {
  readonly device: string;
  readonly taprootMultisig: boolean;
  readonly miniscript: boolean;
  readonly note: string;
}

export const DEVICE_COMPATIBILITY: readonly DeviceCompatibility[] = [
  { device: "Coldcard", taprootMultisig: true, miniscript: true, note: "Broad descriptor and miniscript support." },
  { device: "Ledger", taprootMultisig: true, miniscript: true, note: "Miniscript support depends on app version." },
  { device: "Trezor", taprootMultisig: true, miniscript: false, note: "Taproot supported; miniscript policies limited." },
  { device: "BitBox02", taprootMultisig: true, miniscript: false, note: "Verify policy support before relying on it." },
  { device: "Jade", taprootMultisig: true, miniscript: true, note: "Miniscript support available in recent firmware." },
];

export function compatibleDevices(): readonly DeviceCompatibility[] {
  return DEVICE_COMPATIBILITY.filter((d) => d.miniscript);
}

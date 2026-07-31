/**
 * AssetAdapter layer.
 *
 * The abstraction that keeps the core succession engine chain-agnostic. Critically, each adapter
 * declares its `capabilities` honestly — the succession engine reads them to decide which rule
 * tiers are actually achievable per chain, rather than pretending every chain can do everything.
 *
 * Address validation here is real. Balance lookups are stubbed for the demo (no network calls,
 * no RPC keys) and clearly marked. Nothing here can sign or broadcast.
 */

import type { Chain, VerificationState } from "@legacy/core";

export type OwnershipProofScheme = "BIP322" | "EIP191" | "ED25519_MESSAGE";

export interface AdapterCapabilities {
  /** Can the chain enforce a delay in its own script/VM? */
  readonly supportsNativeTimelock: boolean;
  /** Can succession conditions be enforced on-chain at all? */
  readonly supportsScriptedSuccession: boolean;
  /** Can it stream payments without a custodian? */
  readonly supportsStreaming: boolean;
  readonly supportsMultisig: boolean;
  readonly ownershipProofScheme: OwnershipProofScheme;
  /** What form an unsigned distribution artifact takes. */
  readonly artifactFormat: "PSBT" | "EIP1559_CALLDATA" | "SOLANA_MESSAGE";
}

export interface AddressValidation {
  readonly valid: boolean;
  readonly kind?: string;
  readonly reason?: string;
}

export interface AssetBalance {
  readonly address: string;
  readonly chain: Chain;
  readonly symbol: string;
  readonly amount: bigint;
  readonly decimals: number;
  readonly observedAt: string;
  /** Always OBSERVED at best — reading a balance never proves control. */
  readonly verificationState: VerificationState;
}

export interface OwnershipChallenge {
  readonly address: string;
  readonly chain: Chain;
  readonly scheme: OwnershipProofScheme;
  readonly message: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly nonce: string;
}

export interface AssetAdapter {
  readonly chain: Chain;
  readonly capabilities: AdapterCapabilities;
  validateAddress(address: string): AddressValidation;
  buildOwnershipChallenge(address: string, nonce: string, issuedAt: string): OwnershipChallenge;
  /** Demo stub — returns null rather than inventing a balance. */
  getBalance(address: string): Promise<AssetBalance | null>;
  describeDistribution(input: { to: string; amount: bigint; symbol: string }): string;
}

// --- Bitcoin -------------------------------------------------------------------------------------

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function validateBech32Like(address: string): AddressValidation {
  const lower = address.toLowerCase();
  if (!lower.startsWith("bc1")) return { valid: false, reason: "Not a bech32 Bitcoin address" };
  const data = lower.slice(3);
  if (data.length < 6) return { valid: false, reason: "Too short" };
  for (const ch of data) {
    if (!BECH32_CHARSET.includes(ch)) return { valid: false, reason: `Invalid character '${ch}'` };
  }
  // bc1p = Taproot (v1 witness), bc1q = SegWit v0
  if (lower.startsWith("bc1p")) {
    if (address.length !== 62) return { valid: false, reason: "Taproot addresses are 62 characters" };
    return { valid: true, kind: "P2TR (Taproot)" };
  }
  if (lower.startsWith("bc1q")) {
    if (address.length !== 42 && address.length !== 62) {
      return { valid: false, reason: "SegWit v0 addresses are 42 or 62 characters" };
    }
    return { valid: true, kind: address.length === 42 ? "P2WPKH" : "P2WSH" };
  }
  return { valid: false, reason: "Unrecognised witness version" };
}

const BASE58_CHARSET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function validateBase58(address: string): AddressValidation {
  if (address.length < 26 || address.length > 35) return { valid: false, reason: "Invalid length" };
  for (const ch of address) {
    if (!BASE58_CHARSET.includes(ch)) return { valid: false, reason: `Invalid character '${ch}'` };
  }
  if (address.startsWith("1")) return { valid: true, kind: "P2PKH (legacy)" };
  if (address.startsWith("3")) return { valid: true, kind: "P2SH" };
  return { valid: false, reason: "Unrecognised address prefix" };
}

export const bitcoinAdapter: AssetAdapter = {
  chain: "bitcoin",
  capabilities: {
    supportsNativeTimelock: true, // CSV / CLTV
    supportsScriptedSuccession: true, // miniscript / Taproot script paths
    // Bitcoin genuinely cannot stream without a custodian. Saying otherwise would be a lie
    // the product would then have to build custody to support. See DECISIONS.md §2.3.
    supportsStreaming: false,
    supportsMultisig: true,
    ownershipProofScheme: "BIP322",
    artifactFormat: "PSBT",
  },
  validateAddress(address) {
    const trimmed = address.trim();
    if (trimmed.length === 0) return { valid: false, reason: "Empty address" };
    if (trimmed.toLowerCase().startsWith("bc1")) return validateBech32Like(trimmed);
    return validateBase58(trimmed);
  },
  buildOwnershipChallenge(address, nonce, issuedAt) {
    return {
      address,
      chain: "bitcoin",
      scheme: "BIP322",
      message: `Legacy Protocol ownership proof\nAddress: ${address}\nNonce: ${nonce}\nIssued: ${issuedAt}\n\nSigning this proves you control this address. It authorises nothing and moves no funds.`,
      issuedAt,
      expiresAt: new Date(new Date(issuedAt).getTime() + 3_600_000).toISOString(),
      nonce,
    };
  },
  async getBalance() {
    // Demo mode: no RPC configured. Returning null is honest; inventing a balance is not.
    return null;
  },
  describeDistribution({ to, amount, symbol }) {
    return `PSBT: send ${amount} sats (${symbol}) to ${to}. Requires the beneficiary's signature — this artifact is useless on its own.`;
  },
};

// --- Ethereum / EVM ------------------------------------------------------------------------------

function validateEvmAddress(address: string): AddressValidation {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return { valid: false, reason: "EVM addresses are 0x followed by 40 hex characters" };
  }
  const body = address.slice(2);
  const isChecksummed = body !== body.toLowerCase() && body !== body.toUpperCase();
  return { valid: true, kind: isChecksummed ? "EVM (checksummed)" : "EVM" };
}

export const ethereumAdapter: AssetAdapter = {
  chain: "ethereum",
  capabilities: {
    supportsNativeTimelock: true,
    supportsScriptedSuccession: true,
    // Technically possible, but only with a contract holding the assets — which is custody by
    // a contract we wrote. Offered as an explicit opt-in tier, not the default.
    supportsStreaming: true,
    supportsMultisig: true,
    ownershipProofScheme: "EIP191",
    artifactFormat: "EIP1559_CALLDATA",
  },
  validateAddress: validateEvmAddress,
  buildOwnershipChallenge(address, nonce, issuedAt) {
    return {
      address,
      chain: "ethereum",
      scheme: "EIP191",
      message: `Legacy Protocol ownership proof\nAddress: ${address}\nNonce: ${nonce}\nIssued: ${issuedAt}\n\nSigning proves control. It grants no approval and transfers nothing.`,
      issuedAt,
      expiresAt: new Date(new Date(issuedAt).getTime() + 3_600_000).toISOString(),
      nonce,
    };
  },
  async getBalance() {
    return null;
  },
  describeDistribution({ to, amount, symbol }) {
    return `Unsigned calldata: transfer ${amount} ${symbol} to ${to}.`;
  },
};

/** ERC-20 shares EVM address rules; the distinction is the token contract, not the chain. */
export const erc20Adapter: AssetAdapter = {
  ...ethereumAdapter,
  describeDistribution({ to, amount, symbol }) {
    return `Unsigned calldata: ERC-20 transfer of ${amount} ${symbol} (minor units) to ${to}.`;
  },
};

// --- Solana --------------------------------------------------------------------------------------

function validateSolanaAddress(address: string): AddressValidation {
  if (address.length < 32 || address.length > 44) {
    return { valid: false, reason: "Solana addresses are 32-44 base58 characters" };
  }
  for (const ch of address) {
    if (!BASE58_CHARSET.includes(ch)) return { valid: false, reason: `Invalid character '${ch}'` };
  }
  return { valid: true, kind: "Ed25519 public key" };
}

export const solanaAdapter: AssetAdapter = {
  chain: "solana",
  capabilities: {
    supportsNativeTimelock: false,
    supportsScriptedSuccession: false, // would require a bespoke audited program
    supportsStreaming: false,
    supportsMultisig: true,
    ownershipProofScheme: "ED25519_MESSAGE",
    artifactFormat: "SOLANA_MESSAGE",
  },
  validateAddress: validateSolanaAddress,
  buildOwnershipChallenge(address, nonce, issuedAt) {
    return {
      address,
      chain: "solana",
      scheme: "ED25519_MESSAGE",
      message: `Legacy Protocol ownership proof\nAddress: ${address}\nNonce: ${nonce}\nIssued: ${issuedAt}`,
      issuedAt,
      expiresAt: new Date(new Date(issuedAt).getTime() + 3_600_000).toISOString(),
      nonce,
    };
  },
  async getBalance() {
    return null;
  },
  describeDistribution({ to, amount, symbol }) {
    return `Unsigned Solana message: transfer ${amount} ${symbol} (minor units) to ${to}.`;
  },
};

const ADAPTERS: Record<Chain, AssetAdapter> = {
  bitcoin: bitcoinAdapter,
  ethereum: ethereumAdapter,
  solana: solanaAdapter,
};

export function adapterFor(chain: Chain): AssetAdapter {
  return ADAPTERS[chain];
}

export function allAdapters(): readonly AssetAdapter[] {
  return Object.values(ADAPTERS);
}

/** Which chains can genuinely enforce succession on-chain — drives rule-tier resolution. */
export function chainsSupportingScriptedSuccession(): readonly Chain[] {
  return allAdapters()
    .filter((a) => a.capabilities.supportsScriptedSuccession)
    .map((a) => a.chain);
}

/**
 * Token registry.
 *
 * Stablecoins are added here rather than special-cased in the UI, so adding a token is a data
 * change rather than a code change.
 *
 * Note the decimals: USDC and USDT are 6, DAI is 18. Getting this wrong by a factor of 10^12 is
 * a real and recurring class of bug, which is why decimals live with the token definition and
 * every amount in the system is an integer in minor units.
 */

import type { Chain } from "./types";

export type TokenStandard = "NATIVE" | "ERC20" | "SPL";

export interface TokenDefinition {
  readonly symbol: string;
  readonly name: string;
  readonly chain: Chain;
  readonly standard: TokenStandard;
  readonly decimals: number;
  /** Contract address for tokens; absent for native assets. */
  readonly contractAddress?: string;
  /** Plain-language name shown to beneficiaries, who may never have heard of a stablecoin. */
  readonly friendlyName: string;
  /** Stablecoins are shown to 2dp; volatile assets to 4-8dp. */
  readonly displayDecimals: number;
  readonly isStablecoin: boolean;
}

export const TOKENS: readonly TokenDefinition[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    chain: "bitcoin",
    standard: "NATIVE",
    decimals: 8,
    friendlyName: "Bitcoin",
    displayDecimals: 4,
    isStablecoin: false,
  },
  {
    symbol: "ETH",
    name: "Ether",
    chain: "ethereum",
    standard: "NATIVE",
    decimals: 18,
    friendlyName: "Ethereum",
    displayDecimals: 4,
    isStablecoin: false,
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    chain: "ethereum",
    standard: "ERC20",
    decimals: 6,
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    friendlyName: "US dollar stablecoin (USDC)",
    displayDecimals: 2,
    isStablecoin: true,
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    chain: "ethereum",
    standard: "ERC20",
    decimals: 6,
    contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    friendlyName: "US dollar stablecoin (USDT)",
    displayDecimals: 2,
    isStablecoin: true,
  },
  {
    symbol: "DAI",
    name: "Dai",
    chain: "ethereum",
    standard: "ERC20",
    decimals: 18, // NOT 6 — a common and expensive mistake
    contractAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    friendlyName: "US dollar stablecoin (DAI)",
    displayDecimals: 2,
    isStablecoin: true,
  },
  {
    symbol: "SOL",
    name: "Solana",
    chain: "solana",
    standard: "NATIVE",
    decimals: 9,
    friendlyName: "Solana",
    displayDecimals: 4,
    isStablecoin: false,
  },
];

const BY_SYMBOL = new Map(TOKENS.map((t) => [t.symbol, t]));

export function token(symbol: string): TokenDefinition {
  const t = BY_SYMBOL.get(symbol.toUpperCase());
  if (!t) throw new Error(`Unknown token: ${symbol}`);
  return t;
}

export function tryToken(symbol: string): TokenDefinition | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

export function tokensForChain(chain: Chain): readonly TokenDefinition[] {
  return TOKENS.filter((t) => t.chain === chain);
}

export function stablecoins(): readonly TokenDefinition[] {
  return TOKENS.filter((t) => t.isStablecoin);
}

/** Display precision for an amount of this token. Stablecoins to cents, BTC to 4dp. */
export function displayDecimalsFor(symbol: string): number {
  return tryToken(symbol)?.displayDecimals ?? 4;
}

export function friendlyNameFor(symbol: string): string {
  return tryToken(symbol)?.friendlyName ?? symbol;
}

import { describe, expect, it } from "vitest";
import {
  TOKENS,
  displayDecimalsFor,
  friendlyNameFor,
  stablecoins,
  token,
  tokensForChain,
  tryToken,
} from "../src/tokens";
import { formatAmount, parseAmount, splitByBasisPoints } from "../src/money";

describe("token registry", () => {
  it("includes USDT alongside the other stablecoins", () => {
    const usdt = token("USDT");
    expect(usdt.symbol).toBe("USDT");
    expect(usdt.chain).toBe("ethereum");
    expect(usdt.standard).toBe("ERC20");
    expect(usdt.isStablecoin).toBe(true);
    expect(stablecoins().map((t) => t.symbol)).toContain("USDT");
  });

  it("uses the correct decimals per token", () => {
    // The expensive mistake: assuming all stablecoins are 6 decimals. DAI is 18.
    expect(token("USDC").decimals).toBe(6);
    expect(token("USDT").decimals).toBe(6);
    expect(token("DAI").decimals).toBe(18);
    expect(token("BTC").decimals).toBe(8);
    expect(token("ETH").decimals).toBe(18);
    expect(token("SOL").decimals).toBe(9);
  });

  it("carries the canonical mainnet contract address for each ERC-20", () => {
    expect(token("USDT").contractAddress).toBe("0xdAC17F958D2ee523a2206206994597C13D831ec7");
    expect(token("USDC").contractAddress).toBe("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    // Native assets have no contract.
    expect(token("BTC").contractAddress).toBeUndefined();
  });

  it("is case-insensitive on lookup", () => {
    expect(token("usdt").symbol).toBe("USDT");
    expect(tryToken("UsDt")?.symbol).toBe("USDT");
  });

  it("returns undefined rather than throwing for unknown symbols", () => {
    expect(tryToken("NOTACOIN")).toBeUndefined();
    expect(() => token("NOTACOIN")).toThrow(/Unknown token/);
  });

  it("groups tokens by chain", () => {
    const eth = tokensForChain("ethereum").map((t) => t.symbol);
    expect(eth).toEqual(expect.arrayContaining(["ETH", "USDC", "USDT", "DAI"]));
    expect(tokensForChain("bitcoin").map((t) => t.symbol)).toEqual(["BTC"]);
  });

  it("shows stablecoins to 2dp and volatile assets to 4dp", () => {
    expect(displayDecimalsFor("USDT")).toBe(2);
    expect(displayDecimalsFor("USDC")).toBe(2);
    expect(displayDecimalsFor("BTC")).toBe(4);
    // Unknown symbols fall back to a safe default rather than throwing in a render path.
    expect(displayDecimalsFor("MYSTERY")).toBe(4);
  });

  it("gives beneficiaries a plain-language name", () => {
    expect(friendlyNameFor("USDT")).toMatch(/stablecoin/i);
    expect(friendlyNameFor("BTC")).toBe("Bitcoin");
  });

  it("has no duplicate symbols", () => {
    const symbols = TOKENS.map((t) => t.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});

describe("USDT amounts round-trip correctly", () => {
  it("parses and formats at 6 decimals", () => {
    const amount = parseAmount("183000", 6, "USDT");
    expect(amount.value).toBe(183_000_000_000n);
    expect(formatAmount(amount, displayDecimalsFor("USDT"))).toBe("183,000.00");
  });

  it("splits USDT without losing a single micro-unit", () => {
    // An amount that does not divide evenly three ways.
    const total = parseAmount("183000.000001", 6, "USDT").value;
    const parts = splitByBasisPoints(total, [
      { id: "a", basisPoints: 5000 },
      { id: "b", basisPoints: 2500 },
      { id: "c", basisPoints: 2500 },
    ]);
    expect(parts.reduce((acc, p) => acc + p.value, 0n)).toBe(total);
  });

  it("keeps USDT and DAI distinct despite both being dollar stablecoins", () => {
    // Same nominal value, different decimals — the amounts must not be interchangeable.
    const usdt = parseAmount("100", 6, "USDT");
    const dai = parseAmount("100", 18, "DAI");
    expect(usdt.value).not.toBe(dai.value);
    expect(formatAmount(usdt, 2)).toBe(formatAmount(dai, 2));
  });
});

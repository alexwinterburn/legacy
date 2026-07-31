import { describe, expect, it } from "vitest";
import {
  BLOCKS_PER_DAY,
  MAX_CSV_BLOCKS,
  buildSuccessionPolicy,
  compatibleDevices,
  computeProofOfLife,
  daysToBlocks,
  type KeyRef,
} from "../src/index";

const owner: KeyRef = { role: "OWNER", label: "Your key", keyExpression: "xpubOWNER/0/*" };
const heir: KeyRef = { role: "HEIR", label: "Christine's key", keyExpression: "xpubHEIR1/0/*" };
const heir2: KeyRef = { role: "HEIR", label: "Arabella's key", keyExpression: "xpubHEIR2/0/*" };
const platform: KeyRef = { role: "PLATFORM", label: "Legacy key", keyExpression: "xpubPLATFORM/0/*" };

describe("succession policy construction", () => {
  it("builds a policy with an owner key path and a timelocked heir path", () => {
    const result = buildSuccessionPolicy({ owner, heirs: [heir], inheritanceDelayDays: 180 });
    expect(result.policy).toContain(`pk(${owner.keyExpression})`);
    expect(result.policy).toContain(`older(${daysToBlocks(180)})`);
    expect(result.descriptor).toMatch(/^tr\(xpubOWNER/);
  });

  it("converts days to blocks at ~144 blocks/day", () => {
    expect(daysToBlocks(1)).toBe(BLOCKS_PER_DAY);
    expect(daysToBlocks(180)).toBe(25_920);
  });

  it("warns when the delay exceeds the BIP-68 relative timelock maximum", () => {
    const result = buildSuccessionPolicy({ owner, heirs: [heir], inheritanceDelayDays: 500 });
    expect(result.inheritanceDelayBlocks).toBeGreaterThan(MAX_CSV_BLOCKS);
    expect(result.warnings.some((w) => w.includes("BIP-68"))).toBe(true);
  });

  it("warns about a short delay", () => {
    const result = buildSuccessionPolicy({ owner, heirs: [heir], inheritanceDelayDays: 30 });
    expect(result.warnings.some((w) => w.includes("90 days"))).toBe(true);
  });

  it("warns when there is a single point of failure on the heir side", () => {
    const result = buildSuccessionPolicy({ owner, heirs: [heir], inheritanceDelayDays: 180 });
    expect(result.warnings.some((w) => w.includes("Only one heir key"))).toBe(true);
  });

  it("adds a multi-heir fallback path with a longer delay", () => {
    const result = buildSuccessionPolicy({
      owner,
      heirs: [heir, heir2],
      inheritanceDelayDays: 180,
      fallbackDelayDays: 365,
      heirThreshold: 2,
    });
    const fallback = result.spendingPaths.find((p) => p.name === "Multi-heir fallback");
    expect(fallback).toBeDefined();
    expect(fallback!.delayDays).toBeGreaterThan(180);
  });

  it("rejects a policy with no heirs", () => {
    expect(() => buildSuccessionPolicy({ owner, heirs: [], inheritanceDelayDays: 180 })).toThrow();
  });
});

describe("trust invariants — the product's central claims", () => {
  it("the platform is never sufficient, with or without a platform key", () => {
    const withPlatform = buildSuccessionPolicy({ owner, heirs: [heir], platform, inheritanceDelayDays: 180 });
    const without = buildSuccessionPolicy({ owner, heirs: [heir], inheritanceDelayDays: 180 });
    expect(withPlatform.platformIsSufficient).toBe(false);
    expect(without.platformIsSufficient).toBe(false);
  });

  it("the platform is never necessary — a path always exists without it", () => {
    const result = buildSuccessionPolicy({ owner, heirs: [heir], platform, inheritanceDelayDays: 180 });
    expect(result.platformIsNecessary).toBe(false);
    expect(result.survivesCompanyFailure).toBe(true);
    expect(result.spendingPaths.some((p) => !p.requiresPlatform)).toBe(true);
  });

  it("the inheritance backstop needs nothing from the platform", () => {
    const result = buildSuccessionPolicy({ owner, heirs: [heir], platform, inheritanceDelayDays: 180 });
    const backstop = result.spendingPaths.find((p) => p.name === "Inheritance backstop")!;
    expect(backstop.requiresPlatform).toBe(false);
    expect(backstop.requires).toEqual([heir.label]);
  });

  it("omitting the platform key entirely still yields a working plan (ATTESTOR_ONLY)", () => {
    const result = buildSuccessionPolicy({ owner, heirs: [heir, heir2], inheritanceDelayDays: 180 });
    expect(result.policy).not.toContain("PLATFORM");
    expect(result.survivesCompanyFailure).toBe(true);
  });
});

describe("proof of life", () => {
  const delayBlocks = daysToBlocks(180);

  it("reports the MINIMUM remaining across the UTXO set, not the average", () => {
    // One old UTXO close to unlocking, one recent. The honest answer is the old one.
    const status = computeProofOfLife({
      utxos: [
        { txid: "old", confirmedAtBlock: 800_000, amountSats: 100_000n },
        { txid: "new", confirmedAtBlock: 825_000, amountSats: 100_000n },
      ],
      currentBlock: 825_000,
      delayBlocks,
    });
    expect(status.earliestUnlockTxid).toBe("old");
    expect(status.blocksRemaining).toBe(delayBlocks - 25_000);
  });

  it("flags the need to re-anchor as the unlock approaches", () => {
    const status = computeProofOfLife({
      utxos: [{ txid: "a", confirmedAtBlock: 800_000, amountSats: 1n }],
      currentBlock: 800_000 + delayBlocks - daysToBlocks(30),
      delayBlocks,
      warnWithinDays: 60,
    });
    expect(status.needsReanchor).toBe(true);
    expect(status.message).toMatch(/re-anchor/i);
  });

  it("does not flag a freshly re-anchored wallet", () => {
    const status = computeProofOfLife({
      utxos: [{ txid: "a", confirmedAtBlock: 825_000, amountSats: 1n }],
      currentBlock: 825_010,
      delayBlocks,
      warnWithinDays: 60,
    });
    expect(status.needsReanchor).toBe(false);
  });

  it("clamps at zero once the timelock has matured", () => {
    const status = computeProofOfLife({
      utxos: [{ txid: "a", confirmedAtBlock: 700_000, amountSats: 1n }],
      currentBlock: 900_000,
      delayBlocks,
    });
    expect(status.blocksRemaining).toBe(0);
    expect(status.message).toMatch(/spendable by your heir/);
  });

  it("handles an empty UTXO set without pretending there's a clock running", () => {
    const status = computeProofOfLife({ utxos: [], currentBlock: 800_000, delayBlocks });
    expect(status.earliestUnlockTxid).toBeNull();
    expect(status.needsReanchor).toBe(false);
  });
});

describe("device compatibility", () => {
  it("reports only devices that genuinely support miniscript", () => {
    const compatible = compatibleDevices();
    expect(compatible.length).toBeGreaterThan(0);
    expect(compatible.every((d) => d.miniscript)).toBe(true);
    // Compatibility is genuinely uneven — the matrix must not claim universal support.
    expect(compatible.length).toBeLessThan(5);
  });
});

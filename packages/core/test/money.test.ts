import { describe, expect, it } from "vitest";
import {
  BASIS_POINTS_TOTAL,
  formatAmount,
  parseAmount,
  splitByBasisPoints,
} from "../src/money";
import { AuditChain, canonicalJson } from "../src/audit";

describe("parseAmount", () => {
  it("parses without floating point error", () => {
    expect(parseAmount("1.84", 8, "BTC").value).toBe(184_000_000n);
    expect(parseAmount("0.1", 18, "ETH").value).toBe(100_000_000_000_000_000n);
    // The canonical float trap: 0.1 + 0.2 !== 0.3
    const a = parseAmount("0.1", 8, "BTC").value;
    const b = parseAmount("0.2", 8, "BTC").value;
    expect(a + b).toBe(parseAmount("0.3", 8, "BTC").value);
  });

  it("rejects precision beyond the asset's decimals", () => {
    expect(() => parseAmount("0.123456789", 8, "BTC")).toThrow(/precision/);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "abc", "1.2.3", "1,000"]) {
      expect(() => parseAmount(bad, 8, "BTC")).toThrow();
    }
  });
});

describe("formatAmount", () => {
  it("formats with thousands separators", () => {
    expect(formatAmount({ value: 42_000_000_00n, decimals: 2, symbol: "USDC" }, 2)).toBe("42,000,000.00");
    expect(formatAmount({ value: 420_000_000_000n, decimals: 6, symbol: "USDC" }, 2)).toBe("420,000.00");
  });

  it("keeps a minimum number of decimal places", () => {
    expect(formatAmount({ value: 100_000_000n, decimals: 8, symbol: "BTC" }, 4)).toBe("1.0000");
  });
});

describe("splitByBasisPoints — conservation", () => {
  it("splits evenly when it divides exactly", () => {
    const parts = splitByBasisPoints(100_000_000n, [
      { id: "a", basisPoints: 5000 },
      { id: "b", basisPoints: 2500 },
      { id: "c", basisPoints: 2500 },
    ]);
    expect(parts.map((p) => p.value)).toEqual([50_000_000n, 25_000_000n, 25_000_000n]);
  });

  it("conserves every minor unit when the split is uneven", () => {
    // Three-way split of an indivisible amount. Naive division loses satoshis.
    const total = 100_000_001n;
    const parts = splitByBasisPoints(total, [
      { id: "a", basisPoints: 3333 },
      { id: "b", basisPoints: 3333 },
      { id: "c", basisPoints: 3334 },
    ]);
    expect(parts.reduce((acc, p) => acc + p.value, 0n)).toBe(total);
  });

  it("conserves across many randomised cases", () => {
    for (let i = 1; i <= 500; i++) {
      const total = BigInt(i * 7919 + 13);
      const parts = splitByBasisPoints(total, [
        { id: "a", basisPoints: 1234 },
        { id: "b", basisPoints: 4321 },
        { id: "c", basisPoints: 2222 },
        { id: "d", basisPoints: 2223 },
      ]);
      expect(parts.reduce((acc, p) => acc + p.value, 0n)).toBe(total);
    }
  });

  it("is deterministic — the same input always produces the same split", () => {
    const alloc = [
      { id: "christine", basisPoints: 5000 },
      { id: "arabella", basisPoints: 2500 },
      { id: "ava", basisPoints: 2500 },
    ];
    const first = splitByBasisPoints(184_000_001n, alloc);
    const second = splitByBasisPoints(184_000_001n, alloc);
    expect(first).toEqual(second);
  });

  it("rejects allocations that do not sum to 100%", () => {
    expect(() =>
      splitByBasisPoints(1000n, [
        { id: "a", basisPoints: 5000 },
        { id: "b", basisPoints: 4000 },
      ]),
    ).toThrow(/must sum/);
    expect(BASIS_POINTS_TOTAL).toBe(10_000);
  });

  it("handles a zero balance", () => {
    const parts = splitByBasisPoints(0n, [
      { id: "a", basisPoints: 5000 },
      { id: "b", basisPoints: 5000 },
    ]);
    expect(parts.every((p) => p.value === 0n)).toBe(true);
  });
});

describe("canonicalJson", () => {
  it("is independent of key insertion order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("handles nesting, arrays and bigints", () => {
    expect(canonicalJson({ z: [1, { y: 2, x: 3 }], a: 10n })).toBe('{"a":"10","z":[1,{"x":3,"y":2}]}');
  });
});

describe("AuditChain", () => {
  const base = { actorType: "USER" as const, actorId: "u1", occurredAt: "2026-01-01T00:00:00.000Z" };

  it("chains entries and verifies", () => {
    const chain = new AuditChain();
    chain.append({ ...base, action: "user.created" });
    chain.append({ ...base, action: "beneficiary.added", payload: { id: "b1" } });
    chain.append({ ...base, action: "wallet.added", payload: { chain: "bitcoin" } });
    expect(chain.all()).toHaveLength(3);
    expect(chain.verify()).toEqual({ valid: true, brokenAt: null });
  });

  it("detects tampering with a historical entry", () => {
    const chain = new AuditChain();
    chain.append({ ...base, action: "user.created" });
    chain.append({ ...base, action: "beneficiary.added", payload: { allocation: 5000 } });
    chain.append({ ...base, action: "plan.created" });

    // Rewrite history: change an allocation after the fact.
    const entries = [...chain.all()];
    const tampered = { ...entries[1]!, payload: { allocation: 10000 } };
    const rebuilt = AuditChain.fromEntries([entries[0]!, tampered, entries[2]!]);

    const result = rebuilt.verify();
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it("has a stable head that changes on append", () => {
    const chain = new AuditChain();
    const before = chain.head();
    chain.append({ ...base, action: "user.created" });
    expect(chain.head()).not.toBe(before);
  });
});

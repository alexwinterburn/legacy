# Contracts

> ## ⚠ UNAUDITED. NOT DEPLOYED. TESTNET ONLY.
> Do not send real funds to this contract. An independent security audit is a hard launch gate
> (ROADMAP.md, Phase 2). This code exists to make the architecture concrete and reviewable.

`src/LegacyVault.sol` is the EVM reference implementation of the succession policy described in
`docs/ARCHITECTURE.md` §6.

---

## What the contract does

Holds **policy**, not principal, by default: beneficiaries and their basis-point allocations, the
cooling-off duration, the attestor quorum requirement, and the plan's state machine. Assets stay in
the owner's account and move by allowance at execution time, so a bug here cannot drain a balance
that was never held here.

Reaching `EXECUTABLE` requires **all** of:

1. A claim is open.
2. The cooling-off period has fully elapsed on-chain.
3. The owner has not vetoed.
4. Enough valid attestations from **distinct, registered** attestors.
5. Those attestors span enough **distinct independence classes**.

A quorum of attestations is a necessary condition. It is never a sufficient one.

---

## What the contract deliberately omits

| Omission | Reason |
|---|---|
| Upgrade proxy | An upgrade key can rewrite who inherits. That is a fund-theft key with extra steps. Users migrate by choice; they are not upgraded by decree. |
| Admin pause on execution | A pause over succession is a freeze capability. Only *new plan creation* can be paused; existing plans always complete. |
| Admin override of allocations | No such function exists. Not gated — absent. |
| Admin ability to open, close or accelerate a claim | Same. |
| Custody of principal by default | Keeps the blast radius of any bug away from the balance. |

`ownerVeto()` is the cheapest state-changing function in the contract, has no quorum, no admin
involvement and no delay. A living owner must be able to stop this under any network conditions,
even if every attestor in the world says otherwise.

---

## Replay protection

The EIP-712 digest binds:

- `chainId` and `verifyingContract` (in the domain separator) — no cross-chain or cross-contract replay
- `planId` (in the struct hash) — no cross-plan replay
- `nonce` (incremented on `reactivate`) — attestations from a vetoed claim are dead
- `validUntil` — attestations expire

Signature `s` values in the upper half-range are rejected (EIP-2), so a malleable copy of a
signature cannot be counted as a second, distinct attestation.

---

## Required test corpus before any deployment

Specified in `docs/THREAT-MODEL.md` T8. Every item is a **blocking** test:

| # | Test | Expected |
|---|---|---|
| 1 | Distribute before cooling-off elapses | Reverts `CoolingOffNotElapsed` |
| 2 | Distribute with quorum but no elapsed delay | Reverts |
| 3 | Same attestor signs twice | Reverts `DuplicateAttestor` |
| 4 | Malleable `s` used as a second signature | Reverts `malleable signature` |
| 5 | Two attestors, same class, `requiredDistinctClasses = 2` | Reverts `InsufficientIndependence` |
| 6 | Attestation from an unregistered signer | Reverts `UnknownAttestor` |
| 7 | Attestation replayed from another `planId` | Signature does not recover a registered attestor |
| 8 | Attestation replayed after `reactivate` (nonce bumped) | Reverts |
| 9 | Expired attestation | Reverts `AttestationExpired` |
| 10 | `ownerVeto` during cooling-off, then attestations submitted | Reverts `WrongState` |
| 11 | `ownerVeto` from a non-owner | Reverts `NotOwner` |
| 12 | Reentrant beneficiary calls `distribute` again | Second call reverts (state set before interactions) |
| 13 | Allocations summing to 9,999 or 10,001 bp | Reverts `AllocationsMustSumTo100` |
| 14 | Cooling-off below 30 days | Reverts `CoolingOffTooShort` |
| 15 | Distribution conservation across many uneven splits | `assert(distributed == balance)` holds |
| 16 | Admin attempts to alter a plan | No such function exists (compile-time) |
| 17 | Admin pauses, then an existing plan distributes | Succeeds |
| 18 | Gas cost of `ownerVeto` under congestion | Bounded and minimal |

---

## Toolchain (not installed here)

The prototype ships the contract source and this test plan. Wiring up Foundry or Hardhat is Phase 2
work, alongside the audit:

```bash
forge build
forge test -vvv
forge coverage
```

Deployment targets are testnet only until an audit report exists. There is no "soft launch" on
mainnet.

# ARCHITECTURE.md

Working name: **LEGACY** (`Legacy Protocol`). All brand strings resolve through
`@legacy/core/brand` so the final name is a one-file change.

---

## 1. The one-sentence architecture

> A user's succession plan is a **cryptographic spending policy** plus a **set of rules**; the
> platform's only job is to produce **signed, independently-verifiable evidence** that a
> life-event condition has been met, and to make it easy for the right people to act on that
> evidence — never to hold or move the assets itself.

---

## 2. Design principles (in priority order)

1. **The platform is never sufficient.** No key, quorum or admin action controlled solely by the
   company can move user assets.
2. **The platform is never necessary.** Every plan has at least one spending path that succeeds
   with the company permanently offline. This is the timelock backstop, and it is mandatory.
3. **Verification is evidence, not authority.** The oracle emits attestations. Attestations are
   inputs to a policy predicate. They are not commands.
4. **The user's veto outranks everything.** A living user can always halt succession, at any stage
   before final execution, with a single authenticated action.
5. **Delay is a security primitive.** Every irreversible step is preceded by a mandatory,
   user-configured, publicly-visible waiting period.
6. **Everything is append-only.** State is derived from an immutable, hash-chained event log.
7. **Honest tiering.** Every rule declares whether it is enforced by cryptography, by a
   counterparty, or by law. See DECISIONS.md §3.

---

## 3. System context

```
        ┌────────────┐   ┌────────────┐   ┌──────────────┐   ┌────────────┐
        │   Owner    │   │Beneficiary │   │  Executor /  │   │ Institution│
        │  (web/app) │   │  (portal)  │   │   Attorney   │   │   (API)    │
        └─────┬──────┘   └─────┬──────┘   └──────┬───────┘   └─────┬──────┘
              │                │                 │                 │
              └────────────────┴────────┬────────┴─────────────────┘
                                        │  HTTPS / OAuth2 / mTLS (institutional)
                              ┌─────────▼──────────┐
                              │    API Gateway     │  authz, rate limit, audit
                              └─────────┬──────────┘
        ┌───────────────┬───────────────┼────────────────┬──────────────────┐
        │               │               │                │                  │
 ┌──────▼─────┐  ┌──────▼──────┐ ┌──────▼──────┐  ┌──────▼──────┐  ┌────────▼───────┐
 │ Succession │  │   Death     │  │   Legacy    │  │   Fraud     │  │     Vault      │
 │  Engine    │  │Verification │  │   Oracle    │  │   Engine    │  │ (E2E docs/msg) │
 └──────┬─────┘  └──────┬──────┘ └──────┬──────┘  └──────┬──────┘  └────────┬───────┘
        │               │               │                │                  │
        │        ┌──────▼────────┐      │                │                  │
        │        │Country        │      │                │                  │
        │        │Providers  ×N  │      │                │                  │
        │        └───────────────┘      │                │                  │
        │                               │                │                  │
 ┌──────▼───────────────────────────────▼────────────────▼──────────────────▼──────┐
 │            Append-only Event Log  +  Postgres projections  +  Redis              │
 └─────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
                          ┌────────────▼─────────────┐
                          │   Asset Adapter Layer    │  (read-mostly; never holds keys)
                          ├──────────┬───────┬───────┤
                          │ Bitcoin  │  EVM  │Solana │
                          └──────────┴───────┴───────┘
                                       │
                       ┌───────────────▼────────────────┐
                       │ Public chains (watch + verify) │
                       └────────────────────────────────┘
```

**Note what is *not* in this diagram:** there is no path from any platform service to a signing
operation over user funds. The platform's HSM signs *attestations*, never *transactions*, in the
recommended launch posture (`PlatformRole.ATTESTOR_ONLY`).

---

## 4. The three platform roles

The single most important configuration decision. Encoded as `PlatformRole` in `@legacy/core`.

| Role | Platform holds | Can it move funds alone? | Company-failure impact | Regulatory exposure |
|---|---|---|---|---|
| `ATTESTOR_ONLY` *(recommended launch)* | No key over user funds | No | None — plan is unaffected | Lowest |
| `COSIGNER` | 1 key of 3 | No | Falls back to timelock path | Medium — arguably still non-custodial |
| `CUSTODIAN` | Sufficient keys | **Yes** | Total | High — full CASP/custody licensing |

`CUSTODIAN` is **not implemented** and is present only as a rejected enum value with a compile-time
comment, so nobody adds it casually.

---

## 5. Bitcoin architecture

Bitcoin gets a Bitcoin-native design. No wrapped assets, no EVM-style contract, no bridging.

### 5.1 Reference policy

A Taproot output with a key-path spend for the owner and script-path spends for succession:

```
Key path:      owner_internal_key                 ← owner spends normally, cheapest, most private
Script leaf A: multi_a(2, OWNER, PLATFORM, HEIR)  ← assisted recovery / early succession
Script leaf B: and_v(v:older(TIMELOCK), pk(HEIR)) ← the backstop: heir alone, after the timelock
Script leaf C: and_v(v:older(LONG),  multi_a(2, HEIR_1, HEIR_2, ...))  ← multi-heir fallback
```

Expressed as a miniscript policy (built by `@legacy/bitcoin`):

```
or(
  99@pk(OWNER),
  or(
    9@and(older(26280), pk(HEIR)),            # ~6 months of blocks
    1@thresh(2, pk(OWNER), pk(PLATFORM), pk(HEIR))
  )
)
```

### 5.2 Why this shape

- **Key-path spend for the owner** means day-to-day use is indistinguishable on-chain from any
  other Taproot spend. Succession structure is not public until it is used. This is a real privacy
  win over legacy P2WSH multisig and is why Taproot is the right base.
- **`older()` (relative timelock, BIP-68/CSV) not `after()` (absolute).** A relative timelock
  resets whenever the owner moves the UTXO, which makes ordinary wallet use function as an
  automatic proof-of-life. An absolute timelock requires active re-anchoring and silently expires.
  **This is the dead-man's switch, and it is the answer to "what if the company disappears".**
- **The owner must periodically re-anchor** (self-spend) to reset the clock. This is surfaced in
  the UI as *"Proof of life: your Bitcoin backstop unlocks in 4 months. Re-anchor to reset."*
  Re-anchoring is a self-send costing only fees.
- **PSBT everywhere.** The platform never sees private keys. It produces unsigned PSBTs; hardware
  wallets sign; the platform can combine and finalise but cannot complete a spend alone.

### 5.3 Honest limitations

- Relative timelocks are per-UTXO. Receiving new coins to the descriptor creates UTXOs with their
  own clocks. The wallet layer must track the *minimum* remaining timelock across the UTXO set, and
  the UI must show that, not an average. Implemented in `@legacy/bitcoin`.
- Miniscript support is not universal across hardware wallets. Device compatibility is a real
  onboarding constraint; the repo carries a capability matrix rather than assuming support.
- Fee estimation for a spend that may occur years in the future is unsolved. This is precisely why
  pre-signed transaction ladders are rejected (DECISIONS §2.3) — the heir signs at claim time, with
  current fees.

---

## 6. EVM architecture

For ETH / ERC-20, a minimal `LegacyVault` reference contract (`/contracts`, **testnet only,
unaudited, not deployed**).

Design constraints:
- Assets stay in the owner's EOA/smart account. The vault holds **allowances and policy**, not
  balances, in the default mode — so a contract bug does not put principal at risk.
- Succession execution requires: a **quorum of oracle attestations** (EIP-712 typed data, distinct
  signers, replay-protected by chainId + nonce + planId), **plus** an elapsed on-chain
  `disputeDeadline`, **plus** no `ownerVeto` recorded.
- `ownerVeto()` is callable by the owner at any time and permanently cancels the pending execution
  — cheapest possible path, no admin involvement, no ability for anyone to block it.
- No upgradeability proxy in the reference implementation. Upgradeable succession contracts
  reintroduce exactly the trust the product claims to remove. **Migration, not upgrade**: users opt
  into a new contract version explicitly.
- No admin pause on execution. A pause switch on succession is a freeze capability — it violates
  principle 1. Pausing is limited to *accepting new plans*.

Reentrancy, oracle-replay, signature-malleability and timelock-bypass tests are specified in
`docs/API.md §7` and the contract test plan.

---

## 7. The Legacy Oracle

```
   Evidence sources                    Oracle                        Consumers
 ┌────────────────────┐        ┌────────────────────┐        ┌────────────────────┐
 │ Registry / feed    │───┐    │ 1. Normalise       │        │ Succession engine  │
 │ Death certificate  │───┤    │ 2. Score (DCE)     │───────▶│ Bitcoin co-sign    │
 │ Executor/notary    │───┼───▶│ 3. Independence    │        │ EVM LegacyVault    │
 │ Beneficiary claim  │───┤    │ 4. Quorum sign     │        │ Beneficiary portal │
 │ Inactivity signals │───┘    │ 5. Transparency log│        │ Public verifier    │
 └────────────────────┘        └────────────────────┘        └────────────────────┘
```

Properties, all implemented in `@legacy/oracle`:

1. **Attestations are signed statements about evidence, not instructions.** The payload asserts
   *"as of time T, subject S has death-confidence level L, derived from sources [...]"*. It never
   says "release funds".
2. **Quorum.** An attestation set is only actionable at ≥ `requiredAttestors` signatures from
   distinct signers in distinct `independenceClass`es.
3. **Transparency log.** Every attestation is appended to a hash chain whose head is published. A
   forged attestation is either in the log (visible to the user, who can veto) or not in the log
   (rejected by verifiers). This turns a silent key compromise into a loud one.
4. **Publish-then-act.** An attestation is not actionable until `publishDelay` has elapsed since it
   appeared in the public log. This guarantees the owner has a window to see it and veto.
5. **Verifiable by anyone, forever.** Verification needs only the public keys and the payload —
   no platform API. The verifier is ~40 lines and is published with the open-source contracts, so
   it survives the company.

---

## 8. Death Confidence Engine

Levels 0–6 as specified in the brief, with two additions that make it work:

**Independence classes.** Each source is tagged: `CIVIL_REGISTRY`, `MEDICAL`, `JUDICIAL`,
`FINANCIAL`, `SOCIAL`, `BEHAVIOURAL`, `PLATFORM`. Two sources of the same class never count as
independent corroboration — so a death certificate plus a registry entry (both `CIVIL_REGISTRY`,
both derived from the same registration event) cannot alone reach Level 6.

**Confidence decays and can be revoked.** Evidence has a `validFrom`/`staleAfter`. A user
authenticating post-claim doesn't merely "dispute" — it emits `PROOF_OF_LIFE`, which is
*dispositive*: confidence drops to Level 0 and the plan returns to `ACTIVE` regardless of any other
evidence. A living person's authenticated session outranks a government database, because
government death records do contain errors.

Threshold policy is a pure function — same inputs, same decision, fully auditable, unit-tested
against the false-death, real-death, reversal and hostile-beneficiary-change scenarios.

---

## 9. Death claim state machine

```
   ACTIVE ──claim──▶ INVESTIGATING ──evidence──▶ CORROBORATING ──threshold──▶ COOLING_OFF
      ▲                    │                          │                           │
      │                    │                          │                     dispute window
      │                    ▼                          ▼                           │
      └──── PROOF_OF_LIFE / dispute upheld ◀──────────┴───────────────────────────┤
      │                                                                            │
      │                                                                    ▼ (elapsed, no veto)
      │                                                              EXECUTABLE
      │                                                                    │
      │                                                        beneficiary verification
      │                                                                    ▼
      └──────────────────────────────────────────────────────────  DISTRIBUTING ──▶ COMPLETED
                                                                            │
                                                                     FRAUD_HOLD (any state)
```

Invariants enforced in code:
- No transition into `EXECUTABLE` without: threshold met **and** cooling-off fully elapsed **and**
  zero open disputes **and** fraud score below threshold **and** two distinct admin approvals.
- `PROOF_OF_LIFE` is accepted from any state before `COMPLETED` and always wins.
- Cooling-off cannot be shortened after a claim is opened — only lengthened. Prevents an attacker
  who compromises the account from setting it to zero.

---

## 10. Repository layout

```
/apps
  /web            Next.js 15 — marketing, owner app, beneficiary portal, admin, API routes
/packages
  /core           Brand config, shared types, money, result types, audit chain
  /succession     Rules, allocation maths, distribution, state machine
  /death-verification  DCE, provider abstraction, country providers
  /oracle         Ed25519 attestations, quorum, transparency log
  /fraud          Succession fraud engine
  /health         Legacy Health Score
  /blockchain     AssetAdapter registry, BTC/EVM/ERC-20/SOL adapters
  /bitcoin        Miniscript policy → descriptor, timelock/proof-of-life maths
  /demo-data      Seeded demo world (Alex Winterburn et al.)
/contracts        Solidity reference (testnet only, unaudited, not deployed)
/prisma           Authoritative production schema (not used by the demo runtime)
/docs             This document set
```

The demo runs entirely in-memory — no database, no network, no keys — so it can be demonstrated
anywhere, offline, without provisioning.

---

## 11. Production stack (target, not all present in the prototype)

| Layer | Choice | Reason |
|---|---|---|
| Web | Next.js 15 / React 19 / TypeScript strict / Tailwind v4 | Present in this repo |
| API | Next Route Handlers now → NestJS when the API becomes a product | Avoid premature service split |
| DB | PostgreSQL + append-only event table with hash chain | Auditability is a product feature |
| Cache/queue | Redis (rate limits, cooling-off timers, idempotency) | — |
| Auth | Passkeys/WebAuthn primary, TOTP fallback, step-up for sensitive ops | Phishing resistance is the point |
| Keys | Cloud HSM/KMS for attestation keys; **never** user key material | — |
| Chain | `bitcoinjs-lib` + miniscript, `viem`, `@solana/web3.js` — all read/verify only | — |
| Observability | OpenTelemetry, structured logs, Sentry; security events on a separate sink | — |
| Deploy | Docker, Terraform, per-region data residency | POPIA/GDPR |

---

## 12. Multi-chain: the `AssetAdapter` contract

Every chain implements one interface (`@legacy/blockchain`):

```ts
interface AssetAdapter {
  readonly chain: Chain;
  validateAddress(a: string): AddressValidation;
  getBalance(a: string): Promise<AssetBalance>;         // observation only
  buildOwnershipChallenge(a: string): OwnershipChallenge; // BIP-322 / EIP-191 / ed25519
  verifyOwnershipProof(c: OwnershipChallenge, sig: string): Promise<ProofResult>;
  prepareDistribution(p: DistributionPlan): Promise<UnsignedArtifact>; // PSBT / calldata / tx msg
  monitor(txid: string): Promise<TxStatus>;
  readonly capabilities: AdapterCapabilities; // declares what the chain genuinely supports
}
```

`capabilities` is what keeps the abstraction honest: `supportsNativeTimelock`,
`supportsScriptedSuccession`, `supportsStreaming`, `ownershipProofScheme`. The succession engine
reads capabilities to decide which rule tiers are achievable per asset, so the UI can tell a user
*"this rule is legally-enforced only on Solana"* rather than pretending uniformity.

---

## 13. Company-failure design (principle 2, in detail)

If the company vanishes tomorrow:

| Asset | What still works | What the user needs |
|---|---|---|
| Bitcoin | Heir spends via script leaf B once the relative timelock matures. No platform key involved. | The descriptor + heir key. Both exported. |
| EVM | Heirs execute against the deployed contract using previously-issued attestations, or the owner's own recovery path. | Contract address + ABI + attestation bundle. Exported. |
| Solana | Legal-tier only. Executor uses the exported plan document. | The exported plan. |
| Vault documents | Decryptable with the owner's key share + heir share; platform share not required at the reconstruction threshold used. | Exported key shares. |

**Enforced by product, not intention:** the Legacy Health Score has a mandatory
`survivabilityExport` component. A plan cannot reach a "green" state until the user has downloaded
the **Continuity Pack** — descriptors, contract addresses, public keys, the verifier script,
recovery instructions in plain language, and the executor letter. The score visibly refuses to go
green without it. This is the single most important product mechanism in the whole system, because
it is the only one that makes the "we can disappear" claim true rather than aspirational.

# LEGACY — Digital Legacy Infrastructure

> **Your wealth doesn't disappear when you do.**
>
> A trust-minimisation system for digital wealth succession. Prototype and reference architecture.

**Working name.** Every brand string resolves through `packages/core/src/brand.ts`, so the final
name is a one-file change.

---

## ⚠ Read this first

This is a **demonstration environment and reference architecture**, not a live product.

- No real funds are held or moved. No mainnet broadcast path exists.
- No production smart contracts are deployed. `contracts/` is **unaudited, testnet-only reference code**.
- **No private keys, seed phrases or mnemonics are generated, transmitted or stored anywhere in
  this codebase — including in demo mode.** No such code path exists.
- No government registry API clients have been written, because for death verification those APIs
  overwhelmingly do not exist. See `docs/REGULATORY.md` §3.
- Nothing here is legal, tax, insurance or financial advice.

**Start with [`docs/DECISIONS.md`](docs/DECISIONS.md).** It records where the original brief was
internally contradictory, technically impossible, or commercially dangerous — and what was built
instead. It is the most important document in the repository.

---

## The core idea

Most inheritance products quietly resolve a contradiction in the company's favour: to reliably pay
your heirs, the company must be able to move your assets — which means it can also lose, freeze or
seize them.

This architecture takes the opposite position, and states it precisely rather than reaching for
"trustless":

> **Never a sufficient party. Never a necessary party.**
>
> No key or quorum the company controls can move user assets. And every plan has at least one
> spending path that works with the company permanently offline.

The second half is enforced by product mechanics, not intention: the **Continuity Pack** —
descriptors, contract addresses, public keys, a standalone offline verifier and plain-language
recovery instructions — gates the health score. A plan cannot read green while it silently depends
on this company continuing to exist.

---

## Quick start

```bash
pnpm install
pnpm test          # 130 tests across the domain packages
pnpm build         # production build of the web app
pnpm dev           # http://localhost:3000
```

No database, no RPC endpoints, no API keys, no network access required. The demo runs entirely
in-memory.

### Worth visiting

| Route | What it shows |
|---|---|
| `/` | Marketing site — the argument for the category |
| `/onboarding` | Six-screen cinematic onboarding, with the Continuity Pack gate live |
| `/app` | Owner dashboard — health score, allocations, proof of life |
| `/app/simulator` | **"What happens if I die?"** — real engine output, including what *isn't* automatic |
| `/app/simulate-death` | Interactive walkthrough with a working owner veto |
| `/app/succession` | Rules, each badged with what actually enforces it |
| `/app/continuity` | The survivability bundle |
| `/beneficiary` | Beneficiary portal — no crypto knowledge assumed |
| `/admin` | Control tower — deliberately unable to alter plans or move funds |
| `/admin/coverage` | Global verification network, honestly graded |

### Live API

```bash
# A full attestation lifecycle: sign, publish, evaluate quorum before and after the publish delay
curl localhost:3000/api/v1/oracle/verify

# Real distribution maths — 1.84 BTC split 50/25/25
curl -X POST localhost:3000/api/v1/succession/simulate \
  -H 'content-type: application/json' \
  -d '{"coolingOffDays":60,"allocations":[
        {"beneficiaryId":"ben-christine","basisPoints":5000},
        {"beneficiaryId":"ben-arabella","basisPoints":2500},
        {"beneficiaryId":"ben-ava","basisPoints":2500}]}'

# Score evidence, including why a higher confidence level was withheld
curl -X POST localhost:3000/api/v1/death-verification/confidence \
  -H 'content-type: application/json' \
  -d '{"countryCode":"ZA","lastProofOfLifeAt":"2026-01-01T00:00:00Z",
       "now":"2026-07-01T00:00:00Z","evidence":[]}'
```

---

## Documentation

| Document | Contents |
|---|---|
| [DECISIONS.md](docs/DECISIONS.md) | **Read first.** Contradictions in the brief, what's impossible, what was refused |
| [PRODUCT.md](docs/PRODUCT.md) | Positioning, users, surfaces, journeys, pricing, design direction |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, Bitcoin/EVM architecture, the Oracle, company-failure design |
| [SECURITY.md](docs/SECURITY.md) | Ten enforced invariants, key management, cryptographic choices, assurance |
| [THREAT-MODEL.md](docs/THREAT-MODEL.md) | Twelve attacks, controls, and residual risk |
| [REGULATORY.md](docs/REGULATORY.md) | Licensing posture, what death data is actually obtainable, launch gates |
| [API.md](docs/API.md) | Endpoint surface — including the scopes that deliberately don't exist |
| [DATABASE.md](docs/DATABASE.md) | Schema design and its constraints |
| [MARKET.md](docs/MARKET.md) | Sourced market analysis, TAM/SAM/SOM, competitors, strategy |
| [ROADMAP.md](docs/ROADMAP.md) | Five phases, with the hard gates marked |

---

## Repository layout

```
apps/web                     Next.js 15 — marketing, owner app, beneficiary portal, admin, API
packages/core                Brand config, money, types, hash-chained audit log
packages/succession          Rules, allocation maths, state machine, simulator
packages/death-verification  Confidence engine, country providers, coverage
packages/oracle              Ed25519 attestations, quorum, transparency log
packages/fraud               Succession fraud engine
packages/health              Legacy Health Score
packages/blockchain          AssetAdapter registry — BTC / EVM / ERC-20 / SOL
packages/bitcoin             Miniscript policy → descriptor, proof-of-life maths
packages/demo-data           Seeded demo world
contracts/                   Solidity reference — UNAUDITED, NOT DEPLOYED
prisma/                      Authoritative production schema (unused by the demo)
docs/                        The document set above
```

The crypto-relevant packages (`core`, `oracle`, `bitcoin`) have **zero runtime dependencies**.

---

## What's genuinely implemented

Production-shaped domain logic, with 130 tests:

- **Succession state machine** with its safety invariants enforced in code: proof of life overrides
  everything from any pre-completion state; cooling-off extends but never shortens; two distinct
  approvers required; no single-approver path.
- **Death Confidence Engine** with **source independence classes** — a death certificate and a
  registry entry derive from the same registration event, so they can never corroborate each other.
- **Legacy Oracle** — real Ed25519 signing, quorum across independent classes, hash-chained
  transparency log, and publish-then-act delay. Verification works offline with no platform.
- **Fraud engine** — ten rules, with the time-decayed beneficiary-change-then-death-claim
  correlation as the primary signal.
- **Distribution maths** — largest-remainder splitting in integer minor units, so the parts always
  sum exactly to the whole. No satoshi is ever lost to rounding.
- **Bitcoin policy builder** — Taproot key path plus timelocked script paths, with relative
  (`older()`) timelocks so ordinary wallet use *is* the proof-of-life mechanism.
- **Legacy Health Score** — eleven weighted components, gated on the Continuity Pack.

Modelled, typed and mocked but **not** implemented: real KYC vendors, registry feeds, HSM/KMS,
on-chain broadcast, WebAuthn ceremony, Postgres persistence.

---

## Open questions requiring a human decision

Listed in full in [DECISIONS.md §9](docs/DECISIONS.md). The two that block everything else:

1. **Does the platform hold a co-signing key at launch, or is launch fully key-less?**
   Key-less (`ATTESTOR_ONLY`) is materially safer both regulatorily and architecturally, and is
   the recommended posture. The code supports both.
2. **Which single jurisdiction is the launch market, and has counsel confirmed the licensing
   position there?** Everything else is premature until this is answered.

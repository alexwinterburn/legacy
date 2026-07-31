# DECISIONS.md — Contradictions, Risks and Deliberate Departures from the Brief

> Read this first. The brief asked for an analysis pass before implementation, and explicitly
> asked that anything technically impossible, commercially dangerous or legally problematic be
> flagged with an alternative rather than silently built. This document is that pass.
>
> Everything in `/docs` and `/packages` downstream of this file is written to be consistent with
> the decisions recorded here.

---

## 0. Summary of the most important finding

The brief contains one structural contradiction that shapes the entire architecture:

**You cannot simultaneously have (a) a company that cannot release user funds, and (b) a company
that reliably releases funds to heirs when the user dies.**

Every inheritance system is a negotiated position on this axis:

```
  Pure self-custody                                          Pure custodial
  ├────────────────────────────────────────────────────────────────────────┤
  Heirs get nothing                                          Company can steal
  if the user's plan fails                                   or be compelled to seize
```

The honest resolution is not "we found a way to be at both ends". It is:

> **The company is never a *sufficient* party to move funds, and never a *necessary* party either.**

That is a weaker and more truthful claim than "we can't touch your Bitcoin", and it is the claim
this codebase is built to support. Concretely, in the reference 2-of-3 design the platform holds
one key of three. It cannot spend alone (not sufficient). And the user+heir path, plus the
timelocked recovery path, both work with the platform permanently offline (not necessary).

**Rejected marketing copy.** The brief's line *"We can't arbitrarily release your Bitcoin"* is
defensible. The line *"We can't simply take your Bitcoin"* is defensible. But the combination is
often read by users as "this is trustless", which it is not — it is *trust-minimised*. The product
copy in `apps/web` therefore says **"Never a sufficient party. Never a necessary party."** and
links to a plain-language explanation. See §7 below.

---

## 1. Contradictions in the brief, and how each is resolved

| # | Contradiction | Resolution taken |
|---|---|---|
| C1 | "Non-custodial" + "the platform distributes assets to beneficiaries" | The platform never distributes. It **co-signs** or **publishes an attestation**; the spending path is enforced by script/contract. Beneficiary receives to their own address. See ARCHITECTURE §4. |
| C2 | "Death Confidence Engine" with numeric scores + "only predefined thresholds trigger succession" | Confidence is **advisory input**, never the trigger. The trigger is a *policy predicate* over (confidence level, elapsed cooling-off, dispute state, fraud state, quorum of attestors). Implemented as a pure function in `@legacy/succession`. A score of 99% alone triggers nothing. |
| C3 | Age-based / scheduled / conditional inheritance ("R50k per month for 10 years") + non-custodial | **On-chain drip requires custody or a smart contract that holds funds.** Bitcoin cannot express "pay monthly for 10 years" without someone holding the coins. Resolved by splitting rule types into `TRUSTLESS`, `ASSISTED` and `LEGAL_ONLY` tiers — see §3 below. This is the single largest correction to the brief. |
| C4 | "Company can disappear and legacy still executes" + "platform verifies death" | If the platform is the only death attestor, its disappearance freezes everything. Resolved with the **timelock backstop**: every plan has a dead-man's-switch path that becomes spendable by heirs after N months of user inactivity, requiring *no* platform participation and *no* death verification at all. Death verification only ever *accelerates* what the timelock would eventually do anyway. |
| C5 | "Never invent APIs" + "government registry confirmation" as Level 5 | Correct instinct, and the research confirms it. Most countries have **no** real-time private-sector death API. See REGULATORY.md §3 and §2 below. All providers in this repo are `MANUAL` or `MOCK` except where a documented, purchasable data feed exists — and even then it is batch, not real-time. |
| C6 | "Not custodial" + KYC/AML, subscriptions, institutional API | Non-custodial does not mean unregulated. See REGULATORY.md. Flagged, not resolved by engineering. |
| C7 | "Store family documents, videos, letters" + "we can't access your data" | E2E encryption means the platform cannot read documents — but then it also cannot deliver them to heirs unless the *decryption key* is escrowed under the same succession logic. Resolved: documents are encrypted with a per-vault DEK; the DEK is split under the same threshold policy as the assets. The platform holds one share and cannot reconstruct alone. |
| C8 | Dashboard shows "Estimated protected wealth: $1,847,320" | Implies price feeds and therefore either an oracle dependency or stale data. Demo uses a **pinned snapshot price with an explicit `as of` timestamp** and labels valuations as indicative. Never used in any control decision. |

---

## 2. Things in the brief that are not currently possible (and what is done instead)

### 2.1 Real-time government death verification

Research finding — this materially changes the product:

- **South Africa.** The DHA National Population Register is not exposed as a general-purpose
  commercial death API. Access to NPR verification is intermediated and identity-verification
  oriented, not a death feed. Treated as `MANUAL_WITH_DOCUMENT` in this repo.
- **United States.** The full SSA Death Master File is not public. The **Limited Access DMF**
  requires NTIS certification, an annual subscriber fee (approx. USD 2,930 at time of writing),
  an independent ACAB security assessment, and a triennial systems-safeguards attestation, under
  §203 of the Bipartisan Budget Act of 2013. It is a **batch file, not an API**, and it excludes
  deaths within the preceding three calendar years unless certified. State-level records are
  separate and inconsistent.
- **United Kingdom.** GRO "Disclosure of Death Registration Information" (DDRI) is available to a
  very small number of approved organisations, involves a security assessment, a non-refundable
  assessment fee, and an annual licence fee in the tens of thousands of pounds. It is a **weekly
  data file** with roughly a 7-day lag from registration, and onward bulk disclosure is prohibited.
  The private-sector Death Notification Service (Equiniti/UK Finance) is a *notification* channel
  for banks, not a verification source.
- **Australia / Canada.** State/territory and provincial registries respectively. No single
  national feed. Certificate verification services exist in some jurisdictions.

**Consequence for the product:** the "Level 5 — government registry confirmation" tier is real but
is (a) batch, (b) lagging by days-to-weeks, (c) expensive, (d) contractually restricted, and
(e) unavailable in most of the world. The MVP therefore ships **Level 0–4** as the operative range,
with Level 5 modelled in the type system and gated behind a `ProviderCapability.LICENSED_FEED` flag
that is `false` for every provider in this repository.

No fake API clients have been written. `SouthAfricaProvider`, `UnitedStatesProvider` etc. exist as
**capability declarations and manual workflow definitions**, not as HTTP clients to endpoints that
do not exist.

### 2.2 "Multi-source independent confirmation" (Level 6)

Requires ≥2 genuinely independent sources. In practice, in most countries, the available sources
are correlated (a death certificate and a registry entry both derive from the same registration
event). The engine therefore models **source independence explicitly** (`independenceClass`) and
refuses to count two sources of the same class as independent. This is implemented, and is one of
the more defensible pieces of IP in the design.

### 2.3 On-chain scheduled distributions for Bitcoin

Bitcoin cannot natively pay a stream. Options are: custody it, wrap it, or use a series of
pre-signed timelocked transactions. Pre-signed transaction ladders are brittle (fee estimation
ages badly, RBF/CPFP complications, key material must persist). **Decision: not in MVP.** Scheduled
and age-based rules for BTC are implemented as **legally-expressed instructions plus a staged
key-release schedule**, clearly labelled in the UI as enforced by *process and law*, not by script.

For EVM assets, streaming *is* expressible on-chain, but requires the contract to hold the assets —
which is custody by a contract the platform authored. That is offered as an **opt-in** tier with the
trade-off stated explicitly in the UI.

### 2.4 "Verified assets" via on-chain balance checks

Reading a balance proves an address holds coins. It does **not** prove the user controls it.
Ownership requires a **signed challenge** (BIP-322 for Bitcoin, EIP-191/712 for EVM, ed25519 sign
for Solana). The repo distinguishes `DECLARED` / `OBSERVED` / `PROVEN` accordingly. Calling a
watch-only address "verified" would be misleading, so that word is reserved for `PROVEN`.

---

## 3. Rule-type tiering (the most important correction)

Every succession rule in `@legacy/succession` carries an **enforcement tier**. The UI shows this
badge on every rule. This is the mechanism that keeps the product honest.

| Tier | Meaning | Rules in this tier |
|---|---|---|
| `CRYPTOGRAPHIC` | Enforced by script/contract. Works with the company gone. | Immediate distribution, fixed percentage split, timelock-delayed access |
| `ASSISTED` | Requires a live counterparty (platform or a co-signer) to act. Company failure degrades to the timelock backstop. | Conditional release on beneficiary KYC, dispute-window enforcement, staged key release |
| `LEGAL` | Not technically enforced at all. Expresses intent that an executor/trustee must carry out. | Age-based tranches, monthly schedules, trust-directed distribution, "conditions of character" |

Selling a `LEGAL`-tier rule as if it were `CRYPTOGRAPHIC` would be the single most damaging thing
this product could do. The tier is a required field, not optional metadata.

---

## 4. Security risks that shape the design

1. **False death report is the primary attack**, not key theft. The whole system is a machine for
   converting "someone claims X is dead" into "X's coins move". Therefore: user veto beats
   everything, cooling-off is mandatory and non-zero, and a beneficiary-change immediately
   preceding a death claim is treated as presumptively hostile.
2. **Beneficiary-change → death-claim correlation** is the highest-signal fraud pattern in the
   brief and is implemented as a first-class rule with a time-decayed score.
3. **The platform's signing key is the crown jewel.** Compromise does not directly steal funds
   (1-of-3 is insufficient) but it *does* let an attacker attest to a death, which combined with a
   compromised heir account reaches quorum. Mitigated by: attestation quorum ≥2 with an independent
   attestor, HSM-resident keys, publish-then-act delay, and a public transparency log so a forged
   attestation is externally visible before it is actionable.
4. **Insider risk.** Modelled explicitly: no single admin role can move a plan from
   `INVESTIGATING` to `EXECUTABLE`. Enforced in code by a two-person rule in the state machine,
   not by process documentation.
5. **Correlated key loss.** Users who "back up" all three keys to the same cloud drive have a
   1-of-1 wallet. The health score penalises declared co-location of key material.

Full model in `docs/THREAT-MODEL.md`.

---

## 5. Regulatory posture (summary; full detail in REGULATORY.md)

- Non-custodial software provision is, in several regimes, outside the licensing perimeter —
  MiCA Recital 83 is explicit that non-custodial wallet software providers are not custodians.
  That exemption is **fragile** and is lost the moment the platform holds a key that is *sufficient*
  to move funds, or exercises discretion over release.
- **South Africa** declared crypto assets a financial product under FAIS in October 2022; CASP
  licensing under FAIS opened 1 June 2023. Whether this platform requires a CASP/FSP licence turns
  on whether it provides *advice* or *intermediary services* in relation to crypto assets. Holding
  a non-sufficient co-signing key, and not advising on the merits of assets, is the posture most
  likely to stay outside the perimeter — **but this is a legal question requiring South African
  counsel, not an engineering decision.** Flagged, not resolved.
- Estate administration is a **separately regulated activity** in most jurisdictions (Master of the
  High Court in SA, probate in UK/US). The platform must not act as executor or hold itself out as
  performing estate administration.
- The product must never state or imply that it replaces a will. In several jurisdictions a
  crypto-transfer instruction that conflicts with a valid will creates a live dispute, and
  succession law generally prevails over the technical fact of who received the coins.

**Engineering consequence:** every distribution artefact produced by this system carries an
`executorReconciliationRecord` so the on-chain outcome can be reconciled against the estate.

---

## 6. Things this repository deliberately does **not** do

- ❌ No production smart-contract deployment. Contracts in `/contracts` are **testnet/reference
  only**, unaudited, and marked as such in the source header.
- ❌ No private keys, seed phrases or mnemonics are generated, transmitted, or stored anywhere in
  this codebase — including in demo mode. The demo uses public addresses and mock signatures only.
- ❌ No real funds, no mainnet broadcast paths, no live exchange connections.
- ❌ No invented API clients for government registries.
- ❌ No fabricated market statistics. Every figure in MARKET.md is sourced or explicitly labelled
  as an assumption with its derivation shown.
- ❌ No legal, tax, insurance or financial advice, in the UI or the AI assistant. The assistant is
  constrained to describe *the user's own configuration* and is prohibited from advisory output.

---

## 7. Product-copy corrections

| Brief's copy | Problem | Replacement used |
|---|---|---|
| "We can't simply take your Bitcoin" (as a standalone claim) | Read as "trustless" | "Never a sufficient party. Never a necessary party." |
| "Crypto death insurance" | The brief already rejects this — correctly. It would also be an **insurance representation**, which is regulated. | "Digital legacy infrastructure" |
| "Protection score 94/100" | Implies a guarantee of protection | "Legacy Health 94/100" — a completeness measure, framed as *what is still missing*, never as a safety guarantee |
| "We monitor life events" | Implies surveillance the platform does not perform | "We watch for the signals you configure" |
| "Your legacy executes when required" | Overstates automation for `LEGAL`-tier rules | "Your plan executes to the extent it is cryptographically enforced, and guides your executor for the rest" |

---

## 8. MVP scope actually built here

Given the brief's Phase 1 definition, this repository implements a **demonstration-grade
prototype** with production-shaped domain logic:

**Fully implemented (with tests):**
- Succession rule engine: allocation validation, distribution computation, tiering, dust handling
- Death Confidence Engine: levels 0–6, source independence classes, decay, quorum
- Country provider abstraction + 7 providers with honest capability declarations
- Legacy Oracle: Ed25519-signed attestations, quorum verification, transparency-log hash chain
- Succession Fraud Engine: 10 rules, weighted, with the beneficiary-change correlation rule
- Legacy Health Score: 11 weighted components with per-component remediation guidance
- Asset adapters: BTC / ETH / ERC-20 / SOL with real address validation and ownership-proof models
- Bitcoin: miniscript policy → descriptor construction for the 2-of-3 + timelock design
- Succession state machine with two-person integrity rule
- Immutable, hash-chained audit log
- Full demo dataset and the SIMULATE DEATH walkthrough

**Modelled but not implemented (documented, typed, mocked):**
- Real KYC vendors, real registry feeds, HSM/KMS integration, on-chain broadcast,
  passkey/WebAuthn ceremony, Postgres persistence (schema is authoritative in `prisma/schema.prisma`
  but the demo runs from an in-memory store so it needs no database).

---

## 9. Open questions requiring a human decision

1. **Does the platform hold a co-signing key at launch, or is launch fully key-less
   (descriptor-generation + monitoring only)?** Key-less is materially safer regulatorily and is
   the recommended launch posture. The code supports both via `PlatformRole`.
2. Which single jurisdiction is the launch market, and has counsel confirmed the licensing
   position there? Everything else is premature.
3. Who is the **independent second attestor**? Without one, the oracle is single-source and
   Level 6 is unreachable. Candidates: a law firm, a notary network, an insurer, a mutual with
   another provider.
4. What happens to plans if the company enters liquidation — is the platform key escrowed with a
   third party, or destroyed (forcing the timelock path)? Recommendation: **destroyed**, with the
   timelock as the sole backstop, and this stated in the terms.
5. Insurance: AnchorWatch's model (Lloyd's-backed) suggests insured custody is a real differentiator.
   Being an insurance *distributor* is regulated. Decision needed before any "protected" language.

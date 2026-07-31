# PRODUCT.md

Working name **LEGACY**. Resolved through `@legacy/core/brand` — one file changes the whole product.

---

## 1. Positioning

**Category:** Digital legacy infrastructure.

**Headline:** *Your wealth doesn't disappear when you do.*

**Subheadline:** *Define who inherits your digital assets, on what terms, and let cryptography and
verified life events carry it forward — without handing anyone control of your keys.*

**Core principle, stated honestly:**

> **Never a sufficient party. Never a necessary party.**
> We can't move your assets on our own. And your plan still works if we cease to exist.

That second sentence is the one competitors cannot say, and it is enforced by the mandatory
Continuity Pack (ARCHITECTURE §13), not by promise.

### Language rules (binding on all copy)
- Never "insurance", "protected", "guaranteed", "insured" — insurance representations are regulated.
- Never "replaces your will". Always "works alongside your will".
- Never legal, tax or financial advice, in the UI or from the assistant.
- Never imply automation for `LEGAL`-tier rules.
- "Legacy Health", never "Protection Score" — it measures completeness, not safety.

---

## 2. Users

| Segment | Need | Wedge |
|---|---|---|
| Self-custodied holder, USD 50k–1m | "My family loses everything if I die tomorrow" | Free tier → Guardian |
| HNW / founder, USD 1m+ | Complex allocations, privacy, coordination with existing estate plan | Legacy / Private Wealth |
| Family office | Multi-principal, governance, reporting | Private Wealth / Institutional |
| Non-technical beneficiary | "I've been left crypto and have no idea what to do" | Beneficiary portal — the emotional core |
| Exchange / wallet / bank | Deceased-customer handling at scale | Institutional API |

The **beneficiary** is the second user, and the product is judged on their worst day. Most
competitors treat them as an afterthought; here they get a first-class, crypto-free experience.

---

## 3. The five surfaces

1. **Marketing site** — the argument for the category.
2. **Owner app** — build and maintain the plan.
3. **Beneficiary portal** — claim and receive, with zero crypto knowledge assumed.
4. **Admin control tower** — verification, fraud, coverage. Deliberately *lacks* any ability to
   alter a plan or move funds.
5. **Institutional API** — succession as a service.

---

## 4. Owner journey

### 4.1 Onboarding (cinematic, six screens, ~4 minutes)

Value before friction. **No KYC before the user sees their plan.** Identity verification is
requested at the point it becomes meaningful (when the plan needs to be legally durable), not at
signup — otherwise the drop-off destroys the funnel.

| Screen | Prompt |
|---|---|
| 1 | *Let's protect what you've built.* |
| 2 | *Who should inherit your wealth?* → beneficiaries + allocations |
| 3 | *What should be protected?* → assets (address paste or manual declaration) |
| 4 | *How should it be distributed?* → rules, each showing its enforcement tier |
| 5 | *How should we know when the time comes?* → verification, cooling-off, trusted contact |
| 6 | *Your legacy is ready.* → Legacy Health with the specific next actions |

Screen 5 is where the product differentiates: the user chooses their own cooling-off period and
their own inactivity threshold. Making the safety mechanism *user-configured* is what converts it
from a scary company power into a personal setting.

### 4.2 Dashboard

- **Hero**: estimated protected wealth, with an explicit `as of` timestamp and an *indicative*
  label. Never used in any control decision.
- **Succession status**: one of five plain-language states.
- **Legacy Health**: score with the *specific missing items*, each one click from being fixed.
- **Proof of life**: when the Bitcoin backstop unlocks, and a one-click re-anchor.
- **Beneficiaries**: allocation ring, verification state per person.
- **Timeline**: the immutable audit trail, in human language.

### 4.3 Succession rules

Every rule shows its **enforcement tier** badge (DECISIONS §3) — `CRYPTOGRAPHIC`, `ASSISTED` or
`LEGAL`. This is non-negotiable and is the honesty mechanism of the entire product.

| Rule | Tier | Notes |
|---|---|---|
| Immediate distribution | `CRYPTOGRAPHIC` | Script/contract enforced |
| Percentage split | `CRYPTOGRAPHIC` | Deterministic, dust-safe |
| Delayed access (timelock) | `CRYPTOGRAPHIC` | `older()` on Bitcoin |
| Conditional on beneficiary KYC | `ASSISTED` | Needs a live counterparty |
| Dispute window | `ASSISTED` | Degrades to timelock if platform is gone |
| Age-based tranches | `LEGAL` | Executor-enforced. Cannot be scripted for BTC. |
| Monthly schedule | `LEGAL` | Same. Requires custody to automate — refused. |
| Trust-directed | `LEGAL` | Integration point for a trustee |

### 4.4 Simulator — *"What happens if I die?"*

The most persuasive screen in the product. Steps the user through detection → verification →
cooling-off → notification → beneficiary verification → execution → distribution, with **real
numbers computed by the actual production engine**, not a mock:

> Christine receives 0.92 BTC · Arabella receives 0.46 BTC · Ava receives 0.46 BTC

It also honestly shows what *doesn't* happen automatically, and how long each stage takes. A
simulator that only shows the happy path is marketing; one that shows the gaps is a product.

### 4.5 Digital Family Vault

Encrypted documents, plus **"What I Want My Family To Know"** — video, audio or written messages
released under the same conditions as the assets. This is what turns financial infrastructure into
something a family actually values, and it is the highest-retention feature in the product because
it is the one users revisit for non-financial reasons.

Encryption model in DECISIONS §1 (C7): per-vault DEK, threshold-split, platform holds one
non-sufficient share.

---

## 5. Beneficiary experience

Assume: no crypto knowledge, grieving, possibly hostile family dynamics, possibly an attacker.

> *Alex has left you a digital legacy.*
> Your inheritance: **0.92 BTC** · indicative value USD 106,000 · **Status: pending verification**

Guided path: verify identity → understand what has been left → set up somewhere to receive it →
confirm → receive. Plain language throughout; the words "private key", "multisig", "UTXO" and
"gas" appear nowhere. Co-beneficiaries are always shown, because peer transparency is a fraud
control (THREAT-MODEL T7).

---

## 6. Admin control tower

Platform metrics, death-event queue with confidence and evidence breakdown, fraud monitoring, and
the global verification coverage map.

**Deliberately absent:** any control that alters a plan, changes allocations, declares a death, or
moves funds. Admins record *evidence*; the engine computes. Two distinct approvers are required to
reach `EXECUTABLE`. There is also no "users by portfolio value" view — that is a targeting list
(THREAT-MODEL T11), and its absence is a design decision, not an oversight.

---

## 7. Legacy Health Score

0–100 across 11 weighted components. Framed as *what's missing*, never as a safety guarantee.

| Component | Weight |
|---|---|
| Beneficiaries defined & allocation sums to 100% | 12 |
| Beneficiary contact verified | 8 |
| Asset ownership **proven** (not just declared) | 12 |
| Succession rules defined | 10 |
| Cryptographic enforcement in place | 12 |
| **Continuity Pack exported** (mandatory gate) | 12 |
| Death-verification coverage for country of residence | 8 |
| Account security (passkey, MFA, devices) | 8 |
| Recent proof of life / re-anchor | 6 |
| Estate documents & executor letter | 7 |
| Identity verified | 5 |

**Gate:** the score is capped below "green" until the Continuity Pack is exported. A user cannot
be told they are protected while their plan depends on the company existing.

---

## 8. Pricing

Tiers are data (`@legacy/core/pricing`), not hard-coded — prices change without a code change.
Benchmarks: Casa ~USD 250/yr standard and ~USD 2,100/yr premium; Unchained ~USD 250/yr vault.

| Tier | Price (indicative) | Includes |
|---|---|---|
| **Free** | 0 | 1 plan, 3 beneficiaries, declared assets, manual verification, Continuity Pack |
| **Guardian** | ~USD 49/yr | Ownership proofs, cryptographic rules, vault (5 GB), multi-channel monitoring |
| **Legacy** | ~USD 199/yr | Multi-asset, advanced rules, legacy messages, priority verification, trusted contacts |
| **Private Wealth** | USD 1,000–5,000/yr | Family accounts, dedicated verification, attorney coordination, bespoke policy design |
| **Institutional** | Custom | API, SLA, white-label, bulk attestation for consented subjects |

Note: the **Continuity Pack is in the free tier deliberately**. Charging for the mechanism that
protects users from the company's failure would be indefensible.

Revenue lines: subscriptions → institutional API → verification-as-a-service → legal-network
referrals (disclosed, never advice).

---

## 9. Design direction

Private banking, not crypto. Reference points: Bloomberg's density, Linear's precision, Stripe's
clarity, a private bank's restraint.

- **Palette**: near-black grounds (`#07090C`), warm off-white type, a single restrained brass
  accent (`#C8A96A`). Semantic colour is reserved for state — never decoration.
- **Type**: a serif display face for editorial weight, a neutral sans for UI, tabular numerals
  everywhere financial. Large, confident headings; generous whitespace.
- **Motion**: subtle, purposeful, respects `prefers-reduced-motion`.
- **Data viz**: hand-built SVG — allocation rings, timelines, the coverage map. No chart-library
  defaults.
- **Banned**: neon, gradient meshes, glassmorphism as decoration, "web3" iconography, animated
  price tickers, anything that reads as a trading app.

The test: *would someone protecting R100 million believe this team is careful?*

---

## 10. Demo world

`SIMULATE DEATH` drives the real engines end-to-end — confidence scoring, fraud checks, state
machine, distribution maths — against seeded data (Alex Winterburn: 1.84 BTC, 24.6 ETH,
USD 420,000 USDC; Christine 50%, Arabella 25%, Ava 25%). Nothing is scripted; the numbers on
screen are computed. Reset returns the world to its initial state.

No real funds. No mainnet. No key material anywhere in the repository.

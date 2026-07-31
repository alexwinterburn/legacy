# MARKET.md — Market, Competition and Strategy

> **Sourcing rule applied throughout:** figures are either (a) cited to a named source, or
> (b) labelled `[ASSUMPTION]` with the derivation shown. Nothing is asserted as a statistic
> without one of those two. Where sources disagree, the disagreement is shown rather than
> averaged away.

---

## 1. The problem, quantified

### 1.1 Lost crypto

Estimates of permanently lost Bitcoin vary widely by methodology:

- Chainalysis' widely-cited analysis puts likely-lost BTC in a range around **17–23% of supply**
  (~2.78m–3.79m BTC) on a broad definition, and around **1.8m BTC (~8.5%)** on a stricter
  five-year-dormancy definition.
- Other published estimates cluster around **11–18%** (~2.3m–4m BTC).

**What this actually tells us:** somewhere between 1.8m and 3.8m BTC is gone, and *nobody knows
the split between key loss, death, and abandonment.* Anyone claiming a precise "X BTC lost to
death" number is fabricating it. What is defensible: death is a structural and **growing**
contributor, because the holder base is ageing and early holders concentrated large balances.

### 1.2 Holder base

- Crypto.com's Market Sizing report: global owners rose from **659m (2024) to 741m (2025)**,
  +12.4%, with a projection of 800–900m in 2026.
- Triple-A publishes materially lower figures (~420–560m depending on vintage and method).

Methodologies differ substantially (exchange accounts vs. survey vs. on-chain heuristics), and
exchange-account-based figures overcount through duplicate accounts. **This model uses the lower
Triple-A-style bound for conservatism.**

### 1.3 The structural claim (the part that doesn't need a statistic)

Three facts require no market research:

1. Self-custodied crypto has **no beneficiary designation mechanism**. A bank account, a pension
   and a life policy all have one. A hardware wallet has none.
2. Access is **all-or-nothing and irreversible**. There is no customer-service recovery path.
3. Heirs frequently **do not know the assets exist**, and cannot discover them — there is no
   statement in the post, no institution to write to.

That combination is unique to this asset class, and it is the entire reason for the product.

---

## 2. TAM / SAM / SOM

Built bottom-up from subscription revenue. Every input is labelled.

**Inputs**
| Input | Value | Basis |
|---|---|---|
| Global crypto owners | 500m | Conservative, from the Triple-A end of the range |
| Share holding >USD 25k (worth protecting) | 4% → 20m | `[ASSUMPTION]` — crypto wealth is heavily power-law distributed; most owners hold small balances |
| Share self-custodied (not exchange-only) | 35% → 7m | `[ASSUMPTION]` — the addressable problem only exists for self-custody |
| Share in serviceable jurisdictions (yr 1–3: ZA, UK, US, EU, AU, CA, SG, AE) | 60% → 4.2m | `[ASSUMPTION]` |
| Blended ARPU | USD 120/yr | Midpoint of the Guardian/Legacy tiers; benchmarks: Casa Standard ~USD 250/yr, Casa Premium ~USD 2,100/yr, Unchained vault ~USD 250/yr |

**Results**
| Measure | Definition | Value |
|---|---|---|
| **TAM** | 20m qualifying holders × USD 120 | **≈ USD 2.4bn/yr** |
| **SAM** | 4.2m serviceable × USD 120 | **≈ USD 500m/yr** |
| **SOM (yr 5)** | 1.5% of SAM `[ASSUMPTION]` | **≈ USD 7.5m/yr** (~63k paying subscribers) |

**Health warning.** TAM here is an order-of-magnitude sanity check, not a forecast. The
`[ASSUMPTION]` rows compound; a factor-of-two error in each of three assumptions is an
eight-fold error in the result. The number that matters for the business is SOM, and the number
that matters for fundraising is whether the *institutional* line (below) exists.

**The institutional line is probably the larger business.** Per-user subscription revenue is
capped by consumer willingness to pay for a low-salience, negative-emotion product. Selling
succession infrastructure to exchanges, banks and wealth managers who have millions of customers
with the same problem — and a regulatory duty to handle deceased-customer accounts — is a larger
and stickier market. It is also the harder sell, and it requires the consumer product to exist
first as proof.

---

## 3. Competitive landscape

| | Casa | Unchained | Nunchuk | AnchorWatch | Bitkey | **This platform** |
|---|---|---|---|---|---|---|
| Core product | Collaborative-custody multisig | Multisig + financial services | Self-custody wallet, miniscript | Insured custody (Lloyd's-backed) | Consumer BTC wallet | Succession infrastructure |
| Inheritance | Included across plans | Trust vault + estate docs | Timelocked miniscript plans | Timelock key combinations | Provider-mediated off-chain | Core product, not a feature |
| Custody model | Collaborative, holds a key | Collaborative, holds a key | Non-custodial, no key | Collaborative + insurance | Provider co-signs | `ATTESTOR_ONLY` at launch |
| Assets | BTC + some | BTC | BTC | BTC | BTC | **Multi-chain by design** |
| Death verification | Manual/process | Manual/process, legal-led | User-configured timelock | Timelock | Provider verifies claim | **Confidence engine + oracle** |
| Pricing (published) | ~USD 250/yr std; ~USD 2,100/yr premium | ~USD 250/yr vault; ~USD 1,200 concierge onboarding | Free / paid tiers | Insurance-priced | Free/low | Tiered, see PRODUCT |
| Geography | US-centric | US-only in practice | Global | US | US-centric | **Global-first, ZA launch** |

### 3.1 Where the whitespace actually is

Four gaps, in descending order of defensibility:

1. **Death verification as infrastructure.** Every incumbent handles death as a *manual support
   process*. None has built a verification network, a confidence model, or a signed-attestation
   layer that anyone else could consume. This is the only piece here that compounds.
2. **Non-US, non-Bitcoin-maximalist geography.** Casa/Unchained/AnchorWatch/Bitkey are all
   effectively US products with US legal integration. Emerging markets, Africa, the Middle East and
   Asia are unserved — and estate friction there is *worse*, not better.
3. **Multi-asset.** Incumbents are Bitcoin-only by conviction. Real HNW portfolios hold BTC, ETH,
   stablecoins, exchange balances and tokenised assets. Nobody covers the portfolio.
4. **The beneficiary experience.** Every incumbent optimises for the technically sophisticated
   holder. Nobody has built for the 60-year-old widow who has never seen a seed phrase — which is
   the person who actually has to use the product on the worst day of their life.

### 3.2 Honest assessment of the competition

Casa and Unchained are **good products run by competent teams with real regulatory footing and
years of operational history in exactly this domain**. Nunchuk's miniscript work is technically
ahead of most of the market. AnchorWatch's insurance angle may prove to be the strongest wedge of
all, because insurance is what institutions actually buy.

The realistic strategy is **not** to out-Bitcoin them. It is to be the layer that sits *underneath*
inheritance across many custody models — including theirs — and to own the verification network.
"Build the category leader, not another competitor" only works if the category is different, and
the only genuinely different category on the table is **verification infrastructure**.

---

## 4. Strategy

**Why now?**
Three things converged: the first large cohort of crypto holders is entering the age range where
estate planning becomes salient; regulatory frameworks (MiCA, FSCA/FAIS, UK) now make a compliant
non-custodial product describable; and Taproot + miniscript made expressive Bitcoin succession
policies practical rather than theoretical.

**Why crypto first?**
It is the only asset class with no existing beneficiary mechanism and irreversible loss. The pain
is acute, the alternative is nothing, and the cryptographic tools exist. Bank accounts and
brokerages already have transfer-on-death mechanisms and incumbent processes.

**Why South Africa?**
High crypto adoption relative to GDP; an established regulatory framework (FAIS/CASP) so the
licensing position is *knowable* rather than speculative; a jurisdiction the founding team can
navigate; a market too small for US incumbents to prioritise; and — critically — a market where
proving the model in a hard, manual-verification environment produces a system that generalises to
the rest of the world. Building for a country *without* a death API forces the right architecture.

**Why won't exchanges just build it?**
Some will, badly, for their own custodied balances only. They cannot solve it for self-custodied
assets, which is where the problem lives. And an exchange building it for itself has no reason to
build the cross-institution verification layer — which is exactly why they become **customers** of
the attestation API rather than competitors to it.

**Why won't Casa/Unchained dominate?**
They may dominate US Bitcoin collaborative custody — that is likely, and not worth contesting.
Their model is per-customer service delivery, which does not scale into a network, and their
geographic and asset scope is deliberately narrow.

### 4.1 The moat, ranked by durability

1. **The verification network** — country-by-country provider relationships, licensed data
   feeds, notary/attorney networks, and accumulated per-provider accuracy data. Slow to build,
   slow to copy, improves with scale. **This is the real moat.**
2. **Attestation as a standard.** If exchanges and wallets consume the attestation format, it
   becomes infrastructure. Network effects accrue to the format, not the app.
3. **Fraud model.** Requires volume of real claims to train. Genuinely proprietary over time.
4. **Regulatory footprint.** Licences, certifications (LADMF, DDRI) and counsel opinions per
   jurisdiction are expensive, slow, and a genuine barrier.
5. **Brand trust.** Necessary, but the weakest moat — trust transfers slowly and shatters quickly.

**What is explicitly *not* a moat:** the smart contracts (should be open-source), the UI (copyable
in a quarter), and the multisig scheme (standard, and should be).

# REGULATORY.md

> **This is an engineering-oriented survey, not legal advice.** It records the regulatory
> assumptions the architecture depends on so that counsel can confirm or refute each one. Every
> item marked ⚠️ is a launch-blocking question for a qualified lawyer in that jurisdiction.

---

## 1. The core regulatory strategy

**Minimise regulated activity by construction, not by argument.**

Four things, if avoided, remove most of the licensing perimeter:

| Avoid | Why it matters |
|---|---|
| Holding assets or *sufficient* key material | Triggers custody/CASP regimes almost everywhere |
| Exercising discretion over release | Turns software into intermediation/fiduciary activity |
| Advising on the merits of crypto assets | Triggers financial-advice licensing (notably FAIS in South Africa) |
| Acting as executor / administering estates | Separately regulated; often court-supervised |

The `ATTESTOR_ONLY` platform role (ARCHITECTURE §4) is chosen precisely because it avoids all four.
Moving to `COSIGNER` is a **regulatory decision, not a product decision**, and the code makes that
switch explicit and auditable rather than incidental.

---

## 2. What the platform actually does, in regulatory language

| Activity | Characterisation sought | Risk |
|---|---|---|
| Generating wallet descriptors/policies | Non-custodial wallet **software** | Low |
| Watching public chains for balances | Publicly available data processing | Low |
| Storing encrypted documents | Data processing / cloud storage | Medium (privacy law, not financial) |
| Verifying identity (KYC) | Data processing; may be a regulated obligation if licensed | Medium |
| Collecting death evidence and publishing signed attestations | **Information service** — novel, unclassified | ⚠️ Medium–High: no clean precedent |
| Holding one of three keys (`COSIGNER`) | Arguably non-custodial; contested | ⚠️ High |
| Subscription billing | Ordinary commerce | Low |
| Institutional API to exchanges | B2B software; may make the platform a service provider to a regulated entity | Medium (outsourcing/vendor rules) |

**The genuinely novel regulatory question is the attestation service.** Producing a signed
statement that a person has died, which third parties rely on to transfer wealth, does not map
cleanly onto any existing licence category. It sits somewhere near a credit reference agency, a
notary, and a trust service provider. In the EU, **eIDAS** trust-service rules are worth examining
seriously — a qualified electronic timestamp/seal may be both achievable and a genuine moat.
⚠️ Counsel needed in every launch jurisdiction.

---

## 3. Death data — what is actually obtainable

Research-backed; this is the constraint that most shapes the roadmap.

| Jurisdiction | Source | Reality |
|---|---|---|
| 🇿🇦 South Africa | DHA National Population Register | Not a general commercial death API. Access is intermediated and identity-oriented. **Manual + certificate verification for MVP.** |
| 🇺🇸 United States | SSA **Limited Access DMF** via NTIS | Real but restricted: certification required, ~USD 2,930/yr subscriber fee, independent ACAB security assessment, triennial attestation, under §203 Bipartisan Budget Act 2013. **Batch file, not an API.** Excludes recent deaths for uncertified users. State records vary. |
| 🇬🇧 United Kingdom | GRO **DDRI** | Very few approved organisations. Security assessment + non-refundable assessment fee + annual licence fee in the tens of thousands of pounds. **Weekly file, ~7-day lag.** Onward bulk disclosure prohibited. |
| 🇬🇧 United Kingdom | Death Notification Service (Equiniti/UK Finance) | A *notification* channel to banks, not a verification source the platform can query. |
| 🇦🇺 Australia | State/Territory registries | No national feed. Certificate validation services in some states. |
| 🇨🇦 Canada | Provincial vital statistics | Per-province; no national feed. |
| 🇪🇺 EU | Per-member-state civil registration | Highly fragmented. |
| 🌍 Rest of world | Varies; often paper-based | Manual verification is the only realistic path. |

**Consequences, all reflected in the code:**
1. Level 5 (registry confirmation) is **not** available at MVP in any jurisdiction. It is typed,
   capability-flagged, and set to `false` for every shipped provider.
2. Even when licensed, feeds are **days-to-weeks lagging batch files** — so the cooling-off period
   is not merely a safety feature, it is also what absorbs data latency.
3. The DDRI restriction on onward bulk disclosure means the platform **cannot** resell death data
   through the institutional API. The institutional product must sell *attestations about a
   specific consented subject*, never bulk data. This is a hard architectural constraint.
4. Manual verification (executor, notary, attorney, certified certificate) is the **primary**
   mechanism, not the fallback. The product is designed accordingly.

---

## 4. Jurisdiction notes

### 🇿🇦 South Africa (likely launch market)
- Crypto assets were declared a **financial product under FAIS** (October 2022); CASP licensing
  opened 1 June 2023, with an application deadline of 30 November 2023 for existing providers. As
  at 31 March 2026 the FSCA reported 533 CASP applications, 310 approved, 17 declined, 124 withdrawn.
- ⚠️ **Key question:** does producing succession software plus death attestations constitute
  *advice* or *intermediary services* in respect of a financial product? Providing a technical
  mechanism, without recommending assets or arranging transactions, is the position sought — but
  "intermediary service" is broadly drafted and this needs a written opinion.
- **Estate administration** is supervised by the Master of the High Court. The platform must not
  act as executor. Crypto assets form part of the deceased estate and must be reported to the
  Master; a technical transfer that bypasses the estate can create personal liability for the
  recipient and the executor.
- **Exchange control** still applies to cross-border value transfer; a foreign beneficiary
  receiving South African-sourced value is a real issue. ⚠️
- **Estate duty** applies to worldwide assets of SA-resident deceased. The platform must not
  compute or advise on this.
- **POPIA** applies to all personal information, including that of beneficiaries — who are data
  subjects who have not consented and may not know they are in the system. ⚠️ Significant: see §6.
- **FICA/AML** obligations attach if licensed as an accountable institution.

### 🇺🇸 United States
- Fragmented: state money-transmitter regimes, FinCEN MSB rules, SEC/CFTC for asset classification.
- Non-custodial software has generally been treated as outside MSB money-transmission where the
  provider never takes control of funds — but this is guidance-and-litigation-shaped, not settled,
  and has been actively contested. ⚠️
- **Estate/probate law is state-by-state.** RUFADAA (adopted in most states) governs fiduciary
  access to digital assets and is directly relevant: it can *empower* an executor to access
  accounts, and a platform "terms of service override" may not survive it. Design should assume the
  executor has a statutory right of access.
- LADMF certification (see §3) is a concrete, purchasable compliance step with a known cost.

### 🇬🇧 United Kingdom
- FCA registration for cryptoasset businesses is AML-driven and centres on custody/exchange.
  Non-custodial software is generally outside it. ⚠️ Confirm against the current perimeter, which
  has been actively expanding.
- Financial promotions rules are **strict** and apply to crypto marketing. The landing page copy
  must be reviewed before it is published to a UK audience. Any "protect your wealth" framing
  risks being read as a promotion of a qualifying cryptoasset. ⚠️
- Probate is court-based; the platform must not present itself as an alternative to probate.

### 🇪🇺 European Union
- **MiCA**: Recital 83 explicitly places providers of non-custodial hardware/software wallets
  outside the custodian definition — the strongest available support for the architecture. That
  protection depends entirely on never controlling keys sufficient to move assets.
- **GDPR**: Art. 9 special-category data likely engaged (death, health context, identity documents).
  Data of deceased persons is out of GDPR scope at EU level but re-enters via member-state law.
  Beneficiary data is in scope, fully. DPIA mandatory.
- **eIDAS**: potential *positive* framework for the attestation service — qualified timestamps and
  seals could give attestations cross-border legal effect. Worth pursuing as a moat.

### 🇦🇪 UAE / 🇸🇬 Singapore / 🇦🇺 Australia
- UAE: VARA (Dubai) and ADGM regimes; both have workable non-custodial carve-outs but require
  local presence. Sharia forced-heirship rules interact badly with free-choice beneficiary
  designation — ⚠️ a genuine product problem, not just a legal one, and a reason not to launch
  there early.
- Singapore: MAS PSA licensing is custody/transfer-triggered. Non-custodial software generally
  outside.
- Australia: reform of the digital-asset platform regime is ongoing; state-level probate.

---

## 5. Smart-contract enforceability

A contract that pays out on an attestation is **not** self-evidently a valid testamentary
disposition. In most jurisdictions a valid will requires prescribed formalities (writing,
signature, witnesses). A smart contract will generally satisfy none of these.

Therefore:
- The platform is positioned as a **mechanism of access and transfer**, not as a testamentary
  instrument.
- Users are directed to execute a conventional will that **references** the plan, and the product
  generates an **Executor Letter** designed to be attached to it.
- Where the technical outcome and the will conflict, the will governs, and the recipient may hold
  the assets on constructive trust for the estate. The UI states this plainly.
- **Forced heirship** (civil-law jurisdictions, Sharia jurisdictions) can override the user's
  chosen allocations entirely. Detected by country and surfaced as a warning at plan creation.

---

## 6. Beneficiary data — an underappreciated problem

Beneficiaries are data subjects who **have not signed up**, may not know they are listed, and have
rights (access, erasure, objection) under GDPR/POPIA/CCPA. Meanwhile the owner has a strong
interest in them *not* knowing.

Resolved by: collecting the minimum (name, one contact channel, allocation) until a claim; holding
richer identity data only after the beneficiary is engaged and has been given a privacy notice;
running a lawful-basis analysis of legitimate interests; and an explicit retention policy. ⚠️ A
beneficiary exercising an erasure right against a live succession plan is an unresolved conflict
that needs a documented position before launch.

---

## 7. Compliance obligations that apply regardless of licensing

Privacy (POPIA/GDPR/CCPA) applies whether or not the platform is financially licensed:
data minimisation, encryption, DPIA, breach notification, cross-border transfer mechanisms,
regional data residency, retention limits, and processor agreements for every vendor.

Marketing constraints apply regardless too: no insurance language ("protected", "guaranteed",
"insured") without an insurance permission; no advice; no performance or safety guarantees.

---

## 8. Launch gates

Nothing ships to real users until:

1. ⚠️ Written counsel opinion in the launch jurisdiction on licensing status.
2. ⚠️ Documented position on whether the platform holds any key at launch (recommend: no).
3. ⚠️ Terms of service reviewed for the "not a will / not advice / not insurance" disclaimers.
4. ⚠️ DPIA completed; beneficiary lawful basis documented.
5. ⚠️ Smart contract audited; testnet-only until then.
6. ⚠️ Wind-down plan documented, including the fate of the platform key.
7. ⚠️ Marketing copy reviewed against financial-promotions rules per market.

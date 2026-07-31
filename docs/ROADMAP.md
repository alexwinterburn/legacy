# ROADMAP.md

Sequencing principle: **build the trust-minimisation guarantees before the growth features.**
Anything that increases assets under plan before the guarantees are real increases the size of the
eventual failure.

---

## Phase 0 — Foundations (this repository)

Delivered here:
- Full document set: product, architecture, security, threat model, regulatory, API, database
- Domain engines with tests: succession, death confidence, oracle, fraud, health, adapters
- Bitcoin miniscript policy → descriptor construction, with proof-of-life timelock maths
- Reference EVM contract (**testnet only, unaudited, not deployed**)
- Complete demonstration environment with the SIMULATE DEATH walkthrough
- Marketing site, owner app, beneficiary portal, admin control tower

Explicitly **not** delivered: persistence, real KYC, real registry feeds, HSM integration,
on-chain broadcast, passkey ceremony. All are typed and mocked, none are faked.

---

## Phase 1 — MVP (Bitcoin, one jurisdiction)

**Goal:** a real user can create a plan whose Bitcoin path works with the company gone.

- ⚠️ **Gate: counsel opinion on licensing in the launch jurisdiction** (REGULATORY §8)
- ⚠️ **Gate: decide the platform key posture — recommend `ATTESTOR_ONLY`, i.e. no key**
- Passkey/WebAuthn auth, device management, step-up flows
- PostgreSQL + hash-chained audit log
- Bitcoin: descriptor generation, hardware wallet compatibility matrix, BIP-322 ownership proof,
  proof-of-life re-anchor flow, testnet end-to-end
- Manual death verification: certificate upload, executor/notary attestation, review workflow
- Cooling-off, dispute, proof-of-life — the full state machine in production
- **Continuity Pack export** — a launch requirement, not a later feature
- Beneficiary portal
- Admin tower with two-person approval
- Subscriptions

**Exit criteria:** a continuity drill passes — an external party executes a test plan end-to-end
on testnet with all platform systems switched off.

---

## Phase 2 — Multi-asset and automation

- ⚠️ **Gate: independent smart-contract audit before any mainnet contract**
- Ethereum, ERC-20 (USDC/USDT), `LegacyVault` to mainnet post-audit
- Death Confidence Engine in production with real evidence sources
- Legacy Oracle: HSM-backed keys, quorum signing, public transparency log, published verifier
- Digital Family Vault + legacy messages (threshold-encrypted)
- Fraud engine on live data
- Trusted contacts; inactivity monitoring
- Second jurisdiction

**Exit criteria:** an attestation verifies offline, by a third party, using only published material.

---

## Phase 3 — Global coverage

- ⚠️ **Gate: LADMF certification (US) / DDRI licence assessment (UK)** — long lead times, start early
- Country providers: ZA, UK, US, AU, CA, EU member states
- Notary/attorney verification network — the human layer that covers the ~90% of the world with no
  data feed
- Solana; exchange-balance integrations
- Family accounts, multi-principal governance
- Legal partner network (referrals, disclosed, never advice)
- Institutional API beta

**Exit criteria:** ≥2 genuinely independent attestors, so Level 6 becomes reachable.

---

## Phase 4 — The Oracle as infrastructure

- Attestation format published as an open specification
- Independent attestor network (law firms, notaries, insurers, possibly competing providers)
- ⚠️ eIDAS qualified trust-service assessment for EU legal effect
- Exchange, wallet and bank integrations consuming attestations
- Per-provider accuracy telemetry feeding automatic source weighting

This is the phase where the business stops being an app and becomes infrastructure. It is also
where the moat (MARKET §4.1) actually forms — everything before it is table stakes.

---

## Phase 5 — Broader digital wealth

Tokenised securities, brokerage, insurance policies, business interests, domains, IP, NFTs. Each
new asset class is an `AssetAdapter` plus a legal-tier mapping — the core engine does not change.

---

## Sequencing risks

| Risk | Mitigation |
|---|---|
| Registry certifications (LADMF, DDRI) have long lead times and high fixed costs | Start applications in Phase 2; do not sequence the product behind them — manual verification is the primary path regardless |
| Contract audit is a hard gate before mainnet | Testnet-only until cleared; no exceptions, no "soft launch" |
| Finding a genuinely independent second attestor is a business-development problem, not an engineering one | Start in Phase 1; Level 6 is unreachable without it |
| Growth before the Continuity Pack is real | It ships in Phase 1 and gates the health score |
| Multi-jurisdiction complexity outrunning legal capacity | One jurisdiction fully correct before the second |

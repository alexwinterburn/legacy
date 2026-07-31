# THREAT-MODEL.md

Method: STRIDE-informed, but organised by **adversary goal**, because in an inheritance system
almost every attack reduces to one of three goals: *move the assets early*, *redirect the assets*,
or *prevent the assets moving at all*.

Assets under protection, in priority order:
1. **User funds** (irreversible loss)
2. **The integrity of the death determination** (the mechanism that moves funds)
3. **Identity + estate documents** (irreversible privacy loss, blackmail exposure)
4. **Plan metadata** (who inherits what — a targeting list for physical coercion)

Note on (4): a leaked beneficiary list with allocations and net worth is a **kidnap-and-ransom
target list**. This is not hypothetical for HNW crypto holders. It is treated as a
confidentiality asset of the same tier as identity documents.

---

## T1 — Attacker falsely reports the user's death

**Most likely attack. The entire system is a machine for converting death claims into transfers.**

| Vector | Control |
|---|---|
| Forged death certificate | Document authenticity check + certificate is `CIVIL_REGISTRY` class, insufficient alone for the threshold |
| Claim from a "family member" | Claimant identity verification; claimant must be a *pre-registered* beneficiary or a verified executor; unregistered claimants can only open a low-confidence investigation |
| Repeated claims to wear down review | Rate-limited per subject; repeat claims from the same claimant *raise* the fraud score rather than the confidence |
| Claim timed with the user travelling/offline | Mandatory cooling-off (≥30d), multi-channel notification, and the timelock never shortens |

**Primary control: the user's veto is dispositive and cheap.** One authenticated action resets
everything. Secondary: mandatory delay. Tertiary: multi-source independence.

**Residual risk:** a user who is genuinely incommunicado (hospitalised, imprisoned, remote travel)
for longer than the cooling-off period, whose attacker has also compromised their notification
channels. Mitigation: the "trusted contact" role — a non-beneficiary who is notified of every
claim and can extend the cooling-off period but can never accelerate it. Asymmetric by design.

---

## T2 — Account takeover

| Vector | Control |
|---|---|
| Password/credential stuffing | Passkeys primary; passwords never sufficient alone |
| SIM swap → SMS OTP | SMS is a *notification* channel only, never an authentication factor for sensitive ops |
| Session theft | Short sessions, device binding, re-auth for sensitive operations |
| Email compromise → reset | Account recovery cannot alter beneficiaries or the plan; recovery restores *read* access, and plan changes require step-up + the change-delay below |

**Key control — the beneficiary change delay.** Any change to beneficiaries, allocations,
payout addresses or cooling-off duration enters a **72-hour pending state**, is notified to all
existing channels *and* to the trusted contact, and is reversible by the user during the window.
An attacker who owns the account for an hour cannot redirect the estate.

---

## T3 — Attacker changes the beneficiary, then reports death

The scenario named in the brief. Treated as the signature fraud pattern.

Controls, layered:
1. Change delay (T2) — the change is not even effective for 72h.
2. `RECENT_BENEFICIARY_CHANGE` fraud rule — a death claim within N days of a beneficiary or
   address change produces a large, time-decayed score contribution.
3. Score above threshold → `FRAUD_HOLD`, cooling-off **extended**, manual review mandatory,
   and the *previous* beneficiary set is notified.
4. New payout addresses added within the fraud window require independent verification of the
   beneficiary before any distribution.

Implemented and unit-tested in `@legacy/fraud`.

---

## T4 — Malicious or compromised administrator

| Control | Enforcement |
|---|---|
| No admin can change allocations | Not exposed in any admin API — write path does not exist |
| No admin can declare a death | Admins record *evidence*; the engine computes confidence |
| Two-person rule to reach `EXECUTABLE` | State machine rejects single-approver transitions |
| Admin actions are user-visible | Every admin touch appears in the user's Legacy Timeline |
| Least privilege | Roles: `SUPPORT` (read), `VERIFIER` (evidence), `RISK` (holds), `OPERATOR` (approve #2). No superuser role exists. |

**Residual:** collusion of two admins with distinct roles. Mitigated only by the fact that they
*still* cannot move funds — they can at best reach `EXECUTABLE`, which then requires the heir's own
key and survives a cooling-off period the user can veto. This is the payoff for principle 1.

---

## T5 — Oracle compromise

The attestation signing key is the crown jewel.

- Keys in HSM/KMS, non-exportable, per-environment separation.
- **Quorum ≥2 signers in distinct independence classes** — a single key is insufficient.
- **Transparency log**: every attestation is hash-chained and the head is published. A forged
  attestation is detectable by anyone; the user is notified on publication.
- **Publish-then-act delay**: an attestation is not actionable until it has been publicly visible
  long enough for the user to veto.
- Attestations are narrowly scoped: subject, level, sources, validity window, plan id, chain id,
  nonce. They cannot be replayed to another plan or chain.
- Key rotation with an on-chain/publish-time key registry and explicit revocation.

---

## T6 — Government data error (false positive in an official registry)

Real and documented in every jurisdiction that publishes error rates. Controls:
- Registry evidence alone is `CIVIL_REGISTRY` class and cannot reach the highest threshold alone.
- The full cooling-off period applies to registry-sourced claims exactly as to any other.
- `PROOF_OF_LIFE` overrides registry data. **An authenticated living user beats a database.**
- Provider-level error-rate tracking; providers with degraded accuracy are automatically
  down-weighted rather than disabled.

---

## T7 — Beneficiary fraud after a genuine death

The user is dead and cannot veto. This is the hardest case, since the strongest control is gone.

- Beneficiary identity verification at claim time, matched against the identity data recorded at
  *plan creation* time — not against whatever the claimant now asserts.
- Payout addresses fixed at plan time; a change at claim time requires the full change delay,
  independent verification, **and** notification to co-beneficiaries.
- Co-beneficiary notification is mandatory: every beneficiary is told what every other beneficiary
  is receiving. Peer transparency is the practical control here — siblings audit each other.
- Executor/attorney counter-signature required for `LEGAL`-tier rules.
- Distribution outputs go to previously-proven addresses (ownership-proven where the chain permits).

---

## T8 — Smart contract exploit

- Contract holds policy and allowances, not principal, in the default mode — caps the blast radius.
- No upgrade proxy (an upgrade key is a fund-theft key with extra steps).
- No admin pause on execution (a pause is a freeze capability; violates principle 1).
- Checks-effects-interactions; reentrancy guards; no `delegatecall`; pull-payment where feasible.
- EIP-712 with chainId + verifyingContract + planId + nonce → cross-chain and cross-plan replay safe.
- Required test corpus: unauthorised release, oracle replay, signature malleability, timelock
  bypass, reentrancy on distribution, veto-front-running, quorum spoofing with duplicate signers.
- **Not deployed. Unaudited. Testnet only.** Audit + formal verification are launch gates.

---

## T9 — Key loss (the user's own)

The most common real-world failure, and the one most inheritance products understate.

- Wallets built as k-of-n so a single lost key is survivable.
- Health score penalises **declared key co-location** — three keys in one drawer is a 1-of-1.
- The timelock backstop means an heir with one key recovers funds even if the owner's key is lost
  and the platform is gone.
- Explicitly refused: any scheme where the platform stores seed phrases or shards sufficient to
  reconstruct. Not implemented anywhere in this codebase, including demo mode.

---

## T10 — The company disappears

Design target: **zero impact on Bitcoin and EVM plans.**

- Timelock path needs no platform participation.
- Descriptors, contract addresses, public keys and the independent verifier are exported to the
  user in the **Continuity Pack**, which the health score *requires* before a plan reads green.
- The verifier is standalone and open-source.
- Recommended posture: on wind-down the platform key is **destroyed**, not escrowed — escrow
  recreates the trusted third party the product exists to remove.

---

## T11 — Coercion ("$5 wrench attack") and targeting

Underweighted in the brief; serious for this user segment.

- Plan metadata encrypted; staff cannot browse by net worth. No "top users by value" view exists
  in the admin product — deliberately omitted despite being an obvious dashboard feature.
- Duress signalling: a duress passkey/PIN that appears to succeed while silently placing the
  account in `FRAUD_HOLD` and notifying the trusted contact. Modelled; not implemented in this
  prototype (needs careful UX so it cannot be discovered by the coercer).
- Withdrawal/plan-change delays give a coerced user a post-event reversal window.
- Data minimisation: exact balances are not required — bands are sufficient for most product
  functions, and the schema supports storing bands rather than amounts.

---

## T12 — Regulatory / legal seizure

Out of scope for cryptography, in scope for architecture: if the platform *cannot* move funds, a
seizure order against the platform cannot move funds. This is a feature, and it is also a reason
the platform must not market itself as able to withhold assets from lawful process — it simply
isn't the party in possession. Orders are directed at the estate and the key holders.

---

## Prioritised control summary

| Rank | Control | Defends |
|---|---|---|
| 1 | User veto (`PROOF_OF_LIFE`), dispositive from any pre-completion state | T1, T3, T6 |
| 2 | Mandatory cooling-off, extendable but never shortenable | T1, T3, T4, T6 |
| 3 | Platform never sufficient (k-of-n, quorum) | T4, T5, T12 |
| 4 | Timelock backstop, no platform participation | T9, T10 |
| 5 | 72h change delay + multi-channel + trusted-contact notification | T2, T3 |
| 6 | Attestation transparency log + publish-then-act | T5, T4 |
| 7 | Source independence classes | T1, T6 |
| 8 | Fraud correlation engine | T3, T7 |
| 9 | Mandatory Continuity Pack export | T10, T9 |
| 10 | Data minimisation on plan metadata | T11 |

# API.md

API-first. The consumer app, the beneficiary portal and the admin tower all consume the same API
as institutional clients — no privileged internal backdoor exists.

Base: `/api/v1` · JSON · `Idempotency-Key` required on all writes · cursor pagination ·
RFC 7807 problem details for errors.

---

## 1. Auth

| Consumer | Mechanism |
|---|---|
| Web/mobile users | Session cookie from passkey/WebAuthn ceremony |
| Institutional | OAuth2 client credentials + mTLS; scoped API keys |
| Public verifier | None — attestation verification requires no API access at all |

Scopes: `user:read` `user:write` `assets:read` `assets:write` `beneficiaries:read`
`beneficiaries:write` `succession:read` `succession:write` `death:submit` `death:read`
`distribution:read` `distribution:execute` `admin:evidence` `admin:risk` `admin:approve`

**Sensitive operations require step-up auth** and reject session-only credentials:
beneficiary/allocation change, payout address change, cooling-off change, vault access,
Continuity Pack export, dispute, proof of life.

**Scopes that do not exist, by design:** `death:declare`, `plan:override`, `funds:release`,
`allocation:admin`. There is no API path by which the platform declares a death or moves assets.

---

## 2. Users

```
POST   /users                      Create account
GET    /users/me                   Profile + status
PATCH  /users/me                   Update profile
POST   /users/me/proof-of-life     ★ step-up — dispositive, resets confidence to L0
GET    /users/me/health            Legacy Health Score + remediation items
GET    /users/me/timeline          Legacy Timeline (audit projection)
POST   /users/me/continuity-pack   ★ step-up — generate + download the survival bundle
GET    /users/me/devices
DELETE /users/me/devices/{id}
```

`POST /users/me/proof-of-life` is the most important endpoint in the system. It is rate-limited
generously (not tightly — a living user must never be locked out of proving it), audited, and
notified on every channel.

---

## 3. Assets and wallets

```
POST   /wallets                       Register (chain, address | descriptor)
GET    /wallets                       List with verificationState
POST   /wallets/{id}/ownership-challenge   Issue BIP-322 / EIP-191 / ed25519 challenge
POST   /wallets/{id}/ownership-proof       Submit signature → PROVEN
GET    /wallets/{id}/balance               Observed on-chain balance (+ observedAt)
DELETE /wallets/{id}

POST   /assets                        Declare an off-chain / manual asset
GET    /assets
PATCH  /assets/{id}
```

Response for a wallet always carries `verificationState: DECLARED | OBSERVED | PROVEN`. Clients
must not render `PROVEN` language for the other two states.

---

## 4. Beneficiaries

```
POST   /beneficiaries          ★ step-up — enters 72h pending window
GET    /beneficiaries
PATCH  /beneficiaries/{id}     ★ step-up — creates a new version, 72h pending
DELETE /beneficiaries/{id}     ★ step-up — 72h pending
GET    /beneficiaries/{id}/versions      Full change history
POST   /beneficiaries/{id}/verify-contact
GET    /pending-changes        Everything in the 72h window
POST   /pending-changes/{id}/cancel      Revert during the window (no step-up — must be easy)
```

Cancelling a pending change deliberately requires **less** friction than making one. An attacker
should face resistance; a victim should not.

---

## 5. Succession

```
POST   /succession/plan              Create/replace (new version)
GET    /succession/plan
GET    /succession/plan/versions
POST   /succession/rules             Add a rule (enforcementTier required)
PATCH  /succession/rules/{id}
DELETE /succession/rules/{id}
POST   /succession/validate          Dry-run: allocation integrity, tier feasibility per asset
POST   /succession/simulate          Full simulation → the timeline + per-beneficiary amounts
GET    /succession/status
GET    /succession/policy/{chain}    Generated descriptor / contract policy for the plan
```

`POST /succession/simulate` is the engine behind the "What happens if I die?" screen and is a
pure function over the current plan — no side effects, no state written.

---

## 6. Death verification

```
POST   /death-events                       Submit a claim (claimant identity required)
GET    /death-events/{id}                  Status, confidence, cooling-off, evidence summary
POST   /death-events/{id}/evidence         ★ admin:evidence — record a source + result
POST   /death-events/{id}/dispute          ★ step-up — subject or trusted contact
POST   /death-events/{id}/extend-cooling   ★ admin:risk — extend only; shortening is not exposed
GET    /death-events/{id}/attestations     Signed attestations + log positions
GET    /death-events/{id}/confidence       Level, score, per-source contribution, independence
POST   /death-events/{id}/approve          ★ admin:approve — records ONE approval only
```

`extend-cooling` has no counterpart. There is no shorten endpoint, in any role (invariant I4).
`approve` records a single approval; the transition to `EXECUTABLE` happens only when two distinct
approvers have recorded, and all other predicates hold.

---

## 7. Oracle (public)

```
GET    /oracle/keys                    Current + historical public keys, with revocations
GET    /oracle/log/head                Transparency log head (hash, index, signature)
GET    /oracle/log?from={index}        Log entries for independent replay
POST   /oracle/verify                  Convenience verifier (offline verification also documented)
```

These endpoints are unauthenticated by design. Verification must be possible by anyone, forever,
including after the company ceases to exist — which is why the offline verifier is published
alongside the contracts rather than existing only as a hosted endpoint.

---

## 8. Distribution

```
GET    /distributions                       Computed plan (snapshot-based)
GET    /distributions/{id}
POST   /distributions/{id}/prepare          Build the unsigned artifact (PSBT / calldata)
POST   /distributions/{id}/submit-signature Collect signatures from authorised parties
GET    /distributions/{id}/status           On-chain monitoring
GET    /distributions/{id}/reconciliation   Executor reconciliation record
```

The platform prepares and monitors. It never holds the signatures required to complete a spend on
its own, and `prepare` returns an artifact that is useless without the beneficiary's key.

---

## 9. Beneficiary portal

```
POST   /claims/{token}/accept           Beneficiary accepts an invitation
GET    /claims/{token}                  What has been left, plain language
POST   /claims/{token}/identity         Begin identity verification
POST   /claims/{token}/destination      Nominate a receiving address (72h window applies)
GET    /claims/{token}/status           Where the claim is in the process
GET    /claims/{token}/co-beneficiaries Who else is receiving what (fraud control)
```

Token-scoped, so a beneficiary needs no platform account to begin.

---

## 10. Institutional

```
POST   /institutional/subjects                  Register a consented subject
GET    /institutional/subjects/{id}/status      Succession status for that subject
POST   /institutional/subjects/{id}/attestation Request an attestation
POST   /institutional/webhooks                  Subscribe to events
GET    /institutional/coverage                  Verification coverage by country
```

**Hard constraint (REGULATORY §3):** no bulk death-data endpoint exists and none will. Licensed
registry feeds prohibit onward bulk disclosure. The institutional product sells *attestations about
a specific, consented subject* — never a data feed.

---

## 11. Admin

```
GET    /admin/metrics
GET    /admin/death-events            Queue with confidence + fraud scores
GET    /admin/death-events/{id}
GET    /admin/fraud-alerts
POST   /admin/fraud-alerts/{id}/review   ★ admin:risk
GET    /admin/providers                  Country provider health + accuracy
GET    /admin/coverage                   Global map data
```

Read-heavy by construction. The only writes are: record evidence, review a fraud alert, extend
cooling-off, and record one approval. There is no admin write path to plans, allocations,
beneficiaries or funds (invariant I6), and no "users by value" report (THREAT-MODEL T11).

---

## 12. Webhooks

`death_event.opened` · `death_event.confidence_changed` · `death_event.disputed` ·
`death_event.cooling_off_started` · `death_event.executable` · `attestation.published` ·
`distribution.prepared` · `distribution.completed` · `fraud.alert_raised` ·
`plan.changed` · `proof_of_life.recorded`

Signed with Ed25519 (`X-Legacy-Signature`), timestamped, replay-protected, at-least-once with
idempotency keys.

---

## 13. Errors

RFC 7807. Domain-specific types include:

| Type | Meaning |
|---|---|
| `allocation-not-100` | Allocations do not sum to 10000 bp |
| `cooling-off-not-elapsed` | Attempted execution before the window closed |
| `insufficient-confidence` | Confidence level below the plan's threshold |
| `insufficient-attestor-quorum` | Fewer than `requiredAttestors`, or not independent |
| `dispute-open` | An unresolved dispute blocks progression |
| `fraud-hold` | Risk threshold exceeded |
| `single-approver` | Second distinct approver required |
| `step-up-required` | Sensitive operation attempted with session credentials only |
| `tier-not-supported-on-chain` | Rule tier unachievable for the target chain |

Errors carry a `remediation` field in plain language, because a beneficiary hitting
`insufficient-confidence` on the worst day of their life should not be reading an error code.

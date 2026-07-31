# SECURITY.md

Security is the product. Attack analysis lives in `THREAT-MODEL.md`; this document specifies the
controls.

---

## 1. Non-negotiable invariants

These are enforced in code, not policy. Each has a corresponding test.

| # | Invariant | Enforced in |
|---|---|---|
| I1 | No platform-controlled key or quorum is sufficient to move user assets | Key policy; `PlatformRole` |
| I2 | Every plan has a spending path that works with the platform offline | `@legacy/bitcoin` policy builder; health gate |
| I3 | `PROOF_OF_LIFE` overrides all evidence, from any state before `COMPLETED` | `@legacy/succession` state machine |
| I4 | Cooling-off can be lengthened, never shortened, after a claim opens | State machine guard |
| I5 | Two distinct approvers required to reach `EXECUTABLE` | State machine guard |
| I6 | No admin write path to allocations, beneficiaries, or death status | API surface (absent by construction) |
| I7 | Attestations are not actionable until publicly logged + delay elapsed | `@legacy/oracle` |
| I8 | Two sources of the same independence class never corroborate each other | `@legacy/death-verification` |
| I9 | No private key, seed or mnemonic is generated, transmitted or stored | Repo-wide; no such code path exists |
| I10 | Audit log is append-only and hash-chained; tampering is detectable | `@legacy/core/audit` |

---

## 2. Authentication

**Passkeys/WebAuthn primary.** Phishing resistance is the requirement, and shared secrets do not
provide it. TOTP as fallback; hardware security keys for Private Wealth.

**SMS is a notification channel, never an authentication factor for sensitive operations.**
SIM swap is a routine attack against exactly this user segment.

**Step-up re-authentication** is required for: beneficiary/allocation changes, payout address
changes, cooling-off changes, vault access, Continuity Pack export, dispute submission,
`PROOF_OF_LIFE`. Step-up must use a phishing-resistant factor.

`PROOF_OF_LIFE` deserves special attention: it must be **easy enough to perform under stress**
(the user may be abroad, ill, or on a borrowed device) while being **impossible to forge**. Design:
any registered passkey on any registered device, plus a fallback in-person/video verification path
with a human reviewer. Deliberately more paths than for other sensitive operations, because a false
negative here means the wrong outcome on the highest-stakes decision the system makes.

**Sessions:** short-lived, device-bound, revocable; new-device login alerts on all channels;
concurrent-session visibility.

---

## 3. Key management

| Key | Location | Notes |
|---|---|---|
| User asset keys | **User's hardware wallet only** | Never transmitted, never stored, never seen |
| Platform attestation key | Cloud HSM/KMS, non-exportable | Signs *attestations*, never transactions |
| Platform co-signing key (`COSIGNER` role only) | HSM, policy-gated, quorum-required | Not used at launch |
| Vault DEKs | Threshold-split; platform share non-sufficient | See §5 |
| Transparency-log signing key | Separate HSM key, separate rotation | Compromise of one ≠ compromise of both |

Rotation with published key registries and explicit revocation; key ceremonies with multi-party
control and recorded attestation; per-environment separation (no production key ever exists in a
non-production environment).

**Explicitly refused:** any scheme where the platform can reconstruct user key material —
including "encrypted seed backup", "social recovery held by us", or shard schemes where the
platform's shares meet the reconstruction threshold.

---

## 4. Cryptographic choices

| Purpose | Algorithm | Reason |
|---|---|---|
| Attestation signing | **Ed25519** | Deterministic, no nonce-reuse foot-gun, small, fast |
| EVM contract verification | **secp256k1 / EIP-712** | Required by EVM `ecrecover` |
| Bitcoin ownership proof | **BIP-322** | The standard message-signing scheme for modern address types |
| Solana ownership proof | ed25519 signed message | Native |
| Audit chain | **SHA-256** hash chain | Simple, auditable, no trusted setup |
| Vault content | **AES-256-GCM** with per-object DEK | Authenticated encryption |
| Key derivation | **Argon2id** for password-derived keys | Memory-hard |
| Transport | **TLS 1.3**, HSTS preload, cert pinning on mobile | — |

**Domain separation** on every signature: attestation payloads carry a type tag, schema version,
chain id, plan id, nonce and validity window. An attestation for one plan cannot be replayed onto
another, onto another chain, or onto a different message type.

---

## 5. Data protection

**Classification**

| Class | Examples | Controls |
|---|---|---|
| **Critical** | Identity documents, vault contents, legacy messages | E2E encrypted; platform cannot read |
| **Sensitive** | Beneficiary identities, allocations, balances | Encrypted at rest, field-level for identifiers, strict RBAC |
| **Operational** | Audit log, event metadata | Encrypted at rest, append-only |
| **Public** | Transparency log heads, contract addresses | Published deliberately |

**Vault encryption:** each object gets a random DEK; the DEK is wrapped under a threshold scheme
across owner share / beneficiary share(s) / platform share, with the threshold set so the platform
share alone is insufficient and, at the configured threshold, unnecessary. Release to beneficiaries
happens by delivering the shares the succession policy permits — never by the platform decrypting.

**Minimisation:** balances may be stored as **bands** rather than amounts where exact figures are
not required; beneficiary identity data is collected in stages, not up-front (REGULATORY §6).
Retention limits and deletion workflows per jurisdiction.

---

## 6. Application security

- TypeScript `strict` everywhere; no `any` in domain packages.
- All external input validated with schemas (`zod`) at the boundary.
- Parameterised queries only; no string-built SQL.
- Output encoding, strict CSP, no `dangerouslySetInnerHTML` on user content.
- CSRF protection on state-changing routes; SameSite cookies.
- Rate limiting per IP, per account and per operation. Death claims, disputes and auth attempts
  have their own tighter budgets.
- Idempotency keys on all state-changing API operations.
- No secrets in code or in the repository. Configuration by environment variable, secrets from a
  managed secrets store. `.env.example` documents names only, never values.
- Dependency policy: lockfile committed, automated vulnerability scanning, minimal dependency
  surface in domain packages (the crypto-relevant packages have **zero** runtime dependencies).

---

## 7. Operational security

**Zero trust:** no implicit network trust; mTLS between services; every request authenticated and
authorised on its own merits.

**Least privilege:** admin roles `SUPPORT` (read), `VERIFIER` (record evidence), `RISK` (place
holds, extend cooling-off), `OPERATOR` (second approval). **No superuser role exists.** No role can
alter a plan or move funds. Production data access requires a ticket, is time-boxed, and is
surfaced in the affected user's own timeline.

**Monitoring:** security events to a separate, append-only sink with independent retention.
Alerting on: attestation signing outside expected rate, admin access to production data,
beneficiary-change spikes, repeated failed step-up, and any transparency-log head discontinuity.

**Incident response:** documented severities; a defined "attestation key compromise" runbook whose
first action is publishing a revocation to the key registry and notifying every user with an
in-flight claim; breach notification within statutory windows.

**Resilience:** the succession engine is deterministic and re-derivable from the event log. Backups
are encrypted, geographically separated and restore-tested. A **wind-down runbook** exists and is
tested — it is a security control, because I2 depends on it.

---

## 8. Assurance

| Activity | Cadence |
|---|---|
| Automated tests (unit, integration, security) | Every commit |
| Dependency + secret scanning | Every commit |
| Smart-contract audit by an independent firm | Before any mainnet deployment — **launch gate** |
| External penetration test | Pre-launch, then annually |
| Cryptographic design review | Pre-launch, and on any change to key policy |
| Continuity drill (execute a plan with the platform "offline") | Quarterly — verifies I2 empirically |
| Key ceremony audit | On each ceremony |

The quarterly continuity drill is the most important item in this table. Invariant I2 is the
product's central claim, and a claim that is never tested is a claim that is false.

---

## 9. Responsible disclosure

A public security policy, a monitored contact, a safe-harbour commitment for good-faith research,
and a bug bounty scaled to the value at risk. Contract code and the independent verifier are
published so that the security claims are checkable rather than asserted.

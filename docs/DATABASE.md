# DATABASE.md

PostgreSQL. The authoritative schema is `prisma/schema.prisma`. **The demo runtime does not use a
database** — it runs from an in-memory seeded store so the prototype can be demonstrated anywhere
without provisioning.

---

## 1. Modelling principles

1. **Event-sourced core, projected reads.** `AuditEvent` is the source of truth for anything that
   affects succession. Entity tables are projections and can be rebuilt.
2. **Append-only where it matters.** Beneficiaries, allocations, rules and death evidence are
   never updated in place — a change writes a new version and supersedes the old. The history of
   *who was going to inherit and when that changed* is itself security-critical evidence.
3. **Hash-chained audit.** Every `AuditEvent` carries `prevHash` and `hash`. Tampering is
   detectable without trusting the database.
4. **Money as integers.** `BigInt` minor units plus a `decimals` field. No floats anywhere near
   an allocation.
5. **Field-level encryption** for identity and contact data; the column type is `Bytes`, and the
   application encrypts before write.
6. **Soft-delete never for financial records.** Retention and erasure are handled by
   cryptographic erasure (destroying the field key), which satisfies erasure obligations without
   breaking the audit chain.

---

## 2. Entity map

```
User ──1:1── Profile
 │  ├──1:N── IdentityVerification
 │  ├──1:N── Device / Session / SecurityEvent
 │  ├──1:N── Wallet ──1:N── Asset ──1:N── AssetBalanceSnapshot
 │  ├──1:N── Beneficiary ──1:N── BeneficiaryVerification
 │  ├──1:1── SuccessionPlan ──1:N── SuccessionRule
 │  │                        └──1:N── Allocation
 │  ├──1:N── Document / LegacyMessage        (Vault)
 │  ├──1:1── Subscription
 │  ├──1:N── TrustedContact
 │  └──1:N── AuditEvent
 │
DeathEvent ──1:N── VerificationSource ──1:N── VerificationResult
 │  ├──1:N── OracleAttestation
 │  ├──1:N── Dispute
 │  ├──1:N── FraudAlert
 │  └──1:1── DistributionPlan ──1:N── Distribution

Country ──1:N── VerificationProvider
InstitutionalClient ──1:N── ApiKey
```

---

## 3. Core tables

### `User`
`id` · `email` (unique, encrypted) · `phone` (encrypted) · `countryOfResidence` ·
`taxResidency[]` · `status` (`ACTIVE|INVESTIGATING|DECEASED_CONFIRMED|SUSPENDED`) ·
`platformRole` · `createdAt` · `lastProofOfLifeAt` · `lastSeenAt`

`lastProofOfLifeAt` is distinct from `lastSeenAt`: the former is an authenticated, deliberate act;
the latter is passive telemetry. Only the former resets inactivity-based confidence.

### `SuccessionPlan`
`id` · `userId` · `version` · `status` (see state machine) · `coolingOffDays` ·
`inactivityThresholdDays` · `requiredConfidenceLevel` · `requiredAttestors` ·
`continuityPackExportedAt` · `effectiveFrom` · `supersededById`

Constraint: `coolingOffDays >= 30`. Changes to `coolingOffDays` are subject to the 72-hour pending
window and cannot reduce the value while a claim is open (invariant I4).

### `Beneficiary`
`id` · `userId` · `version` · `fullName` (enc) · `dateOfBirth` (enc) · `relationship` ·
`country` · `email` (enc) · `phone` (enc) · `identityRef` (enc) · `status` ·
`supersededById` · `createdAt` · `effectiveFrom`

Versioned, never updated in place — the fraud engine reads this history directly.

### `Allocation`
`id` · `planId` · `beneficiaryId` · `basisPoints` (integer, 0–10000) · `assetScope`
(`ALL` or a specific `assetId`) · `ruleId`

**Basis points, not percentages.** Sum must equal exactly 10000 per scope — enforced by a
constraint trigger *and* in the domain layer. Floating-point percentages that "sum to 100.00000001"
are a real class of bug in this domain.

### `SuccessionRule`
`id` · `planId` · `type` · `enforcementTier` (`CRYPTOGRAPHIC|ASSISTED|LEGAL`) · `config` (jsonb) ·
`appliesToAssetIds[]` · `order`

`enforcementTier` is **NOT NULL**. A rule cannot exist without declaring how it is enforced
(DECISIONS §3).

### `Asset` / `Wallet`
`Wallet`: `id` · `userId` · `chain` · `address` · `descriptor` (for BTC output descriptors) ·
`verificationState` (`DECLARED|OBSERVED|PROVEN`) · `ownershipProofRef` · `label`

`Asset`: `id` · `walletId` · `chain` · `symbol` · `contractAddress?` · `decimals` ·
`declaredAmount` (BigInt) · `observedAmount` (BigInt) · `lastObservedAt`

`verificationState` is deliberately three-valued: reading a balance is `OBSERVED`, and only a
signed challenge earns `PROVEN` (DECISIONS §2.4).

### `DeathEvent`
`id` · `subjectUserId` · `reportedBy` · `reporterType` · `reportedAt` · `state` ·
`confidenceLevel` (0–6) · `confidenceScore` · `coolingOffEndsAt` · `fraudScore` ·
`approvals[]` · `resolvedAt` · `resolution`

`approvals[]` holds distinct approver ids; the transition guard requires ≥2 distinct entries
(invariant I5).

### `VerificationSource` / `VerificationResult`
`VerificationSource`: `id` · `deathEventId` · `providerId` · `sourceType` ·
`independenceClass` · `submittedBy` · `submittedAt` · `evidenceRef` (encrypted blob pointer)

`VerificationResult`: `id` · `sourceId` · `outcome` (`CONFIRMS|CONTRADICTS|INCONCLUSIVE`) ·
`confidence` · `validFrom` · `staleAfter` · `verifiedBy` · `notes`

`independenceClass` is the field that makes Level 6 meaningful (invariant I8).

### `OracleAttestation`
`id` · `deathEventId` · `payload` (jsonb, canonical) · `payloadHash` · `signerKeyId` ·
`signature` · `signedAt` · `publishedAt` · `actionableAt` · `logIndex` · `prevLogHash` · `logHash`

`actionableAt = publishedAt + publishDelay` (invariant I7). The log fields form the transparency
chain.

### `AuditEvent`
`id` · `seq` (monotonic) · `userId?` · `actorType` · `actorId` · `action` · `payload` (jsonb) ·
`prevHash` · `hash` · `occurredAt`

`hash = SHA256(seq ‖ prevHash ‖ canonicalJSON(payload) ‖ occurredAt)`. Insert-only; `UPDATE` and
`DELETE` revoked at the role level. Periodic head publication makes retrospective rewriting
externally detectable.

### `FraudAlert`
`id` · `userId` · `deathEventId?` · `ruleId` · `severity` · `score` · `signals` (jsonb) ·
`state` · `raisedAt` · `reviewedBy` · `outcome`

### `Distribution` / `DistributionPlan`
`DistributionPlan`: `id` · `deathEventId` · `computedAt` · `snapshot` (jsonb — balances and prices
at computation time) · `executorReconciliationRecord` (jsonb)

`Distribution`: `id` · `planId` · `beneficiaryId` · `assetId` · `amount` (BigInt) ·
`destinationAddress` · `state` · `artifactRef` (PSBT/calldata) · `txid?` · `confirmedAt?`

The snapshot is essential: allocations must be computed against a **fixed point in time**, or a
price move mid-distribution changes what each beneficiary receives.

### Reference data
`Country`: `code` · `name` · `verificationTier` (`AUTOMATED|PARTIAL|MANUAL`) ·
`forcedHeirship` (bool) · `dataResidencyRegion`
`VerificationProvider`: `id` · `countryCode` · `name` · `capabilities` (jsonb) · `status` ·
`accuracyScore` · `lastAssessedAt`

`forcedHeirship` drives the plan-creation warning described in REGULATORY §5.

---

## 4. Key constraints and triggers

| Constraint | Purpose |
|---|---|
| `SUM(basisPoints) = 10000` per plan+scope | Allocation integrity |
| `coolingOffDays >= 30` | Minimum safety delay |
| `AuditEvent` insert-only (role grants) | Tamper evidence |
| Unique `(chain, address, userId)` on `Wallet` | No duplicate registration |
| `DeathEvent.state` transitions via a guarded function only | State-machine integrity |
| `enforcementTier` NOT NULL | Honest tiering |
| Partial index on `DeathEvent(state) WHERE state != 'RESOLVED'` | Admin queue performance |

---

## 5. Data residency and retention

Region-partitioned deployment (EU, UK, US, ZA, APAC) with the user's `dataResidencyRegion`
determined at signup. Identity documents are retained only as long as the verification is valid,
then cryptographically erased. Audit events are retained for the statutory maximum, with personal
data referenced rather than embedded so erasure does not break the chain.

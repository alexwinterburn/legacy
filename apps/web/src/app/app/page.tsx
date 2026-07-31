import Link from "next/link";
import { brand, formatAmount } from "@legacy/core";
import { STATE_META, enforcementSummary } from "@legacy/succession";
import { CONFIDENCE_LEVEL_META } from "@legacy/death-verification";
import { AllocationRing, CompositionBar, ScoreArc } from "@/components/dataviz";
import { Badge, Button, Dot, Eyebrow, Panel, Rule, TierBadge, formatDate, formatUsd } from "@/components/ui";
import {
  PRICE_SNAPSHOT_AT,
  demoAllocations,
  demoAssets,
  demoBeneficiaries,
  demoRules,
  demoUser,
  getCurrentConfidence,
  getHealth,
  getPortfolioValue,
  getProofOfLife,
  getProvider,
} from "@/lib/demo";

export default function DashboardPage() {
  const health = getHealth();
  const value = getPortfolioValue();
  const confidence = getCurrentConfidence();
  const proofOfLife = getProofOfLife();
  const provider = getProvider();
  const enforcement = enforcementSummary(demoRules);
  const status = STATE_META.ACTIVE;

  const composition = demoAssets.map((a, i) => ({
    label: a.symbol,
    value: Number(a.amount) / 10 ** a.decimals * a.indicativeUnitPriceUsd,
    color: ["var(--color-brass-400)", "var(--color-brass-300)", "var(--color-brass-500)"][i % 3]!,
  }));

  return (
    <div className="space-y-8">
      {/* Hero */}
      <Panel className="overflow-hidden">
        <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1.4fr_auto]">
          <div>
            <Eyebrow>Your legacy</Eyebrow>
            <p className="tnum display mt-3 text-4xl text-bone-50 sm:text-5xl">{formatUsd(value)}</p>
            <p className="mt-2 text-xs text-bone-600">
              Indicative value, from a price snapshot at {formatDate(PRICE_SNAPSHOT_AT)}. Not a live
              feed, and never used to make a decision.
            </p>

            <div className="mt-7">
              <CompositionBar segments={composition} />
            </div>

            <Rule className="my-7" />

            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
              <div>
                <p className="eyebrow mb-1.5">Succession status</p>
                <span className="inline-flex items-center gap-2 text-sm text-verified">
                  <Dot tone="verified" />
                  {status.label}
                </span>
              </div>
              <div>
                <p className="eyebrow mb-1.5">Death confidence</p>
                <span className="text-sm text-bone-200">
                  Level {confidence.level} — {CONFIDENCE_LEVEL_META[confidence.level].label}
                </span>
              </div>
              <div>
                <p className="eyebrow mb-1.5">Last proof of life</p>
                <span className="tnum text-sm text-bone-200">{formatDate(demoUser.lastProofOfLifeAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 lg:border-l lg:hairline lg:pl-9">
            <ScoreArc score={health.score} band={health.band} />
            <p className="eyebrow">{brand.scoreName}</p>
            {health.cappedByContinuityPack ? (
              <Badge tone="caution">Capped — pack not exported</Badge>
            ) : null}
          </div>
        </div>
      </Panel>

      {/* The Continuity Pack gate — the single most important thing on this screen */}
      {!health.continuityPackExported ? (
        <Panel className="border-caution/30 bg-caution/[0.04] p-7">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <Badge tone="caution" className="mb-3">
                <Dot tone="caution" />
                Action required
              </Badge>
              <h2 className="display text-xl text-bone-50">Your plan still depends on us existing.</h2>
              <p className="mt-3 text-sm leading-relaxed text-bone-400">
                Export your {brand.continuityPackName} and your heirs can recover these assets
                whatever happens to us. Your score is deliberately held below green until then — we
                won&apos;t tell you you&apos;re protected while the plan quietly relies on this
                company continuing to operate.
              </p>
            </div>
            <Button href="/app/continuity">Export {brand.continuityPackName}</Button>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Beneficiaries */}
        <Panel className="p-7 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <Eyebrow>Beneficiaries</Eyebrow>
            <Link href="/app/beneficiaries" className="text-xs text-bone-500 transition-colors hover:text-bone-200">
              Manage &rarr;
            </Link>
          </div>

          <div className="grid gap-8 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex justify-center">
              <AllocationRing
                segments={demoAllocations.map((a) => ({
                  label: demoBeneficiaries.find((b) => b.id === a.beneficiaryId)!.fullName,
                  basisPoints: a.basisPoints,
                }))}
                size={168}
                centerLabel="100%"
                centerSub="allocated"
              />
            </div>

            <ul className="space-y-4">
              {demoAllocations.map((a, i) => {
                const b = demoBeneficiaries.find((x) => x.id === a.beneficiaryId)!;
                return (
                  <li key={a.beneficiaryId} className="border-b hairline pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-2.5">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: ["var(--color-brass-400)", "var(--color-brass-300)", "var(--color-brass-500)"][i % 3] }}
                          aria-hidden
                        />
                        <span className="text-sm text-bone-100">{b.fullName}</span>
                      </span>
                      <span className="tnum text-sm text-bone-300">{a.basisPoints / 100}%</span>
                    </div>
                    <div className="ml-5 mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-bone-600">{b.relationship}</span>
                      {b.contactVerified ? (
                        <Badge tone="verified">Contact verified</Badge>
                      ) : (
                        <Badge tone="caution">Contact unverified</Badge>
                      )}
                      {!b.destinations?.bitcoin ? <Badge tone="neutral">No address yet</Badge> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Panel>

        {/* Proof of life */}
        <Panel className="p-7">
          <Eyebrow className="mb-5">Proof of life</Eyebrow>
          <p className="tnum display text-3xl text-bone-50">{Math.floor(proofOfLife.daysRemaining)}</p>
          <p className="mt-1 text-xs text-bone-500">days until your Bitcoin backstop unlocks</p>

          <p className="mt-5 text-sm leading-relaxed text-bone-400">{proofOfLife.message}</p>

          <div className="panel-inset mt-5 p-4">
            <p className="text-xs leading-relaxed text-bone-500">
              Your timelock is <span className="text-bone-300">relative</span>, so every time you
              move these coins the clock resets. Ordinary use is your proof of life — there&apos;s no
              calendar to remember.
            </p>
          </div>

          <Button href="/app/assets" variant="secondary" className="mt-5 w-full">
            Re-anchor wallet
          </Button>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Health breakdown */}
        <Panel className="p-7 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <Eyebrow>{brand.scoreName} — what&apos;s missing</Eyebrow>
            <span className="tnum text-sm text-bone-400">{health.score}/100</span>
          </div>

          <ul className="space-y-2.5">
            {health.components.map((c) => {
              const pct = Math.round((c.earned / c.weight) * 100);
              return (
                <li key={c.id} className="flex items-start gap-4">
                  <span className="mt-1.5 shrink-0">
                    <Dot tone={c.status === "COMPLETE" ? "verified" : c.status === "PARTIAL" ? "caution" : "alert"} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-4">
                      <Link href={c.href ?? "/app"} className="text-sm text-bone-100 hover:text-brass-300">
                        {c.label}
                      </Link>
                      <span className="tnum shrink-0 text-xs text-bone-600">{pct}%</span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-bone-500">{c.remediation}</p>
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-ink-800">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background:
                            c.status === "COMPLETE"
                              ? "var(--color-verified)"
                              : c.status === "PARTIAL"
                                ? "var(--color-caution)"
                                : "var(--color-alert)",
                        }}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="space-y-6">
          {/* Enforcement honesty panel */}
          <Panel className="p-7">
            <Eyebrow className="mb-5">How your plan is enforced</Eyebrow>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-bone-400">By cryptography</dt>
                <dd className="tnum text-verified">{enforcement.cryptographic}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-bone-400">By a counterparty</dt>
                <dd className="tnum text-caution">{enforcement.assisted}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-bone-400">By your executor</dt>
                <dd className="tnum text-bone-300">{enforcement.legal}</dd>
              </div>
            </dl>
            <Rule className="my-5" />
            <p className="text-xs leading-relaxed text-bone-500">
              {enforcement.survivesCompanyFailure
                ? "At least one rule is enforced on-chain, so the core of your plan works without us."
                : "None of your rules are enforced on-chain. Your plan currently depends entirely on people."}
            </p>
            <Link href="/app/succession" className="mt-4 inline-block text-xs text-brass-400 hover:text-brass-300">
              Review your rules &rarr;
            </Link>
          </Panel>

          {/* Verification coverage */}
          <Panel className="p-7">
            <Eyebrow className="mb-4">Verification in {provider.countryName}</Eyebrow>
            <Badge tone={provider.tier === "MANUAL" ? "neutral" : "caution"} className="mb-4">
              {provider.tier === "MANUAL" ? "Document-led" : "Partially automated"}
            </Badge>
            <p className="text-sm leading-relaxed text-bone-400">{provider.summary}</p>
            <p className="mt-4 text-xs leading-relaxed text-bone-600">
              {provider.capabilities.methods.length} verification methods available.
            </p>
          </Panel>
        </div>
      </div>

      {/* Assets */}
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between px-7 py-5">
          <Eyebrow>Protected assets</Eyebrow>
          <Link href="/app/assets" className="text-xs text-bone-500 transition-colors hover:text-bone-200">
            Manage &rarr;
          </Link>
        </div>
        <div className="overflow-x-auto border-t hairline">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {["Asset", "Holding", "Indicative value", "Verification"].map((h) => (
                  <th key={h} className="eyebrow px-7 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demoAssets.map((a) => (
                <tr key={a.id} className="border-b hairline last:border-0">
                  <td className="px-7 py-4">
                    <span className="text-bone-100">{a.symbol}</span>
                    <span className="ml-2 text-xs capitalize text-bone-600">{a.chain}</span>
                  </td>
                  <td className="tnum px-7 py-4 text-bone-200">
                    {formatAmount({ value: a.amount, decimals: a.decimals, symbol: a.symbol }, a.symbol === "USDC" ? 2 : 4)}
                  </td>
                  <td className="tnum px-7 py-4 text-bone-300">
                    {formatUsd((Number(a.amount) / 10 ** a.decimals) * a.indicativeUnitPriceUsd)}
                  </td>
                  <td className="px-7 py-4">
                    <Badge tone={a.verificationState === "PROVEN" ? "verified" : "caution"}>
                      {a.verificationState === "PROVEN" ? "Ownership proven" : "Observed only"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Rules preview */}
      <Panel className="p-7">
        <div className="mb-6 flex items-center justify-between">
          <Eyebrow>Succession rules</Eyebrow>
          <Link href="/app/succession" className="text-xs text-bone-500 transition-colors hover:text-bone-200">
            Manage &rarr;
          </Link>
        </div>
        <ul className="space-y-3">
          {demoRules.map((r) => (
            <li key={r.id} className="panel-inset flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="text-sm text-bone-100">
                {r.type.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}
              </span>
              <TierBadge tier={r.enforcementTier} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

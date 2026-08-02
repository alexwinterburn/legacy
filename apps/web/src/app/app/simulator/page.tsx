import { formatAmount } from "@legacy/core";
import { CONFIDENCE_LEVEL_META } from "@legacy/death-verification";
import { STATE_META, simulateSuccession } from "@legacy/succession";
import { Badge, Button, Dot, Eyebrow, Panel, Rule, SectionHeading, formatUsd } from "@/components/ui";
import {
  DEMO_NOW,
  demoAllocations,
  demoAssets,
  demoBeneficiaries,
  demoPlan,
  demoRules,
  getSimulatedConfidence,
} from "@/lib/demo";

export default function SimulatorPage() {
  const snapshot = { takenAt: DEMO_NOW, assets: demoAssets(), note: "Simulation snapshot" };

  const result = simulateSuccession({
    startAt: DEMO_NOW,
    coolingOffDays: demoPlan().coolingOffDays,
    requiredConfidenceLevel: demoPlan().requiredConfidenceLevel,
    beneficiaries: demoBeneficiaries(),
    allocations: demoAllocations(),
    rules: demoRules(),
    snapshot,
  });

  const vetoed = simulateSuccession({
    startAt: DEMO_NOW,
    coolingOffDays: demoPlan().coolingOffDays,
    requiredConfidenceLevel: demoPlan().requiredConfidenceLevel,
    beneficiaries: demoBeneficiaries(),
    allocations: demoAllocations(),
    rules: demoRules(),
    snapshot,
    withProofOfLifeAtStep: 4,
  });

  const confidence = getSimulatedConfidence();

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Simulator"
        title="What happens if I die?"
        lead="Every number and every step below is computed by the same engines that would run for real — the state machine, the confidence model, the distribution maths. Nothing here is scripted for the demo."
      />

      {/* Outcome summary */}
      <Panel className="p-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <Eyebrow className="mb-3">Outcome</Eyebrow>
            <p className="display text-2xl text-bone-50">{STATE_META[result.finalState].label}</p>
            <p className="mt-2 text-sm text-bone-400">{STATE_META[result.finalState].description}</p>
          </div>
          <div className="text-right">
            <Eyebrow className="mb-1">Elapsed</Eyebrow>
            <p className="tnum display text-3xl text-bone-50">{result.totalDays}</p>
            <p className="text-xs text-bone-500">days from claim to distribution</p>
          </div>
        </div>
      </Panel>

      {/* Distribution */}
      {result.distribution ? (
        <Panel className="p-7">
          <Eyebrow className="mb-6">Who receives what</Eyebrow>
          <div className="space-y-5">
            {result.distribution.byBeneficiary.map((b) => (
              <div key={b.beneficiaryId} className="panel-inset p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <h3 className="display text-xl text-bone-50">{b.beneficiaryName}</h3>
                  <div className="text-right">
                    <span className="tnum text-sm text-brass-300">{b.basisPoints / 100}%</span>
                    <p className="tnum text-xs text-bone-500">≈ {formatUsd(b.indicativeValueUsd)}</p>
                  </div>
                </div>

                <ul className="mt-4 space-y-2.5">
                  {b.lines.map((l) => (
                    <li key={l.assetId} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2.5">
                        <Dot tone="brass" />
                        <span className="tnum text-bone-100">{l.formattedAmount}</span>
                        <span className="text-bone-400">{l.symbol}</span>
                      </span>
                      {l.needsDestination ? (
                        <Badge tone="caution">No address yet — we&apos;ll help them set one up</Badge>
                      ) : (
                        <span className="font-mono text-xs text-bone-600">
                          → {l.destinationAddress!.slice(0, 10)}…{l.destinationAddress!.slice(-6)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Rule className="my-6" />

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-xs text-bone-500">
            <span>
              Conservation checked:{" "}
              {result.distribution.executorReconciliation.conservationChecked ? (
                <span className="text-verified">every minor unit accounted for</span>
              ) : (
                <span className="text-alert">mismatch</span>
              )}
            </span>
            <span>Total indicative: {formatUsd(result.distribution.totalIndicativeValueUsd)}</span>
          </div>
        </Panel>
      ) : null}

      {/* Timeline */}
      <Panel className="p-7">
        <Eyebrow className="mb-6">Step by step</Eyebrow>
        <ol className="space-y-0">
          {result.steps.map((step, i) => (
            <li key={step.index} className="relative flex gap-5 pb-7 last:pb-0">
              {i < result.steps.length - 1 ? (
                <span className="absolute left-[13px] top-8 h-full w-px bg-ink-700" aria-hidden />
              ) : null}

              <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-ink-600 bg-ink-850 text-[0.6875rem] text-bone-400">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium text-bone-50">{step.title}</p>
                  <span className="tnum shrink-0 text-xs text-bone-600">
                    Day {step.dayOffset}
                  </span>
                </div>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-bone-400">{step.detail}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{step.actor}</Badge>
                  <Badge tone={step.state === "EXECUTABLE" || step.state === "DISTRIBUTING" ? "caution" : "neutral"}>
                    {STATE_META[step.state].label}
                  </Badge>
                  <span className="text-xs text-bone-600">
                    Confidence L{step.confidenceLevel} — {CONFIDENCE_LEVEL_META[step.confidenceLevel].label}
                  </span>
                </div>
                {step.blockedReason ? (
                  <p className="mt-3 rounded-lg border-l-2 border-alert/40 bg-alert/[0.04] px-4 py-3 text-sm text-alert">
                    Blocked: {step.blockedReason}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      {/* The veto */}
      <Panel className="border-verified/25 bg-verified/[0.03] p-7">
        <Eyebrow className="mb-4">The same simulation, if you&apos;re alive</Eyebrow>
        <p className="max-w-3xl text-sm leading-relaxed text-bone-400">
          Suppose the claim was mistaken, or malicious. At any point before distribution completes,
          one authenticated action from you ends it.
        </p>

        <div className="mt-6 space-y-2.5">
          {vetoed.steps.map((step) => (
            <div
              key={step.index}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg px-5 py-3.5 ${
                step.title.includes("alive") ? "bg-verified/10 border border-verified/25" : "panel-inset"
              }`}
            >
              <span className={`text-sm ${step.title.includes("alive") ? "text-verified" : "text-bone-300"}`}>
                {step.title}
              </span>
              <span className="tnum text-xs text-bone-600">Day {step.dayOffset}</span>
            </div>
          ))}
        </div>

        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-bone-400">
          Confidence drops to zero, the claim closes, and the plan returns to normal — regardless of
          what any registry, certificate or claimant said. A living person&apos;s authenticated
          session outranks a government database, because databases contain errors and living people
          don&apos;t stop being alive.
        </p>
      </Panel>

      {/* What isn't automatic */}
      {result.manualSteps.length > 0 ? (
        <Panel className="border-caution/25 bg-caution/[0.03] p-7">
          <Eyebrow className="mb-4">What this simulation does not do automatically</Eyebrow>
          <ul className="space-y-3">
            {result.manualSteps.map((s, i) => (
              <li key={i} className="flex gap-3.5">
                <span className="mt-1.5 shrink-0"><Dot tone="caution" /></span>
                <span className="text-sm leading-relaxed text-bone-400">{s}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-3xl text-xs leading-relaxed text-bone-600">
            A simulator that only shows the happy path is marketing. These are the parts of your
            plan that depend on people, and you should know exactly which they are.
          </p>
        </Panel>
      ) : null}

      {/* Confidence detail */}
      <Panel className="p-7">
        <Eyebrow className="mb-5">How confidence was reached</Eyebrow>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="display text-2xl text-bone-50">
            Level {confidence.level} — {CONFIDENCE_LEVEL_META[confidence.level].label}
          </p>
          <span className="tnum text-sm text-bone-500">score {confidence.score}/100</span>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-bone-400">{confidence.rationale}</p>

        <Rule className="my-6" />

        <ul className="space-y-2.5">
          {confidence.contributing.map((c, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="font-mono text-xs text-bone-600">{c.evidenceId}</span>
              <span className="text-bone-400">{c.effect}</span>
            </li>
          ))}
        </ul>

        <div className="panel-inset mt-6 p-5">
          <p className="eyebrow mb-2">Independent source classes</p>
          <div className="flex flex-wrap gap-2">
            {confidence.independentClasses.map((c) => (
              <Badge key={c} tone="verified">{c.replace(/_/g, " ").toLowerCase()}</Badge>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-bone-500">
            Level 6 requires two genuinely independent classes. A death certificate and a registry
            entry both come from the same registration event, so they can never corroborate each
            other however authentic each one is.
          </p>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Button href="/app/simulate-death">Run the full demo walkthrough</Button>
        <Button href="/app/succession" variant="secondary">Adjust my rules</Button>
      </div>
    </div>
  );
}

// Reads mutable store state, so it must not be statically prerendered.
export const dynamic = "force-dynamic";

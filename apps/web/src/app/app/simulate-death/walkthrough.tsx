"use client";

import { useState } from "react";
import { Badge, Button, Dot, Eyebrow, Panel, Rule } from "@/components/ui";

export interface WalkthroughStep {
  title: string;
  detail: string;
  actor: string;
  dayOffset: number;
  state: string;
  stateLabel: string;
  confidenceLevel: number;
  confidenceLabel: string;
  blockedReason?: string;
}

export interface WalkthroughPayload {
  steps: WalkthroughStep[];
  distribution: {
    beneficiaryName: string;
    basisPoints: number;
    indicativeValueUsd: number;
    lines: { symbol: string; formattedAmount: string; needsDestination: boolean }[];
  }[];
  manualSteps: string[];
  fraudScore: number;
  fraudSeverity: string;
  coolingOffDays: number;
}

export function Walkthrough({ payload }: { payload: WalkthroughPayload }) {
  const [step, setStep] = useState(-1);
  const [vetoed, setVetoed] = useState(false);

  const started = step >= 0;
  const finished = step >= payload.steps.length - 1;
  const current = started ? payload.steps[Math.min(step, payload.steps.length - 1)] : undefined;

  function reset() {
    setStep(-1);
    setVetoed(false);
  }

  if (vetoed) {
    return (
      <Panel className="border-verified/30 bg-verified/[0.04] p-9 text-center">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-verified/15">
          <Dot tone="verified" />
        </span>
        <h2 className="display text-3xl text-bone-50">You stopped it.</h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-bone-400">
          One authenticated action with your passkey. Confidence dropped to zero, the claim closed,
          and your plan returned to normal — regardless of what the evidence said. Your
          beneficiaries were told the claim was resolved, and the whole episode is permanently
          recorded in your timeline.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={reset}>Run it again</Button>
          <Button href="/app/timeline" variant="secondary">See the audit record</Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <Panel className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <Eyebrow className="mb-1.5">Demonstration</Eyebrow>
            <p className="text-sm text-bone-300">
              {!started
                ? "Nothing has happened yet. Your plan is active."
                : `Step ${step + 1} of ${payload.steps.length} · Day ${current?.dayOffset ?? 0}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {!started ? (
              <Button onClick={() => setStep(0)}>Simulate death</Button>
            ) : (
              <>
                {!finished ? (
                  <Button onClick={() => setStep((s) => s + 1)}>Advance</Button>
                ) : null}
                {step >= 0 && step < payload.steps.length - 2 ? (
                  <Button variant="secondary" onClick={() => setVetoed(true)}>
                    I&apos;m alive — stop this
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={reset}>Reset</Button>
              </>
            )}
          </div>
        </div>

        {started ? (
          <div className="mt-5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-ink-800">
              <div
                className="h-full rounded-full bg-brass-400 transition-all duration-500"
                style={{ width: `${((step + 1) / payload.steps.length) * 100}%` }}
              />
            </div>
          </div>
        ) : null}
      </Panel>

      {!started ? (
        <Panel className="p-9">
          <h2 className="display text-2xl text-bone-50">What you&apos;re about to see</h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bone-400">
            A death is reported against this account. Watch what does — and does not — happen. Every
            state transition below is produced by the real succession engine, including the guards
            that refuse to let it move too fast.
          </p>

          <Rule className="my-7" />

          <ul className="space-y-3.5">
            {[
              `Assets stay exactly where they are for at least ${payload.coolingOffDays} days`,
              "You are notified on every channel, repeatedly",
              "Two independent classes of evidence are required to reach the highest confidence",
              "Two separate people must approve — and neither can move your assets",
              "You can end it at any point with a single authenticated action",
            ].map((s) => (
              <li key={s} className="flex gap-3.5 text-sm text-bone-300">
                <span className="mt-1.5 shrink-0"><Dot tone="brass" /></span>
                {s}
              </li>
            ))}
          </ul>

          <p className="mt-7 text-xs leading-relaxed text-bone-600">
            Demonstration only. No funds exist, no transactions are prepared, and nothing leaves
            this browser.
          </p>
        </Panel>
      ) : null}

      {/* Steps */}
      {started ? (
        <div className="space-y-3">
          {payload.steps.slice(0, step + 1).map((s, i) => {
            const isCurrent = i === step;
            return (
              <Panel
                key={i}
                className={`animate-rise p-6 ${isCurrent ? "border-brass-500/30" : "opacity-70"}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-ink-600 bg-ink-850 text-[0.6875rem] text-bone-400">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-bone-50">{s.title}</p>
                      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-bone-400">{s.detail}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{s.actor}</Badge>
                        <Badge tone={s.state === "EXECUTABLE" || s.state === "DISTRIBUTING" ? "caution" : "neutral"}>
                          {s.stateLabel}
                        </Badge>
                        <span className="text-xs text-bone-600">
                          Confidence L{s.confidenceLevel} — {s.confidenceLabel}
                        </span>
                      </div>
                      {s.blockedReason ? (
                        <p className="mt-3 rounded-lg border-l-2 border-alert/40 bg-alert/[0.05] px-4 py-3 text-sm text-alert">
                          Refused by the engine: {s.blockedReason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span className="tnum shrink-0 text-xs text-bone-600">Day {s.dayOffset}</span>
                </div>
              </Panel>
            );
          })}
        </div>
      ) : null}

      {/* Final distribution */}
      {finished ? (
        <Panel className="animate-rise p-7">
          <Eyebrow className="mb-6">Distribution</Eyebrow>
          <div className="space-y-4">
            {payload.distribution.map((b) => (
              <div key={b.beneficiaryName} className="panel-inset p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="display text-xl text-bone-50">{b.beneficiaryName}</h3>
                  <span className="tnum text-sm text-brass-300">{b.basisPoints / 100}%</span>
                </div>
                <ul className="mt-3.5 space-y-2">
                  {b.lines.map((l) => (
                    <li key={l.symbol} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2.5">
                        <Dot tone="brass" />
                        <span className="tnum text-bone-100">{l.formattedAmount}</span>
                        <span className="text-bone-400">{l.symbol}</span>
                      </span>
                      {l.needsDestination ? (
                        <Badge tone="caution">Address set up during claim</Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Rule className="my-7" />

          <p className="max-w-3xl text-sm leading-relaxed text-bone-400">
            Each beneficiary signs for their own share and receives it directly at their own
            address. It never passes through us — at no point in this process did we hold, control,
            or have the ability to redirect any of it.
          </p>

          {payload.manualSteps.length > 0 ? (
            <div className="mt-6 rounded-lg border-l-2 border-caution/40 bg-caution/[0.04] px-5 py-4">
              <p className="eyebrow mb-2.5">And what didn&apos;t happen automatically</p>
              <ul className="space-y-2">
                {payload.manualSteps.map((s, i) => (
                  <li key={i} className="text-sm leading-relaxed text-bone-400">{s}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <Button onClick={reset}>Run it again</Button>
            <Button href="/beneficiary" variant="secondary">See the beneficiary&apos;s view</Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

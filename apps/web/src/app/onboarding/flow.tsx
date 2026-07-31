"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Dot, Eyebrow, Field, Panel, Rule, inputClass } from "@/components/ui";
import { AllocationRing, ScoreArc } from "@/components/dataviz";

interface BeneficiaryDraft {
  name: string;
  relationship: string;
  share: number;
}

const SCREENS = [
  "Let's protect what you've built.",
  "Who should inherit your wealth?",
  "What should be protected?",
  "How should it be distributed?",
  "How should we know when the time comes?",
  "Your legacy is ready.",
] as const;

export function OnboardingFlow() {
  const [screen, setScreen] = useState(0);
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryDraft[]>([
    { name: "Christine Winterburn", relationship: "Spouse", share: 50 },
    { name: "Arabella Winterburn", relationship: "Daughter", share: 25 },
    { name: "Ava Winterburn", relationship: "Daughter", share: 25 },
  ]);
  const [assets, setAssets] = useState({ btc: "1.84", eth: "24.6", usdc: "420000" });
  const [distribution, setDistribution] = useState<"immediate" | "delayed">("delayed");
  const [coolingOff, setCoolingOff] = useState(60);
  const [trustedContact, setTrustedContact] = useState(true);
  const [continuityExported, setContinuityExported] = useState(false);

  const totalShare = beneficiaries.reduce((acc, b) => acc + b.share, 0);
  const allocationComplete = totalShare === 100;

  // Mirrors the real health-score weighting closely enough to be honest about the gate.
  const score = useMemo(() => {
    let s = 20;
    if (allocationComplete) s += 18;
    if (Number(assets.btc) > 0) s += 14;
    if (distribution === "delayed") s += 12;
    if (coolingOff >= 60) s += 8;
    if (trustedContact) s += 7;
    if (continuityExported) s += 21;
    return Math.min(continuityExported ? 100 : 79, s);
  }, [allocationComplete, assets.btc, distribution, coolingOff, trustedContact, continuityExported]);

  const band: "green" | "amber" | "red" = score >= 80 ? "green" : score >= 55 ? "amber" : "red";

  function updateShare(index: number, value: number) {
    setBeneficiaries((prev) => prev.map((b, i) => (i === index ? { ...b, share: value } : b)));
  }

  const canAdvance = screen !== 1 || allocationComplete;

  return (
    <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
      {/* Progress */}
      <div className="mb-12">
        <div className="flex gap-1.5">
          {SCREENS.map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-colors duration-500 ${
                i <= screen ? "bg-brass-400" : "bg-ink-700"
              }`}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-bone-600">
          Step {screen + 1} of {SCREENS.length}
        </p>
      </div>

      <h1 key={screen} className="display animate-rise text-3xl leading-snug text-bone-50 sm:text-4xl">
        {SCREENS[screen]}
      </h1>

      <div className="mt-10">
        {screen === 0 ? (
          <div className="animate-rise space-y-6">
            <p className="max-w-xl text-base leading-relaxed text-bone-400">
              This takes about four minutes. We won&apos;t ask for identity documents or a payment
              method until you&apos;ve seen your plan — you should know what you&apos;re getting
              before we ask anything of you.
            </p>

            <Panel className="p-7">
              <Eyebrow className="mb-5">Before we start, three things we won&apos;t do</Eyebrow>
              <ul className="space-y-4">
                {[
                  ["We won't ask for your seed phrase", "Not now, not ever. We have no way to store one, and anyone who asks for yours is stealing from you."],
                  ["We won't hold your assets", "You'll build a spending policy. We may hold one key of several — never enough to move anything."],
                  ["We won't pretend to be your will", "This works alongside your will. If they conflict, the will governs."],
                ].map(([title, body]) => (
                  <li key={title} className="flex gap-3.5">
                    <span className="mt-1.5 shrink-0"><Dot tone="brass" /></span>
                    <div>
                      <p className="text-sm text-bone-100">{title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-bone-500">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        ) : null}

        {screen === 1 ? (
          <div className="animate-rise space-y-6">
            <p className="max-w-xl text-sm leading-relaxed text-bone-400">
              Name the people who should receive your digital assets, and what proportion each
              should get.
            </p>

            <Panel className="p-7">
              <div className="space-y-5">
                {beneficiaries.map((b, i) => (
                  <div key={i} className="grid gap-4 sm:grid-cols-[1.6fr_1fr_auto] sm:items-end">
                    <Field label="Full name">
                      <input
                        className={inputClass}
                        value={b.name}
                        onChange={(e) =>
                          setBeneficiaries((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                          )
                        }
                      />
                    </Field>
                    <Field label="Relationship">
                      <input
                        className={inputClass}
                        value={b.relationship}
                        onChange={(e) =>
                          setBeneficiaries((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, relationship: e.target.value } : x)),
                          )
                        }
                      />
                    </Field>
                    <Field label="Share">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className={`${inputClass} tnum w-20`}
                          value={b.share}
                          onChange={(e) => updateShare(i, Number(e.target.value))}
                        />
                        <span className="text-sm text-bone-500">%</span>
                      </div>
                    </Field>
                  </div>
                ))}
              </div>

              <Rule className="my-7" />

              <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-5">
                  <AllocationRing
                    segments={beneficiaries.map((b) => ({
                      label: b.name,
                      basisPoints: Math.max(0, Math.round((b.share / Math.max(totalShare, 1)) * 10_000)),
                    }))}
                    size={92}
                    thickness={9}
                  />
                  <div>
                    {allocationComplete ? (
                      <>
                        <Badge tone="verified" className="mb-2">
                          <Dot tone="verified" />
                          Fully allocated
                        </Badge>
                        <p className="text-sm text-bone-200">Your legacy is 100% allocated.</p>
                      </>
                    ) : (
                      <>
                        <Badge tone="caution" className="mb-2">
                          {totalShare > 100 ? "Over-allocated" : "Incomplete"}
                        </Badge>
                        <p className="tnum text-sm text-bone-300">
                          {totalShare}% allocated · {totalShare > 100 ? `${totalShare - 100}% too much` : `${100 - totalShare}% remaining`}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  onClick={() => setBeneficiaries((p) => [...p, { name: "", relationship: "", share: 0 }])}
                >
                  + Add another
                </Button>
              </div>
            </Panel>
          </div>
        ) : null}

        {screen === 2 ? (
          <div className="animate-rise space-y-6">
            <p className="max-w-xl text-sm leading-relaxed text-bone-400">
              Tell us what you hold. You can paste addresses now and prove ownership later — we only
              ever need public addresses.
            </p>

            <Panel className="p-7">
              <div className="space-y-5">
                {(
                  [
                    ["btc", "Bitcoin", "BTC"],
                    ["eth", "Ethereum", "ETH"],
                    ["usdc", "USD Coin", "USDC"],
                  ] as const
                ).map(([key, label, symbol]) => (
                  <Field key={key} label={label}>
                    <div className="flex items-center gap-3">
                      <input
                        className={`${inputClass} tnum`}
                        value={assets[key]}
                        onChange={(e) => setAssets((p) => ({ ...p, [key]: e.target.value }))}
                      />
                      <span className="w-14 text-sm text-bone-500">{symbol}</span>
                    </div>
                  </Field>
                ))}
              </div>

              <div className="panel-inset mt-6 p-5">
                <p className="text-xs leading-relaxed text-bone-500">
                  Anything you enter here is <span className="text-bone-300">declared</span>. Once
                  you add an address we can move it to <span className="text-bone-300">observed</span>,
                  and once you sign a challenge with its key it becomes{" "}
                  <span className="text-bone-300">proven</span>. We keep those three states separate
                  because they genuinely mean different things.
                </p>
              </div>
            </Panel>
          </div>
        ) : null}

        {screen === 3 ? (
          <div className="animate-rise space-y-6">
            <p className="max-w-xl text-sm leading-relaxed text-bone-400">
              Choose how your assets pass on. We&apos;ll tell you plainly what enforces each option.
            </p>

            <div className="space-y-4">
              {(
                [
                  {
                    id: "immediate" as const,
                    title: "Immediate distribution",
                    body: "Everything passes to your beneficiaries once verification and the cooling-off period complete.",
                    tier: "Enforced by cryptography",
                    tone: "verified" as const,
                  },
                  {
                    id: "delayed" as const,
                    title: "Delayed access with a Bitcoin backstop",
                    body: "As above, plus a relative timelock so your heirs can recover the funds even if we no longer exist. Moving your coins resets the clock — ordinary use is your proof of life.",
                    tier: "Enforced by cryptography",
                    tone: "verified" as const,
                  },
                ]
              ).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setDistribution(opt.id)}
                  className={`w-full rounded-xl border p-6 text-left transition-colors ${
                    distribution === opt.id
                      ? "border-brass-500/50 bg-brass-400/[0.06]"
                      : "border-ink-600 bg-ink-900 hover:border-ink-500"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-sm font-medium text-bone-50">{opt.title}</p>
                    <Badge tone={opt.tone}><Dot tone={opt.tone} />{opt.tier}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-bone-400">{opt.body}</p>
                </button>
              ))}

              <Panel className="p-6 opacity-70">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm font-medium text-bone-200">Age-based tranches</p>
                  <Badge tone="neutral">Enforced by your executor</Badge>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-bone-500">
                  &ldquo;20% at 21, 30% at 25, 50% at 30.&rdquo; No blockchain can verify someone&apos;s
                  age, and automating it would mean someone holding your coins. You can add this later
                  as an instruction to your executor — we just won&apos;t pretend it&apos;s automatic.
                </p>
              </Panel>
            </div>
          </div>
        ) : null}

        {screen === 4 ? (
          <div className="animate-rise space-y-6">
            <p className="max-w-xl text-sm leading-relaxed text-bone-400">
              These are the safety settings. They&apos;re yours to choose, because a delay you
              picked yourself is a setting — a delay we imposed would be a company power.
            </p>

            <Panel className="p-7">
              <Field label="Cooling-off period" hint="How long everything pauses after a death is reported, before anything can proceed. Longer is safer; it can always be extended later, but never shortened once a claim is open.">
                <div className="mt-2 flex flex-wrap gap-2">
                  {[30, 60, 90, 180].map((d) => (
                    <button
                      key={d}
                      onClick={() => setCoolingOff(d)}
                      className={`tnum rounded-lg border px-4 py-2 text-sm transition-colors ${
                        coolingOff === d
                          ? "border-brass-500/50 bg-brass-400/10 text-brass-200"
                          : "border-ink-600 text-bone-400 hover:border-ink-500"
                      }`}
                    >
                      {d} days
                    </button>
                  ))}
                </div>
              </Field>

              <Rule className="my-7" />

              <button
                onClick={() => setTrustedContact((v) => !v)}
                className="flex w-full items-start gap-4 text-left"
              >
                <span
                  className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    trustedContact ? "border-brass-400 bg-brass-400 text-ink-950" : "border-ink-500"
                  }`}
                >
                  {trustedContact ? "✓" : ""}
                </span>
                <span>
                  <span className="block text-sm text-bone-100">Nominate a trusted contact</span>
                  <span className="mt-1 block text-sm leading-relaxed text-bone-500">
                    Someone who isn&apos;t a beneficiary. They&apos;re notified of any claim and can
                    extend the waiting period — but never shorten it. The asymmetry is deliberate:
                    they can protect you, never harm you.
                  </span>
                </span>
              </button>
            </Panel>
          </div>
        ) : null}

        {screen === 5 ? (
          <div className="animate-rise space-y-6">
            <Panel className="p-8 text-center">
              <div className="flex justify-center">
                <ScoreArc score={score} band={band} />
              </div>
              <p className="eyebrow mt-4">Legacy Health</p>

              <Rule className="my-7" />

              {!continuityExported ? (
                <>
                  <p className="display text-xl text-bone-50">One thing left.</p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-bone-400">
                    Your score is capped at 79 until you export your Continuity Pack. Until your
                    family holds it, the honest description of your plan is &ldquo;works, provided
                    this company is still around&rdquo; — and we won&apos;t score that as green.
                  </p>
                  <Button className="mt-6" onClick={() => setContinuityExported(true)}>
                    Export Continuity Pack
                  </Button>
                </>
              ) : (
                <>
                  <p className="display text-2xl text-bone-50">You are protected.</p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-bone-400">
                    Your plan is in place, and it no longer depends on us existing. Your heirs can
                    recover your assets with what you now hold, whatever happens to this company.
                  </p>
                  <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <Button href="/app">Go to my dashboard</Button>
                    <Button href="/app/simulator" variant="secondary">See what happens if I die</Button>
                  </div>
                </>
              )}
            </Panel>

            <Panel className="p-7">
              <Eyebrow className="mb-5">Your plan</Eyebrow>
              <dl className="space-y-3 text-sm">
                {[
                  ["Beneficiaries", beneficiaries.filter((b) => b.name).map((b) => `${b.name.split(" ")[0]} ${b.share}%`).join(" · ")],
                  ["Distribution", distribution === "delayed" ? "Delayed access with a Bitcoin backstop" : "Immediate distribution"],
                  ["Cooling-off", `${coolingOff} days`],
                  ["Trusted contact", trustedContact ? "Nominated" : "Not set"],
                  ["Continuity Pack", continuityExported ? "Exported" : "Not exported"],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-wrap justify-between gap-4 border-b hairline pb-3 last:border-0 last:pb-0">
                    <dt className="text-bone-500">{k}</dt>
                    <dd className="text-right text-bone-200">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        ) : null}
      </div>

      {/* Navigation */}
      <div className="mt-12 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setScreen((s) => Math.max(0, s - 1))}
          disabled={screen === 0}
        >
          Back
        </Button>

        {screen < SCREENS.length - 1 ? (
          <Button onClick={() => setScreen((s) => s + 1)} disabled={!canAdvance}>
            {screen === 0 ? "Begin" : "Continue"}
          </Button>
        ) : null}
      </div>

      {!canAdvance ? (
        <p className="mt-4 text-right text-xs text-caution">
          Allocations must total exactly 100% before you can continue.
        </p>
      ) : null}
    </div>
  );
}

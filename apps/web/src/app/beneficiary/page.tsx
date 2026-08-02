import Link from "next/link";
import { friendlyNameFor } from "@legacy/core";
import { computeDistribution } from "@legacy/succession";
import { Wordmark } from "@/components/site-chrome";
import { Badge, Button, Dot, Eyebrow, LegalNote, Panel, Rule, formatUsd } from "@/components/ui";
import { DEMO_NOW, demoAllocations, demoAssets, demoBeneficiaries, demoUser } from "@/lib/demo";

/**
 * The beneficiary experience.
 *
 * Assume: no crypto knowledge, grieving, possibly hostile family dynamics. The words
 * "private key", "multisig", "UTXO" and "gas" appear nowhere on this page, deliberately.
 */
export default function BeneficiaryPortal() {
  const distribution = computeDistribution({
    snapshot: { takenAt: DEMO_NOW, assets: demoAssets(), note: "Claim snapshot" },
    allocations: demoAllocations(),
    beneficiaries: demoBeneficiaries(),
  });

  const christine = distribution.byBeneficiary.find((b) => b.beneficiaryName.startsWith("Christine"))!;
  const others = distribution.byBeneficiary.filter((b) => b !== christine);

  const steps = [
    { title: "Confirm who you are", body: "A short identity check, matched against the details Alex recorded when setting this up.", state: "done" },
    { title: "Understand what's been left to you", body: "A plain summary of the assets and what they're worth today.", state: "done" },
    { title: "Set up somewhere to receive it", body: "If you don't already have a wallet, we'll walk you through creating one. It takes about ten minutes.", state: "current" },
    { title: "Confirm and receive", body: "You approve the transfer, and it arrives directly with you.", state: "todo" },
  ] as const;

  return (
    <div className="min-h-screen">
      <header className="border-b hairline bg-ink-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5 sm:px-8">
          <Wordmark />
          <Badge tone="brass">Beneficiary</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-14 sm:px-8">
        {/* Opening */}
        <div className="animate-rise">
          <p className="display text-3xl leading-snug text-bone-50 sm:text-4xl">
            {demoUser().fullName} has left you a digital legacy.
          </p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-bone-400">
            We know this is a difficult time. There&apos;s nothing you need to do today. When
            you&apos;re ready, we&apos;ll take you through it one step at a time — and you
            don&apos;t need to understand anything technical.
          </p>
        </div>

        {/* Inheritance */}
        <Panel className="mt-10 p-8">
          <Eyebrow className="mb-5">Your inheritance</Eyebrow>

          <div className="space-y-4">
            {christine.lines.map((l) => (
              <div key={l.assetId} className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <p className="tnum display text-3xl text-bone-50">
                    {l.formattedAmount} <span className="text-xl text-bone-400">{l.symbol}</span>
                  </p>
                  <p className="mt-1 text-xs text-bone-600">{friendlyNameFor(l.symbol)}</p>
                </div>
                <p className="tnum text-sm text-bone-300">≈ {formatUsd(l.indicativeValueUsd)}</p>
              </div>
            ))}
          </div>

          <Rule className="my-7" />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow mb-1.5">Estimated total value</p>
              <p className="tnum display text-2xl text-bone-50">{formatUsd(christine.indicativeValueUsd)}</p>
            </div>
            <Badge tone="caution"><Dot tone="caution" />Pending verification</Badge>
          </div>

          <p className="mt-5 text-xs leading-relaxed text-bone-600">
            Values shown are indicative and move with the market. The amounts themselves — the{" "}
            {christine.lines[0]?.formattedAmount} {christine.lines[0]?.symbol}, for example — are fixed
            by Alex&apos;s instructions and don&apos;t change.
          </p>
        </Panel>

        {/* Steps */}
        <Panel className="mt-6 p-8">
          <Eyebrow className="mb-6">What happens next</Eyebrow>
          <ol className="space-y-0">
            {steps.map((s, i) => (
              <li key={s.title} className="relative flex gap-5 pb-7 last:pb-0">
                {i < steps.length - 1 ? (
                  <span className="absolute left-[13px] top-8 h-full w-px bg-ink-700" aria-hidden />
                ) : null}
                <span
                  className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] ${
                    s.state === "done"
                      ? "border-verified/40 bg-verified/15 text-verified"
                      : s.state === "current"
                        ? "border-brass-400/50 bg-brass-400/15 text-brass-300"
                        : "border-ink-600 bg-ink-850 text-bone-500"
                  }`}
                >
                  {s.state === "done" ? "✓" : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${s.state === "todo" ? "text-bone-400" : "text-bone-50"}`}>
                    {s.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-bone-500">{s.body}</p>
                  {s.state === "current" ? (
                    <Button className="mt-4">Continue</Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Panel>

        {/* Co-beneficiaries — a fraud control, framed as transparency */}
        <Panel className="mt-6 p-8">
          <Eyebrow className="mb-4">Others receiving a share</Eyebrow>
          <p className="max-w-2xl text-sm leading-relaxed text-bone-400">
            Everyone named in this plan can see what everyone else receives. That&apos;s deliberate:
            it means nobody can quietly alter someone else&apos;s share without the others noticing.
          </p>

          <ul className="mt-6 space-y-3">
            {others.map((b) => (
              <li key={b.beneficiaryId} className="panel-inset flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="text-sm text-bone-100">{b.beneficiaryName}</span>
                <span className="tnum text-sm text-bone-400">{b.basisPoints / 100}%</span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Reassurance */}
        <Panel className="mt-6 p-8">
          <Eyebrow className="mb-5">Questions you might have</Eyebrow>
          <dl className="space-y-5">
            {[
              ["Do I need to understand cryptocurrency?", "No. We'll set everything up with you, in plain language, at whatever pace suits you."],
              ["Is there a deadline?", "No. This will wait for you. Take the time you need."],
              ["Could someone else claim my share?", "Your share is tied to your verified identity, and any change to where it goes triggers a waiting period and notifies everyone else named here."],
              ["What does this cost me?", "Nothing. There's no fee to receive an inheritance through us."],
              ["Do I need a lawyer?", "This doesn't replace the estate process. We'd encourage you to speak to whoever is administering the estate — and we can provide a summary document for them."],
            ].map(([q, a]) => (
              <div key={q} className="border-b hairline pb-5 last:border-0 last:pb-0">
                <dt className="text-sm text-bone-100">{q}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-bone-500">{a}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div className="mt-10 space-y-4">
          <LegalNote />
          <p className="text-xs text-bone-600">
            Demonstration environment. <Link href="/" className="underline decoration-bone-600 underline-offset-4 hover:text-bone-400">Return to the main site</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

// Reads mutable store state, so it must not be statically prerendered.
export const dynamic = "force-dynamic";


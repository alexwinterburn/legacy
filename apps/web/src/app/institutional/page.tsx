import { brand } from "@legacy/core";
import { coverageSummary } from "@legacy/death-verification";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Badge, Button, Dot, Eyebrow, Panel, Rule, SectionHeading } from "@/components/ui";

export default function InstitutionalPage() {
  const coverage = coverageSummary();

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="Institutional"
          title="Succession as infrastructure."
          lead="Exchanges, wallets, banks and wealth managers all hit the same wall: a customer dies, and nobody can prove it to a standard that justifies moving money. We sell the proof — never the data."
        />

        {/* The hard constraint, stated up front */}
        <Panel className="mt-12 border-caution/30 bg-caution/[0.03] p-7">
          <Eyebrow className="mb-3">A constraint we won&apos;t design around</Eyebrow>
          <p className="max-w-3xl text-sm leading-relaxed text-bone-400">
            Licensed death-registry feeds prohibit onward bulk disclosure — GRO&apos;s DDRI licence
            in the UK is explicit about it. So there is no bulk death-data endpoint in this API, and
            there never will be. We provide <span className="text-bone-200">attestations about a
            specific, consented subject</span>. If you need a data feed, you need your own licence.
          </p>
        </Panel>

        {/* Flow */}
        <Panel className="mt-6 p-8">
          <Eyebrow className="mb-7">How an integration works</Eyebrow>
          <ol className="grid gap-px overflow-hidden rounded-xl border hairline bg-ink-700 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Register a consented subject", "Your customer opts in. You send us a pseudonymous subject reference — not their portfolio."],
              ["We monitor and gather", "Inactivity signals, and the verification sources available in their jurisdiction."],
              ["Evidence is scored", "Our confidence engine grades it, including which corroboration is genuinely independent."],
              ["Attestations are signed and published", "A quorum of independent attestors, entered into a public transparency log."],
              ["You receive a webhook", "With the attestation and its actionable-from time."],
              ["You act under your own policy", "You decide what a level-6 attestation permits. We never instruct you to release anything."],
            ].map(([title, body], i) => (
              <li key={title} className="bg-ink-900 p-6">
                <span className="tnum display text-2xl text-brass-500/70">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-3 text-sm font-medium text-bone-50">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-bone-500">{body}</p>
              </li>
            ))}
          </ol>
        </Panel>

        {/* Live endpoints */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b hairline px-6 py-3.5">
              <p className="font-mono text-xs text-bone-400">GET /api/v1/oracle/verify</p>
              <Badge tone="verified">Live in this demo</Badge>
            </div>
            <div className="p-6">
              <p className="text-sm leading-relaxed text-bone-400">
                Generates two independent attestations, publishes them to a transparency log, and
                evaluates the quorum twice — once immediately and once after the publish delay — so
                you can see publish-then-act working.
              </p>
              <p className="mt-4 text-xs text-bone-600">
                Try it: <code className="font-mono text-bone-500">curl localhost:3000/api/v1/oracle/verify</code>
              </p>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b hairline px-6 py-3.5">
              <p className="font-mono text-xs text-bone-400">POST /api/v1/death-verification/confidence</p>
              <Badge tone="verified">Live in this demo</Badge>
            </div>
            <div className="p-6">
              <p className="text-sm leading-relaxed text-bone-400">
                Score a set of evidence. Returns the level, each source&apos;s contribution, and the
                reasons a higher level was withheld — including when two sources look independent
                but aren&apos;t.
              </p>
            </div>
          </Panel>
        </div>

        <Panel className="mt-6 overflow-hidden">
          <div className="border-b hairline px-6 py-3.5">
            <p className="font-mono text-xs text-bone-400">POST /api/v1/succession/simulate</p>
          </div>
          <pre className="overflow-x-auto px-6 py-5 font-mono text-xs leading-relaxed text-bone-400">
{`{
  "coolingOffDays": 60,
  "requiredConfidenceLevel": 4,
  "allocations": [
    { "beneficiaryId": "ben-christine", "basisPoints": 5000 },
    { "beneficiaryId": "ben-arabella",  "basisPoints": 2500 },
    { "beneficiaryId": "ben-ava",       "basisPoints": 2500 }
  ],
  "ruleTypes": ["PERCENTAGE", "TIMELOCK_DELAY"]
}

→ amounts are returned as STRINGS in minor units.
  JSON has no bigint, and a float would lose satoshis.`}
          </pre>
        </Panel>

        {/* Scopes */}
        <Panel className="mt-6 p-7">
          <Eyebrow className="mb-5">Scopes that exist — and scopes that don&apos;t</Eyebrow>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm text-bone-200">Available</p>
              <ul className="space-y-2">
                {["subjects:read", "subjects:write", "attestation:request", "succession:read", "coverage:read", "webhooks:manage"].map((s) => (
                  <li key={s} className="flex items-center gap-2.5 font-mono text-xs text-bone-400">
                    <Dot tone="verified" />{s}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-sm text-bone-200">Deliberately absent</p>
              <ul className="space-y-2">
                {["death:declare", "plan:override", "funds:release", "allocation:admin", "deaths:bulk"].map((s) => (
                  <li key={s} className="flex items-center gap-2.5 font-mono text-xs text-bone-600 line-through">
                    <Dot tone="alert" />{s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Rule className="my-6" />
          <p className="text-xs leading-relaxed text-bone-600">
            These aren&apos;t permission-gated. The write paths don&apos;t exist in the codebase, so
            there is nothing to escalate to.
          </p>
        </Panel>

        {/* Coverage */}
        <Panel className="mt-6 p-7">
          <Eyebrow className="mb-4">Coverage today</Eyebrow>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="tnum display text-3xl text-bone-50">{coverage.total}</p>
              <p className="mt-1 text-sm text-bone-500">countries modelled</p>
            </div>
            <div>
              <p className="tnum display text-3xl text-caution">{coverage.partial}</p>
              <p className="mt-1 text-sm text-bone-500">with a licensable data source</p>
            </div>
            <div>
              <p className="tnum display text-3xl text-bone-300">{coverage.manual}</p>
              <p className="mt-1 text-sm text-bone-500">document-led verification</p>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-xs leading-relaxed text-bone-600">
            Nothing is marked automated, because we hold no registry licences yet. We&apos;d rather
            you integrate against an accurate picture of what we can do than a flattering one.
          </p>
        </Panel>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button href={`mailto:${brand.supportEmail}`}>Talk to us</Button>
          <Button href="/admin/coverage" variant="secondary">Inspect the verification network</Button>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

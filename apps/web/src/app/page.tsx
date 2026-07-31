import Link from "next/link";
import { brand } from "@legacy/core";
import { coverageSummary } from "@legacy/death-verification";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AllocationRing, CoverageMap } from "@/components/dataviz";
import { Badge, Button, Dot, Eyebrow, Panel, Rule, SectionHeading, formatUsd } from "@/components/ui";
import { demoAllocations, demoBeneficiaries, getBitcoinPolicy, getPortfolioValue } from "@/lib/demo";

export default function LandingPage() {
  const coverage = coverageSummary();
  const policy = getBitcoinPolicy();

  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Problem />
        <Solution />
        <HowItWorks />
        <NeverTrustUs policy={policy} />
        <Continuity />
        <YourLegacy />
        <Global coverage={coverage} />
        <Security />
        <Institutional />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}

function Hero() {
  return (
    <section className="vignette relative overflow-hidden border-b hairline">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-20 sm:px-8 sm:pb-32 sm:pt-28">
        <div className="animate-rise">
          <Badge tone="brass" className="mb-8">
            <Dot tone="brass" />
            {brand.tagline}
          </Badge>
        </div>

        <h1 className="display animate-rise max-w-4xl text-[2.5rem] leading-[1.05] text-bone-50 sm:text-6xl lg:text-7xl" style={{ animationDelay: "0.05s" }}>
          Your wealth doesn&apos;t disappear when you do.
        </h1>

        <p className="animate-rise mt-8 max-w-2xl text-lg leading-relaxed text-bone-300 sm:text-xl" style={{ animationDelay: "0.12s" }}>
          {brand.subheadline}
        </p>

        <div className="animate-rise mt-10 flex flex-wrap items-center gap-4" style={{ animationDelay: "0.18s" }}>
          <Button href="/onboarding" className="px-7 py-3 text-[0.9375rem]">
            Protect my legacy
          </Button>
          <Button href="/#how" variant="secondary" className="px-7 py-3 text-[0.9375rem]">
            See how it works
          </Button>
        </div>

        <div className="animate-rise mt-16 grid max-w-3xl gap-px overflow-hidden rounded-xl border hairline bg-ink-700 sm:grid-cols-3" style={{ animationDelay: "0.24s" }}>
          {[
            ["Non-custodial", "We never hold enough to move your assets"],
            ["Survives us", "Your plan works if we cease to exist"],
            ["Verified, not assumed", "Death is corroborated, never taken on trust"],
          ].map(([title, sub]) => (
            <div key={title} className="bg-ink-900 px-5 py-5">
              <p className="text-sm font-medium text-bone-100">{title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-bone-500">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section id="problem" className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
      <SectionHeading
        eyebrow="The problem"
        title="Self-custody has no beneficiary field."
        lead="A bank account has one. A pension has one. A life policy has one. A hardware wallet in a drawer has nothing — and no institution to write to, no statement in the post, and no customer-service line that can help."
      />

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {[
          {
            title: "Access is all or nothing",
            body: "There is no partial recovery and no appeal. Either your family can reconstruct the keys, or the assets are gone permanently. Nobody can override that — including us.",
          },
          {
            title: "Heirs often don't know it exists",
            body: "Crypto leaves no paper trail for an executor to follow. Assets that nobody knows to look for are indistinguishable from assets that were never there.",
          },
          {
            title: "The estimates only tell us it's large",
            body: "Published analyses put permanently lost Bitcoin somewhere between roughly 1.8 and 3.8 million BTC, depending on method. Nobody credibly separates key loss from death — and anyone quoting a precise figure for death alone is guessing.",
          },
        ].map((item) => (
          <Panel key={item.title} className="p-7">
            <h3 className="display text-xl text-bone-50">{item.title}</h3>
            <p className="mt-4 text-sm leading-relaxed text-bone-400">{item.body}</p>
          </Panel>
        ))}
      </div>
    </section>
  );
}

function Solution() {
  return (
    <section className="border-y hairline bg-ink-900/50">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <SectionHeading
          eyebrow="The solution"
          title="A spending policy, a verification layer, and a plan that outlives us."
          lead="Not a wallet. Not a will. The connective tissue between what you hold, who should receive it, and the proof that the moment has come."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <Panel className="p-8">
            <Eyebrow className="mb-5">What we build</Eyebrow>
            <ul className="space-y-4">
              {[
                ["Cryptographic succession", "Spending policies on Bitcoin and EVM chains that enforce your wishes without anyone's permission."],
                ["Life-event verification", "Evidence gathered from independent sources, scored honestly, and signed so anyone can check it."],
                ["A mandatory waiting period", "Nothing irreversible happens quickly. You can stop it with one authenticated action."],
                ["A plan your family can actually use", "Your beneficiaries never need to understand any of this."],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-1.5 shrink-0"><Dot tone="brass" /></span>
                  <div>
                    <p className="text-sm font-medium text-bone-100">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-bone-500">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel className="p-8">
            <Eyebrow className="mb-5">What we refuse to build</Eyebrow>
            <ul className="space-y-4">
              {[
                ["Custody of your assets", "If we held enough to pay your heirs, we'd hold enough to lose your coins."],
                ["A switch we can flip", "No administrator, however senior, can declare you dead or release your assets."],
                ["Automation we can't honour", "Bitcoin can't pay a monthly allowance without someone holding the coins. We say so rather than pretending."],
                ["Your seed phrase, anywhere", "We never generate, receive or store private key material. Not even in this demo."],
              ].map(([title, body]) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-1.5 shrink-0 text-bone-600" aria-hidden>&times;</span>
                  <div>
                    <p className="text-sm font-medium text-bone-100">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-bone-500">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ["Secure your assets", "Register the wallets you want covered and prove you control them by signing a challenge. We never see a key."],
    ["Choose your beneficiaries", "Name who inherits and in what proportion. Allocations are exact — down to the last satoshi."],
    ["Define your wishes", "Choose how and when. Every rule tells you plainly whether it's enforced by cryptography, by us, or by your executor."],
    ["Verify your identity", "So your beneficiaries can be matched to you when it matters, and nobody else can claim to be you."],
    ["We watch for the signals you configure", "Inactivity thresholds, trusted contacts, and the verification sources available in your country."],
    ["Your plan executes", "After verification, a cooling-off period, and your chance to stop it — assets pass directly to your beneficiaries."],
  ];

  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
      <SectionHeading eyebrow="How it works" title="Six steps. Then it waits, quietly, for as long as it needs to." />

      <ol className="mt-14 grid gap-px overflow-hidden rounded-xl border hairline bg-ink-700 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map(([title, body], i) => (
          <li key={title} className="bg-ink-900 p-7">
            <span className="tnum display text-3xl text-brass-500/70">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="mt-4 text-base font-medium text-bone-50">{title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-bone-500">{body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function NeverTrustUs({ policy }: { policy: ReturnType<typeof getBitcoinPolicy> }) {
  return (
    <section id="trust" className="border-y hairline bg-ink-900/50">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <SectionHeading
          eyebrow="Never trust us"
          title={brand.trustPrinciple}
          lead={brand.trustPrincipleExplainer}
        />

        <div className="mt-6 max-w-3xl rounded-lg border-l-2 border-brass-500/50 bg-ink-850/60 px-5 py-4">
          <p className="text-sm leading-relaxed text-bone-400">
            <span className="font-medium text-bone-200">We won&apos;t say &ldquo;trustless&rdquo;.</span>{" "}
            It wouldn&apos;t be true, and you deserve the precise claim instead: we are never a{" "}
            <em className="text-bone-200 not-italic">sufficient</em> party to move your assets, and never a{" "}
            <em className="text-bone-200 not-italic">necessary</em> one either.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <Panel className="p-8">
            <Eyebrow className="mb-6">Your Bitcoin spending paths</Eyebrow>
            <ul className="space-y-5">
              {policy.spendingPaths.map((path) => (
                <li key={path.name} className="panel-inset p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-bone-100">{path.name}</p>
                    {path.delayDays > 0 ? (
                      <Badge tone="caution">After {Math.round(path.delayDays)} days</Badge>
                    ) : (
                      <Badge tone="verified">Immediate</Badge>
                    )}
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-bone-500">{path.description}</p>
                  <p className="mt-3 font-mono text-xs text-bone-600">requires: {path.requires.join(", ")}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="space-y-6">
            <Panel className="p-8">
              <Eyebrow className="mb-5">What this means in practice</Eyebrow>
              <dl className="space-y-4 text-sm">
                {[
                  ["Can we spend your Bitcoin alone?", "No. No path is satisfied by our key.", "verified"],
                  ["Can we freeze your assets?", "No. We aren't in possession of them.", "verified"],
                  ["Can we change who inherits?", "No. That write path doesn't exist in our systems.", "verified"],
                  ["Can we declare you dead?", "No. Our staff record evidence; the engine scores it, and you can override it.", "verified"],
                  ["If we vanish, do your heirs still inherit?", "Yes — the timelocked path needs nothing from us.", "verified"],
                ].map(([q, a]) => (
                  <div key={q} className="border-b hairline pb-4 last:border-0 last:pb-0">
                    <dt className="text-bone-300">{q}</dt>
                    <dd className="mt-1 flex items-start gap-2 text-bone-500">
                      <span className="mt-1.5 shrink-0"><Dot tone="verified" /></span>
                      <span>{a}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel className="p-8">
              <Eyebrow className="mb-4">The honest caveat</Eyebrow>
              <p className="text-sm leading-relaxed text-bone-400">
                Some things genuinely can&apos;t be enforced by cryptography — an allowance paid
                monthly, or a share released at 25. Automating those would mean holding your assets,
                which we won&apos;t do. So we record them as instructions for your executor, and we
                label them that way everywhere they appear. You&apos;ll always know which parts of
                your plan run on mathematics and which run on people.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}

function Continuity() {
  return (
    <section id="continuity" className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <SectionHeading
            eyebrow="If we disappear"
            title="We can cease to exist. Your legacy shouldn't."
            lead="Most inheritance products quietly depend on the provider still being there. We treat that as the failure we're most likely to cause — and we design it out."
          />
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-bone-500">
            Every plan produces a {brand.continuityPackName}: your output descriptors, contract
            addresses, public keys, a standalone verifier, and plain-language recovery instructions
            your family can hand to any competent engineer. Your {brand.scoreName} score will not
            reach green until you&apos;ve downloaded it.
          </p>
          <div className="mt-8">
            <Button href="/app/continuity" variant="secondary">
              See what&apos;s in the pack
            </Button>
          </div>
        </div>

        <Panel className="p-8">
          <Eyebrow className="mb-6">Continuity Pack contents</Eyebrow>
          <ul className="space-y-3.5">
            {[
              ["Output descriptors", "The full Bitcoin spending policy, importable into any compatible wallet."],
              ["Contract addresses and ABIs", "For any EVM assets, with the source published."],
              ["Attestation public keys", "So past attestations remain verifiable forever."],
              ["Standalone verifier", "About forty lines. No network, no platform, no dependency on us."],
              ["Recovery instructions", "Written for a person, not a developer."],
              ["Executor letter", "Designed to be attached to your will."],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-3.5 border-b hairline pb-3.5 last:border-0 last:pb-0">
                <span className="mt-1.5 shrink-0"><Dot tone="brass" /></span>
                <div>
                  <p className="text-sm text-bone-100">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-bone-500">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </section>
  );
}

function YourLegacy() {
  const value = getPortfolioValue();
  const segments = demoAllocations.map((a) => ({
    label: demoBeneficiaries.find((b) => b.id === a.beneficiaryId)?.fullName ?? a.beneficiaryId,
    basisPoints: a.basisPoints,
  }));

  return (
    <section className="border-y hairline bg-ink-900/50">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <SectionHeading
          eyebrow="Your legacy"
          title="Exact amounts. Named people. No ambiguity."
          lead="Allocations are computed in whole satoshis and wei, so the parts always sum to the whole. Not approximately — exactly."
        />

        <Panel className="mt-14 overflow-hidden">
          <div className="grid gap-10 p-8 sm:p-10 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="flex justify-center">
              <AllocationRing segments={segments} size={220} centerLabel="100%" centerSub="allocated" />
            </div>

            <div>
              <p className="eyebrow mb-1">Estimated protected wealth</p>
              <p className="tnum display text-4xl text-bone-50 sm:text-5xl">{formatUsd(value)}</p>
              <p className="mt-2 text-xs text-bone-600">
                Indicative only, from a pinned price snapshot. Never used to make a decision.
              </p>

              <Rule className="my-7" />

              <ul className="space-y-3.5">
                {demoAllocations.map((a, i) => {
                  const b = demoBeneficiaries.find((x) => x.id === a.beneficiaryId)!;
                  return (
                    <li key={a.beneficiaryId} className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-3">
                        <span
                          className="size-2.5 rounded-full"
                          style={{
                            background: ["var(--color-brass-400)", "var(--color-brass-300)", "var(--color-brass-500)"][i % 3],
                          }}
                          aria-hidden
                        />
                        <span className="text-sm text-bone-100">{b.fullName}</span>
                        <span className="text-xs text-bone-600">{b.relationship}</span>
                      </span>
                      <span className="tnum text-sm text-bone-300">{a.basisPoints / 100}%</span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-8">
                <Button href="/app/simulator" variant="secondary">
                  Simulate my succession
                </Button>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Global({ coverage }: { coverage: ReturnType<typeof coverageSummary> }) {
  return (
    <section id="global" className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
      <SectionHeading
        eyebrow="Global"
        title="Most of the world has no death API. We built for that reality."
        lead="Where an official data feed exists, it is typically a licensed weekly batch file with a lag of days — not a real-time query. Everywhere else, verification is document-led and reviewed by people. Our architecture treats manual verification as the primary path, not the exception."
      />

      <Panel className="mt-12 p-8">
        <CoverageMap />
      </Panel>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          [String(coverage.total), "Countries modelled"],
          [String(coverage.partial), "With a licensable data source"],
          [String(coverage.manual), "Document-led verification"],
        ].map(([value, label]) => (
          <div key={label} className="panel-inset px-5 py-4">
            <p className="tnum display text-2xl text-bone-50">{value}</p>
            <p className="mt-1 text-xs text-bone-500">{label}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-bone-600">
        We hold no registry licences today, so no country is shown as fully automated. Obtaining
        them — NTIS certification in the United States, a GRO licence in the United Kingdom — is a
        deliberate, costly, multi-quarter process, and we&apos;d rather show you an honest map than
        a green one.
      </p>
    </section>
  );
}

function Security() {
  return (
    <section className="border-y hairline bg-ink-900/50">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <SectionHeading
          eyebrow="Security"
          title="The attack we defend against isn't theft. It's a lie about your death."
          lead="Everything valuable in this system flows from one question: has this person actually died? So that question gets the delay, the corroboration and the veto."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            ["Your veto beats everything", "One authenticated action resets any claim — from any stage, at any confidence level. A living person outranks a government database, because databases contain errors."],
            ["Delay is a feature", "A mandatory cooling-off period of at least 30 days. It can be extended by our risk team; it can never be shortened, by anyone, including you, once a claim is open."],
            ["Two sources, genuinely independent", "A death certificate and a registry entry come from the same registration event. We refuse to count them as corroborating each other."],
            ["No single administrator", "Two distinct approvers are required to reach an executable state — and even then, neither can move your assets."],
            ["Attestations are published", "Every signed statement enters a public hash chain before it's actionable, so a forgery is visible to you before it's usable."],
            ["Changes take 72 hours", "Beneficiary and address changes sit in a pending window, notified everywhere. An attacker with an hour of access can't redirect your estate."],
          ].map(([title, body]) => (
            <Panel key={title} className="p-7">
              <h3 className="text-base font-medium text-bone-50">{title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-bone-500">{body}</p>
            </Panel>
          ))}
        </div>

        <div className="mt-10">
          <Button href="/security" variant="secondary">Read the security model</Button>
        </div>
      </div>
    </section>
  );
}

function Institutional() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
      <div className="grid gap-14 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Institutional"
            title="Succession as infrastructure."
            lead="Exchanges, wallets, banks and wealth managers all face the same problem at scale: a customer dies, and nobody can prove it to a standard that justifies moving money."
          />
          <p className="mt-6 max-w-xl text-sm leading-relaxed text-bone-500">
            The Legacy API provides verified, signed life-event attestations for consented subjects
            — never bulk data. Licensed registry feeds prohibit onward disclosure, so we sell the
            attestation, not the record. That constraint is baked into the API surface: there is no
            bulk endpoint, and there never will be.
          </p>
          <div className="mt-8">
            <Button href="/institutional" variant="secondary">Explore the API</Button>
          </div>
        </div>

        <Panel className="overflow-hidden">
          <div className="border-b hairline px-6 py-3.5">
            <p className="font-mono text-xs text-bone-500">POST /api/v1/institutional/subjects/&#123;id&#125;/attestation</p>
          </div>
          <pre className="overflow-x-auto px-6 py-5 font-mono text-xs leading-relaxed text-bone-400">
{`{
  "schema": "legacy.attestation.death.v1",
  "subjectId": "sub_8f2a…",
  "confidenceLevel": 6,
  "sourceClasses": ["CIVIL_REGISTRY", "MEDICAL"],
  "assertedAt": "2026-07-22T14:30:00Z",
  "validUntil": "2027-07-22T14:30:00Z",
  "statement": "…evidence only and confers no
     authority to move assets.",
  "signatures": [
    { "keyId": "att_platform_01", "class": "PLATFORM" },
    { "keyId": "att_notary_14",   "class": "JUDICIAL" }
  ],
  "transparencyLog": { "index": 40912, "actionableAt": "…" }
}`}
          </pre>
        </Panel>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="border-t hairline">
      <div className="vignette">
        <div className="mx-auto max-w-4xl px-5 py-28 text-center sm:px-8 sm:py-36">
          <h2 className="display text-4xl leading-[1.08] text-bone-50 sm:text-5xl">
            Build wealth. Protect it. Pass it on.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-bone-400">
            It takes about four minutes to set up a plan. It takes one authenticated action, any
            time, to stop one.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button href="/onboarding" className="px-7 py-3 text-[0.9375rem]">Protect my legacy</Button>
            <Button href="/app" variant="secondary" className="px-7 py-3 text-[0.9375rem]">
              Explore the demo
            </Button>
          </div>
          <p className="mt-8 text-xs text-bone-600">
            Demonstration environment. <Link href="/#trust" className="underline decoration-bone-600 underline-offset-4 hover:text-bone-400">No real funds</Link> are held or moved.
          </p>
        </div>
      </div>
    </section>
  );
}

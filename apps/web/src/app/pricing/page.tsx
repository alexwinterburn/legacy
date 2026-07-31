import { PRICING_TIERS, brand } from "@legacy/core";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Badge, Button, Dot, Eyebrow, Panel, SectionHeading } from "@/components/ui";

export default function PricingPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="Priced so the safety features are never the upsell."
          lead="The Continuity Pack — the thing that makes your plan work if we cease to exist — is in the free tier. Charging for protection against our own failure would be indefensible."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PRICING_TIERS.slice(0, 3).map((tier) => (
            <Panel
              key={tier.id}
              className={`flex flex-col p-7 ${tier.highlighted ? "border-brass-500/40" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="display text-xl text-bone-50">{tier.name}</h3>
                {tier.highlighted ? <Badge tone="brass">Most chosen</Badge> : null}
              </div>

              <p className="tnum display mt-5 text-3xl text-bone-50">
                {tier.annualUsd === 0 ? "Free" : `$${tier.annualUsd}`}
                {tier.annualUsd ? <span className="text-base text-bone-500">/year</span> : null}
              </p>

              <p className="mt-3 text-sm leading-relaxed text-bone-400">{tier.tagline}</p>

              <ul className="mt-7 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm text-bone-300">
                    <span className="mt-1.5 shrink-0"><Dot tone={f.includes("Continuity") ? "brass" : "neutral"} /></span>
                    {f}
                  </li>
                ))}
              </ul>

              <Button
                href="/onboarding"
                variant={tier.highlighted ? "primary" : "secondary"}
                className="mt-8 w-full"
              >
                {tier.annualUsd === 0 ? "Start free" : `Choose ${tier.name}`}
              </Button>
            </Panel>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {PRICING_TIERS.slice(3).map((tier) => (
            <Panel key={tier.id} className="p-7">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <h3 className="display text-xl text-bone-50">{tier.name}</h3>
                <p className="tnum text-lg text-bone-200">
                  {tier.annualUsd === null ? "Custom" : `From $${tier.annualUsd.toLocaleString()}/year`}
                </p>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-bone-400">{tier.tagline}</p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm text-bone-400">
                    <span className="mt-1.5 shrink-0"><Dot tone="neutral" /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <Button href={tier.id === "institutional" ? "/institutional" : "/onboarding"} variant="secondary" className="mt-7">
                {tier.id === "institutional" ? "Explore the API" : "Talk to us"}
              </Button>
            </Panel>
          ))}
        </div>

        <Panel className="mt-10 p-7">
          <Eyebrow className="mb-4">How we think about pricing</Eyebrow>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ["Safety is never a paid tier", `The ${brand.continuityPackName}, your executor letter, and your ability to stop a claim are free on every plan. Those are the mechanisms that protect you from us.`],
              ["Prices are configuration, not code", "Tiers live in a single data file so they can change without an engineering release. The figures shown here are indicative."],
              ["No fee to inherit", "Beneficiaries never pay to receive what's been left to them. Charging a grieving family to access their inheritance would be grotesque."],
            ].map(([title, body]) => (
              <div key={title}>
                <p className="text-sm font-medium text-bone-100">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-bone-500">{body}</p>
              </div>
            ))}
          </div>
        </Panel>
      </main>
      <SiteFooter />
    </>
  );
}

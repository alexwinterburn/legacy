import { fraudAlerts } from "@legacy/demo-data";
import { Badge, Button, Dot, Eyebrow, Panel, Rule, formatDateTime } from "@/components/ui";
import { getFraudHostileScenario } from "@/lib/demo";

export default function FraudPage() {
  const scenario = getFraudHostileScenario();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl text-bone-50">Fraud monitoring</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-bone-400">
          The primary attack on a succession platform isn&apos;t theft of keys — it&apos;s a lie
          about someone&apos;s death, usually paired with a quiet change to who inherits. That
          correlation is the highest-signal pattern we track.
        </p>
      </div>

      {/* Live scored scenario */}
      <Panel className="border-alert/30 bg-alert/[0.03] p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <Eyebrow className="mb-3">Worked example — scored by the live engine</Eyebrow>
            <h2 className="display text-xl text-bone-50">
              Beneficiaries rewritten, then a death claim 18 hours later
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bone-400">
              100% of the estate reallocated to a single newly added party, MFA removed, and an
              attempt to shorten the cooling-off period — followed by a claim from someone not named
              in the plan.
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow mb-1">Score</p>
            <p className="tnum display text-4xl text-alert">{scenario.score}</p>
            <Badge tone="alert" className="mt-2">{scenario.severity}</Badge>
          </div>
        </div>

        <Rule className="my-6" />

        <Eyebrow className="mb-4">Contributing rules</Eyebrow>
        <ul className="space-y-3">
          {scenario.findings.map((f) => (
            <li key={f.ruleId} className="panel-inset p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-bone-100">{f.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-bone-500">{f.explanation}</p>
                  <p className="mt-1.5 font-mono text-[0.6875rem] text-bone-600">{f.ruleId}</p>
                </div>
                <span className="flex shrink-0 items-center gap-3">
                  <Badge tone={f.severity === "CRITICAL" ? "alert" : f.severity === "HIGH" ? "alert" : "caution"}>
                    {f.severity.toLowerCase()}
                  </Badge>
                  <span className="tnum text-sm text-bone-300">+{f.score}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-lg border-l-2 border-alert/40 bg-alert/[0.05] px-5 py-4">
          <p className="eyebrow mb-1.5">Recommendation</p>
          <p className="text-sm leading-relaxed text-bone-300">{scenario.recommendation}</p>
          <p className="mt-2 text-xs text-bone-500">
            Recommended cooling-off extension: {scenario.recommendedCoolingOffExtensionDays} days.
          </p>
        </div>

        <p className="mt-5 max-w-3xl text-xs leading-relaxed text-bone-600">
          Note what a high score does and doesn&apos;t do. It extends delays and forces human
          review. It never releases anything, and it never prevents a living account holder from
          proving they&apos;re alive — that path stays open at every score.
        </p>
      </Panel>

      {/* Alert queue */}
      <Panel className="overflow-hidden">
        <div className="px-7 py-5">
          <Eyebrow>Alert queue</Eyebrow>
        </div>
        <div className="border-t hairline">
          {fraudAlerts.map((a) => (
            <div key={a.id} className="border-b hairline p-7 last:border-0">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-xs text-brass-400">{a.id}</span>
                    <h3 className="text-base text-bone-50">{a.title}</h3>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bone-400">{a.detail}</p>
                  <p className="mt-2.5 text-xs text-bone-600">
                    {a.userName} · raised {formatDateTime(a.raisedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={a.state === "OPEN" ? "alert" : a.state === "REVIEWING" ? "caution" : "neutral"}>
                    <Dot tone={a.state === "OPEN" ? "alert" : a.state === "REVIEWING" ? "caution" : "neutral"} />
                    {a.state.toLowerCase()}
                  </Badge>
                  <span className="tnum text-sm text-bone-300">{a.score}</span>
                </div>
              </div>

              {a.state !== "CLOSED" ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button variant="secondary">Review</Button>
                  <Button variant="ghost">Extend cooling-off</Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-7">
        <Eyebrow className="mb-3">Rules in the engine</Eyebrow>
        <ul className="grid gap-x-10 gap-y-2 text-sm text-bone-400 sm:grid-cols-2">
          {[
            "R1 — beneficiary change shortly before a claim (time-decayed)",
            "R2 — payout address change shortly before a claim",
            "R3 — estate concentrated onto a single new party",
            "R4 — majority of the estate reallocated at once",
            "R5 — repeated claims against the same subject",
            "R6 — claim from someone not named in the plan",
            "R7 — claimant identity unverified",
            "R8 — account takeover indicators",
            "R9 — geographic anomalies",
            "R10 — attempt to shorten the cooling-off period",
          ].map((r) => (
            <li key={r} className="flex gap-2.5">
              <span className="mt-1.5 shrink-0"><Dot tone="neutral" /></span>
              {r}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

// Reads mutable store state, so it must not be statically prerendered.
export const dynamic = "force-dynamic";

import { adminDeathEvents } from "@legacy/demo-data";
import { CONFIDENCE_LEVEL_META } from "@legacy/death-verification";
import { Badge, Button, Dot, Eyebrow, Panel, Rule, formatDateTime } from "@/components/ui";

export default function DeathEventsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl text-bone-50">Death events</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-bone-400">
          Evidence is recorded here; confidence is computed by the engine. No role in this console
          can set a confidence level, declare a death, or release assets.
        </p>
      </div>

      <div className="space-y-6">
        {adminDeathEvents.map((e) => (
          <Panel key={e.id} id={e.id} className="scroll-mt-24 p-7">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-brass-400">{e.id}</span>
                  <h2 className="display text-xl text-bone-50">{e.userName}</h2>
                  <Badge tone="neutral">{e.country}</Badge>
                </div>
                <p className="mt-2 text-xs text-bone-600">Claim opened {formatDateTime(e.claimDate)}</p>
              </div>
              <Badge tone={e.state === "FRAUD_HOLD" ? "alert" : e.state === "EXECUTABLE" ? "caution" : "neutral"}>
                {e.state.replace(/_/g, " ").toLowerCase()}
              </Badge>
            </div>

            <Rule className="my-6" />

            {/* Key metrics */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="eyebrow mb-1.5">Confidence</p>
                <p className="tnum text-lg text-bone-50">Level {e.confidenceLevel}</p>
                <p className="text-xs text-bone-600">{CONFIDENCE_LEVEL_META[e.confidenceLevel].label}</p>
              </div>
              <div>
                <p className="eyebrow mb-1.5">Risk score</p>
                <p className={`tnum text-lg ${e.fraudScore >= 60 ? "text-alert" : e.fraudScore >= 25 ? "text-caution" : "text-verified"}`}>
                  {e.fraudScore}
                </p>
                <p className="text-xs text-bone-600">{e.fraudScore >= 60 ? "Above hold threshold" : "Below threshold"}</p>
              </div>
              <div>
                <p className="eyebrow mb-1.5">Cooling-off ends</p>
                <p className="tnum text-lg text-bone-50">
                  {e.coolingOffEndsAt ? formatDateTime(e.coolingOffEndsAt).split(",")[0] : "Not started"}
                </p>
                <p className="text-xs text-bone-600">Extendable only</p>
              </div>
              <div>
                <p className="eyebrow mb-1.5">Approvals</p>
                <p className="tnum text-lg text-bone-50">{e.approvals.length} of 2</p>
                <p className="text-xs text-bone-600">
                  {e.approvals.length >= 2 ? "Quorum met" : "Second approver required"}
                </p>
              </div>
            </div>

            {/* Evidence */}
            <div className="mt-7">
              <Eyebrow className="mb-3">Evidence</Eyebrow>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b hairline text-left">
                      {["Source", "Independence class", "Outcome", "Recorded"].map((h) => (
                        <th key={h} className="eyebrow py-2.5 pr-6 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {e.sources.map((s, i) => (
                      <tr key={i} className="border-b hairline last:border-0">
                        <td className="py-3 pr-6 text-bone-100">{s.type}</td>
                        <td className="py-3 pr-6">
                          <Badge tone="neutral">{s.class.replace(/_/g, " ").toLowerCase()}</Badge>
                        </td>
                        <td className="py-3 pr-6">
                          <span className={s.outcome === "CONFIRMS" ? "text-caution" : "text-verified"}>
                            {s.outcome.toLowerCase()}
                          </span>
                        </td>
                        <td className="tnum py-3 pr-6 text-xs text-bone-500">{formatDateTime(s.at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(() => {
                const classes = new Set(e.sources.filter((s) => s.outcome === "CONFIRMS").map((s) => s.class));
                return (
                  <p className="mt-3 text-xs leading-relaxed text-bone-600">
                    {classes.size >= 2
                      ? `${classes.size} independent source classes — level 6 is reachable.`
                      : "All confirming evidence is from a single independence class, so level 6 is withheld regardless of how strong each piece is."}
                  </p>
                );
              })()}
            </div>

            {/* Beneficiaries */}
            <div className="mt-7">
              <Eyebrow className="mb-3">Beneficiaries</Eyebrow>
              <ul className="space-y-2">
                {e.beneficiaries.map((b) => (
                  <li key={b.name} className="panel-inset flex flex-wrap items-center justify-between gap-3 p-3.5">
                    <span className="flex items-center gap-2.5 text-sm text-bone-100">
                      <Dot tone={b.verified ? "verified" : "caution"} />
                      {b.name}
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="tnum text-sm text-bone-300">{b.share}</span>
                      <Badge tone={b.verified ? "verified" : "caution"}>
                        {b.verified ? "Verified" : "Unverified"}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Note */}
            <div className="mt-7 rounded-lg border-l-2 border-ink-600 bg-ink-950/50 px-5 py-4">
              <p className="eyebrow mb-1.5">Reviewer note</p>
              <p className="text-sm leading-relaxed text-bone-400">{e.note}</p>
            </div>

            {/* Actions — deliberately limited */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="secondary">Record evidence</Button>
              <Button variant="secondary">Extend cooling-off</Button>
              <Button variant="ghost">Record my approval</Button>
            </div>
            <p className="mt-3 text-xs text-bone-600">
              There is no action here that shortens a delay, alters a plan, or releases assets — not
              for any role, including the most privileged.
            </p>
          </Panel>
        ))}
      </div>
    </div>
  );
}

// Reads mutable store state, so it must not be statically prerendered.
export const dynamic = "force-dynamic";

import Link from "next/link";
import { adminDeathEvents, fraudAlerts, platformMetrics } from "@legacy/demo-data";
import { coverageSummary } from "@legacy/death-verification";
import { CoverageMap } from "@/components/dataviz";
import { Badge, Dot, Eyebrow, Panel, Stat, formatDate, formatUsd } from "@/components/ui";

export default function AdminOverview() {
  const coverage = coverageSummary();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="display text-3xl text-bone-50">Platform</h1>
        <p className="mt-2 text-sm text-bone-500">Demonstration data.</p>
      </div>

      {/* Metrics */}
      <Panel className="p-7">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Users" value={platformMetrics.users.toLocaleString()} />
          <Stat label="Active plans" value={platformMetrics.activePlans.toLocaleString()} />
          <Stat
            label="Assets under plan"
            value={formatUsd(platformMetrics.assetsProtectedUsd, { compact: true })}
            sub="Indicative. Never held by us."
          />
          <Stat label="Countries covered" value={String(platformMetrics.countriesCovered)} />
        </div>

        <div className="mt-8 grid gap-8 border-t hairline pt-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Death events (all time)" value={String(platformMetrics.deathEventsAllTime)} />
          <Stat label="Pending claims" value={String(platformMetrics.pendingClaims)} tone="brass" />
          <Stat label="Open fraud alerts" value={String(platformMetrics.openFraudAlerts)} tone="alert" />
          <Stat
            label="False claims rejected"
            value={String(platformMetrics.falseClaimsRejected)}
            tone="verified"
            sub="The metric that matters most"
          />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Death event queue */}
        <Panel className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-7 py-5">
            <Eyebrow>Death events</Eyebrow>
            <Link href="/admin/death-events" className="text-xs text-bone-500 transition-colors hover:text-bone-200">
              All events &rarr;
            </Link>
          </div>
          <div className="overflow-x-auto border-t hairline">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b hairline text-left">
                  {["Event", "Subject", "Country", "Confidence", "Risk", "State"].map((h) => (
                    <th key={h} className="eyebrow px-6 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adminDeathEvents.map((e) => (
                  <tr key={e.id} className="border-b hairline last:border-0">
                    <td className="px-6 py-4">
                      <Link href={`/admin/death-events#${e.id}`} className="font-mono text-xs text-brass-400 hover:text-brass-300">
                        {e.id}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-bone-100">{e.userName}</td>
                    <td className="px-6 py-4 text-bone-400">{e.country}</td>
                    <td className="px-6 py-4">
                      <span className="tnum text-bone-200">L{e.confidenceLevel}</span>
                      <span className="tnum ml-2 text-xs text-bone-600">{e.confidenceScore}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`tnum ${e.fraudScore >= 60 ? "text-alert" : e.fraudScore >= 25 ? "text-caution" : "text-bone-400"}`}>
                        {e.fraudScore}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={stateTone(e.state)}>{e.state.replace(/_/g, " ").toLowerCase()}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Fraud */}
        <Panel className="p-7">
          <div className="mb-5 flex items-center justify-between">
            <Eyebrow>Fraud alerts</Eyebrow>
            <Link href="/admin/fraud" className="text-xs text-bone-500 transition-colors hover:text-bone-200">
              All &rarr;
            </Link>
          </div>
          <ul className="space-y-4">
            {fraudAlerts.map((a) => (
              <li key={a.id} className="border-b hairline pb-4 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-bone-100">{a.title}</p>
                  <Badge tone={a.severity === "CRITICAL" ? "alert" : a.severity === "HIGH" ? "alert" : "caution"}>
                    {a.score}
                  </Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-bone-500">{a.detail}</p>
                <p className="mt-2 text-xs text-bone-600">
                  {a.userName} · {formatDate(a.raisedAt)}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* Coverage */}
      <Panel className="p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Eyebrow>Verification network</Eyebrow>
          <div className="flex flex-wrap gap-5 text-xs text-bone-500">
            <span className="inline-flex items-center gap-2"><Dot tone="verified" />{coverage.automated} automated</span>
            <span className="inline-flex items-center gap-2"><Dot tone="caution" />{coverage.partial} partial</span>
            <span className="inline-flex items-center gap-2"><Dot tone="neutral" />{coverage.manual} manual</span>
          </div>
        </div>
        <CoverageMap compact />
        <p className="mt-5 max-w-3xl text-xs leading-relaxed text-bone-600">
          No country shows as fully automated because we hold no registry licences. Marking a
          country green before the licence is in hand would misrepresent what we can actually do
          for a customer living there.
        </p>
      </Panel>
    </div>
  );
}

function stateTone(state: string): "verified" | "caution" | "alert" | "neutral" {
  if (state === "FRAUD_HOLD") return "alert";
  if (state === "EXECUTABLE") return "caution";
  if (state === "COOLING_OFF") return "caution";
  return "neutral";
}

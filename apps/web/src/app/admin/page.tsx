import Link from "next/link";
import { adminDeathEvents, fraudAlerts } from "@legacy/demo-data";
import { coverageSummary } from "@legacy/death-verification";
import { buildDunningQueue, computeRevenueMetrics, formatMoney, money } from "@legacy/billing";
import { CoverageMap } from "@/components/dataviz";
import { ActionForm } from "@/components/form";
import { Badge, Dot, Eyebrow, Panel, Rule, Stat, formatDate, formatDateTime } from "@/components/ui";
import { runBillingCycleAction } from "@/lib/actions";
import { getWorld } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function AdminOverview() {
  const world = getWorld();
  const now = new Date().toISOString();
  const coverage = coverageSummary();
  const metrics = computeRevenueMetrics({ subscriptions: world.subscriptions, invoices: world.invoices, now });
  const dunning = buildDunningQueue({ invoices: world.invoices, subscriptions: world.subscriptions, now });

  const totalProtected = world.users.reduce(
    (acc, u) => acc + u.assets.reduce((a, x) => a + (Number(x.amount) / 10 ** x.decimals) * x.indicativeUnitPriceUsd, 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-3xl text-bone-50">Platform</h1>
          <p className="mt-2 text-sm text-bone-500">
            Live figures from the operational store. {world.users.length} accounts.
          </p>
        </div>
        <ActionForm action={runBillingCycleAction} submitLabel="Run billing cycle" compact />
      </div>

      {/* Commercial */}
      <Panel className="p-7">
        <Eyebrow className="mb-6">Commercial</Eyebrow>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="MRR" value={formatMoney(money(metrics.mrrMinor))} sub="Normalised across intervals" />
          <Stat label="ARR" value={formatMoney(money(metrics.arrMinor))} tone="brass" />
          <Stat label="Paying subscribers" value={String(metrics.payingSubscribers)} tone="verified" />
          <Stat
            label="In collections"
            value={String(dunning.length)}
            tone={dunning.length > 0 ? "alert" : undefined}
            sub={dunning.length > 0 ? formatMoney(money(dunning.reduce((a, q) => a + q.amountMinor, 0n))) + " at risk" : "All settled"}
          />
        </div>

        <Rule className="my-8" />

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Trialing" value={String(metrics.trialingSubscribers)} />
          <Stat label="Free" value={String(metrics.freeUsers)} />
          <Stat label="Churn (30d)" value={`${metrics.churnRatePercent}%`} />
          <Stat label="Collected" value={formatMoney(money(metrics.collectedMinor))} tone="verified" />
        </div>

        <div className="mt-6 flex flex-wrap gap-4 text-xs">
          <Link href="/admin/subscriptions" className="text-brass-400 hover:text-brass-300">Subscriptions &rarr;</Link>
          <Link href="/admin/payments" className="text-brass-400 hover:text-brass-300">Payments &rarr;</Link>
          <Link href="/admin/dunning" className="text-brass-400 hover:text-brass-300">Dunning &rarr;</Link>
        </div>
        {world.lastBillingRunAt ? (
          <p className="mt-4 text-xs text-bone-600">Last billing cycle {formatDateTime(world.lastBillingRunAt)}.</p>
        ) : null}
      </Panel>

      {/* Protection */}
      <Panel className="p-7">
        <Eyebrow className="mb-6">Protection</Eyebrow>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Assets under plan"
            value={`$${(totalProtected / 1_000_000).toFixed(2)}M`}
            sub="Indicative. Never held by us."
          />
          <Stat label="Countries covered" value={String(coverage.total)} />
          <Stat label="Pending death claims" value={String(adminDeathEvents.filter((e) => e.state !== "EXECUTABLE").length)} tone="brass" />
          <Stat label="Open fraud alerts" value={String(fraudAlerts.filter((f) => f.state !== "CLOSED").length)} tone="alert" />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Death events */}
        <Panel className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-6 py-4">
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
                      <span className={e.fraudScore >= 60 ? "text-alert" : e.fraudScore >= 25 ? "text-caution" : "text-bone-400"}>
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

        {/* Staff activity */}
        <Panel className="p-7">
          <Eyebrow className="mb-5">Recent staff actions</Eyebrow>
          <p className="mb-5 text-xs leading-relaxed text-bone-600">
            Every entry also appears in the affected customer&apos;s own timeline.
          </p>
          <ul className="space-y-4">
            {world.adminAudit.slice(0, 6).map((a) => (
              <li key={a.id} className="border-b hairline pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-xs text-brass-400">{a.action}</span>
                  <span className="tnum text-xs text-bone-600">{formatDate(a.at)}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-bone-400">{a.detail}</p>
                <p className="mt-1 text-xs text-bone-600">
                  {a.actorId} · {a.actorRole}
                  {a.targetUserId ? (
                    <>
                      {" · "}
                      <Link href={`/admin/users/${a.targetUserId}`} className="hover:text-bone-400">
                        {world.users.find((u) => u.id === a.targetUserId)?.fullName ?? a.targetUserId}
                      </Link>
                    </>
                  ) : null}
                </p>
              </li>
            ))}
            {world.adminAudit.length === 0 ? (
              <li className="text-sm text-bone-500">No staff actions recorded.</li>
            ) : null}
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
  if (state === "EXECUTABLE" || state === "COOLING_OFF") return "caution";
  return "neutral";
}

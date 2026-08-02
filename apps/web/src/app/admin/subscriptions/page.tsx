import Link from "next/link";
import { tier } from "@legacy/core";
import {
  computeRevenueMetrics,
  estimatedLtvMinor,
  formatMoney,
  money,
  mrrMinor,
} from "@legacy/billing";
import { CompositionBar } from "@/components/dataviz";
import { Badge, Eyebrow, Panel, Rule, SectionHeading, Stat, formatDate } from "@/components/ui";
import { getWorld } from "@/lib/store";
import { SubscriptionBadge } from "../users/page";

export const dynamic = "force-dynamic";

export default function SubscriptionsPage() {
  const world = getWorld();
  const now = new Date().toISOString();
  const metrics = computeRevenueMetrics({
    subscriptions: world.subscriptions,
    invoices: world.invoices,
    now,
  });

  const palette = ["var(--color-brass-400)", "var(--color-brass-300)", "var(--color-brass-500)", "var(--color-bone-500)", "var(--color-brass-600)"];

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Subscriptions"
        title="The subscriber base"
        lead="Every figure is derived from the live subscription records — no stored aggregates that can drift out of agreement with their source."
      />

      {/* Headline metrics */}
      <Panel className="p-7">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="MRR" value={formatMoney(money(metrics.mrrMinor))} sub="Normalised across intervals" />
          <Stat label="ARR" value={formatMoney(money(metrics.arrMinor))} tone="brass" />
          <Stat label="ARPU" value={formatMoney(money(metrics.arpuMinor))} sub="Paying subscribers only" />
          <Stat
            label="Estimated LTV"
            value={formatMoney(money(estimatedLtvMinor(metrics)))}
            sub="ARPU ÷ churn — an estimate, not a forecast"
          />
        </div>

        <Rule className="my-8" />

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Paying" value={String(metrics.payingSubscribers)} tone="verified" />
          <Stat label="Trialing" value={String(metrics.trialingSubscribers)} />
          <Stat label="Free" value={String(metrics.freeUsers)} />
          <Stat label="Delinquent" value={String(metrics.delinquentSubscribers)} tone={metrics.delinquentSubscribers > 0 ? "alert" : undefined} />
        </div>

        <Rule className="my-8" />

        <div className="grid gap-8 sm:grid-cols-3">
          <Stat label="Churn (30d)" value={`${metrics.churnRatePercent}%`} />
          <Stat label="Trial conversion" value={`${metrics.trialConversionPercent}%`} />
          <Stat label="Collected" value={formatMoney(money(metrics.collectedMinor))} tone="verified" />
        </div>
      </Panel>

      {/* Revenue by tier */}
      <Panel className="p-7">
        <Eyebrow className="mb-5">Revenue by tier</Eyebrow>
        <CompositionBar
          segments={metrics.byTier
            .filter((t) => t.mrrMinor > 0n)
            .map((t, i) => ({
              label: tier(t.tierId).name,
              value: Number(t.mrrMinor),
              color: palette[i % palette.length]!,
            }))}
        />

        <div className="mt-7 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {["Tier", "Subscribers", "MRR", "Share of MRR"].map((h) => (
                  <th key={h} className="eyebrow py-3 pr-6 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.byTier.map((t) => (
                <tr key={t.tierId} className="border-b hairline last:border-0">
                  <td className="py-3 pr-6 text-bone-100">{tier(t.tierId).name}</td>
                  <td className="tnum py-3 pr-6 text-bone-300">{t.count}</td>
                  <td className="tnum py-3 pr-6 text-bone-300">{formatMoney(money(t.mrrMinor))}</td>
                  <td className="tnum py-3 pr-6 text-bone-500">
                    {metrics.mrrMinor > 0n ? `${((Number(t.mrrMinor) / Number(metrics.mrrMinor)) * 100).toFixed(0)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* All subscriptions */}
      <Panel className="overflow-hidden">
        <div className="px-6 py-4">
          <Eyebrow>All subscriptions</Eyebrow>
        </div>
        <div className="overflow-x-auto border-t hairline">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {["Customer", "Tier", "Status", "Interval", "MRR", "Credit", "Discount", "Renews", "Failed"].map((h) => (
                  <th key={h} className="eyebrow px-6 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {world.subscriptions.map((s) => {
                const user = world.users.find((u) => u.id === s.userId);
                return (
                  <tr key={s.id} className="border-b hairline transition-colors last:border-0 hover:bg-ink-800/40">
                    <td className="px-6 py-3.5">
                      <Link href={`/admin/users/${s.userId}`} className="text-bone-100 hover:text-brass-300">
                        {user?.fullName ?? s.userId}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge tone={s.tierId === "private_wealth" ? "brass" : "neutral"}>{tier(s.tierId).name}</Badge>
                    </td>
                    <td className="px-6 py-3.5"><SubscriptionBadge status={s.status} /></td>
                    <td className="px-6 py-3.5 text-xs text-bone-500">{s.interval.toLowerCase()}</td>
                    <td className="tnum px-6 py-3.5 text-bone-300">{formatMoney(money(mrrMinor(s), s.currency))}</td>
                    <td className="tnum px-6 py-3.5 text-bone-500">
                      {s.creditMinor > 0n ? formatMoney(money(s.creditMinor, s.currency)) : "—"}
                    </td>
                    <td className="tnum px-6 py-3.5 text-bone-500">{s.discountPercent ? `${s.discountPercent}%` : "—"}</td>
                    <td className="tnum px-6 py-3.5 text-xs text-bone-500">{formatDate(s.currentPeriodEnd)}</td>
                    <td className="tnum px-6 py-3.5">
                      <span className={s.failedAttempts > 0 ? "text-alert" : "text-bone-600"}>{s.failedAttempts}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-7">
        <Eyebrow className="mb-3">How these numbers are defined</Eyebrow>
        <ul className="space-y-2 text-sm leading-relaxed text-bone-400">
          <li><span className="text-bone-200">MRR</span> — annual prices divided by 12, monthly taken at face value. Trials, pauses and cancellations contribute nothing.</li>
          <li><span className="text-bone-200">ARPU</span> — MRR divided by paying subscribers. Free and trialing users are excluded, so it isn&apos;t diluted.</li>
          <li><span className="text-bone-200">Churn</span> — cancellations in the last 30 days over paying subscribers at the window start.</li>
          <li><span className="text-bone-200">LTV</span> — ARPU ÷ monthly churn. A rule of thumb, and it becomes meaningless at low subscriber counts.</li>
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-bone-600">
          A dashboard number nobody can define is worse than no number, so each of these is stated
          rather than left to interpretation.
        </p>
      </Panel>
    </div>
  );
}

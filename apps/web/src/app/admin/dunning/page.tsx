import Link from "next/link";
import {
  RETRY_SCHEDULE_DAYS,
  buildDunningQueue,
  declineExplanation,
  formatMoney,
  isRetryable,
  money,
} from "@legacy/billing";
import { ActionButton } from "@/components/form";
import { Badge, Dot, Eyebrow, Panel, Rule, SectionHeading, Stat } from "@/components/ui";
import { adminRetryPaymentAction } from "@/lib/actions";
import { getWorld } from "@/lib/store";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, { label: string; tone: "verified" | "caution" | "alert" | "neutral" }> = {
  RETRY_PAYMENT: { label: "Retry now", tone: "caution" },
  NOTIFY_CUSTOMER: { label: "Notify", tone: "neutral" },
  REQUEST_NEW_PAYMENT_METHOD: { label: "Needs new card", tone: "alert" },
  MARK_UNCOLLECTIBLE: { label: "Write off", tone: "alert" },
  DOWNGRADE_TO_FREE: { label: "Downgrade", tone: "alert" },
  NO_ACTION: { label: "No action", tone: "verified" },
};

export default function DunningPage() {
  const world = getWorld();
  const now = new Date().toISOString();
  const queue = buildDunningQueue({ invoices: world.invoices, subscriptions: world.subscriptions, now });

  const atRisk = queue.reduce((a, q) => a + q.amountMinor, 0n);
  const hardDeclines = queue.filter((q) => !isRetryable(q.lastDeclineCode));

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Dunning"
        title="Collections"
        lead="Automated recovery on failed payments. Two rules shape it: never retry a card that will decline every time, and never let collections touch the succession mechanism."
      />

      <Panel className="p-7">
        <div className="grid gap-8 sm:grid-cols-3">
          <Stat label="In collections" value={String(queue.length)} tone={queue.length > 0 ? "alert" : undefined} />
          <Stat label="Value at risk" value={formatMoney(money(atRisk))} />
          <Stat
            label="Needing a new card"
            value={String(hardDeclines.length)}
            sub="Hard declines — retrying achieves nothing"
          />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="px-6 py-4">
          <Eyebrow>Queue</Eyebrow>
          <p className="mt-2 text-sm text-bone-500">Ordered by how overdue each invoice is.</p>
        </div>
        <div className="overflow-x-auto border-t hairline">
          <table className="w-full min-w-[1000px] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {["Invoice", "Customer", "Amount", "Overdue", "Attempts", "Decline", "Next action", ""].map((h) => (
                  <th key={h} className="eyebrow px-6 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.map((q) => {
                const user = world.users.find((u) => u.id === q.userId);
                const meta = ACTION_LABEL[q.action.kind] ?? ACTION_LABEL.NO_ACTION!;
                return (
                  <tr key={q.invoiceId} className="border-b hairline transition-colors last:border-0 hover:bg-ink-800/40">
                    <td className="px-6 py-4 font-mono text-xs text-brass-400">{q.invoiceNumber}</td>
                    <td className="px-6 py-4">
                      <Link href={`/admin/users/${q.userId}`} className="text-bone-100 hover:text-brass-300">
                        {user?.fullName ?? q.userId}
                      </Link>
                    </td>
                    <td className="tnum px-6 py-4 text-bone-200">{formatMoney(money(q.amountMinor, q.currency))}</td>
                    <td className="tnum px-6 py-4">
                      <span className={q.daysOverdue > 14 ? "text-alert" : q.daysOverdue > 0 ? "text-caution" : "text-bone-500"}>
                        {q.daysOverdue}d
                      </span>
                    </td>
                    <td className="tnum px-6 py-4 text-bone-400">{q.failedAttempts}</td>
                    <td className="px-6 py-4 text-xs">
                      {q.lastDeclineCode ? (
                        <>
                          <span className={isRetryable(q.lastDeclineCode) ? "text-caution" : "text-alert"}>
                            {q.lastDeclineCode.replace(/_/g, " ").toLowerCase()}
                          </span>
                          <p className="mt-0.5 max-w-xs text-bone-600">{declineExplanation(q.lastDeclineCode)}</p>
                        </>
                      ) : (
                        <span className="text-bone-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={meta.tone}>
                        <Dot tone={meta.tone} />
                        {meta.label}
                      </Badge>
                      {"reason" in q.action ? (
                        <p className="mt-1 max-w-xs text-xs text-bone-600">{q.action.reason}</p>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      {isRetryable(q.lastDeclineCode) ? (
                        <ActionButton action={adminRetryPaymentAction} label="Force retry" variant="ghost" hidden={{ invoiceId: q.invoiceId }} />
                      ) : (
                        <span className="text-xs text-bone-600">Retry disabled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {queue.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-sm text-verified">
                    Nothing in collections. Every invoice is settled.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-7">
          <Eyebrow className="mb-4">The retry schedule</Eyebrow>
          <p className="text-sm leading-relaxed text-bone-400">
            After a soft decline we retry at {RETRY_SCHEDULE_DAYS.join(", ")} days, then stop.
            Front-loaded because most recoverable failures resolve quickly, then spaced out so a
            customer whose salary lands monthly gets a chance.
          </p>
          <Rule className="my-5" />
          <p className="text-sm leading-relaxed text-bone-400">
            A <span className="text-bone-200">hard decline</span> — a card reported lost, or expired
            — is never retried. It will decline every time, and four attempts on a stolen card
            achieves nothing except appearing on somebody&apos;s statement as harassment.
          </p>
        </Panel>

        <Panel className="border-verified/25 bg-verified/[0.03] p-7">
          <Eyebrow className="mb-4">What collections can never do</Eyebrow>
          <ul className="space-y-3 text-sm">
            {[
              "Deactivate a succession plan",
              "Block a Continuity Pack export",
              "Prevent a beneficiary from claiming",
              "Delete a beneficiary or an allocation",
            ].map((s) => (
              <li key={s} className="flex gap-3 text-bone-300">
                <span className="mt-1.5 shrink-0"><Dot tone="verified" /></span>
                {s}
              </li>
            ))}
          </ul>
          <Rule className="my-5" />
          <p className="text-sm leading-relaxed text-bone-400">
            Non-payment costs features — vault uploads pause, the tier drops to Free once the grace
            period ends. It must never cost a family their inheritance, so that rule is encoded in
            the entitlement function rather than left to everyone remembering it.
          </p>
        </Panel>
      </div>
    </div>
  );
}

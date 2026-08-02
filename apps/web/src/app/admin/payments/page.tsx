import Link from "next/link";
import { formatMoney, money, outstandingMinor } from "@legacy/billing";
import { ActionButton, ActionForm } from "@/components/form";
import { Badge, Eyebrow, Panel, SectionHeading, Stat, formatDate, formatDateTime, inputClass } from "@/components/ui";
import { adminRefundAction, adminRetryPaymentAction, adminVoidInvoiceAction, runBillingCycleAction } from "@/lib/actions";
import { getWorld } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function PaymentsPage() {
  const world = getWorld();
  const invoices = [...world.invoices].sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));

  const collected = invoices.reduce((a, i) => a + i.amountPaidMinor, 0n);
  const outstanding = invoices.reduce((a, i) => a + outstandingMinor(i), 0n);
  const refunded = invoices.reduce((a, i) => a + i.amountRefundedMinor, 0n);
  const attempts = invoices.flatMap((i) => i.attempts);
  const failed = attempts.filter((a) => a.outcome === "FAILED");
  const successRate = attempts.length > 0 ? ((attempts.length - failed.length) / attempts.length) * 100 : 100;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <SectionHeading
          eyebrow="Payments"
          title="Invoices and collection"
          lead="The automated cycle issues invoices, attempts collection on the dunning schedule, and advances subscription state. Run it manually here to watch it work."
        />
        <ActionForm action={runBillingCycleAction} submitLabel="Run billing cycle" compact />
      </div>

      <Panel className="p-7">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Collected" value={formatMoney(money(collected))} tone="verified" />
          <Stat label="Outstanding" value={formatMoney(money(outstanding))} tone={outstanding > 0n ? "alert" : undefined} />
          <Stat label="Refunded" value={formatMoney(money(refunded))} />
          <Stat
            label="Authorisation rate"
            value={`${successRate.toFixed(0)}%`}
            sub={`${attempts.length} attempts, ${failed.length} declined`}
          />
        </div>
        {world.lastBillingRunAt ? (
          <p className="mt-6 text-xs text-bone-600">Last cycle run {formatDateTime(world.lastBillingRunAt)}.</p>
        ) : (
          <p className="mt-6 text-xs text-bone-600">The cycle has not been run in this session yet.</p>
        )}
      </Panel>

      <Panel className="overflow-hidden">
        <div className="px-6 py-4">
          <Eyebrow>All invoices</Eyebrow>
        </div>
        <div className="overflow-x-auto border-t hairline">
          <table className="w-full min-w-[1050px] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {["Invoice", "Customer", "Issued", "Due", "Total", "Paid", "Status", "Last decline", ""].map((h) => (
                  <th key={h} className="eyebrow px-6 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const user = world.users.find((u) => u.id === i.userId);
                const lastFail = [...i.attempts].reverse().find((a) => a.outcome === "FAILED");
                return (
                  <tr key={i.id} className="border-b hairline transition-colors last:border-0 hover:bg-ink-800/40">
                    <td className="px-6 py-3.5 font-mono text-xs text-brass-400">{i.number}</td>
                    <td className="px-6 py-3.5">
                      <Link href={`/admin/users/${i.userId}`} className="text-bone-100 hover:text-brass-300">
                        {user?.fullName ?? i.userId}
                      </Link>
                    </td>
                    <td className="tnum px-6 py-3.5 text-xs text-bone-500">{formatDate(i.issuedAt)}</td>
                    <td className="tnum px-6 py-3.5 text-xs text-bone-500">{formatDate(i.dueAt)}</td>
                    <td className="tnum px-6 py-3.5 text-bone-200">{formatMoney(money(i.totalMinor, i.currency))}</td>
                    <td className="tnum px-6 py-3.5 text-bone-400">{formatMoney(money(i.amountPaidMinor, i.currency))}</td>
                    <td className="px-6 py-3.5">
                      <Badge
                        tone={
                          i.status === "PAID" ? "verified"
                          : i.status === "OPEN" ? "caution"
                          : i.status === "UNCOLLECTIBLE" ? "alert"
                          : "neutral"
                        }
                      >
                        {i.status.replace(/_/g, " ").toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-3.5 text-xs">
                      {lastFail?.declineCode ? (
                        <span className="text-alert">{lastFail.declineCode.replace(/_/g, " ").toLowerCase()}</span>
                      ) : (
                        <span className="text-bone-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {i.status === "OPEN" || i.status === "UNCOLLECTIBLE" ? (
                          <>
                            <ActionButton action={adminRetryPaymentAction} label="Retry" variant="ghost" hidden={{ invoiceId: i.id }} />
                            <ActionButton
                              action={adminVoidInvoiceAction}
                              label="Void"
                              variant="ghost"
                              confirm={`Void ${i.number}? This cannot be undone.`}
                              hidden={{ invoiceId: i.id, reason: "Voided by billing operations." }}
                            />
                          </>
                        ) : null}
                        {i.status === "PAID" || i.status === "PARTIALLY_REFUNDED" ? (
                          <ActionForm action={adminRefundAction} submitLabel="Refund" variant="ghost" compact>
                            <input type="hidden" name="invoiceId" value={i.id} />
                            <input type="hidden" name="reason" value="Refunded by billing operations." />
                            <input
                              type="number"
                              name="amount"
                              step="0.01"
                              min={0}
                              defaultValue={(Number(i.amountPaidMinor - i.amountRefundedMinor) / 100).toFixed(2)}
                              className={`${inputClass} tnum mb-2 w-24`}
                              aria-label={`Refund amount for ${i.number}`}
                            />
                          </ActionForm>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Attempt log */}
      <Panel className="overflow-hidden">
        <div className="px-6 py-4">
          <Eyebrow>Payment attempts</Eyebrow>
          <p className="mt-2 text-sm text-bone-500">
            Every charge carries an idempotency key derived from invoice and attempt number, so a
            network timeout during a retry cannot double-charge a customer.
          </p>
        </div>
        <div className="overflow-x-auto border-t hairline">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {["When", "Invoice", "Attempt", "Amount", "Outcome", "Reference"].map((h) => (
                  <th key={h} className="eyebrow px-6 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attempts
                .sort((a, b) => (a.attemptedAt < b.attemptedAt ? 1 : -1))
                .slice(0, 40)
                .map((a) => {
                  const inv = invoices.find((i) => i.id === a.invoiceId);
                  return (
                    <tr key={a.id} className="border-b hairline last:border-0">
                      <td className="tnum px-6 py-3 text-xs text-bone-500">{formatDate(a.attemptedAt)}</td>
                      <td className="px-6 py-3 font-mono text-xs text-brass-400">{inv?.number ?? a.invoiceId}</td>
                      <td className="tnum px-6 py-3 text-bone-400">#{a.attemptNumber}</td>
                      <td className="tnum px-6 py-3 text-bone-300">{formatMoney(money(a.amountMinor))}</td>
                      <td className="px-6 py-3">
                        <Badge tone={a.outcome === "SUCCEEDED" ? "verified" : a.outcome === "REQUIRES_ACTION" ? "caution" : "alert"}>
                          {a.outcome.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                        {a.declineCode ? (
                          <span className="ml-2 text-xs text-bone-500">{a.declineCode.replace(/_/g, " ").toLowerCase()}</span>
                        ) : null}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-bone-600">{a.providerReference}</td>
                    </tr>
                  );
                })}
              {attempts.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-bone-500">No payment attempts yet. Run the billing cycle.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

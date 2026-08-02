import Link from "next/link";
import { notFound } from "next/navigation";
import { PRICING_TIERS, tier } from "@legacy/core";
import { entitlementFor, formatMoney, money, mrrMinor, outstandingMinor } from "@legacy/billing";
import { ActionButton, ActionForm, SelectField, TextField } from "@/components/form";
import { Badge, Dot, Eyebrow, Panel, Rule, SectionHeading, formatDate, formatDateTime, inputClass } from "@/components/ui";
import {
  adminChangeTierAction,
  adminCreditAction,
  adminDiscountAction,
  adminExtendTrialAction,
  adminIdentityAction,
  adminIssueInvoiceAction,
  adminNoteAction,
  adminRefundAction,
  adminResetMfaAction,
  adminRetryPaymentAction,
  adminSetStatusAction,
  adminSubscriptionAction,
} from "@/lib/actions";
import { FORBIDDEN_CAPABILITIES } from "@/lib/admin";
import { getWorld } from "@/lib/store";
import { SubscriptionBadge } from "../page";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const world = getWorld();
  const user = world.users.find((u) => u.id === id);
  if (!user) notFound();

  const sub = world.subscriptions.find((s) => s.userId === id);
  const invoices = world.invoices.filter((i) => i.userId === id).sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1));
  const methods = world.paymentMethods.filter((p) => p.userId === id);
  const adminLog = world.adminAudit.filter((a) => a.targetUserId === id);
  const entitlement = sub ? entitlementFor(sub, new Date().toISOString()) : undefined;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/users" className="text-xs text-bone-500 hover:text-bone-300">&larr; All users</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="display text-3xl text-bone-50">{user.fullName}</h1>
            <p className="mt-2 text-sm text-bone-500">
              {user.email} · {user.countryName} · joined {formatDate(user.createdAt)}
            </p>
            <p className="mt-1 font-mono text-xs text-bone-600">{user.id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={user.status === "ACTIVE" ? "verified" : user.status === "SUSPENDED" ? "alert" : "caution"}>
              <Dot tone={user.status === "ACTIVE" ? "verified" : user.status === "SUSPENDED" ? "alert" : "caution"} />
              {user.status.toLowerCase()}
            </Badge>
            {sub ? <SubscriptionBadge status={sub.status} /> : null}
            {user.identityVerified ? <Badge tone="verified">KYC verified</Badge> : <Badge tone="caution">KYC pending</Badge>}
          </div>
        </div>
      </div>

      {/* Snapshot */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Tier" value={sub ? tier(sub.tierId).name : "—"} />
        <Metric label="MRR" value={sub ? formatMoney(money(mrrMinor(sub), sub.currency)) : "—"} />
        <Metric
          label="Account credit"
          value={sub ? formatMoney(money(sub.creditMinor, sub.currency)) : "—"}
          tone={sub && sub.creditMinor > 0n ? "brass" : undefined}
        />
        <Metric
          label="Outstanding"
          value={formatMoney(money(invoices.reduce((a, i) => a + outstandingMinor(i), 0n)))}
          tone={invoices.some((i) => outstandingMinor(i) > 0n) ? "alert" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="min-w-0 space-y-6">
          {/* Subscription controls */}
          {sub ? (
            <Panel className="p-7">
              <Eyebrow className="mb-5">Subscription</Eyebrow>

              <dl className="grid gap-5 sm:grid-cols-2">
                <Field label="Status" value={sub.status.replace(/_/g, " ").toLowerCase()} />
                <Field label="Interval" value={sub.interval.toLowerCase()} />
                <Field label="Unit price" value={formatMoney(money(sub.unitPriceMinor, sub.currency))} />
                <Field label="Discount" value={sub.discountPercent ? `${sub.discountPercent}%` : "None"} />
                <Field label="Period ends" value={formatDate(sub.currentPeriodEnd)} />
                <Field label="Failed attempts" value={String(sub.failedAttempts)} />
                {sub.trialEndsAt ? <Field label="Trial ends" value={formatDate(sub.trialEndsAt)} /> : null}
                {sub.gracePeriodEndsAt ? <Field label="Grace ends" value={formatDate(sub.gracePeriodEndsAt)} /> : null}
              </dl>

              <Rule className="my-6" />

              <div className="grid gap-6 sm:grid-cols-2">
                <ActionForm action={adminChangeTierAction} submitLabel="Change tier">
                  <input type="hidden" name="userId" value={user.id} />
                  <SelectField
                    name="tierId"
                    label="Move to tier"
                    defaultValue={sub.tierId}
                    options={PRICING_TIERS.map((t) => ({ value: t.id, label: t.name }))}
                    hint="Proration is computed and shown on the next invoice."
                  />
                </ActionForm>

                <ActionForm action={adminCreditAction} submitLabel="Apply credit">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="space-y-4">
                    <TextField name="amount" label="Credit (USD)" type="number" step="0.01" min={0} placeholder="15.00" />
                    <TextField name="reason" label="Reason" placeholder="Goodwill after a billing error" />
                  </div>
                </ActionForm>

                <ActionForm action={adminDiscountAction} submitLabel="Set discount">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="space-y-4">
                    <TextField name="percent" label="Discount %" type="number" min={0} max={100} defaultValue={sub.discountPercent ?? 0} />
                    <TextField name="reason" label="Reason" placeholder="Founding member" />
                  </div>
                </ActionForm>

                {sub.status === "TRIALING" ? (
                  <ActionForm action={adminExtendTrialAction} submitLabel="Extend trial">
                    <input type="hidden" name="userId" value={user.id} />
                    <TextField name="days" label="Extra days" type="number" min={1} defaultValue={7} />
                  </ActionForm>
                ) : null}
              </div>

              <Rule className="my-6" />

              <Eyebrow className="mb-3">Lifecycle</Eyebrow>
              <div className="flex flex-wrap gap-3">
                <ActionForm action={adminSubscriptionAction} submitLabel="Cancel at period end" variant="secondary" compact>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="op" value="cancel_period_end" />
                  <input type="hidden" name="reason" value="Requested by customer." />
                </ActionForm>
                <ActionForm action={adminSubscriptionAction} submitLabel="Cancel immediately" variant="ghost" compact>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="op" value="cancel_now" />
                  <input type="hidden" name="reason" value="Requested by customer." />
                </ActionForm>
                <ActionForm action={adminSubscriptionAction} submitLabel="Pause" variant="ghost" compact>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="op" value="pause" />
                  <input type="hidden" name="reason" value="Paused by support." />
                </ActionForm>
                <ActionForm action={adminSubscriptionAction} submitLabel="Resume" variant="secondary" compact>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="op" value="resume" />
                </ActionForm>
                <ActionForm action={adminIssueInvoiceAction} submitLabel="Issue invoice" variant="ghost" compact>
                  <input type="hidden" name="userId" value={user.id} />
                </ActionForm>
              </div>

              {entitlement ? (
                <div className="mt-6 rounded-lg border-l-2 border-verified/40 bg-verified/[0.04] px-5 py-4">
                  <p className="eyebrow mb-2">What this billing state entitles them to</p>
                  <p className="text-sm text-bone-300">{entitlement.reason}</p>
                  <ul className="mt-3 grid gap-1.5 text-xs text-bone-400 sm:grid-cols-2">
                    <li>Plan editing: {entitlement.canEditPlan ? "yes" : "no"}</li>
                    <li>Vault uploads: {entitlement.canUploadToVault ? "yes" : "no"}</li>
                    <li className="text-verified">Succession plan active: always</li>
                    <li className="text-verified">Beneficiaries can claim: always</li>
                  </ul>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {/* Invoices */}
          <Panel className="overflow-hidden">
            <div className="px-6 py-4">
              <Eyebrow>Invoices</Eyebrow>
            </div>
            <div className="overflow-x-auto border-t hairline">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b hairline text-left">
                    {["Invoice", "Issued", "Total", "Status", "Attempts", ""].map((h) => (
                      <th key={h} className="eyebrow px-6 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id} className="border-b hairline last:border-0">
                      <td className="px-6 py-3.5 font-mono text-xs text-brass-400">{i.number}</td>
                      <td className="tnum px-6 py-3.5 text-xs text-bone-500">{formatDate(i.issuedAt)}</td>
                      <td className="tnum px-6 py-3.5 text-bone-200">{formatMoney(money(i.totalMinor, i.currency))}</td>
                      <td className="px-6 py-3.5">
                        <Badge tone={i.status === "PAID" ? "verified" : i.status === "OPEN" ? "caution" : i.status === "UNCOLLECTIBLE" ? "alert" : "neutral"}>
                          {i.status.replace(/_/g, " ").toLowerCase()}
                        </Badge>
                      </td>
                      <td className="tnum px-6 py-3.5 text-xs text-bone-500">
                        {i.attempts.length}
                        {i.attempts.at(-1)?.declineCode ? (
                          <span className="ml-2 text-alert">{i.attempts.at(-1)!.declineCode!.toLowerCase().replace(/_/g, " ")}</span>
                        ) : null}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex flex-wrap gap-2">
                          {i.status === "OPEN" || i.status === "UNCOLLECTIBLE" ? (
                            <ActionButton action={adminRetryPaymentAction} label="Retry" variant="ghost" hidden={{ invoiceId: i.id }} />
                          ) : null}
                          {i.status === "PAID" || i.status === "PARTIALLY_REFUNDED" ? (
                            <RefundForm invoiceId={i.id} maxDollars={Number(i.amountPaidMinor - i.amountRefundedMinor) / 100} />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-bone-500">No invoices yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Payment methods */}
          <Panel className="p-7">
            <Eyebrow className="mb-4">Payment methods</Eyebrow>
            {methods.length === 0 ? (
              <p className="text-sm text-bone-500">No payment method on file.</p>
            ) : (
              <ul className="space-y-2">
                {methods.map((m) => (
                  <li key={m.id} className="panel-inset flex flex-wrap items-center justify-between gap-3 p-4">
                    <span className="text-sm text-bone-200">
                      {m.brand} •••• {m.last4}
                      <span className="ml-3 text-xs text-bone-600">
                        expires {String(m.expiryMonth).padStart(2, "0")}/{m.expiryYear}
                      </span>
                    </span>
                    {m.isDefault ? <Badge tone="neutral">default</Badge> : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Account controls */}
          <Panel className="p-7">
            <Eyebrow className="mb-5">Account controls</Eyebrow>

            <ActionForm action={adminSetStatusAction} submitLabel="Update status">
              <input type="hidden" name="userId" value={user.id} />
              <div className="space-y-4">
                <SelectField
                  name="status"
                  label="Account status"
                  defaultValue={user.status}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INVESTIGATING", label: "Investigating" },
                    { value: "SUSPENDED", label: "Suspended" },
                  ]}
                />
                <TextField name="reason" label="Reason" placeholder="Required when restricting" />
              </div>
            </ActionForm>

            <Rule className="my-6" />

            <div className="flex flex-wrap gap-3">
              <ActionForm action={adminResetMfaAction} submitLabel="Reset MFA" variant="secondary" compact>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="reason" value="Customer lost their device." />
              </ActionForm>
              <ActionForm action={adminIdentityAction} submitLabel={user.identityVerified ? "Revoke KYC" : "Mark KYC verified"} variant="ghost" compact>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="verified" value={user.identityVerified ? "false" : "true"} />
              </ActionForm>
            </div>

            <Rule className="my-6" />

            <dl className="space-y-3 text-sm">
              <Field label="Passkey" value={user.passkeyEnabled ? "Enabled" : "Not set"} />
              <Field label="MFA" value={user.mfaEnabled ? "Enabled" : "Disabled"} />
              <Field label="Registered devices" value={String(user.registeredDeviceCount)} />
              <Field label="Last proof of life" value={formatDate(user.lastProofOfLifeAt)} />
              <Field label="Continuity Pack" value={user.continuityPackExportedAt ? `Exported ${formatDate(user.continuityPackExportedAt)}` : "Not exported"} />
            </dl>
          </Panel>

          {/* Internal notes */}
          <Panel className="p-7">
            <Eyebrow className="mb-4">Internal notes</Eyebrow>
            <ActionForm action={adminNoteAction} submitLabel="Add note" resetOnSuccess>
              <input type="hidden" name="userId" value={user.id} />
              <textarea name="note" rows={3} placeholder="Context for the next person who picks this up…" className={inputClass} />
            </ActionForm>
            {user.internalNotes.length > 0 ? (
              <ul className="mt-5 space-y-2.5">
                {user.internalNotes.map((n, i) => (
                  <li key={i} className="panel-inset p-3.5 text-xs leading-relaxed text-bone-400">{n}</li>
                ))}
              </ul>
            ) : null}
          </Panel>

          {/* Staff actions on this account */}
          <Panel className="p-7">
            <Eyebrow className="mb-4">Staff actions on this account</Eyebrow>
            <p className="mb-4 text-xs leading-relaxed text-bone-600">
              Every entry here also appears in the customer&apos;s own timeline. They see what we do.
            </p>
            {adminLog.length === 0 ? (
              <p className="text-sm text-bone-500">No staff actions recorded.</p>
            ) : (
              <ul className="space-y-3">
                {adminLog.map((a) => (
                  <li key={a.id} className="border-b hairline pb-3 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-mono text-xs text-brass-400">{a.action}</span>
                      <span className="tnum text-xs text-bone-600">{formatDateTime(a.at)}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-bone-400">{a.detail}</p>
                    <p className="mt-1 text-xs text-bone-600">{a.actorId} · {a.actorRole}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* The boundary */}
          <Panel className="border-alert/25 bg-alert/[0.03] p-7">
            <Eyebrow className="mb-4">What this console cannot do</Eyebrow>
            <ul className="space-y-3">
              {FORBIDDEN_CAPABILITIES.map((c) => (
                <li key={c.capability} className="flex gap-3">
                  <span className="mt-0.5 shrink-0 text-bone-600" aria-hidden>&times;</span>
                  <div>
                    <p className="text-sm text-bone-200">{c.capability}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-bone-500">{c.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-bone-600">
              These are not permission-gated. The functions do not exist, so there is nothing for a
              compromised admin session to reach.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "brass" | "alert" }) {
  return (
    <Panel className="p-5">
      <p className="eyebrow mb-2">{label}</p>
      <p className={`tnum display text-2xl ${tone === "alert" ? "text-alert" : tone === "brass" ? "text-brass-300" : "text-bone-50"}`}>
        {value}
      </p>
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-bone-500">{label}</dt>
      <dd className="text-right text-bone-200">{value}</dd>
    </div>
  );
}

function RefundForm({ invoiceId, maxDollars }: { invoiceId: string; maxDollars: number }) {
  return (
    <ActionForm action={adminRefundAction} submitLabel="Refund" variant="ghost" compact>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="reason" value="Refunded by support." />
      <input
        type="number"
        name="amount"
        step="0.01"
        min={0}
        max={maxDollars}
        defaultValue={maxDollars.toFixed(2)}
        className={`${inputClass} tnum mb-2 w-24`}
        aria-label="Refund amount"
      />
    </ActionForm>
  );
}

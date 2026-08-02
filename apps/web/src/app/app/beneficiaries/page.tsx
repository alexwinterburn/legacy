import { AllocationRing } from "@/components/dataviz";
import { ActionButton, ActionForm, TextField } from "@/components/form";
import { Badge, Dot, Eyebrow, Panel, Rule, SectionHeading, formatDate, inputClass } from "@/components/ui";
import {
  addBeneficiaryAction,
  removeBeneficiaryAction,
  setAllocationsAction,
  verifyBeneficiaryContactAction,
} from "@/lib/actions";
import { demoAllocations, demoBeneficiaries, getAllocationStatus } from "@/lib/demo";

export default function BeneficiariesPage() {
  const beneficiaries = demoBeneficiaries();
  const allocations = demoAllocations();
  const allocation = getAllocationStatus();

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Beneficiaries"
        title="Who receives your wealth."
        lead="Allocations are held in basis points and split in whole minor units, so the parts always sum exactly to the whole — no rounding, no lost satoshis."
      />

      {/* Allocation summary + editor */}
      <Panel className="p-7">
        <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-start">
          <div className="flex justify-center">
            <AllocationRing
              segments={allocations.map((a) => ({
                label: beneficiaries.find((b) => b.id === a.beneficiaryId)?.fullName ?? a.beneficiaryId,
                basisPoints: a.basisPoints,
              }))}
              size={190}
              centerLabel={`${(allocation.totalBasisPoints / 100).toFixed(0)}%`}
              centerSub="allocated"
            />
          </div>

          <div>
            {allocation.complete ? (
              <>
                <Badge tone="verified" className="mb-3">
                  <Dot tone="verified" />
                  Fully allocated
                </Badge>
                <p className="display text-2xl text-bone-50">Your legacy is 100% allocated.</p>
              </>
            ) : (
              <>
                <Badge tone="caution" className="mb-3">
                  {allocation.totalBasisPoints > 10_000 ? "Over-allocated" : "Incomplete"}
                </Badge>
                <p className="display text-2xl text-bone-50">
                  {allocation.totalBasisPoints > 10_000
                    ? `You've allocated ${(allocation.totalBasisPoints / 100).toFixed(0)}% — that's ${((allocation.totalBasisPoints - 10_000) / 100).toFixed(0)}% too much.`
                    : `${(allocation.remaining / 100).toFixed(0)}% is still unallocated.`}
                </p>
              </>
            )}

            <p className="mt-3 max-w-lg text-sm leading-relaxed text-bone-400">
              Any change here — a new beneficiary, a different share, a new payout address — enters
              a 72-hour pending window and is notified on every channel you&apos;ve registered, plus
              your trusted contact. You can reverse it instantly during that window.
            </p>

            {beneficiaries.length > 0 ? (
              <>
                <Rule className="my-6" />
                <ActionForm action={setAllocationsAction} submitLabel="Save allocations">
                  <Eyebrow className="mb-3">Adjust shares</Eyebrow>
                  <div className="space-y-3">
                    {beneficiaries.map((b) => {
                      const share = (allocations.find((a) => a.beneficiaryId === b.id)?.basisPoints ?? 0) / 100;
                      return (
                        <div key={b.id} className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm text-bone-200">{b.fullName}</span>
                          <input
                            type="number"
                            name={`share_${b.id}`}
                            defaultValue={share}
                            min={0}
                            max={100}
                            step="0.01"
                            className={`${inputClass} tnum w-24`}
                          />
                          <span className="text-sm text-bone-500">%</span>
                        </div>
                      );
                    })}
                  </div>
                </ActionForm>
              </>
            ) : null}
          </div>
        </div>
      </Panel>

      {/* Beneficiary list */}
      <div className="space-y-4">
        {beneficiaries.length === 0 ? (
          <Panel className="p-9 text-center">
            <p className="display text-xl text-bone-50">No beneficiaries yet.</p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-bone-400">
              Without a beneficiary there is nobody to inherit, and your plan can&apos;t do
              anything. Add someone below.
            </p>
          </Panel>
        ) : null}

        {beneficiaries.map((b) => {
          const alloc = allocations.find((a) => a.beneficiaryId === b.id);
          return (
            <Panel key={b.id} className="p-7">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="display text-xl text-bone-50">{b.fullName}</h3>
                    <span className="text-xs text-bone-500">{b.relationship}</span>
                  </div>

                  <dl className="mt-5 grid gap-x-10 gap-y-3 text-sm sm:grid-cols-2">
                    <Detail label="Date of birth" value={formatDate(b.dateOfBirth)} />
                    <Detail label="Country" value={b.country} />
                    <Detail label="Email" value={b.email} />
                    <Detail label="Phone" value={b.phone ?? "Not provided"} />
                    <Detail
                      label="Bitcoin destination"
                      value={
                        b.destinations?.bitcoin ? (
                          <span className="font-mono text-xs">{truncate(b.destinations.bitcoin)}</span>
                        ) : (
                          <span className="text-bone-500">Not set — we&apos;ll help them at claim time</span>
                        )
                      }
                    />
                    <Detail label="Added" value={formatDate(b.createdAt)} />
                  </dl>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {b.contactVerified ? (
                      <Badge tone="verified"><Dot tone="verified" />Contact verified</Badge>
                    ) : (
                      <Badge tone="caution"><Dot tone="caution" />Contact unverified</Badge>
                    )}
                    {b.identityVerified ? (
                      <Badge tone="verified"><Dot tone="verified" />Identity verified</Badge>
                    ) : (
                      <Badge tone="neutral">Identity verified at claim time</Badge>
                    )}
                  </div>

                  {!b.contactVerified ? (
                    <div className="mt-4 max-w-lg rounded-lg border-l-2 border-caution/40 bg-caution/[0.04] px-4 py-3">
                      <p className="text-xs leading-relaxed text-bone-400">
                        We can&apos;t currently reach {b.fullName.split(" ")[0]}. If we can&apos;t
                        contact a beneficiary, they can&apos;t be told there&apos;s anything to claim.
                      </p>
                      <ActionButton
                        action={verifyBeneficiaryContactAction}
                        label="Confirm contact details"
                        variant="ghost"
                        hidden={{ beneficiaryId: b.id }}
                        className="mt-2"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-4">
                  <div className="text-right">
                    <p className="eyebrow mb-1">Share</p>
                    <p className="tnum display text-4xl text-brass-300">
                      {((alloc?.basisPoints ?? 0) / 100).toFixed(0)}%
                    </p>
                  </div>
                  <ActionButton
                    action={removeBeneficiaryAction}
                    label="Remove"
                    variant="ghost"
                    confirm={`Remove ${b.fullName}? You'll need to reallocate their ${((alloc?.basisPoints ?? 0) / 100).toFixed(0)}% share.`}
                    hidden={{ beneficiaryId: b.id }}
                  />
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Add form */}
      <Panel className="p-7">
        <Eyebrow className="mb-5">Add a beneficiary</Eyebrow>
        <ActionForm action={addBeneficiaryAction} submitLabel="Add beneficiary" resetOnSuccess>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField name="fullName" label="Full name" placeholder="Jane Winterburn" required />
            <TextField name="relationship" label="Relationship" placeholder="Daughter" required />
            <TextField name="dateOfBirth" label="Date of birth" placeholder="1990-04-11" required hint="YYYY-MM-DD" />
            <TextField name="country" label="Country" placeholder="ZA" required hint="Two-letter code" />
            <TextField name="email" label="Email" type="email" placeholder="jane@example.com" required />
            <TextField name="phone" label="Phone (optional)" placeholder="+27 82 000 0000" />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-bone-600">
            New beneficiaries start with a 0% share. Set their allocation above and save — the total
            must reach exactly 100% before the plan is complete.
          </p>
        </ActionForm>
      </Panel>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow mb-1">{label}</dt>
      <dd className="text-bone-200">{value}</dd>
    </div>
  );
}

function truncate(s: string): string {
  return s.length > 24 ? `${s.slice(0, 12)}…${s.slice(-8)}` : s;
}

// Reads mutable store state, so it must not be statically prerendered.
export const dynamic = "force-dynamic";

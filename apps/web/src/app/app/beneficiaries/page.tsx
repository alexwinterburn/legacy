import { AllocationRing } from "@/components/dataviz";
import { Badge, Button, Dot, Eyebrow, Panel, Rule, SectionHeading, formatDate } from "@/components/ui";
import { demoAllocations, demoBeneficiaries, getAllocationStatus } from "@/lib/demo";

export default function BeneficiariesPage() {
  const allocation = getAllocationStatus();

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Beneficiaries"
        title="Who receives your wealth."
        lead="Allocations are held in basis points and split in whole minor units, so the parts always sum exactly to the whole — no rounding, no lost satoshis."
      />

      <Panel className="p-7">
        <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex justify-center">
            <AllocationRing
              segments={demoAllocations.map((a) => ({
                label: demoBeneficiaries.find((b) => b.id === a.beneficiaryId)!.fullName,
                basisPoints: a.basisPoints,
              }))}
              size={190}
              centerLabel={`${allocation.totalBasisPoints / 100}%`}
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
                <Badge tone="caution" className="mb-3">Incomplete</Badge>
                <p className="display text-2xl text-bone-50">
                  {allocation.remaining / 100}% is still unallocated.
                </p>
              </>
            )}
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-bone-400">
              Any change to this list — a new beneficiary, a different share, a new payout address —
              enters a 72-hour pending window and is notified on every channel you&apos;ve
              registered, plus your trusted contact. You can reverse it instantly during that window.
            </p>
            <p className="mt-3 max-w-lg text-xs leading-relaxed text-bone-600">
              That delay exists because the most common attack on a plan like yours is someone
              taking over your account for an hour and redirecting the estate.
            </p>
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        {demoBeneficiaries.map((b) => {
          const alloc = demoAllocations.find((a) => a.beneficiaryId === b.id);
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

                  <div className="mt-5 flex flex-wrap gap-2">
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
                    <p className="mt-4 max-w-lg rounded-lg border-l-2 border-caution/40 bg-caution/[0.04] px-4 py-3 text-xs leading-relaxed text-bone-400">
                      We can&apos;t currently reach {b.fullName.split(" ")[0]}. If we can&apos;t
                      contact a beneficiary, they can&apos;t be told there&apos;s anything to claim.
                    </p>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="eyebrow mb-1">Share</p>
                  <p className="tnum display text-4xl text-brass-300">
                    {(alloc?.basisPoints ?? 0) / 100}%
                  </p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel className="p-7">
        <Eyebrow className="mb-4">Add a beneficiary</Eyebrow>
        <p className="max-w-2xl text-sm leading-relaxed text-bone-400">
          In the live product this opens the beneficiary form and, on submission, places the change
          into the 72-hour pending window. This prototype is read-only.
        </p>
        <Rule className="my-6" />
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" disabled>Add beneficiary</Button>
          <Button variant="ghost" href="/app/succession">Configure how they inherit &rarr;</Button>
        </div>
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

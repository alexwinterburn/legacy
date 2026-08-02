import { Badge, Dot, Eyebrow, Panel, SectionHeading, formatDateTime } from "@/components/ui";
import { getTimeline } from "@/lib/demo";

const ACTION_LABELS: Record<string, string> = {
  "user.created": "Account created",
  "user.proof_of_life": "You confirmed you're alive",
  "plan.created": "Succession plan created",
  "beneficiary.added": "Beneficiary added",
  "beneficiary.changed": "Beneficiary changed",
  "beneficiary.contact_verified": "Beneficiary contact verified",
  "wallet.added": "Wallet registered",
  "wallet.ownership_proven": "Wallet ownership proven",
  "rule.added": "Succession rule added",
  "continuity_pack.exported": "Continuity Pack exported",
  "death_event.confidence_changed": "Death confidence reassessed",
};

export default function TimelinePage() {
  const chain = getTimeline();
  const entries = [...chain.all()].reverse();
  const integrity = chain.verify();

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Legacy timeline"
        title="Everything that has ever happened to your plan."
        lead="An append-only, hash-chained record. Each entry commits to the one before it, so altering any past event breaks every hash that follows — including ours. There is no edit or delete path, for you or for us."
      />

      <Panel className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {integrity.valid ? (
              <Badge tone="verified"><Dot tone="verified" />Chain intact</Badge>
            ) : (
              <Badge tone="alert"><Dot tone="alert" />Broken at entry {integrity.brokenAt}</Badge>
            )}
            <span className="text-sm text-bone-400">{entries.length} events</span>
          </div>
          <p className="font-mono text-xs text-bone-600">head: {chain.head().slice(0, 24)}…</p>
        </div>
      </Panel>

      <Panel className="p-7">
        <ol className="relative space-y-0">
          {entries.map((entry, i) => (
            <li key={entry.seq} className="relative flex gap-5 pb-8 last:pb-0">
              {/* Connector line */}
              {i < entries.length - 1 ? (
                <span className="absolute left-[5px] top-4 h-full w-px bg-ink-700" aria-hidden />
              ) : null}

              <span className="relative z-10 mt-1.5 shrink-0">
                <Dot tone={entry.actorType === "USER" ? "brass" : "neutral"} />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm text-bone-100">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </p>
                  <time className="tnum shrink-0 text-xs text-bone-600">{formatDateTime(entry.occurredAt)}</time>
                </div>

                {Object.keys(entry.payload).length > 0 ? (
                  <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                    {Object.entries(entry.payload).map(([k, v]) => (
                      <div key={k} className="flex gap-1.5 text-xs">
                        <dt className="text-bone-600">{k}:</dt>
                        <dd className="text-bone-400">{String(v)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-[0.6875rem] uppercase tracking-wider text-bone-600">
                    {entry.actorType.toLowerCase()}
                  </span>
                  <span className="font-mono text-[0.6875rem] text-bone-600">
                    #{entry.seq} · {entry.hash.slice(0, 12)}…
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel className="p-7">
        <Eyebrow className="mb-3">Why this matters</Eyebrow>
        <p className="max-w-3xl text-sm leading-relaxed text-bone-400">
          If one of our staff ever touches your account, it appears here — you see our actions the
          same way you see your own. And because the log is hash-chained, we can&apos;t quietly
          remove an entry we&apos;d rather you didn&apos;t see. That&apos;s an unusual property to
          build deliberately, and it&apos;s the point.
        </p>
      </Panel>
    </div>
  );
}

// Reads mutable store state, so it must not be statically prerendered.
export const dynamic = "force-dynamic";

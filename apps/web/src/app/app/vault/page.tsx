import { brand } from "@legacy/core";
import { Badge, Button, Dot, Eyebrow, Panel, Rule, SectionHeading, formatDate } from "@/components/ui";

const DOCUMENTS = [
  { name: "Last will and testament.pdf", category: "Estate", size: "1.2 MB", added: "2026-02-20T00:00:00.000Z", releasedTo: "Executor" },
  { name: "Life policy — Old Mutual.pdf", category: "Insurance", size: "480 KB", added: "2026-03-02T00:00:00.000Z", releasedTo: "All beneficiaries" },
  { name: "Property deed — Constantia.pdf", category: "Property", size: "3.1 MB", added: "2026-03-02T00:00:00.000Z", releasedTo: "Christine" },
  { name: "Company shareholding.pdf", category: "Business", size: "820 KB", added: "2026-05-11T00:00:00.000Z", releasedTo: "Executor" },
];

const MESSAGES = [
  {
    title: "For Christine",
    type: "Video",
    duration: "4 min 12 s",
    recipient: "Christine Winterburn",
    release: "On completed succession",
    recorded: "2026-03-14T00:00:00.000Z",
  },
  {
    title: "For Arabella, on her 21st",
    type: "Letter",
    duration: "—",
    recipient: "Arabella Winterburn",
    release: "On her 21st birthday",
    recorded: "2026-03-14T00:00:00.000Z",
  },
  {
    title: "For Ava, on her 21st",
    type: "Letter",
    duration: "—",
    recipient: "Ava Winterburn",
    release: "On her 21st birthday",
    recorded: "2026-03-14T00:00:00.000Z",
  },
  {
    title: "What I want you all to know",
    type: "Audio",
    duration: "11 min 40 s",
    recipient: "All beneficiaries",
    release: "On completed succession",
    recorded: "2026-06-01T00:00:00.000Z",
  },
];

export default function VaultPage() {
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={brand.vaultName}
        title="The things that aren't money."
        lead="Documents your family will need, and the things you'd want to say. Encrypted so we can't read them — and released only under the conditions you set."
      />

      <Panel className="p-7">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <Eyebrow className="mb-3">How the encryption works</Eyebrow>
            <p className="text-sm leading-relaxed text-bone-400">
              Every item is encrypted with its own key. That key is split across your share, your
              beneficiaries&apos; shares, and one share held by us — with the threshold set so our
              share alone is never enough to open anything, and at the release threshold it
              isn&apos;t needed at all.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-bone-500">
              When the conditions are met, we don&apos;t decrypt your files and hand them over. We
              deliver the key shares your policy permits, and your beneficiaries decrypt them
              themselves.
            </p>
          </div>
          <Badge tone="verified"><Dot tone="verified" />We cannot read these</Badge>
        </div>
      </Panel>

      {/* Documents */}
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between px-7 py-5">
          <Eyebrow>Documents</Eyebrow>
          <Button variant="secondary" disabled>Upload</Button>
        </div>
        <div className="overflow-x-auto border-t hairline">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {["Document", "Category", "Size", "Added", "Released to"].map((h) => (
                  <th key={h} className="eyebrow px-7 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DOCUMENTS.map((d) => (
                <tr key={d.name} className="border-b hairline last:border-0">
                  <td className="px-7 py-4 text-bone-100">{d.name}</td>
                  <td className="px-7 py-4"><Badge tone="neutral">{d.category}</Badge></td>
                  <td className="tnum px-7 py-4 text-bone-500">{d.size}</td>
                  <td className="tnum px-7 py-4 text-bone-500">{formatDate(d.added)}</td>
                  <td className="px-7 py-4 text-bone-400">{d.releasedTo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Legacy messages */}
      <div>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="display text-2xl text-bone-50">What I want my family to know</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bone-400">
              Video, audio or written messages, released under the same conditions as your assets.
              This is the part of the product people come back to — and it&apos;s not about money at
              all.
            </p>
          </div>
          <Button variant="secondary" disabled>Record a message</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {MESSAGES.map((m) => (
            <Panel key={m.title} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-base text-bone-50">{m.title}</h3>
                  <p className="mt-1 text-xs text-bone-500">For {m.recipient}</p>
                </div>
                <Badge tone="brass">{m.type}</Badge>
              </div>

              <Rule className="my-5" />

              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-bone-600">Release condition</dt>
                  <dd className="text-right text-bone-300">{m.release}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-bone-600">Length</dt>
                  <dd className="tnum text-bone-300">{m.duration}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-bone-600">Recorded</dt>
                  <dd className="tnum text-bone-300">{formatDate(m.recorded)}</dd>
                </div>
              </dl>

              {m.release.includes("birthday") ? (
                <p className="mt-4 rounded-lg border-l-2 border-caution/40 bg-caution/[0.04] px-4 py-3 text-xs leading-relaxed text-bone-400">
                  Date-based release is carried out by us or your executor — no chain can verify
                  someone&apos;s age. If we no longer exist, this depends on your executor.
                </p>
              ) : null}
            </Panel>
          ))}
        </div>
      </div>

      <Panel className="p-7">
        <Eyebrow className="mb-3">A limitation worth stating</Eyebrow>
        <p className="max-w-3xl text-sm leading-relaxed text-bone-400">
          End-to-end encryption and guaranteed delivery pull against each other. If we genuinely
          cannot read your files, then delivering them depends on the key shares reaching your
          beneficiaries — which is why the {brand.continuityPackName} includes their shares, and why
          exporting it matters more than any other single action in this product.
        </p>
      </Panel>
    </div>
  );
}

// Reads mutable store state, so it must not be statically prerendered.
export const dynamic = "force-dynamic";

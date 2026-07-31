import { brand } from "@legacy/core";
import { ATTESTATION_SCHEMA } from "@legacy/oracle";
import { Badge, Button, Dot, Eyebrow, Panel, Rule, SectionHeading } from "@/components/ui";
import { getBitcoinPolicy, getHealth } from "@/lib/demo";

export default function ContinuityPage() {
  const health = getHealth();
  const policy = getBitcoinPolicy();

  const contents = [
    {
      title: "Output descriptors",
      body: "Your complete Bitcoin spending policy in descriptor form. Importable into any compatible wallet — Sparrow, Bitcoin Core, or a hardware device with miniscript support.",
      critical: true,
    },
    {
      title: "Contract addresses and ABIs",
      body: "For EVM assets, with the verified source. The contracts are open-source, so your heirs' engineer can read exactly what they do.",
      critical: true,
    },
    {
      title: "Attestation public keys",
      body: `Every key that has signed a ${brand.oracleName} attestation, with revocation dates. Past attestations stay verifiable forever.`,
      critical: false,
    },
    {
      title: "Standalone verifier",
      body: "About forty lines of dependency-free code that verifies any attestation offline. No network, no API, no us.",
      critical: true,
    },
    {
      title: "Recovery instructions",
      body: "Written for a person, not a developer. What your family holds, who to call, what to hand an engineer, and in what order.",
      critical: true,
    },
    {
      title: "Executor letter",
      body: "A document designed to be attached to your will, describing the assets and this mechanism in terms an attorney and a court will recognise.",
      critical: false,
    },
    {
      title: "Beneficiary summary",
      body: "Who inherits what, as of the export date, so your executor can reconcile the on-chain outcome against the estate.",
      critical: false,
    },
  ];

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow={brand.continuityPackName}
        title="We can cease to exist. Your legacy shouldn't."
        lead="This is the most important thing in the product, so it's free on every tier and it gates your health score. A plan that quietly depends on this company surviving isn't a plan — it's a hope."
      />

      {!health.continuityPackExported ? (
        <Panel className="border-caution/30 bg-caution/[0.04] p-7">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-2xl">
              <Badge tone="caution" className="mb-3">
                <Dot tone="caution" />
                Not yet exported
              </Badge>
              <p className="display text-xl text-bone-50">
                {health.cappedByContinuityPack
                  ? `Your ${brand.scoreName} is capped at ${health.score} until you export this.`
                  : `Your ${brand.scoreName} cannot pass ${health.score >= 79 ? health.score : 79} until you export this.`}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-bone-400">
                Not as a nudge — as a matter of accuracy. Until your family holds this bundle, the
                honest description of your plan is &ldquo;works, provided this company is still
                around&rdquo;. We won&apos;t score that as green.
              </p>
            </div>
            <Button>Export {brand.continuityPackName}</Button>
          </div>
        </Panel>
      ) : (
        <Panel className="border-verified/30 bg-verified/[0.04] p-7">
          <Badge tone="verified" className="mb-3"><Dot tone="verified" />Exported</Badge>
          <p className="display text-xl text-bone-50">Your plan no longer depends on us.</p>
        </Panel>
      )}

      <Panel className="p-7">
        <Eyebrow className="mb-6">What&apos;s inside</Eyebrow>
        <ul className="space-y-5">
          {contents.map((c) => (
            <li key={c.title} className="flex gap-4 border-b hairline pb-5 last:border-0 last:pb-0">
              <span className="mt-1.5 shrink-0">
                <Dot tone={c.critical ? "brass" : "neutral"} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-medium text-bone-100">{c.title}</p>
                  {c.critical ? <Badge tone="brass">Essential</Badge> : null}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-bone-500">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-7">
        <Eyebrow className="mb-4">Preview — your descriptor</Eyebrow>
        <div className="panel-inset overflow-x-auto p-5">
          <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-bone-400">
{policy.descriptor}
          </pre>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-bone-500">
          This single line is enough for your heirs to recover the wallet with any compatible
          software. It contains public keys only — no private key material, which is why it&apos;s
          safe to store alongside your will.
        </p>
      </Panel>

      <Panel className="p-7">
        <Eyebrow className="mb-4">Preview — the standalone verifier</Eyebrow>
        <div className="panel-inset overflow-x-auto p-5">
          <pre className="font-mono text-xs leading-relaxed text-bone-400">
{`// verify.mjs — no dependencies, no network, no platform.
import { createPublicKey, verify } from "node:crypto";

const canonical = (v) => /* stable key ordering */ …;

export function verifyAttestation(att, publicKeyPem, now) {
  if (att.payload.schema !== "${ATTESTATION_SCHEMA}") return false;
  if (new Date(now) > new Date(att.payload.validUntil))  return false;
  return verify(
    null,
    Buffer.from(canonical(att.payload), "utf8"),
    createPublicKey(publicKeyPem),
    Buffer.from(att.signature, "base64"),
  );
}`}
          </pre>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-bone-500">
          Deliberately trivial. If verifying our attestations required our servers, then our
          servers would be a dependency of your inheritance — and the central claim of this product
          would be false.
        </p>
      </Panel>

      <Panel className="p-7">
        <Eyebrow className="mb-4">What happens if we wind down</Eyebrow>
        <ul className="space-y-4 text-sm">
          {[
            ["Bitcoin", "Your heir spends via the timelocked script path once it matures. No key of ours is involved at any point.", "verified"],
            ["EVM assets", "Heirs execute against the deployed contract with previously issued attestations, or you use your own recovery path.", "verified"],
            ["Solana", "Executor-enforced. Your exported plan and executor letter are what carry it.", "caution"],
            ["Vault documents", "Decryptable from your key share plus your heirs' shares. Our share isn't required at the configured threshold.", "verified"],
            ["Our signing key", "Our recommendation is that it's destroyed on wind-down rather than escrowed. Escrow would just recreate the trusted third party this product exists to remove.", "neutral"],
          ].map(([title, body, tone]) => (
            <li key={title} className="flex gap-3.5 border-b hairline pb-4 last:border-0 last:pb-0">
              <span className="mt-1.5 shrink-0"><Dot tone={tone as "verified" | "caution" | "neutral"} /></span>
              <div>
                <p className="text-bone-100">{title}</p>
                <p className="mt-0.5 leading-relaxed text-bone-500">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <Rule className="my-6" />
        <p className="text-xs leading-relaxed text-bone-600">
          We test this quarterly by executing a plan end to end with all our own systems switched
          off. A claim that&apos;s never tested is a claim that&apos;s false.
        </p>
      </Panel>
    </div>
  );
}

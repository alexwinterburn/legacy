import { brand } from "@legacy/core";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Badge, Dot, Eyebrow, Panel, Rule, SectionHeading } from "@/components/ui";

export default function SecurityPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeading
          eyebrow="Security"
          title="The threat isn't theft. It's a lie about your death."
          lead="Every valuable thing in this system flows from one question: has this person actually died? So that question gets the delay, the corroboration, and — above all — your veto."
        />

        {/* Invariants */}
        <Panel className="mt-12 p-8">
          <Eyebrow className="mb-6">Invariants enforced in code, not policy</Eyebrow>
          <ul className="space-y-4">
            {[
              ["No key or quorum we control can move your assets", "Structural. Our key satisfies no spending path on its own."],
              ["Every plan has a path that works with us offline", "The timelock backstop, and the health score won't go green without your Continuity Pack."],
              ["Proof of life overrides everything", "From any state before completion, at any confidence level, against any evidence."],
              ["Cooling-off can be extended, never shortened", "Not by our risk team, not by an administrator, not by you once a claim is open."],
              ["Two distinct approvers to reach executable", "The state machine rejects a single approver, and rejects the same person twice."],
              ["No admin write path to your plan", "Not permission-gated — absent from the API."],
              ["Attestations are published before they're actionable", "A forged attestation is visible to you before anyone can use it."],
              ["Same-class sources never corroborate each other", "A certificate and a registry entry come from one registration event."],
              ["We never generate, receive or store key material", "No such code path exists, including in the demo."],
              ["The audit log is append-only and hash-chained", "We can't quietly remove an entry we'd rather you didn't see."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-4 border-b hairline pb-4 last:border-0 last:pb-0">
                <span className="tnum shrink-0 font-mono text-xs text-bone-600">I{i + 1}</span>
                <div>
                  <p className="text-sm text-bone-100">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-bone-500">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Attacks */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {[
            {
              title: "Someone falsely reports your death",
              body: "The primary attack. Defended by mandatory delay, multi-channel notification, source independence, and your dispositive veto. Repeat claims raise the fraud score rather than the confidence.",
            },
            {
              title: "Someone takes over your account",
              body: "Passkeys are primary and SMS is never an authentication factor. Beneficiary and address changes enter a 72-hour window, notified everywhere. Account recovery restores read access — it cannot change your plan.",
            },
            {
              title: "Beneficiary changed, then a death claim",
              body: "Scored as presumptively hostile with a time-decayed weight. Triggers a hold, extends cooling-off, forces manual review, and notifies the previous beneficiaries.",
            },
            {
              title: "One of our staff goes rogue",
              body: "They can record evidence. They cannot declare a death, alter a plan, shorten a delay or move funds — and every action they take appears in your own timeline.",
            },
            {
              title: "Our signing key is stolen",
              body: "One key never reaches quorum. Attestations must span independent classes, are published before they're actionable, and revocation is public. A silent compromise becomes a loud one.",
            },
            {
              title: "A government database is simply wrong",
              body: "Registry data alone can't reach the top confidence level, the full cooling-off period still applies, and your authenticated session overrides it. Registries do contain errors.",
            },
            {
              title: "You lose a key",
              body: "Wallets are built k-of-n so a single loss is survivable, and the health score penalises keeping all your keys in one place. Three keys in one drawer is one key.",
            },
            {
              title: "We go out of business",
              body: `The timelock path needs nothing from us. Your ${brand.continuityPackName} contains everything your heirs need. We test this quarterly by executing a plan with all our systems switched off.`,
            },
          ].map((a) => (
            <Panel key={a.title} className="p-7">
              <h3 className="text-base font-medium text-bone-50">{a.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-bone-400">{a.body}</p>
            </Panel>
          ))}
        </div>

        {/* Crypto choices */}
        <Panel className="mt-6 p-8">
          <Eyebrow className="mb-6">Cryptographic choices</Eyebrow>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b hairline text-left">
                  {["Purpose", "Algorithm", "Why"].map((h) => (
                    <th key={h} className="eyebrow py-3 pr-6 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Attestation signing", "Ed25519", "Deterministic — no nonce-reuse foot-gun"],
                  ["EVM verification", "secp256k1 / EIP-712", "Required by ecrecover; typed data prevents replay"],
                  ["Bitcoin ownership proof", "BIP-322", "The standard for modern address types"],
                  ["Audit chain", "SHA-256 hash chain", "Simple, auditable, no trusted setup"],
                  ["Vault contents", "AES-256-GCM", "Authenticated encryption, per-object keys"],
                  ["Password-derived keys", "Argon2id", "Memory-hard"],
                ].map(([purpose, algo, why]) => (
                  <tr key={purpose} className="border-b hairline last:border-0">
                    <td className="py-3 pr-6 text-bone-200">{purpose}</td>
                    <td className="py-3 pr-6 font-mono text-xs text-brass-300">{algo}</td>
                    <td className="py-3 pr-6 text-bone-500">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Rule className="my-7" />

          <p className="max-w-3xl text-sm leading-relaxed text-bone-400">
            Every signed payload carries a type tag, schema version, chain id, plan id, nonce and
            validity window. An attestation for one plan cannot be replayed onto another, onto
            another chain, or onto a different message type.
          </p>
        </Panel>

        {/* Assurance */}
        <Panel className="mt-6 p-8">
          <Eyebrow className="mb-6">Assurance</Eyebrow>
          <ul className="space-y-3">
            {[
              ["Automated tests, dependency and secret scanning", "Every commit"],
              ["Independent smart-contract audit", "Before any mainnet deployment — a hard gate"],
              ["External penetration test", "Pre-launch, then annually"],
              ["Cryptographic design review", "Pre-launch and on any key-policy change"],
              ["Continuity drill — execute a plan with us switched off", "Quarterly"],
            ].map(([item, cadence]) => (
              <li key={item} className="flex flex-wrap items-center justify-between gap-3 border-b hairline pb-3 last:border-0 last:pb-0">
                <span className="text-sm text-bone-300">{item}</span>
                <Badge tone="neutral">{cadence}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-bone-500">
            The continuity drill is the most important item here. Our central claim is that your
            plan survives our failure, and a claim that is never tested is a claim that is false.
          </p>
        </Panel>

        <Panel className="mt-6 p-7">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="brass"><Dot tone="brass" />Responsible disclosure</Badge>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-bone-400">
            Good-faith security research is welcome and protected by a safe-harbour commitment. Our
            contracts and the standalone attestation verifier are published so the claims on this
            page can be checked rather than taken on trust — which is, after all, the whole idea.
          </p>
        </Panel>
      </main>
      <SiteFooter />
    </>
  );
}

import { ENFORCEMENT_TIER_META } from "@legacy/core";
import { RULE_DEFINITIONS, enforcementSummary } from "@legacy/succession";
import { adapterFor } from "@legacy/blockchain";
import { ActionButton, ActionForm, CheckboxGroup, SelectField, TextField } from "@/components/form";
import { Badge, Dot, Eyebrow, Panel, Rule, SectionHeading, TierBadge } from "@/components/ui";
import { addRuleAction, removeRuleAction, updatePlanSettingsAction } from "@/lib/actions";
import { demoPlan, demoRules } from "@/lib/demo";

export default function SuccessionPage() {
  const summary = enforcementSummary(demoRules());
  const btc = adapterFor("bitcoin");
  const eth = adapterFor("ethereum");
  const sol = adapterFor("solana");

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Succession rules"
        title="How your wealth is distributed — and what actually enforces it."
        lead="Every rule carries a badge telling you plainly whether it runs on mathematics, on a counterparty, or on a person carrying out your instructions. We'd rather show you the limits than let you believe something is automatic when it isn't."
      />

      {/* Tier legend */}
      <div className="grid gap-4 md:grid-cols-3">
        {(["CRYPTOGRAPHIC", "ASSISTED", "LEGAL"] as const).map((tier) => {
          const meta = ENFORCEMENT_TIER_META[tier];
          return (
            <Panel key={tier} className="p-6">
              <TierBadge tier={tier} />
              <p className="mt-4 text-sm leading-relaxed text-bone-400">{meta.description}</p>
              <p className="mt-3 text-xs text-bone-600">
                {meta.survivesCompanyFailure
                  ? "Unaffected if we cease to exist."
                  : "Falls back to your timelock path if we cease to exist."}
              </p>
            </Panel>
          );
        })}
      </div>

      {/* Plan settings */}
      <Panel className="p-7">
        <Eyebrow className="mb-5">Plan settings</Eyebrow>
        <ActionForm action={updatePlanSettingsAction} submitLabel="Save settings">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <TextField
              name="coolingOffDays"
              label="Cooling-off period (days)"
              type="number"
              min={30}
              max={365}
              defaultValue={demoPlan().coolingOffDays}
              hint="Minimum 30. Can be extended by our risk team; never shortened once a claim is open."
            />
            <TextField
              name="inactivityThresholdDays"
              label="Inactivity threshold (days)"
              type="number"
              min={30}
              max={1825}
              defaultValue={demoPlan().inactivityThresholdDays}
              hint="Silence alone is weak evidence — it can only ever reach level 1 or 2."
            />
            <TextField
              name="inheritanceDelayDays"
              label="Bitcoin backstop (days)"
              type="number"
              min={30}
              max={450}
              defaultValue={demoPlan().inheritanceDelayDays}
              hint="Relative timelock. Resets whenever you move the coins."
            />
          </div>
        </ActionForm>
        <Rule className="my-6" />
        <Setting
          label="Required confidence"
          value={`Level ${demoPlan().requiredConfidenceLevel}`}
          note="Documentary evidence, checked. Nothing proceeds below this. Raising it is a support request — lowering it is not offered."
        />
      </Panel>

      {/* Rules */}
      <div className="space-y-4">
        {demoRules().map((rule) => {
          const def = RULE_DEFINITIONS[rule.type];
          return (
            <Panel key={rule.id} className="p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="display text-xl text-bone-50">{def.label}</h3>
                  <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-bone-400">{def.description}</p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <TierBadge tier={rule.enforcementTier} />
                  <ActionButton
                    action={removeRuleAction}
                    label="Remove"
                    variant="ghost"
                    hidden={{ ruleId: rule.id }}
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {rule.appliesToChains.map((c) => (
                  <Badge key={c} tone="neutral" className="capitalize">{c}</Badge>
                ))}
              </div>

              {def.caveat ? (
                <div className="mt-5 rounded-lg border-l-2 border-caution/40 bg-caution/[0.04] px-5 py-4">
                  <p className="eyebrow mb-1.5">What this rule can&apos;t do</p>
                  <p className="text-sm leading-relaxed text-bone-400">{def.caveat}</p>
                </div>
              ) : null}

              {rule.enforcementTier !== def.bestTier ? (
                <p className="mt-4 text-xs leading-relaxed text-bone-600">
                  This rule can be {ENFORCEMENT_TIER_META[def.bestTier].label.toLowerCase()} on some
                  chains, but not on every chain you&apos;ve applied it to — so it&apos;s been
                  downgraded rather than overstated.
                </p>
              ) : null}
            </Panel>
          );
        })}
      </div>

      {/* Add rule */}
      <Panel className="p-7">
        <Eyebrow className="mb-5">Add a rule</Eyebrow>
        <ActionForm action={addRuleAction} submitLabel="Add rule">
          <div className="grid gap-6 sm:grid-cols-2">
            <SelectField
              name="ruleType"
              label="Rule"
              options={Object.values(RULE_DEFINITIONS).map((d) => ({ value: d.type, label: d.label }))}
            />
            <CheckboxGroup
              name="chains"
              label="Applies to"
              options={[
                { value: "bitcoin", label: "Bitcoin" },
                { value: "ethereum", label: "Ethereum" },
                { value: "solana", label: "Solana" },
              ]}
              defaultChecked={["bitcoin"]}
            />
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-bone-600">
            The enforcement tier is computed from what the chains you pick can actually deliver, not
            from what the rule is called. Pick Solana for a percentage split and it resolves to
            executor-enforced, because Solana has no scripted succession.
          </p>
        </ActionForm>
      </Panel>

      {/* Summary */}
      <Panel className="p-7">
        <Eyebrow className="mb-5">Your plan at a glance</Eyebrow>
        <div className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="tnum display text-3xl text-verified">{summary.cryptographic}</p>
            <p className="mt-1 text-sm text-bone-400">enforced by cryptography</p>
          </div>
          <div>
            <p className="tnum display text-3xl text-caution">{summary.assisted}</p>
            <p className="mt-1 text-sm text-bone-400">need a counterparty</p>
          </div>
          <div>
            <p className="tnum display text-3xl text-bone-300">{summary.legal}</p>
            <p className="mt-1 text-sm text-bone-400">carried out by your executor</p>
          </div>
        </div>
        <Rule className="my-6" />
        <p className="max-w-3xl text-sm leading-relaxed text-bone-400">
          {summary.survivesCompanyFailure
            ? "The core of your plan is enforced on-chain, so it works with us permanently offline. The executor-enforced parts depend on your will and your executor — make sure both exist and agree with this plan."
            : "None of your rules are currently enforced on-chain. Your plan depends entirely on people carrying out instructions."}
        </p>
      </Panel>

      {/* Chain capability matrix */}
      <Panel className="overflow-hidden">
        <div className="px-7 py-5">
          <Eyebrow>What each chain can actually enforce</Eyebrow>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bone-500">
            The rule tiers above are derived from this. Chains differ genuinely, and pretending
            otherwise would mean promising something a chain can&apos;t deliver.
          </p>
        </div>
        <div className="overflow-x-auto border-t hairline">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b hairline text-left">
                {["Chain", "Native timelock", "Scripted succession", "Streaming", "Ownership proof"].map((h) => (
                  <th key={h} className="eyebrow px-7 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[btc, eth, sol].map((a) => (
                <tr key={a.chain} className="border-b hairline last:border-0">
                  <td className="px-7 py-3.5 capitalize text-bone-100">{a.chain}</td>
                  <td className="px-7 py-3.5">{a.capabilities.supportsNativeTimelock ? <Dot tone="verified" /> : <Dot tone="alert" />}</td>
                  <td className="px-7 py-3.5">{a.capabilities.supportsScriptedSuccession ? <Dot tone="verified" /> : <Dot tone="alert" />}</td>
                  <td className="px-7 py-3.5">
                    {a.capabilities.supportsStreaming ? (
                      <span className="inline-flex items-center gap-2 text-xs text-caution">
                        <Dot tone="caution" />requires custody
                      </span>
                    ) : (
                      <Dot tone="alert" />
                    )}
                  </td>
                  <td className="px-7 py-3.5 font-mono text-xs text-bone-500">{a.capabilities.ownershipProofScheme}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t hairline px-7 py-5">
          <p className="text-xs leading-relaxed text-bone-600">
            Streaming is technically possible on EVM chains, but only via a contract that holds your
            assets — which is custody by a contract we wrote. It&apos;s offered as an explicit
            opt-in with that trade-off stated, never as a default.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function Setting({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="eyebrow mb-1.5">{label}</dt>
      <dd className="tnum text-lg text-bone-50">{value}</dd>
      <p className="mt-1.5 text-xs leading-relaxed text-bone-600">{note}</p>
    </div>
  );
}

// Reads mutable store state, so it must not be statically prerendered.
export const dynamic = "force-dynamic";

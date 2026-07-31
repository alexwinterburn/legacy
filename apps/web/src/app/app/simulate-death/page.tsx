import { CONFIDENCE_LEVEL_META } from "@legacy/death-verification";
import { STATE_META, simulateSuccession } from "@legacy/succession";
import { Badge, Dot, Panel, SectionHeading } from "@/components/ui";
import { Walkthrough, type WalkthroughPayload } from "./walkthrough";
import {
  DEMO_NOW,
  demoAllocations,
  demoAssets,
  demoBeneficiaries,
  demoPlan,
  demoRules,
  getFraudBaseline,
} from "@/lib/demo";

export default function SimulateDeathPage() {
  const result = simulateSuccession({
    startAt: DEMO_NOW,
    coolingOffDays: demoPlan.coolingOffDays,
    requiredConfidenceLevel: demoPlan.requiredConfidenceLevel,
    beneficiaries: demoBeneficiaries,
    allocations: demoAllocations,
    rules: demoRules,
    snapshot: { takenAt: DEMO_NOW, assets: demoAssets, note: "Demo walkthrough snapshot" },
  });

  const fraud = getFraudBaseline();

  // bigint values can't cross the server/client boundary — format them here.
  const payload: WalkthroughPayload = {
    steps: result.steps.map((s) => ({
      title: s.title,
      detail: s.detail,
      actor: s.actor,
      dayOffset: s.dayOffset,
      state: s.state,
      stateLabel: STATE_META[s.state].label,
      confidenceLevel: s.confidenceLevel,
      confidenceLabel: CONFIDENCE_LEVEL_META[s.confidenceLevel].label,
      blockedReason: s.blockedReason,
    })),
    distribution:
      result.distribution?.byBeneficiary.map((b) => ({
        beneficiaryName: b.beneficiaryName,
        basisPoints: b.basisPoints,
        indicativeValueUsd: b.indicativeValueUsd,
        lines: b.lines.map((l) => ({
          symbol: l.symbol,
          formattedAmount: l.formattedAmount,
          needsDestination: l.needsDestination,
        })),
      })) ?? [],
    manualSteps: [...result.manualSteps],
    fraudScore: fraud.score,
    fraudSeverity: fraud.severity,
    coolingOffDays: demoPlan.coolingOffDays,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <SectionHeading
          eyebrow="Demonstration"
          title="Simulate death"
          lead="A death is reported against this account. Step through what actually happens — including everything that refuses to happen."
        />
        <Badge tone="alert" className="shrink-0">
          <Dot tone="alert" />
          Demo only
        </Badge>
      </div>

      <Walkthrough payload={payload} />

      <Panel className="p-7">
        <p className="eyebrow mb-3">A note on what you just saw</p>
        <p className="max-w-3xl text-sm leading-relaxed text-bone-400">
          The states, the confidence levels, the refusals and the amounts all come from the
          production engines in{" "}
          <code className="font-mono text-xs text-bone-500">@legacy/succession</code>,{" "}
          <code className="font-mono text-xs text-bone-500">@legacy/death-verification</code> and{" "}
          <code className="font-mono text-xs text-bone-500">@legacy/fraud</code> — the same code
          that would run against real evidence. If you change the plan&apos;s cooling-off period or
          required confidence level, this walkthrough changes with it, because it isn&apos;t a
          storyboard.
        </p>
      </Panel>
    </div>
  );
}

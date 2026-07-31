/**
 * Hand-built SVG data visualisation.
 *
 * No chart library: the defaults of one would fight the design system, and these shapes are
 * specific enough that a general-purpose library would cost more than it saves.
 */

import { globalCoverage, project, type VerificationTier } from "@legacy/death-verification";
import { cx } from "./ui";

const TIER_COLOR: Record<VerificationTier, string> = {
  AUTOMATED: "var(--color-verified)",
  PARTIAL: "var(--color-caution)",
  MANUAL: "var(--color-bone-500)",
};

const TIER_LABEL: Record<VerificationTier, string> = {
  AUTOMATED: "Automated source",
  PARTIAL: "Partially automated",
  MANUAL: "Manual verification",
};

/**
 * Verification coverage map — equirectangular graticule with country markers.
 *
 * A graticule rather than country outlines: it reads as an instrument panel rather than an
 * infographic, needs no geo dataset, and keeps the focus on the coverage signal.
 */
export function CoverageMap({ className, compact = false }: { className?: string; compact?: boolean }) {
  const countries = globalCoverage();
  const W = 720;
  const H = 360;

  return (
    <div className={cx("w-full overflow-x-auto", className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[560px] w-full" role="img" aria-label="Global death-verification coverage">
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="var(--color-brass-600)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={W} height={H} fill="url(#mapGlow)" />

        {/* Graticule */}
        <g stroke="var(--color-ink-700)" strokeWidth="0.5" opacity="0.8">
          {Array.from({ length: 13 }, (_, i) => {
            const x = (i / 12) * W;
            return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={H} />;
          })}
          {Array.from({ length: 7 }, (_, i) => {
            const y = (i / 6) * H;
            return <line key={`h${i}`} x1={0} y1={y} x2={W} y2={y} />;
          })}
        </g>

        {/* Equator and prime meridian, slightly brighter */}
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--color-ink-600)" strokeWidth="0.8" />
        <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="var(--color-ink-600)" strokeWidth="0.8" />

        {countries.map((c, i) => {
          const { x, y } = project(c.lat, c.lon);
          const cx0 = x * W;
          const cy0 = y * H;
          const color = TIER_COLOR[c.tier];
          return (
            <g key={c.code}>
              <title>{`${c.name} — ${TIER_LABEL[c.tier]}${c.note ? `. ${c.note}` : ""}`}</title>
              <circle
                cx={cx0}
                cy={cy0}
                r={c.tier === "MANUAL" ? 8 : 11}
                fill={color}
                opacity="0.12"
                className="animate-pulse-ring"
                style={{ animationDelay: `${(i % 8) * 0.4}s` }}
              />
              <circle cx={cx0} cy={cy0} r={c.tier === "MANUAL" ? 2.4 : 3.4} fill={color} />
              {!compact && (c.code === "ZA" || c.code === "GB" || c.code === "US") ? (
                <text
                  x={cx0 + 8}
                  y={cy0 + 3.5}
                  fill="var(--color-bone-500)"
                  fontSize="9"
                  letterSpacing="0.08em"
                >
                  {c.code}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
        {(["AUTOMATED", "PARTIAL", "MANUAL"] as const).map((tier) => (
          <span key={tier} className="inline-flex items-center gap-2 text-xs text-bone-400">
            <span className="size-2 rounded-full" style={{ background: TIER_COLOR[tier] }} aria-hidden />
            {TIER_LABEL[tier]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Allocation ring. Segments are proportional to basis points; gaps make small shares legible. */
export function AllocationRing({
  segments,
  size = 200,
  thickness = 14,
  centerLabel,
  centerSub,
}: {
  segments: readonly { label: string; basisPoints: number; color?: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const palette = ["var(--color-brass-400)", "var(--color-brass-300)", "var(--color-brass-500)", "var(--color-bone-500)", "var(--color-brass-600)"];
  const GAP = 6;

  let offset = 0;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Allocation breakdown">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-ink-700)"
        strokeWidth={thickness}
      />
      {segments.map((seg, i) => {
        const fraction = seg.basisPoints / 10_000;
        const length = Math.max(0, circumference * fraction - GAP);
        const dash = `${length} ${circumference - length}`;
        const rotation = (offset / 10_000) * 360 - 90;
        offset += seg.basisPoints;
        return (
          <circle
            key={seg.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={seg.color ?? palette[i % palette.length]}
            strokeWidth={thickness}
            strokeDasharray={dash}
            strokeDashoffset={-GAP / 2}
            strokeLinecap="butt"
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            className="animate-draw"
            style={{ ["--dash" as string]: String(circumference), animationDelay: `${i * 0.12}s` }}
          />
        );
      })}
      {centerLabel ? (
        <text
          x={size / 2}
          y={size / 2 - (centerSub ? 2 : -6)}
          textAnchor="middle"
          fill="var(--color-bone-50)"
          fontSize={size * 0.14}
          fontFamily="var(--font-display)"
        >
          {centerLabel}
        </text>
      ) : null}
      {centerSub ? (
        <text
          x={size / 2}
          y={size / 2 + 18}
          textAnchor="middle"
          fill="var(--color-bone-500)"
          fontSize={size * 0.055}
          letterSpacing="0.14em"
        >
          {centerSub.toUpperCase()}
        </text>
      ) : null}
    </svg>
  );
}

/** Health score arc. Colour is bound to the band, never decorative. */
export function ScoreArc({
  score,
  band,
  size = 180,
}: {
  score: number;
  band: "green" | "amber" | "red";
  size?: number;
}) {
  const thickness = 12;
  const radius = (size - thickness) / 2;
  const arcFraction = 0.75; // three-quarter arc, gap at the bottom
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * arcFraction;
  const filled = arcLength * (score / 100);
  const color =
    band === "green" ? "var(--color-verified)" : band === "amber" ? "var(--color-caution)" : "var(--color-alert)";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Legacy Health score ${score} out of 100`}>
      <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-ink-700)"
          strokeWidth={thickness}
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          className="animate-draw"
          style={{ ["--dash" as string]: String(circumference) }}
        />
      </g>
      <text
        x={size / 2}
        y={size / 2 + 4}
        textAnchor="middle"
        fill="var(--color-bone-50)"
        fontSize={size * 0.26}
        fontFamily="var(--font-display)"
        className="tnum"
      >
        {score}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 26}
        textAnchor="middle"
        fill="var(--color-bone-500)"
        fontSize={size * 0.07}
        letterSpacing="0.16em"
      >
        / 100
      </text>
    </svg>
  );
}

/** Horizontal weighted bar, used for portfolio composition. */
export function CompositionBar({
  segments,
}: {
  segments: readonly { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-800">
        {segments.map((s) => (
          <div
            key={s.label}
            className="h-full transition-all duration-700"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${((s.value / total) * 100).toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-2 text-xs text-bone-400">
            <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
            <span className="tnum text-bone-600">{((s.value / total) * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

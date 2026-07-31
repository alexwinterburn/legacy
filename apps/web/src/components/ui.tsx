import type { ReactNode } from "react";
import Link from "next/link";
import { ENFORCEMENT_TIER_META, VERIFICATION_STATE_META, type EnforcementTier, type VerificationState } from "@legacy/core";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Panel({
  children,
  className,
  id,
  as: As = "div",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <As id={id} className={cx("panel", className)}>
      {children}
    </As>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("eyebrow", className)}>{children}</p>;
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("max-w-3xl", className)}>
      {eyebrow ? <Eyebrow className="mb-4">{eyebrow}</Eyebrow> : null}
      <h2 className="display text-3xl sm:text-4xl md:text-[2.75rem] leading-[1.1] text-bone-50">{title}</h2>
      {lead ? <p className="mt-5 text-base sm:text-lg leading-relaxed text-bone-300">{lead}</p> : null}
    </div>
  );
}

type Tone = "neutral" | "verified" | "caution" | "alert" | "brass";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-ink-800 text-bone-300 border-ink-600",
  verified: "bg-[color-mix(in_srgb,var(--color-verified)_14%,transparent)] text-verified border-[color-mix(in_srgb,var(--color-verified)_30%,transparent)]",
  caution: "bg-[color-mix(in_srgb,var(--color-caution)_14%,transparent)] text-caution border-[color-mix(in_srgb,var(--color-caution)_30%,transparent)]",
  alert: "bg-[color-mix(in_srgb,var(--color-alert)_14%,transparent)] text-alert border-[color-mix(in_srgb,var(--color-alert)_30%,transparent)]",
  brass: "bg-[color-mix(in_srgb,var(--color-brass-400)_12%,transparent)] text-brass-300 border-[color-mix(in_srgb,var(--color-brass-400)_28%,transparent)]",
};

export function Badge({
  children,
  tone = "neutral",
  title,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium tracking-wide",
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  const color =
    tone === "verified"
      ? "bg-verified"
      : tone === "caution"
        ? "bg-caution"
        : tone === "alert"
          ? "bg-alert"
          : tone === "brass"
            ? "bg-brass-400"
            : "bg-bone-500";
  return <span className={cx("inline-block size-1.5 rounded-full", color)} aria-hidden />;
}

/**
 * The enforcement tier badge. Appears on every rule, everywhere, without exception —
 * it is the product's honesty mechanism. See DECISIONS.md §3.
 */
export function TierBadge({ tier }: { tier: EnforcementTier }) {
  const meta = ENFORCEMENT_TIER_META[tier];
  const tone: Tone = tier === "CRYPTOGRAPHIC" ? "verified" : tier === "ASSISTED" ? "caution" : "neutral";
  return (
    <Badge tone={tone} title={meta.description}>
      <Dot tone={tone} />
      {meta.label}
    </Badge>
  );
}

export function VerificationBadge({ state }: { state: VerificationState }) {
  const meta = VERIFICATION_STATE_META[state];
  const tone: Tone = state === "PROVEN" ? "verified" : state === "OBSERVED" ? "caution" : "neutral";
  return (
    <Badge tone={tone} title={meta.description}>
      <Dot tone={tone} />
      {meta.label}
    </Badge>
  );
}

export function Button({
  children,
  href,
  variant = "primary",
  className,
  type,
  onClick,
  disabled,
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-brass-400 text-ink-950 hover:bg-brass-300 shadow-[0_1px_0_0_rgba(255,255,255,0.15)_inset]",
    secondary: "border border-ink-600 bg-ink-800/60 text-bone-100 hover:bg-ink-700 hover:border-ink-500",
    ghost: "text-bone-300 hover:text-bone-50 hover:bg-ink-800/60",
  };
  const cls = cx(base, variants[variant], className);
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type ?? "button"} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div>
      <p className="eyebrow mb-2">{label}</p>
      <p
        className={cx(
          "tnum display text-2xl sm:text-3xl leading-none",
          tone === "verified" ? "text-verified" : tone === "alert" ? "text-alert" : tone === "brass" ? "text-brass-300" : "text-bone-50",
        )}
      >
        {value}
      </p>
      {sub ? <p className="mt-2 text-xs text-bone-500">{sub}</p> : null}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-bone-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-ink-600 bg-ink-950/70 px-3.5 py-2.5 text-sm text-bone-100 placeholder:text-bone-600 focus:border-brass-500 focus:outline-none transition-colors";

/** A single hairline divider with a soft brass centre. Used to separate major sections. */
export function Rule({ className }: { className?: string }) {
  return <div className={cx("rule-gradient h-px w-full", className)} aria-hidden />;
}

/**
 * The disclaimer that must appear anywhere the product could be mistaken for legal advice.
 * See REGULATORY.md §5 and PRODUCT.md §1.
 */
export function LegalNote({ className }: { className?: string }) {
  return (
    <p className={cx("text-xs leading-relaxed text-bone-600", className)}>
      This is technology, not legal, tax, insurance or financial advice. It works alongside your
      will — it does not replace one, and it does not replace an executor, a trust or an attorney.
    </p>
  );
}

export function formatUsd(value: number, opts: { compact?: boolean } = {}): string {
  if (opts.compact && value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 2)}M`;
  }
  if (opts.compact && value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`;
  }
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

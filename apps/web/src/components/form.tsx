"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Badge, Button, Dot, cx, inputClass } from "./ui";
import type { ActionResult } from "@/lib/actions";

/**
 * A form bound to a server action, with inline success/error feedback.
 *
 * Errors render next to the form that caused them rather than throwing a page-level boundary —
 * a validation failure is a normal outcome, not an exception.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  variant = "primary",
  className,
  confirm,
  resetOnSuccess = false,
  compact = false,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children?: ReactNode;
  submitLabel: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  confirm?: string;
  resetOnSuccess?: boolean;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  return (
    <form
      className={className}
      action={(formData) => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          const r = await action(formData);
          setResult(r);
          if (r.ok && resetOnSuccess) {
            const form = document.activeElement?.closest("form");
            form?.reset();
          }
        });
      }}
    >
      {children}
      <div className={cx("flex flex-wrap items-center gap-3", compact ? "" : "mt-4")}>
        <Button type="submit" variant={variant} disabled={pending}>
          {pending ? "Working…" : submitLabel}
        </Button>
        {result ? (
          <span
            className={cx(
              "inline-flex items-center gap-2 text-xs",
              result.ok ? "text-verified" : "text-alert",
            )}
            role="status"
          >
            <Dot tone={result.ok ? "verified" : "alert"} />
            {result.ok ? result.message ?? "Done." : result.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

/** A single-button action with no fields. */
export function ActionButton({
  action,
  label,
  variant = "secondary",
  confirm,
  hidden,
  className,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  confirm?: string;
  hidden?: Record<string, string>;
  className?: string;
}) {
  return (
    <ActionForm action={action} submitLabel={label} variant={variant} confirm={confirm} className={className} compact>
      {hidden
        ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
        : null}
    </ActionForm>
  );
}

export function TextField({
  name,
  label,
  placeholder,
  defaultValue,
  type = "text",
  hint,
  required,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | number;
  type?: string;
  hint?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      <input
        className={inputClass}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        min={min}
        max={max}
        step={step}
      />
      {hint ? <span className="mt-1.5 block text-xs text-bone-600">{hint}</span> : null}
    </label>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="eyebrow mb-2 block">{label}</span>
      <select className={inputClass} name={name} defaultValue={defaultValue}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-900">
            {o.label}
          </option>
        ))}
      </select>
      {hint ? <span className="mt-1.5 block text-xs text-bone-600">{hint}</span> : null}
    </label>
  );
}

export function CheckboxGroup({
  name,
  label,
  options,
  defaultChecked = [],
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultChecked?: readonly string[];
}) {
  return (
    <div>
      <span className="eyebrow mb-2 block">{label}</span>
      <div className="flex flex-wrap gap-4">
        {options.map((o) => (
          <label key={o.value} className="inline-flex items-center gap-2 text-sm text-bone-300">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={defaultChecked.includes(o.value)}
              className="size-4 rounded border-ink-500 bg-ink-950 accent-brass-400"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Collapsible section, used to keep dense admin panels manageable. */
export function Disclosure({ summary, children, badge }: { summary: string; children: ReactNode; badge?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="panel-inset overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-ink-800/40"
      >
        <span className="flex items-center gap-3 text-sm text-bone-100">
          {summary}
          {badge ? <Badge tone="neutral">{badge}</Badge> : null}
        </span>
        <span className={cx("text-bone-500 transition-transform", open && "rotate-90")} aria-hidden>
          ›
        </span>
      </button>
      {open ? <div className="border-t hairline px-5 py-5">{children}</div> : null}
    </div>
  );
}

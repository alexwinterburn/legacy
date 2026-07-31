import Link from "next/link";
import { brand } from "@legacy/core";
import { Button, LegalNote, Rule } from "./ui";

export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg viewBox="0 0 24 24" className="size-5 text-brass-400" fill="none" aria-hidden>
        {/* A key silhouette inside a vault ring — succession, held securely. */}
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
        <path d="M12 5.5v13M12 5.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M12 14.2h3M12 16.8h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <span className="display text-lg tracking-[0.18em] text-bone-50 transition-colors group-hover:text-white">
        {brand.name}
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b hairline bg-ink-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Wordmark />
        <nav className="hidden items-center gap-7 text-sm text-bone-300 md:flex">
          <Link href="/#how" className="transition-colors hover:text-bone-50">How it works</Link>
          <Link href="/#trust" className="transition-colors hover:text-bone-50">Never trust us</Link>
          <Link href="/#global" className="transition-colors hover:text-bone-50">Global</Link>
          <Link href="/pricing" className="transition-colors hover:text-bone-50">Pricing</Link>
          <Link href="/institutional" className="transition-colors hover:text-bone-50">Institutional</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button href="/app" variant="ghost" className="hidden sm:inline-flex">
            View demo
          </Button>
          <Button href="/onboarding">Protect my legacy</Button>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t hairline bg-ink-950">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-bone-500">
              {brand.tagline}. {brand.trustPrinciple}
            </p>
          </div>
          <FooterColumn
            title="Product"
            links={[
              ["Owner dashboard", "/app"],
              ["Succession simulator", "/app/simulator"],
              ["Beneficiary portal", "/beneficiary"],
              ["Pricing", "/pricing"],
            ]}
          />
          <FooterColumn
            title="Platform"
            links={[
              ["Institutional API", "/institutional"],
              ["Control tower", "/admin"],
              ["Verification coverage", "/admin/coverage"],
              ["Security model", "/security"],
            ]}
          />
          <FooterColumn
            title="Understand"
            links={[
              ["Never trust us", "/#trust"],
              ["How it works", "/#how"],
              ["If we disappear", "/#continuity"],
              ["The problem", "/#problem"],
            ]}
          />
        </div>

        <Rule className="my-10" />

        <div className="space-y-4">
          <LegalNote className="max-w-3xl" />
          <p className="text-xs leading-relaxed text-bone-600">
            <span className="text-bone-500">Prototype.</span> This is a demonstration environment.
            No real funds are held or moved, no production smart contracts are deployed, and no
            private keys or seed phrases are generated, transmitted or stored anywhere in this
            system. Balances and valuations shown are illustrative.
          </p>
          <p className="text-xs text-bone-600">
            © {new Date().getFullYear()} {brand.legalName}. Working name — subject to change.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow mb-4">{title}</p>
      <ul className="space-y-2.5 text-sm">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-bone-400 transition-colors hover:text-bone-100">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

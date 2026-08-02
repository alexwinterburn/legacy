import Link from "next/link";
import { brand } from "@legacy/core";
import { Wordmark } from "@/components/site-chrome";
import { Badge, Dot, LegalNote } from "@/components/ui";
import { demoUser } from "@/lib/demo";

const NAV = [
  ["Overview", "/app"],
  ["Beneficiaries", "/app/beneficiaries"],
  ["Assets", "/app/assets"],
  ["Succession", "/app/succession"],
  ["Simulator", "/app/simulator"],
  ["Family Vault", "/app/vault"],
  ["Continuity", "/app/continuity"],
  ["Timeline", "/app/timeline"],
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b hairline bg-ink-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-6">
            <Wordmark />
            <Badge tone="brass" className="hidden sm:inline-flex">Demo environment</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/beneficiary" className="hidden text-sm text-bone-400 transition-colors hover:text-bone-100 sm:block">
              Beneficiary view
            </Link>
            <Link href="/admin" className="hidden text-sm text-bone-400 transition-colors hover:text-bone-100 sm:block">
              Control tower
            </Link>
            <div className="flex items-center gap-2.5 rounded-full border hairline bg-ink-900 py-1 pl-1 pr-3.5">
              <span className="flex size-7 items-center justify-center rounded-full bg-brass-500/20 text-xs font-medium text-brass-300">
                {demoUser().fullName.split(" ").map((n) => n[0]).join("")}
              </span>
              <span className="text-sm text-bone-200">{demoUser().fullName.split(" ")[0]}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-5 py-8 sm:px-8">
        <aside className="hidden w-52 shrink-0 lg:block">
          <nav className="sticky top-24 space-y-0.5">
            {NAV.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="block rounded-lg px-3.5 py-2 text-sm text-bone-400 transition-colors hover:bg-ink-800/70 hover:text-bone-50"
              >
                {label}
              </Link>
            ))}
            <div className="pt-6">
              <Link
                href="/app/simulate-death"
                className="flex items-center gap-2 rounded-lg border border-alert/30 bg-alert/5 px-3.5 py-2.5 text-sm text-alert transition-colors hover:bg-alert/10"
              >
                <Dot tone="alert" />
                Simulate death
              </Link>
              <p className="mt-2 px-1 text-[0.6875rem] leading-relaxed text-bone-600">
                Demo only. Drives the real engines end to end.
              </p>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Mobile nav */}
      <nav className="sticky bottom-0 z-40 flex gap-1 overflow-x-auto border-t hairline bg-ink-950/95 px-3 py-2 backdrop-blur-xl lg:hidden">
        {NAV.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="whitespace-nowrap rounded-lg px-3 py-2 text-xs text-bone-400 hover:bg-ink-800 hover:text-bone-50"
          >
            {label}
          </Link>
        ))}
      </nav>

      <footer className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-8">
        <LegalNote className="max-w-3xl" />
        <p className="mt-3 text-xs text-bone-600">
          {brand.legalName} — prototype. No real funds, no deployed contracts, no key material.
        </p>
      </footer>
    </div>
  );
}

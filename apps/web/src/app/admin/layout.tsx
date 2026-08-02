import Link from "next/link";
import { Wordmark } from "@/components/site-chrome";
import { Badge } from "@/components/ui";
import { CURRENT_ADMIN } from "@/lib/admin";

const NAV = [
  ["Overview", "/admin"],
  ["Users", "/admin/users"],
  ["Subscriptions", "/admin/subscriptions"],
  ["Payments", "/admin/payments"],
  ["Dunning", "/admin/dunning"],
  ["Death events", "/admin/death-events"],
  ["Fraud", "/admin/fraud"],
  ["Coverage", "/admin/coverage"],
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b hairline bg-ink-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-6 px-5 sm:px-8">
          <div className="flex items-center gap-5">
            <Wordmark />
            <Badge tone="alert">Back office</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-bone-500 sm:block">
              {CURRENT_ADMIN.name} · <span className="text-bone-400">{CURRENT_ADMIN.role}</span>
            </span>
            <Link href="/app" className="text-sm text-bone-400 transition-colors hover:text-bone-100">
              Exit
            </Link>
          </div>
        </div>
        <nav className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4 pb-2 sm:px-7">
          {NAV.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-bone-400 transition-colors hover:bg-ink-800 hover:text-bone-50"
            >
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-8 sm:px-8">{children}</main>

      <footer className="mx-auto max-w-[1600px] px-5 pb-16 pt-8 sm:px-8">
        <div className="panel-inset p-5">
          <p className="text-xs leading-relaxed text-bone-500">
            <span className="text-bone-300">The boundary.</span> Staff have full control over the
            account, the subscription and the money. They have none over the succession mechanism —
            no console here can change a customer&apos;s beneficiaries, declare a death, shorten a
            cooling-off period, or move assets. Those write paths do not exist in the codebase, so
            there is nothing to escalate to.
          </p>
          <Link href="/admin/users" className="mt-3 inline-block text-xs text-brass-400 hover:text-brass-300">
            See the full list of deliberately absent capabilities on any user record &rarr;
          </Link>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { Wordmark } from "@/components/site-chrome";
import { Badge } from "@/components/ui";

const NAV = [
  ["Overview", "/admin"],
  ["Death events", "/admin/death-events"],
  ["Fraud monitoring", "/admin/fraud"],
  ["Verification network", "/admin/coverage"],
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b hairline bg-ink-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-6">
            <Wordmark />
            <Badge tone="alert">Control tower</Badge>
          </div>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            {NAV.map(([label, href]) => (
              <Link key={href} href={href} className="text-bone-400 transition-colors hover:text-bone-50">
                {label}
              </Link>
            ))}
          </nav>
          <Link href="/app" className="text-sm text-bone-400 transition-colors hover:text-bone-100">
            Exit
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">{children}</main>

      <footer className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8">
        <div className="panel-inset p-5">
          <p className="text-xs leading-relaxed text-bone-500">
            <span className="text-bone-300">What this console deliberately cannot do:</span> change
            an allocation, add or remove a beneficiary, declare a death, shorten a cooling-off
            period, or move funds. Those write paths do not exist in the API. Staff record evidence;
            the engine computes. Every action taken here appears in the affected user&apos;s own
            timeline.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-bone-600">
            There is also no &ldquo;users by portfolio value&rdquo; report. A ranked list of
            wealthy customers is a targeting list, and its absence is a design decision rather than
            an oversight.
          </p>
        </div>
      </footer>
    </div>
  );
}

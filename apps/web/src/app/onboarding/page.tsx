import Link from "next/link";
import { Wordmark } from "@/components/site-chrome";
import { Badge, LegalNote } from "@/components/ui";
import { OnboardingFlow } from "./flow";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b hairline bg-ink-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <Wordmark />
          <Badge tone="brass">Demo</Badge>
        </div>
      </header>

      <OnboardingFlow />

      <footer className="mx-auto max-w-3xl px-5 pb-16 sm:px-8">
        <LegalNote />
        <p className="mt-3 text-xs text-bone-600">
          Demonstration only — nothing is saved.{" "}
          <Link href="/" className="underline decoration-bone-600 underline-offset-4 hover:text-bone-400">
            Back to the main site
          </Link>
        </p>
      </footer>
    </div>
  );
}

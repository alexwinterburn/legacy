import type { Metadata } from "next";
import { brand } from "@legacy/core";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description: brand.subheadline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brass-400 focus:px-4 focus:py-2 focus:text-sm focus:text-ink-950"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

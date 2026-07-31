/**
 * Global verification coverage.
 *
 * Feeds the admin control tower map. Coordinates are approximate country centroids for an
 * equirectangular projection — enough to communicate coverage, not a GIS dataset.
 *
 * `tier` reflects what is honestly achievable today, not what a licence could unlock. Countries
 * where a feed exists but we do not hold the licence are PARTIAL, not AUTOMATED.
 */

import { providerForCountry, type VerificationTier } from "./providers";

export interface CountryCoverage {
  readonly code: string;
  readonly name: string;
  readonly lat: number;
  readonly lon: number;
  readonly tier: VerificationTier;
  /** Civil-law or religious forced heirship may override the user's chosen allocations. */
  readonly forcedHeirship: boolean;
  readonly note?: string;
}

const COUNTRIES: readonly Omit<CountryCoverage, "tier">[] = [
  { code: "ZA", name: "South Africa", lat: -30.6, lon: 22.9, forcedHeirship: false, note: "Launch market. Document-led verification." },
  { code: "GB", name: "United Kingdom", lat: 55.4, lon: -3.4, forcedHeirship: false, note: "GRO DDRI exists; licence not held." },
  { code: "US", name: "United States", lat: 39.8, lon: -98.6, forcedHeirship: false, note: "LADMF certification required; state-by-state probate." },
  { code: "AU", name: "Australia", lat: -25.3, lon: 133.8, forcedHeirship: false, note: "State and territory registries." },
  { code: "CA", name: "Canada", lat: 56.1, lon: -106.3, forcedHeirship: false, note: "Provincial vital statistics." },
  { code: "DE", name: "Germany", lat: 51.2, lon: 10.5, forcedHeirship: true, note: "Pflichtteil — compulsory share for close relatives." },
  { code: "FR", name: "France", lat: 46.2, lon: 2.2, forcedHeirship: true, note: "Réserve héréditaire — children have a reserved share." },
  { code: "NL", name: "Netherlands", lat: 52.1, lon: 5.3, forcedHeirship: true },
  { code: "ES", name: "Spain", lat: 40.5, lon: -3.7, forcedHeirship: true, note: "Legítima." },
  { code: "PT", name: "Portugal", lat: 39.4, lon: -8.2, forcedHeirship: true },
  { code: "IE", name: "Ireland", lat: 53.1, lon: -8.2, forcedHeirship: true, note: "Legal right share for a spouse." },
  { code: "CH", name: "Switzerland", lat: 46.8, lon: 8.2, forcedHeirship: true },
  { code: "AE", name: "United Arab Emirates", lat: 23.4, lon: 53.8, forcedHeirship: true, note: "Sharia forced heirship may override chosen allocations." },
  { code: "SG", name: "Singapore", lat: 1.35, lon: 103.8, forcedHeirship: false },
  { code: "IN", name: "India", lat: 20.6, lon: 79.0, forcedHeirship: true, note: "Personal law varies by community." },
  { code: "BR", name: "Brazil", lat: -14.2, lon: -51.9, forcedHeirship: true, note: "Legítima — 50% reserved." },
  { code: "NG", name: "Nigeria", lat: 9.1, lon: 8.7, forcedHeirship: true },
  { code: "KE", name: "Kenya", lat: -0.02, lon: 37.9, forcedHeirship: false },
  { code: "JP", name: "Japan", lat: 36.2, lon: 138.3, forcedHeirship: true },
  { code: "MX", name: "Mexico", lat: 23.6, lon: -102.6, forcedHeirship: true },
  { code: "AR", name: "Argentina", lat: -38.4, lon: -63.6, forcedHeirship: true },
  { code: "PL", name: "Poland", lat: 51.9, lon: 19.1, forcedHeirship: true },
  { code: "TR", name: "Türkiye", lat: 39.0, lon: 35.2, forcedHeirship: true },
  { code: "NZ", name: "New Zealand", lat: -40.9, lon: 174.9, forcedHeirship: false },
  { code: "PH", name: "Philippines", lat: 12.9, lon: 121.8, forcedHeirship: true },
  { code: "ID", name: "Indonesia", lat: -0.8, lon: 113.9, forcedHeirship: true },
];

export function globalCoverage(): readonly CountryCoverage[] {
  return COUNTRIES.map((c) => ({ ...c, tier: providerForCountry(c.code, c.name).tier }));
}

export function coverageSummary(): {
  automated: number;
  partial: number;
  manual: number;
  total: number;
} {
  const all = globalCoverage();
  return {
    automated: all.filter((c) => c.tier === "AUTOMATED").length,
    partial: all.filter((c) => c.tier === "PARTIAL").length,
    manual: all.filter((c) => c.tier === "MANUAL").length,
    total: all.length,
  };
}

/** Project lat/lon to a 0..1 unit square (equirectangular). */
export function project(lat: number, lon: number): { x: number; y: number } {
  return { x: (lon + 180) / 360, y: (90 - lat) / 180 };
}

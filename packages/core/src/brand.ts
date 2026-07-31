/**
 * Brand abstraction.
 *
 * Every user-visible product name resolves through this module so the final brand is a
 * single-file change. See PRODUCT.md §1.
 */

export interface BrandConfig {
  /** Short product name, used in UI chrome. */
  readonly name: string;
  /** Legal/entity name, used in footers and legal copy. */
  readonly legalName: string;
  /** The proprietary verification layer. */
  readonly oracleName: string;
  /** The health metric shown to users. */
  readonly scoreName: string;
  /** The survivability bundle that makes the "we can disappear" claim true. */
  readonly continuityPackName: string;
  /** The encrypted document module. */
  readonly vaultName: string;
  readonly tagline: string;
  readonly headline: string;
  readonly subheadline: string;
  /**
   * The trust principle. Deliberately NOT "we can't take your Bitcoin" — see DECISIONS.md §0
   * for why that phrasing was rejected as misleading.
   */
  readonly trustPrinciple: string;
  readonly trustPrincipleExplainer: string;
  readonly domain: string;
  readonly supportEmail: string;
}

export const brand: BrandConfig = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "LEGACY",
  legalName: process.env.NEXT_PUBLIC_BRAND_LEGAL_NAME ?? "Legacy Protocol",
  oracleName: "Legacy Oracle",
  scoreName: "Legacy Health",
  continuityPackName: "Continuity Pack",
  vaultName: "Family Vault",
  tagline: "Digital legacy infrastructure",
  headline: "Your wealth doesn't disappear when you do.",
  subheadline:
    "Define who inherits your digital assets, on what terms, and let cryptography and verified life events carry it forward — without handing anyone control of your keys.",
  trustPrinciple: "Never a sufficient party. Never a necessary party.",
  trustPrincipleExplainer:
    "We can't move your assets on our own — we never hold enough to do it. And your plan still works if we cease to exist.",
  domain: "legacy.example",
  supportEmail: "support@legacy.example",
};

/** Candidate names retained for the naming exercise. Not used at runtime. */
export const BRAND_CANDIDATES = [
  "Legacy",
  "Continuum",
  "Succession",
  "Inherit",
  "Heir",
  "LastKey",
  "After",
  "Eternal",
  "Perpetua",
  "Meridian",
] as const;

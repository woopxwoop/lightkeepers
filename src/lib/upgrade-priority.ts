/**
 * Qualitative upgrade tiers from a % DPS impact
 * (gain for cons/sig, drop for talent/level).
 *
 * Call sites pass {@link primaryUpgradePct}(mean, median) so a skewed high
 * mean still surfaces when the median alone would understate the upgrade.
 *
 * Measured talent / cons / sig / artifact rows prefer merge-stamped
 * {@link ImportanceImpactTier} from CDN JSON; these ladders remain the
 * fallback when `tier` is missing (stale payload, guide rows, level-90).
 *
 * Each Builds section passes its own ordered threshold ladder, so both the
 * number of bands and their labels remain section-specific.
 */

import type {
  ImpactTierScale,
  ImportanceImpactTier,
} from "$lib/types/investment";

export type UpgradeTier =
  | "exceptional"
  | "high"
  | "solid"
  | "modest"
  | "negligible";

export interface UpgradeImpactBand {
  /** Inclusive lower bound for this band. */
  minPct: number;
  tier: UpgradeTier;
  label: string;
}

export interface UpgradeImpact {
  tier: UpgradeTier;
  label: string;
}

export type UpgradeImpactLadder = readonly UpgradeImpactBand[];

/** Default labels for merge-stamped impact tiers (3–5 bands). */
export const MERGED_IMPACT_LABELS: Record<ImportanceImpactTier, string> = {
  exceptional: "Exceptional impact",
  high: "High impact",
  solid: "Solid impact",
  modest: "Modest impact",
  negligible: "Negligible impact",
};

export const TALENT_UPGRADE: UpgradeImpactLadder = [
  { minPct: 10, tier: "exceptional", label: "Essential to upgrade" },
  { minPct: 7.5, tier: "high", label: "Highly recommended" },
  { minPct: 5, tier: "solid", label: "Recommended" },
  { minPct: 2.5, tier: "modest", label: "Minor impact" },
  { minPct: 0, tier: "negligible", label: "Largely inconsequential" },
];

export const CONSTELLATION_UPGRADE: UpgradeImpactLadder = [
  { minPct: 20, tier: "exceptional", label: "Exceptional impact" },
  { minPct: 15, tier: "high", label: "High impact" },
  { minPct: 10, tier: "solid", label: "Solid impact" },
  { minPct: 5, tier: "modest", label: "Modest impact" },
  { minPct: 0, tier: "negligible", label: "Negligible impact" },
];

export const SIGNATURE_UPGRADE: UpgradeImpactLadder = CONSTELLATION_UPGRADE;

export const LEVEL_UPGRADE: UpgradeImpactLadder = [
  { minPct: 8, tier: "exceptional", label: "Essential to level to 90" },
  { minPct: 6, tier: "high", label: "Highly recommended" },
  { minPct: 4, tier: "solid", label: "Recommended" },
  { minPct: 2, tier: "modest", label: "Minor impact" },
  { minPct: 0, tier: "negligible", label: "Largely inconsequential" },
];

/**
 * Stronger mean/median impact by absolute magnitude. Impact samples may be
 * signed, so preserve the selected value's sign for display.
 */
export function primaryUpgradePct(mean: number, median: number): number {
  return Math.abs(mean) >= Math.abs(median) ? mean : median;
}

/**
 * The named band for a tier, so unmeasured rows can borrow a ladder's own
 * wording instead of restating a label the ladder already owns.
 */
export function impactForTier(
  ladder: UpgradeImpactLadder,
  tier: UpgradeTier,
): UpgradeImpact {
  const band = ladder.find((b) => b.tier === tier);
  if (!band) {
    throw new Error(`Upgrade impact ladder has no ${tier} band`);
  }
  return { tier: band.tier, label: band.label };
}

/** Classify |pct| with the first matching band in a descending threshold ladder. */
export function classifyUpgradeImpact(
  pct: number,
  ladder: UpgradeImpactLadder,
): UpgradeImpact {
  if (!Number.isFinite(pct)) {
    return { tier: "negligible", label: "Data unavailable" };
  }

  const abs = Math.abs(pct);
  const band = ladder.find(({ minPct }) => abs >= minPct);
  if (!band) {
    throw new Error("Upgrade impact ladder must include a zero-percent band");
  }
  return { tier: band.tier, label: band.label };
}

/**
 * Prefer merge-stamped CDN tiers (+ roster labels/floors); fall back to the
 * section ladder when the payload has no tier yet.
 */
export function resolveUpgradeImpact(
  stamped: ImportanceImpactTier | null | undefined,
  pct: number,
  ladder: UpgradeImpactLadder,
  scale?: ImpactTierScale | null,
): UpgradeImpact {
  if (stamped) {
    return {
      tier: stamped,
      label:
        scale?.labels?.[stamped] ?? MERGED_IMPACT_LABELS[stamped] ?? stamped,
    };
  }
  return classifyUpgradeImpact(pct, ladder);
}

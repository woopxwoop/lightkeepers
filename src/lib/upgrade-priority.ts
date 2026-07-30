/**
 * Qualitative upgrade tiers from a % DPS impact
 * (gain for cons/sig, drop for talent/level).
 *
 * Call sites pass {@link primaryUpgradePct}(mean, median) so a skewed high
 * mean still surfaces when the median alone would understate the upgrade.
 *
 * Each Builds section passes its own ordered threshold ladder, so both the
 * number of bands and their labels remain section-specific.
 */

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

/** Stronger of mean vs median — used for tier + sort on Builds priority. */
export function primaryUpgradePct(mean: number, median: number): number {
  return Math.max(mean, median);
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

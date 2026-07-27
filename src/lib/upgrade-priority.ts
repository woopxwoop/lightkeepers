/**
 * Qualitative upgrade tiers from a median % DPS impact
 * (gain for cons/sig, drop for talent/level).
 *
 * Each Builds section passes its own cutoffs + labels via
 * {@link UpgradeImpactConfig}.
 */

export type UpgradeTier =
  | "highly_recommended"
  | "recommended"
  | "inconsequential";

export interface UpgradeImpactConfig {
  /** |median %| ≥ this → highly_recommended */
  highPct: number;
  /** |median %| ≥ this → recommended (else inconsequential) */
  recommendedPct: number;
  labels: Record<UpgradeTier, string>;
}

export interface UpgradeImpact {
  tier: UpgradeTier;
  label: string;
}

/** Default upgrade wording (talents / cons / signature). */
export const DEFAULT_UPGRADE_LABELS: Record<UpgradeTier, string> = {
  highly_recommended: "Highly recommended to upgrade",
  recommended: "Recommended to upgrade",
  inconsequential: "Largely inconsequential",
};

export const TALENT_UPGRADE: UpgradeImpactConfig = {
  highPct: 10,
  recommendedPct: 4,
  labels: DEFAULT_UPGRADE_LABELS,
};

export const CONSTELLATION_UPGRADE: UpgradeImpactConfig = {
  highPct: 20,
  recommendedPct: 8,
  labels: {
    highly_recommended: "High impact constellation",
    recommended: "Mid impact constellation",
    inconsequential: "Low impact constellation",
  },
};

export const SIGNATURE_UPGRADE: UpgradeImpactConfig = {
  highPct: 20,
  recommendedPct: 8,
  labels: {
    highly_recommended: "High impact weapon",
    recommended: "Mid impact weapon",
    inconsequential: "Low impact weapon",
  },
};

export const LEVEL_UPGRADE: UpgradeImpactConfig = {
  highPct: 5,
  recommendedPct: 2,
  labels: {
    highly_recommended: "Highly recommended to level to 90",
    recommended: "Recommended to level to 90",
    inconsequential: "Leveling to 90 is inconsequential",
  },
};

/** Classify |pct| into a tier + label using section-specific cutoffs. */
export function classifyUpgradeImpact(
  pct: number,
  config: UpgradeImpactConfig,
): UpgradeImpact {
  const abs = Math.abs(pct);
  const tier: UpgradeTier =
    abs >= config.highPct
      ? "highly_recommended"
      : abs >= config.recommendedPct
        ? "recommended"
        : "inconsequential";
  return { tier, label: config.labels[tier] };
}

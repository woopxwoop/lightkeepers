/**
 * Planner target autofill from character Builds impact tiers.
 *
 * Talent: exceptional/high→10, solid→9, modest→8, negligible→1
 * Level:  exceptional/high/solid→90, modest→80, negligible→70
 * Ascension: exceptional/high/solid→min A6; otherwise leave to level/talent floors
 * Level is then floored by talent/ascension gates (A6 needs 80, not 90).
 */

import {
  classifyUpgradeImpact,
  LEVEL_UPGRADE,
  primaryUpgradePct,
  TALENT_UPGRADE,
  type UpgradeImpactLadder,
} from "$lib/upgrade-priority";
import {
  gateCharacterConfig,
  minAscensionForLevel,
  minAscensionForTalent,
  minLevelForAscension,
  UPGRADE_DEFAULTS,
} from "$lib/upgrade-costs";
import type {
  CharacterIndex,
  CharacterLevelImportance,
  CharacterTalentImportance,
  ImportanceImpactTier,
  TalentSlot,
} from "$lib/types/investment";
import type {
  CharacterUpgradeConfig,
  UpgradePromoteStep,
} from "$lib/types/upgrade-costs";

export const TALENT_LEVEL_BY_TIER: Record<ImportanceImpactTier, number> = {
  exceptional: 10,
  high: 10,
  solid: 9,
  modest: 8,
  negligible: 1,
};

export const CHARACTER_LEVEL_BY_TIER: Record<ImportanceImpactTier, number> = {
  exceptional: 90,
  high: 90,
  solid: 90,
  modest: 80,
  negligible: 70,
};

/** Final ascension (A6) when Builds ascension impact clears these bands. */
const FINAL_ASCENSION_TIERS = new Set<ImportanceImpactTier>([
  "exceptional",
  "high",
  "solid",
]);

export function talentLevelFromTier(tier: ImportanceImpactTier): number {
  return TALENT_LEVEL_BY_TIER[tier];
}

export function characterLevelFromTier(tier: ImportanceImpactTier): number {
  return CHARACTER_LEVEL_BY_TIER[tier];
}

/** Min ascension from stamped/classified ascension importance, else 0. */
export function ascensionFromImportanceTier(
  tier: ImportanceImpactTier | null | undefined,
): number {
  if (!tier) return 0;
  return FINAL_ASCENSION_TIERS.has(tier) ? 6 : 0;
}

function resolveTalentTier(
  importance: CharacterTalentImportance,
  slot: TalentSlot,
): ImportanceImpactTier {
  const row = importance[slot];
  if (row.tier) return row.tier;
  return classifyUpgradeImpact(
    primaryUpgradePct(row.mean_pct_drop, row.median_pct_drop),
    TALENT_UPGRADE,
  ).tier;
}

/** Classify a stamped/derived importance row. Defaults to the level ladder. */
function resolveImportanceTier(
  importance: CharacterLevelImportance | undefined,
  ladder: UpgradeImpactLadder = LEVEL_UPGRADE,
): ImportanceImpactTier | null {
  if (!importance || importance.teams <= 0) return null;
  if (importance.tier) return importance.tier;
  return classifyUpgradeImpact(
    primaryUpgradePct(importance.mean_pct_drop, importance.median_pct_drop),
    ladder,
  ).tier;
}

function talentsFromImportance(
  importance: CharacterTalentImportance,
): CharacterUpgradeConfig["talents"] {
  return {
    normal: talentLevelFromTier(resolveTalentTier(importance, "auto")),
    skill: talentLevelFromTier(resolveTalentTier(importance, "skill")),
    burst: talentLevelFromTier(resolveTalentTier(importance, "burst")),
  };
}

/**
 * Build a gated character target from Builds summary tiers.
 * Missing Builds file / talent data → 70/70 with talents 1/1/1.
 * Missing level data → level 70, then talent/ascension floors.
 */
export function plannerTargetFromBuilds(
  builds: CharacterIndex | null | undefined,
  promotes: UpgradePromoteStep[],
): CharacterUpgradeConfig {
  const talentImp = builds?.talent_importance;
  const hasTalentData = Boolean(talentImp && talentImp.teams > 0);
  const talents = hasTalentData
    ? talentsFromImportance(talentImp!)
    : { ...UPGRADE_DEFAULTS.characterTarget.talents };

  const levelTier = resolveImportanceTier(builds?.level_importance);
  const ascensionTier = resolveImportanceTier(builds?.ascension_importance);
  let level = levelTier
    ? characterLevelFromTier(levelTier)
    : UPGRADE_DEFAULTS.characterTarget.level;

  const talentAsc = Math.max(
    minAscensionForTalent(talents.normal),
    minAscensionForTalent(talents.skill),
    minAscensionForTalent(talents.burst),
  );
  const ascFromImportance = ascensionFromImportanceTier(ascensionTier);
  level = Math.max(
    level,
    minLevelForAscension(promotes, Math.max(talentAsc, ascFromImportance)),
  );

  const ascFromLevel = minAscensionForLevel(promotes, level);
  // No Builds importance at all → keep the 70/70 shell (A4 @ 70).
  const hasAnyImportance = Boolean(hasTalentData || levelTier || ascensionTier);
  const ascFromDefault = hasAnyImportance
    ? 0
    : UPGRADE_DEFAULTS.characterTarget.ascension;

  return gateCharacterConfig(
    {
      level,
      ascension: Math.max(
        talentAsc,
        ascFromLevel,
        ascFromImportance,
        ascFromDefault,
      ),
      talents,
    },
    promotes,
  );
}

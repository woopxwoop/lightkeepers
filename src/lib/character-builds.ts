/**
 * Character Builds-tab display transforms.
 *
 * Pure helpers so the character page stays props → $derived → markup.
 */

import { isArtifactSubstatKey } from "$lib/build-stats";
import {
  CONSTELLATION_UPGRADE,
  LEVEL_UPGRADE,
  SIGNATURE_UPGRADE,
  TALENT_UPGRADE,
  classifyUpgradeImpact,
  impactForTier,
  primaryUpgradePct,
  type UpgradeImpactLadder,
  type UpgradeTier,
} from "$lib/upgrade-priority";
import type {
  CharacterConsGain,
  CharacterGuidePriority,
  CharacterIndex,
  CharacterSigGain,
  CharacterTalentImportance,
  CharacterVerticalGain,
  CharacterWeaponRank,
  TalentSlot,
} from "$lib/types/investment";

export const MAIN_STAT_SLOTS = [
  { key: "sands" as const, label: "Sands" },
  { key: "goblet" as const, label: "Goblet" },
  { key: "circlet" as const, label: "Circlet" },
];

export const TALENT_SLOT_LABELS: Record<TalentSlot, string> = {
  auto: "Normal",
  skill: "Skill",
  burst: "Burst",
};

/** Map investment talent slots → kit skill types for icons. */
export const TALENT_SLOT_TO_KIT: Record<TalentSlot, string> = {
  auto: "normal",
  skill: "skill",
  burst: "burst",
};

export type RecommendedSubstat = {
  key: string;
  mean: number;
  matchesMain: boolean;
  mainSlots: string[];
};

/**
 * Recommended substats from OptimFull liquid ranks, plus any recommended
 * main that can also roll as a substat (e.g. EM sands → also recommend EM
 * subs). Main-only keys (elemental DMG, heal, etc.) stay excluded.
 */
export function recommendedSubstatsFromBuilds(
  builds: CharacterIndex | null | undefined,
): RecommendedSubstat[] {
  if (!builds) return [];
  const mainSlots = new Map<string, string[]>();
  for (const slot of MAIN_STAT_SLOTS) {
    for (const s of builds.main_stats[slot.key]) {
      if (!isArtifactSubstatKey(s.key)) continue;
      const list = mainSlots.get(s.key) ?? [];
      list.push(slot.label);
      mainSlots.set(s.key, list);
    }
  }

  const byKey = new Map<string, RecommendedSubstat>();

  for (const r of builds.substat_rolls_liquid.ranked) {
    if (!isArtifactSubstatKey(r.key)) continue;
    if (r.mean <= 0.5 && !mainSlots.has(r.key)) continue;
    const slots = mainSlots.get(r.key) ?? [];
    byKey.set(r.key, {
      key: r.key,
      mean: r.mean,
      matchesMain: slots.length > 0,
      mainSlots: slots,
    });
  }

  for (const [key, slots] of mainSlots) {
    if (byKey.has(key)) continue;
    byKey.set(key, {
      key,
      mean: 0,
      matchesMain: true,
      mainSlots: slots,
    });
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.matchesMain !== b.matchesMain) return a.matchesMain ? -1 : 1;
    if (a.mean !== b.mean) return b.mean - a.mean;
    return a.key.localeCompare(b.key);
  });
}

/** Weapons: higher rarity first, then team usage (stable within ties). */
export function rankWeaponsByRarityAndTeams(
  weapons: CharacterWeaponRank[] | null | undefined,
  getStars: (key: string) => number,
): CharacterWeaponRank[] {
  if (!weapons?.length) return [];
  return [...weapons].sort((a, b) => {
    const ra = getStars(a.key);
    const rb = getStars(b.key);
    if (ra !== rb) return rb - ra;
    return b.teams - a.teams;
  });
}

export type VerticalImpactRow<T> = T & {
  pct: number;
  priority: UpgradeTier;
  priorityLabel: string;
};

/** Add the primary pct and its resolved impact to a vertical gain row. */
function attachImpact<T extends CharacterVerticalGain>(
  row: T,
  ladder: UpgradeImpactLadder,
): VerticalImpactRow<T> {
  const pct = primaryUpgradePct(row.mean_pct_gain, row.median_pct_gain);
  const impact = classifyUpgradeImpact(pct, ladder);
  return {
    ...row,
    pct,
    priority: impact.tier,
    priorityLabel: impact.label,
  };
}

/**
 * Descending impact, with non-finite pct treated as last place. Subtracting
 * raw values would yield NaN and leave those rows in arbitrary positions.
 */
function compareByImpact(a: { pct: number }, b: { pct: number }): number {
  const aOk = Number.isFinite(a.pct);
  const bOk = Number.isFinite(b.pct);
  if (!aOk || !bOk) return aOk === bOk ? 0 : aOk ? -1 : 1;
  return b.pct - a.pct;
}

/** Constellations in source order with their display-ready impact. */
export function constellationImpactRows(
  constellations: CharacterConsGain[] | null | undefined,
): VerticalImpactRow<CharacterConsGain>[] {
  if (!constellations?.length) return [];
  return constellations.map((row) => attachImpact(row, CONSTELLATION_UPGRADE));
}

/** Signature weapons ranked by primary gain, with display-ready impact. */
export function rankSigWeaponsByGain(
  sigWeapons: CharacterSigGain[] | null | undefined,
): VerticalImpactRow<CharacterSigGain>[] {
  if (!sigWeapons?.length) return [];
  return sigWeapons
    .map((row) => attachImpact(row, SIGNATURE_UPGRADE))
    .sort((a, b) => compareByImpact(a, b) || a.key.localeCompare(b.key));
}

export type TalentImportanceRow = {
  slot: TalentSlot;
  label: string;
  icon: string | null;
  priority: UpgradeTier;
  priorityLabel: string;
  pct: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  teams: number;
};

/**
 * Talent priority rows from measured simulation data. Qualitative labels from
 * max(mean, median) % DPS drop when that talent is at 1.
 */
export function talentImportanceRows(
  talentImportance: CharacterTalentImportance | null | undefined,
  resolveSkillIcon: (kitType: string) => string | null,
): TalentImportanceRow[] {
  if (!talentImportance || talentImportance.teams <= 0) return [];

  const slots = ["auto", "skill", "burst"] as const;
  const rows = slots.flatMap((slot) => {
    const stats = talentImportance[slot];
    if (!stats) return [];
    const pct = primaryUpgradePct(stats.mean_pct_drop, stats.median_pct_drop);
    const impact = classifyUpgradeImpact(pct, TALENT_UPGRADE);
    return [
      {
        slot,
        label: TALENT_SLOT_LABELS[slot],
        icon: resolveSkillIcon(TALENT_SLOT_TO_KIT[slot]),
        priority: impact.tier,
        priorityLabel: impact.label,
        pct,
        mean: stats.mean_pct_drop,
        median: stats.median_pct_drop,
        min: stats.min_pct_drop,
        max: stats.max_pct_drop,
        teams: talentImportance.teams,
      },
    ];
  });

  return rows.sort(
    (a, b) => compareByImpact(a, b) || a.slot.localeCompare(b.slot),
  );
}

export type LevelImportanceRow = {
  priority: UpgradeTier;
  priorityLabel: string;
  teams: number;
  mean: number;
  median: number;
  min: number;
  max: number;
};

/** Character level 90 importance from measured simulation data. */
export function levelImportanceFromBuilds(
  builds: CharacterIndex | null | undefined,
): LevelImportanceRow | null {
  const li = builds?.level_importance;
  if (!li || li.teams <= 0) return null;
  const pct = primaryUpgradePct(li.mean_pct_drop, li.median_pct_drop);
  const impact = classifyUpgradeImpact(pct, LEVEL_UPGRADE);
  return {
    priority: impact.tier,
    priorityLabel: impact.label,
    teams: li.teams,
    mean: li.mean_pct_drop,
    median: li.median_pct_drop,
    min: li.min_pct_drop,
    max: li.max_pct_drop,
  };
}

// ── Guide vs sim section selection ──────────────────────────────────────────

export type BuildsSectionSource = "sim" | "guide";

export type GuideTalentRow = {
  slot: TalentSlot;
  label: string;
  icon: string | null;
};

export type GuideConsRow = {
  cons: number;
  priority: UpgradeTier;
  priorityLabel: string;
};

export type GuideSigRow = {
  key: string;
  priority: UpgradeTier;
  priorityLabel: string;
};

/**
 * A guide only lists a constellation or signature when it is worth pulling for,
 * so those rows present at the vertical ladder's high band — the recommendation
 * itself is the claim, and no percentage stands behind it.
 */
const GUIDE_VERTICAL_IMPACT = impactForTier(CONSTELLATION_UPGRADE, "high");

/** Guide Level 90 recommendation borrows the level ladder's "Recommended" band. */
const GUIDE_LEVEL_IMPACT = impactForTier(LEVEL_UPGRADE, "solid");

/**
 * Whether an authored guide section should present instead of measured data.
 * Default fills gaps; override replaces only sections the guide authored.
 */
export function useGuideSection(
  guide: CharacterGuidePriority | null | undefined,
  hasGuide: boolean,
  hasSim: boolean,
): boolean {
  if (!guide || !hasGuide) return false;
  if (guide.override) return true;
  return !hasSim;
}

export type TalentPrioritySection =
  | { source: "sim"; rows: TalentImportanceRow[] }
  | { source: "guide"; simMissing: boolean; rows: GuideTalentRow[] };

export function talentPrioritySection(
  builds: CharacterIndex | null | undefined,
  resolveSkillIcon: (kitType: string) => string | null,
): TalentPrioritySection | null {
  const guide = builds?.guide_priority;
  const simRows = talentImportanceRows(builds?.talent_importance, resolveSkillIcon);
  const guideSlots = guide?.talent_priority ?? [];
  const preferGuide = useGuideSection(
    guide,
    guideSlots.length > 0,
    simRows.length > 0,
  );
  if (preferGuide) {
    return {
      source: "guide",
      simMissing: simRows.length === 0,
      rows: guideSlots.map((slot) => ({
        slot,
        label: TALENT_SLOT_LABELS[slot],
        icon: resolveSkillIcon(TALENT_SLOT_TO_KIT[slot]),
      })),
    };
  }
  if (simRows.length > 0) return { source: "sim", rows: simRows };
  return null;
}

export type LevelPrioritySection =
  | { source: "sim"; row: LevelImportanceRow }
  | {
      source: "guide";
      simMissing: boolean;
      priority: UpgradeTier;
      priorityLabel: string;
    };

export function levelPrioritySection(
  builds: CharacterIndex | null | undefined,
): LevelPrioritySection | null {
  const guide = builds?.guide_priority;
  const simRow = levelImportanceFromBuilds(builds);
  const preferGuide = useGuideSection(
    guide,
    guide?.level_90 === true,
    simRow != null,
  );
  if (preferGuide) {
    return {
      source: "guide",
      simMissing: simRow == null,
      priority: GUIDE_LEVEL_IMPACT.tier,
      priorityLabel: GUIDE_LEVEL_IMPACT.label,
    };
  }
  if (simRow) return { source: "sim", row: simRow };
  return null;
}

export type ConsPrioritySection =
  | { source: "sim"; rows: VerticalImpactRow<CharacterConsGain>[] }
  | { source: "guide"; simMissing: boolean; rows: GuideConsRow[] };

export function constellationPrioritySection(
  builds: CharacterIndex | null | undefined,
): ConsPrioritySection | null {
  const guide = builds?.guide_priority;
  const simRows = constellationImpactRows(
    builds?.vertical_importance?.constellations,
  );
  const guideCons = guide?.constellations ?? [];
  const preferGuide = useGuideSection(
    guide,
    guideCons.length > 0,
    simRows.length > 0,
  );
  if (preferGuide) {
    return {
      source: "guide",
      simMissing: simRows.length === 0,
      rows: [...guideCons]
        .sort((a, b) => a - b)
        .map((cons) => ({
          cons,
          priority: GUIDE_VERTICAL_IMPACT.tier,
          priorityLabel: GUIDE_VERTICAL_IMPACT.label,
        })),
    };
  }
  if (simRows.length > 0) return { source: "sim", rows: simRows };
  return null;
}

export type SigPrioritySection =
  | { source: "sim"; rows: VerticalImpactRow<CharacterSigGain>[] }
  | { source: "guide"; simMissing: boolean; rows: GuideSigRow[] };

export function sigWeaponPrioritySection(
  builds: CharacterIndex | null | undefined,
): SigPrioritySection | null {
  const guide = builds?.guide_priority;
  const simRows = rankSigWeaponsByGain(
    builds?.vertical_importance?.sig_weapons,
  );
  const guideSigs = guide?.sig_weapons ?? [];
  const preferGuide = useGuideSection(
    guide,
    guideSigs.length > 0,
    simRows.length > 0,
  );
  if (preferGuide) {
    return {
      source: "guide",
      simMissing: simRows.length === 0,
      rows: guideSigs.map((key) => ({
        key,
        priority: GUIDE_VERTICAL_IMPACT.tier,
        priorityLabel: GUIDE_VERTICAL_IMPACT.label,
      })),
    };
  }
  if (simRows.length > 0) return { source: "sim", rows: simRows };
  return null;
}

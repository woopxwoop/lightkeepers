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
  primaryUpgradePct,
  type UpgradeImpact,
  type UpgradeImpactLadder,
  type UpgradeTier,
} from "$lib/upgrade-priority";
import type {
  CharacterConsGain,
  CharacterIndex,
  CharacterSigGain,
  CharacterTalentImportance,
  CharacterVerticalGain,
  CharacterWeaponRank,
  GuideUpgradeTier,
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

/**
 * A guide states a call, not a measurement, so its rows read as a flat
 * recommendation: the guide's own ordering carries the emphasis that the
 * measured ladders express through bands.
 */
const GUIDE_TIER_IMPACT: Record<GuideUpgradeTier, UpgradeImpact> = {
  highly_recommended: { tier: "solid", label: "Recommended" },
  recommended: { tier: "solid", label: "Recommended" },
  inconsequential: { tier: "negligible", label: "Not recommended" },
};

/** Prefer a guide-authored `tier`, else classify the measured pct. */
function resolveUpgradeImpact(
  pct: number,
  ladder: UpgradeImpactLadder,
  guideTier?: GuideUpgradeTier | null,
): UpgradeImpact {
  return guideTier
    ? GUIDE_TIER_IMPACT[guideTier]
    : classifyUpgradeImpact(pct, ladder);
}

/** Add the primary pct and its resolved impact to a vertical gain row. */
function attachImpact<T extends CharacterVerticalGain>(
  row: T,
  ladder: UpgradeImpactLadder,
): VerticalImpactRow<T> {
  const pct = primaryUpgradePct(row.mean_pct_gain, row.median_pct_gain);
  const impact = resolveUpgradeImpact(pct, ladder, row.tier);
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
 * Talent priority rows: qualitative labels from max(mean, median) % DPS drop
 * when that talent is at 1. `resolveSkillIcon` maps kit skill type → URL.
 *
 * Guide-authored `tier` fields win over classifying the measured pct, and rows
 * still render when ``teams === 0`` if any slot carries a tier.
 */
export function talentImportanceRows(
  talentImportance: CharacterTalentImportance | null | undefined,
  resolveSkillIcon: (kitType: string) => string | null,
): TalentImportanceRow[] {
  if (!talentImportance) return [];
  const slots = ["auto", "skill", "burst"] as const;
  const hasTier = slots.some((slot) => talentImportance[slot]?.tier != null);
  if (talentImportance.teams <= 0 && !hasTier) return [];

  // A tiered guide also authors the ranking, so trust its slot order.
  const ordered: readonly TalentSlot[] =
    hasTier && talentImportance.priority?.length
      ? talentImportance.priority
      : slots;

  const rows = ordered.flatMap((slot) => {
    const stats = talentImportance[slot];
    if (!stats) return [];
    const pct = primaryUpgradePct(stats.mean_pct_drop, stats.median_pct_drop);
    const impact = resolveUpgradeImpact(pct, TALENT_UPGRADE, stats.tier);
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

  if (hasTier) return rows;
  return rows.sort((a, b) => compareByImpact(a, b) || a.slot.localeCompare(b.slot));
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

/** Character level 90 importance (separate from talents). */
export function levelImportanceFromBuilds(
  builds: CharacterIndex | null | undefined,
): LevelImportanceRow | null {
  const li = builds?.level_importance;
  if (!li) return null;
  if (li.teams <= 0 && li.tier == null) return null;
  const pct = primaryUpgradePct(li.mean_pct_drop, li.median_pct_drop);
  const impact = resolveUpgradeImpact(pct, LEVEL_UPGRADE, li.tier);
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

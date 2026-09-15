/**
 * Grade owned characters against Builds summaries.
 *
 * v1 scoring is progress-only (level / ascension / talents). Weapon, set, and
 * mains tips stay as soft asides — the gear comparison isn’t comprehensive yet.
 */

import { rankWeaponsByRarityAndTeams } from "$lib/character-builds";
import {
  INVENTORY_ARTIFACT_SLOTS,
  type RosterBuildView,
} from "$lib/roster-build-card";
import { plannerTargetFromBuilds } from "$lib/planner-targets";
import { isStaleBuildSummary } from "$lib/stale-build-summary";
import { primaryUpgradePct } from "$lib/upgrade-priority";
import type { CharacterIndex } from "$lib/types/investment";
import type { UpgradePromoteStep } from "$lib/types/upgrade-costs";

/** Unlock table for gating planner targets when the upgrade catalog isn’t loaded. */
export const GRADE_CHARACTER_PROMOTES: UpgradePromoteStep[] = [
  { promoteLevel: 0, mora: 0, unlockMaxLevel: 20, items: [] },
  { promoteLevel: 1, mora: 0, unlockMaxLevel: 40, items: [] },
  { promoteLevel: 2, mora: 0, unlockMaxLevel: 50, items: [] },
  { promoteLevel: 3, mora: 0, unlockMaxLevel: 60, items: [] },
  { promoteLevel: 4, mora: 0, unlockMaxLevel: 70, items: [] },
  { promoteLevel: 5, mora: 0, unlockMaxLevel: 80, items: [] },
  { promoteLevel: 6, mora: 0, unlockMaxLevel: 90, items: [] },
];

export const WEAPON_OK_MAX_RANK = 3;
export const MAIN_OK_MAX_RANK = 2;

export type AccountBuildBucket = "built_well" | "needs_work" | "ungraded";

/** Soft gear axes (aside only) plus the progress axis that drives the bucket. */
export type AccountBuildAxis = "weapon" | "set" | "mains" | "progress";

export type AccountBuildNameResolvers = {
  getWeaponStars?: (key: string) => number;
  getWeaponName?: (key: string) => string | null | undefined;
  getSetName?: (key: string) => string | null | undefined;
  translateStat?: (key: string) => string;
};

/** Progress advice axis for icons / current→target copy. */
export type AccountBuildAdviceKind =
  | "level"
  | "ascension"
  | "normal"
  | "skill"
  | "burst";

export type AccountBuildAdviceStep = {
  kind: AccountBuildAdviceKind;
  current: number;
  target: number;
};

export type AccountBuildGrade = {
  bucket: AccountBuildBucket;
  /** Whether weapon + five artifact slots are equipped (informational). */
  complete: boolean;
  /** Axis checks when a usable summary exists; null when ungraded. */
  axes: Record<AccountBuildAxis, boolean> | null;
  /** Progress gaps only (drives Needs work). */
  gaps: AccountBuildAxis[];
  /** Structured progress gaps (current → target). Empty when Built well / ungraded copy. */
  adviceSteps: AccountBuildAdviceStep[];
  /** Text lines — formatted steps, or ungraded guidance. */
  advice: string[];
  /** Soft gear tips; do not affect the bucket. */
  aside: string[];
  /**
   * Higher = upgrade first within Needs work.
   * Sum of Builds % impact for lagging level/ascension/talent slots.
   */
  priority: number;
  /** Why Ungraded, when applicable. */
  ungradedReason: "missing" | "stale" | "error" | null;
};

/** Genshin UI item stems for level / ascension advice icons. */
export const ACCOUNT_BUILD_ADVICE_UI_ICON: Partial<
  Record<AccountBuildAdviceKind, string>
> = {
  level: "UI_ItemIcon_104003",
  ascension: "UI_ItemIcon_104104",
};

/** Resolve advice icon: level/ascension UI items, or kit talent URLs. */
export function adviceStepIconSrc(
  kind: AccountBuildAdviceKind,
  talents?: {
    auto: string | null;
    skill: string | null;
    burst: string | null;
  } | null,
  uiAssetUrl: (uiName: string) => string = (n) => n,
): string | null {
  const ui = ACCOUNT_BUILD_ADVICE_UI_ICON[kind];
  if (ui) return uiAssetUrl(ui);
  if (!talents) return null;
  if (kind === "normal") return talents.auto;
  if (kind === "skill") return talents.skill;
  if (kind === "burst") return talents.burst;
  return null;
}

export function formatAdviceStep(step: AccountBuildAdviceStep): string {
  switch (step.kind) {
    case "level":
      return `Lv ${step.current} → Lv ${step.target}`;
    case "ascension":
      return `A${step.current} → A${step.target}`;
    case "normal":
      return `NA ${step.current} → ${step.target}`;
    case "skill":
      return `Skill ${step.current} → ${step.target}`;
    case "burst":
      return `Burst ${step.current} → ${step.target}`;
  }
}

export function isBuildComplete(view: RosterBuildView): boolean {
  if (!view.weapon?.key) return false;
  for (const slot of INVENTORY_ARTIFACT_SLOTS) {
    if (!view.piecesBySlot[slot]) return false;
  }
  return true;
}

export function weaponAxisOk(
  view: RosterBuildView,
  builds: CharacterIndex,
  getStars: (key: string) => number = () => 0,
): boolean {
  const key = view.weapon?.key;
  if (!key) return false;
  const ranked = rankWeaponsByRarityAndTeams(builds.weapons, getStars);
  if (ranked.length === 0) return true;
  const idx = ranked.findIndex((row) => row.key === key);
  return idx >= 0 && idx < WEAPON_OK_MAX_RANK;
}

/**
 * OK when any recommended set entry is met (equipped count ≥ recommended count
 * for that key). Empty recommendations → OK.
 */
export function setAxisOk(
  view: RosterBuildView,
  builds: CharacterIndex,
): boolean {
  const recommended = builds.sets ?? [];
  if (recommended.length === 0) return true;
  const byKey = new Map(
    view.setCounts.map((row) => [row.setKey, row.count] as const),
  );
  return recommended.some((rec) => (byKey.get(rec.key) ?? 0) >= rec.count);
}

const MAIN_SLOTS = ["sands", "goblet", "circlet"] as const;

export function mainsAxisOk(
  view: RosterBuildView,
  builds: CharacterIndex,
): boolean {
  for (const slot of MAIN_SLOTS) {
    const ranked = builds.main_stats?.[slot] ?? [];
    if (ranked.length === 0) continue;
    const piece = view.piecesBySlot[slot];
    if (!piece) return false;
    const idx = ranked.findIndex((row) => row.key === piece.mainStatKey);
    if (idx < 0 || idx >= MAIN_OK_MAX_RANK) return false;
  }
  return true;
}

export function progressAxisOk(
  view: RosterBuildView,
  builds: CharacterIndex,
  promotes: UpgradePromoteStep[] = GRADE_CHARACTER_PROMOTES,
): boolean {
  const target = plannerTargetFromBuilds(builds, promotes);
  const p = view.progress;
  if (p.level < target.level) return false;
  if (p.ascension < target.ascension) return false;
  if (p.talents.normal < target.talents.normal) return false;
  if (p.talents.skill < target.talents.skill) return false;
  if (p.talents.burst < target.talents.burst) return false;
  return true;
}

function usableSummary(
  builds: CharacterIndex | null | undefined,
  nameId: string | null | undefined,
): boolean {
  if (!builds) return false;
  if (builds.upToDate === false) return false;
  if (isStaleBuildSummary(nameId)) return false;
  return true;
}

function weaponLabel(
  key: string,
  resolvers: AccountBuildNameResolvers,
): string {
  return resolvers.getWeaponName?.(key)?.trim() || key;
}

function setLabel(key: string, resolvers: AccountBuildNameResolvers): string {
  return resolvers.getSetName?.(key)?.trim() || key;
}

function statLabel(key: string, resolvers: AccountBuildNameResolvers): string {
  return resolvers.translateStat?.(key) || key;
}

function joinNames(names: string[], max = 3): string {
  const slice = names.slice(0, max);
  if (slice.length === 0) return "";
  if (slice.length === 1) return slice[0]!;
  if (slice.length === 2) return `${slice[0]} or ${slice[1]}`;
  return `${slice.slice(0, -1).join(", ")}, or ${slice[slice.length - 1]}`;
}

function topWeaponAdvice(
  builds: CharacterIndex,
  resolvers: AccountBuildNameResolvers,
): string | null {
  const getStars = resolvers.getWeaponStars ?? (() => 0);
  const ranked = rankWeaponsByRarityAndTeams(builds.weapons, getStars).slice(
    0,
    WEAPON_OK_MAX_RANK,
  );
  if (ranked.length === 0) return null;
  const names = ranked.map((row) => weaponLabel(row.key, resolvers));
  return `Weapon: ${joinNames(names)}`;
}

function topSetAdvice(
  builds: CharacterIndex,
  resolvers: AccountBuildNameResolvers,
): string | null {
  const recommended = builds.sets ?? [];
  if (recommended.length === 0) return null;
  const best = recommended[0]!;
  const name = setLabel(best.key, resolvers);
  return `Set: ${name} ${best.count}pc`;
}

function mainsAdvice(
  view: RosterBuildView,
  builds: CharacterIndex,
  resolvers: AccountBuildNameResolvers,
): string | null {
  const parts: string[] = [];
  for (const slot of MAIN_SLOTS) {
    const ranked = builds.main_stats?.[slot] ?? [];
    if (ranked.length === 0) continue;
    const piece = view.piecesBySlot[slot];
    const idx = piece
      ? ranked.findIndex((row) => row.key === piece.mainStatKey)
      : -1;
    if (piece && idx >= 0 && idx < MAIN_OK_MAX_RANK) continue;
    const options = ranked
      .slice(0, MAIN_OK_MAX_RANK)
      .map((row) => statLabel(row.key, resolvers));
    const slotLabel =
      slot === "sands" ? "Sands" : slot === "goblet" ? "Goblet" : "Circlet";
    parts.push(`${slotLabel} ${joinNames(options)}`);
  }
  if (parts.length === 0) return null;
  return `Mains: ${parts.join(" · ")}`;
}

function progressAdviceSteps(
  view: RosterBuildView,
  builds: CharacterIndex,
  promotes: UpgradePromoteStep[],
): AccountBuildAdviceStep[] {
  const target = plannerTargetFromBuilds(builds, promotes);
  const p = view.progress;
  const steps: AccountBuildAdviceStep[] = [];
  if (p.level < target.level) {
    steps.push({ kind: "level", current: p.level, target: target.level });
  }
  if (p.ascension < target.ascension) {
    steps.push({
      kind: "ascension",
      current: p.ascension,
      target: target.ascension,
    });
  }
  if (p.talents.normal < target.talents.normal) {
    steps.push({
      kind: "normal",
      current: p.talents.normal,
      target: target.talents.normal,
    });
  }
  if (p.talents.skill < target.talents.skill) {
    steps.push({
      kind: "skill",
      current: p.talents.skill,
      target: target.talents.skill,
    });
  }
  if (p.talents.burst < target.talents.burst) {
    steps.push({
      kind: "burst",
      current: p.talents.burst,
      target: target.talents.burst,
    });
  }
  return steps;
}

function slotImpactPct(
  row:
    | { mean_pct_drop: number; median_pct_drop: number }
    | null
    | undefined,
): number {
  if (!row) return 0;
  return Math.abs(primaryUpgradePct(row.mean_pct_drop, row.median_pct_drop));
}

/**
 * Rank Needs work characters by Builds impact of unfinished level/talent work.
 */
export function progressPriority(
  view: RosterBuildView,
  builds: CharacterIndex,
  promotes: UpgradePromoteStep[] = GRADE_CHARACTER_PROMOTES,
): number {
  const target = plannerTargetFromBuilds(builds, promotes);
  const p = view.progress;
  let score = 0;
  if (p.level < target.level) {
    score += slotImpactPct(builds.level_importance);
  }
  if (p.ascension < target.ascension) {
    score += slotImpactPct(builds.ascension_importance);
  }
  const talent = builds.talent_importance;
  if (p.talents.normal < target.talents.normal) {
    score += slotImpactPct(talent?.auto);
  }
  if (p.talents.skill < target.talents.skill) {
    score += slotImpactPct(talent?.skill);
  }
  if (p.talents.burst < target.talents.burst) {
    score += slotImpactPct(talent?.burst);
  }
  return score;
}

/** Soft gear notes only — never drives the bucket. */
function gearAside(
  view: RosterBuildView,
  builds: CharacterIndex,
  resolvers: AccountBuildNameResolvers,
): string[] {
  const aside: string[] = [];
  const getStars = resolvers.getWeaponStars ?? (() => 0);
  if (!weaponAxisOk(view, builds, getStars)) {
    const line = topWeaponAdvice(builds, resolvers);
    if (line) aside.push(line);
  }
  if (!setAxisOk(view, builds)) {
    const line = topSetAdvice(builds, resolvers);
    if (line) aside.push(line);
  }
  if (!mainsAxisOk(view, builds)) {
    const line = mainsAdvice(view, builds, resolvers);
    if (line) aside.push(line);
  }
  return aside;
}

/**
 * Grade one owned build view against its Builds summary.
 * Pass `summaryError: true` when the fetch threw (Ungraded · error).
 */
export function gradeOwnedBuild(input: {
  view: RosterBuildView;
  builds: CharacterIndex | null | undefined;
  /** Roster / kit name_id for stale-summary checks. */
  nameId?: string | null;
  summaryError?: boolean;
  getWeaponStars?: (key: string) => number;
  getWeaponName?: (key: string) => string | null | undefined;
  getSetName?: (key: string) => string | null | undefined;
  translateStat?: (key: string) => string;
  promotes?: UpgradePromoteStep[];
}): AccountBuildGrade {
  const resolvers: AccountBuildNameResolvers = {
    getWeaponStars: input.getWeaponStars,
    getWeaponName: input.getWeaponName,
    getSetName: input.getSetName,
    translateStat: input.translateStat,
  };
  const complete = isBuildComplete(input.view);

  if (input.summaryError) {
    return {
      bucket: "ungraded",
      complete,
      axes: null,
      gaps: [],
      adviceSteps: [],
      advice: ["Retry loading Builds, then open the character page"],
      aside: [],
      priority: 0,
      ungradedReason: "error",
    };
  }

  if (!usableSummary(input.builds, input.nameId)) {
    const reason: "missing" | "stale" =
      input.builds?.upToDate === false || isStaleBuildSummary(input.nameId)
        ? "stale"
        : "missing";
    return {
      bucket: "ungraded",
      complete,
      axes: null,
      gaps: [],
      adviceSteps: [],
      advice:
        reason === "stale"
          ? ["Builds is outdated — check the character page for guides"]
          : ["No Builds data yet — open the character page when available"],
      aside: [],
      priority: 0,
      ungradedReason: reason,
    };
  }

  const builds = input.builds!;
  const getStars = input.getWeaponStars ?? (() => 0);
  const promotes = input.promotes ?? GRADE_CHARACTER_PROMOTES;
  const axes: Record<AccountBuildAxis, boolean> = {
    weapon: weaponAxisOk(input.view, builds, getStars),
    set: setAxisOk(input.view, builds),
    mains: mainsAxisOk(input.view, builds),
    progress: progressAxisOk(input.view, builds, promotes),
  };
  const progressOk = axes.progress;
  const adviceSteps = progressOk
    ? []
    : progressAdviceSteps(input.view, builds, promotes);
  const priority = progressOk
    ? 0
    : progressPriority(input.view, builds, promotes);

  return {
    bucket: progressOk ? "built_well" : "needs_work",
    complete,
    axes,
    gaps: progressOk ? [] : ["progress"],
    adviceSteps,
    advice: progressOk
      ? []
      : adviceSteps.length > 0
        ? adviceSteps.map(formatAdviceStep)
        : ["Raise level, ascension, or talents"],
    // Gear tips only on the recommendation bucket — keep Built well clean.
    aside: progressOk ? [] : gearAside(input.view, builds, resolvers),
    priority,
    ungradedReason: null,
  };
}

export function compareGradeRows(
  a: { grade: AccountBuildGrade; sortName: string; nameId?: string },
  b: { grade: AccountBuildGrade; sortName: string; nameId?: string },
  creamNameIds?: ReadonlySet<string> | null,
  usageByNameId?: ReadonlyMap<string, number> | null,
): number {
  if (creamNameIds && creamNameIds.size > 0) {
    const aCream = a.nameId && creamNameIds.has(a.nameId) ? 1 : 0;
    const bCream = b.nameId && creamNameIds.has(b.nameId) ? 1 : 0;
    if (aCream !== bCream) return bCream - aCream;
  }
  if (usageByNameId && usageByNameId.size > 0) {
    const aUsage = (a.nameId && usageByNameId.get(a.nameId)) || 0;
    const bUsage = (b.nameId && usageByNameId.get(b.nameId)) || 0;
    if (aUsage !== bUsage) return bUsage - aUsage;
  }
  return a.sortName.localeCompare(b.sortName);
}

export const ACCOUNT_BUILD_BUCKET_ORDER: AccountBuildBucket[] = [
  "needs_work",
  "built_well",
  "ungraded",
];

export const ACCOUNT_BUILD_BUCKET_LABEL: Record<AccountBuildBucket, string> = {
  needs_work: "Needs work",
  built_well: "Built well",
  ungraded: "Ungraded",
};

export const ACCOUNT_BUILD_AXIS_LABEL: Record<AccountBuildAxis, string> = {
  weapon: "Weapon",
  set: "Set",
  mains: "Mains",
  progress: "Progress",
};

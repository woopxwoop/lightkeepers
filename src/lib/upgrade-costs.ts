/**
 * Pure start→target upgrade cost math (characters + weapons).
 */
import type {
  CharacterUpgradeConfig,
  CharacterUpgradeCosts,
  UpgradeCostItem,
  UpgradeCostResult,
  UpgradeCurves,
  UpgradePromoteStep,
  UpgradeTalentTrack,
  WeaponUpgradeConfig,
  WeaponUpgradeCosts,
} from "$lib/types/upgrade-costs";

export const MAX_LEVEL = 90;
export const MAX_ASCENSION = 6;
export const MAX_TALENT = 10;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function addItems(bag: Record<string, number>, items: UpgradeCostItem[]): void {
  for (const it of items) {
    const key = String(it.id);
    bag[key] = (bag[key] ?? 0) + it.count;
  }
}

function emptyResult(): UpgradeCostResult {
  return { mora: 0, exp: 0, materials: {} };
}

/** Max character/weapon level unlocked at this ascension (from promote table). */
export function maxLevelForAscension(
  promotes: UpgradePromoteStep[],
  ascension: number,
): number {
  const row = promotes.find((p) => p.promoteLevel === ascension);
  return row?.unlockMaxLevel ?? MAX_LEVEL;
}

/**
 * Minimum level for this ascension (previous phase's unlock max).
 * Asc 0 → 1; asc 6 → 80 for standard 90 caps.
 */
export function minLevelForAscension(
  promotes: UpgradePromoteStep[],
  ascension: number,
): number {
  const a = clamp(ascension, 0, MAX_ASCENSION);
  if (a <= 0) return 1;
  const prev = promotes.find((p) => p.promoteLevel === a - 1);
  return prev?.unlockMaxLevel ?? 1;
}

/**
 * Lowest ascension that unlocks `level` (or 6 if above all caps).
 */
export function minAscensionForLevel(
  promotes: UpgradePromoteStep[],
  level: number,
): number {
  if (promotes.length === 0 || level <= 1) return 0;
  const sorted = [...promotes].sort((a, b) => a.promoteLevel - b.promoteLevel);
  for (const step of sorted) {
    if (step.unlockMaxLevel >= level) return step.promoteLevel;
  }
  return MAX_ASCENSION;
}

/**
 * Combat talent cap by character ascension phase.
 * Asc 0–1 → 1; 2 → 2; 3 → 4; 4 → 6; 5 → 8; 6 → 10.
 */
export function maxTalentForAscension(ascension: number): number {
  const a = clamp(ascension, 0, MAX_ASCENSION);
  if (a < 2) return 1;
  if (a === 2) return 2;
  if (a === 3) return 4;
  if (a === 4) return 6;
  if (a === 5) return 8;
  return MAX_TALENT;
}

/** Lowest ascension that allows a given combat talent level. */
export function minAscensionForTalent(talentLevel: number): number {
  const t = clamp(talentLevel, 1, MAX_TALENT);
  if (t <= 1) return 0;
  if (t <= 2) return 2;
  if (t <= 4) return 3;
  if (t <= 6) return 4;
  if (t <= 8) return 5;
  return 6;
}

/** Clamp level/talents to ascension; raise ascension if level/talents require it. */
export function gateCharacterConfig(
  cfg: CharacterUpgradeConfig,
  promotes: UpgradePromoteStep[],
  opts?: {
    /** When true, keep ascension and clamp level/talents down. */ preferAscension?: boolean;
  },
): CharacterUpgradeConfig {
  if (opts?.preferAscension) {
    const ascension = clamp(cfg.ascension, 0, MAX_ASCENSION);
    const minLevel = minLevelForAscension(promotes, ascension);
    const maxLevel = maxLevelForAscension(promotes, ascension);
    const maxTalent = maxTalentForAscension(ascension);
    return {
      level: clamp(cfg.level, minLevel, maxLevel),
      ascension,
      talents: {
        normal: clamp(cfg.talents.normal, 1, maxTalent),
        skill: clamp(cfg.talents.skill, 1, maxTalent),
        burst: clamp(cfg.talents.burst, 1, maxTalent),
      },
    };
  }

  let ascension = clamp(cfg.ascension, 0, MAX_ASCENSION);
  let level = clamp(cfg.level, 1, MAX_LEVEL);
  let normal = clamp(cfg.talents.normal, 1, MAX_TALENT);
  let skill = clamp(cfg.talents.skill, 1, MAX_TALENT);
  let burst = clamp(cfg.talents.burst, 1, MAX_TALENT);

  ascension = Math.max(
    ascension,
    minAscensionForLevel(promotes, level),
    minAscensionForTalent(normal),
    minAscensionForTalent(skill),
    minAscensionForTalent(burst),
  );
  ascension = clamp(ascension, 0, MAX_ASCENSION);

  const minLevel = minLevelForAscension(promotes, ascension);
  const maxLevel = maxLevelForAscension(promotes, ascension);
  const maxTalent = maxTalentForAscension(ascension);
  level = clamp(level, minLevel, maxLevel);
  normal = clamp(normal, 1, maxTalent);
  skill = clamp(skill, 1, maxTalent);
  burst = clamp(burst, 1, maxTalent);

  return {
    level,
    ascension,
    talents: { normal, skill, burst },
  };
}

/** Clamp weapon level to ascension; raise ascension if level requires it. */
export function gateWeaponConfig(
  cfg: WeaponUpgradeConfig,
  promotes: UpgradePromoteStep[],
  opts?: { preferAscension?: boolean },
): WeaponUpgradeConfig {
  if (opts?.preferAscension) {
    const ascension = clamp(cfg.ascension, 0, MAX_ASCENSION);
    const minLevel = minLevelForAscension(promotes, ascension);
    const maxLevel = maxLevelForAscension(promotes, ascension);
    return {
      level: clamp(cfg.level, minLevel, maxLevel),
      ascension,
    };
  }

  let ascension = clamp(cfg.ascension, 0, MAX_ASCENSION);
  let level = clamp(cfg.level, 1, MAX_LEVEL);

  ascension = Math.max(ascension, minAscensionForLevel(promotes, level));
  ascension = clamp(ascension, 0, MAX_ASCENSION);

  const minLevel = minLevelForAscension(promotes, ascension);
  const maxLevel = maxLevelForAscension(promotes, ascension);
  level = clamp(level, minLevel, maxLevel);

  return { level, ascension };
}

function normalizeCharacterConfig(
  cfg: CharacterUpgradeConfig,
  costs: CharacterUpgradeCosts,
): CharacterUpgradeConfig {
  return gateCharacterConfig(cfg, costs.promotes);
}

function normalizeWeaponConfig(
  cfg: WeaponUpgradeConfig,
  costs: WeaponUpgradeCosts,
): WeaponUpgradeConfig {
  return gateWeaponConfig(cfg, costs.promotes);
}

/** EXP to go from `fromLevel` up to (but not including) `toLevel`. */
export function sumLevelExp(
  curve: number[],
  fromLevel: number,
  toLevel: number,
): number {
  if (toLevel <= fromLevel) return 0;
  let total = 0;
  for (let level = fromLevel; level < toLevel; level++) {
    total += curve[level] ?? 0;
  }
  return total;
}

function sumPromoteCosts(
  promotes: UpgradePromoteStep[],
  fromAsc: number,
  toAsc: number,
): { mora: number; items: UpgradeCostItem[] } {
  if (toAsc <= fromAsc) return { mora: 0, items: [] };
  let mora = 0;
  const items: UpgradeCostItem[] = [];
  for (const step of promotes) {
    // Cost on promoteLevel N is paid when ascending to N (from N-1).
    if (step.promoteLevel <= fromAsc || step.promoteLevel > toAsc) continue;
    mora += step.mora;
    items.push(...step.items);
  }
  return { mora, items };
}

function sumTalentTrack(
  track: UpgradeTalentTrack,
  fromLevel: number,
  toLevel: number,
): { mora: number; items: UpgradeCostItem[] } {
  if (toLevel <= fromLevel) return { mora: 0, items: [] };
  let mora = 0;
  const items: UpgradeCostItem[] = [];
  for (const row of track.levels) {
    // Cost on row.level L is paid when raising talent to L.
    if (row.level <= fromLevel || row.level > toLevel) continue;
    mora += row.mora;
    items.push(...row.items);
  }
  return { mora, items };
}

export function diffCharacterUpgrade(
  costs: CharacterUpgradeCosts,
  curves: UpgradeCurves,
  startRaw: CharacterUpgradeConfig,
  targetRaw: CharacterUpgradeConfig,
): UpgradeCostResult {
  const start = normalizeCharacterConfig(startRaw, costs);
  const target = normalizeCharacterConfig(targetRaw, costs);

  // If target is "behind" start on any axis, treat as zero for that axis.
  const out = emptyResult();

  const levelFrom = start.level;
  const levelTo = Math.max(start.level, target.level);
  // Ascension must rise enough to unlock target level; use explicit target ascension.
  const ascFrom = start.ascension;
  const ascTo = Math.max(start.ascension, target.ascension);

  const promote = sumPromoteCosts(costs.promotes, ascFrom, ascTo);
  out.mora += promote.mora;
  addItems(out.materials, promote.items);

  out.exp += sumLevelExp(curves.avatarLevelExp, levelFrom, levelTo);

  for (const key of ["normal", "skill", "burst"] as const) {
    const from = start.talents[key];
    const to = Math.max(from, target.talents[key]);
    const talent = sumTalentTrack(costs.talents[key], from, to);
    out.mora += talent.mora;
    addItems(out.materials, talent.items);
  }

  return out;
}

export function diffWeaponUpgrade(
  costs: WeaponUpgradeCosts,
  curves: UpgradeCurves,
  startRaw: WeaponUpgradeConfig,
  targetRaw: WeaponUpgradeConfig,
): UpgradeCostResult {
  const start = normalizeWeaponConfig(startRaw, costs);
  const target = normalizeWeaponConfig(targetRaw, costs);
  const out = emptyResult();

  const ascFrom = start.ascension;
  const ascTo = Math.max(start.ascension, target.ascension);
  const promote = sumPromoteCosts(costs.promotes, ascFrom, ascTo);
  out.mora += promote.mora;
  addItems(out.materials, promote.items);

  const rarityKey = String(clamp(costs.rankLevel, 1, 5));
  const curve = curves.weaponLevelExpByRarity[rarityKey] ?? [];
  const levelFrom = start.level;
  const levelTo = Math.max(start.level, target.level);
  out.exp += sumLevelExp(curve, levelFrom, levelTo);

  return out;
}

/** Greedy book/ore counts for an EXP total (largest first). */
export function expItemsNeeded(
  expNeeded: number,
  items: { id: number; exp: number }[],
): UpgradeCostItem[] {
  if (expNeeded <= 0 || items.length === 0) return [];
  const sorted = items
    .filter((item) => item.exp > 0)
    .sort((a, b) => b.exp - a.exp);
  if (sorted.length === 0) return [];
  let remaining = expNeeded;
  const out: UpgradeCostItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]!;
    const isLast = i === sorted.length - 1;
    const count = isLast
      ? Math.ceil(remaining / item.exp)
      : Math.floor(remaining / item.exp);
    if (count > 0) {
      out.push({ id: item.id, count });
      remaining -= count * item.exp;
    }
  }
  return out.filter((x) => x.count > 0);
}

export const UPGRADE_DEFAULTS = {
  characterStart: {
    level: 1,
    ascension: 0,
    talents: { normal: 1, skill: 1, burst: 1 },
  } satisfies CharacterUpgradeConfig,
  characterTarget: {
    level: 70,
    ascension: 4,
    talents: { normal: 1, skill: 1, burst: 1 },
  } satisfies CharacterUpgradeConfig,
  weaponStart: { level: 1, ascension: 0 } satisfies WeaponUpgradeConfig,
  weaponTarget: { level: 90, ascension: 6 } satisfies WeaponUpgradeConfig,
} as const;

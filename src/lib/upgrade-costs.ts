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

const MAX_LEVEL = 90;
const MAX_ASCENSION = 6;
const MAX_TALENT = 10;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function addItems(
  bag: Record<string, number>,
  items: UpgradeCostItem[],
): void {
  for (const it of items) {
    const key = String(it.id);
    bag[key] = (bag[key] ?? 0) + it.count;
  }
}

function emptyResult(): UpgradeCostResult {
  return { mora: 0, exp: 0, materials: {} };
}

function maxLevelForAscension(
  promotes: UpgradePromoteStep[],
  ascension: number,
): number {
  const row = promotes.find((p) => p.promoteLevel === ascension);
  return row?.unlockMaxLevel ?? MAX_LEVEL;
}

function normalizeCharacterConfig(
  cfg: CharacterUpgradeConfig,
  costs: CharacterUpgradeCosts,
): CharacterUpgradeConfig {
  const ascension = clamp(cfg.ascension, 0, MAX_ASCENSION);
  const maxLevel = maxLevelForAscension(costs.promotes, ascension);
  return {
    level: clamp(cfg.level, 1, maxLevel),
    ascension,
    talents: {
      normal: clamp(cfg.talents.normal, 1, MAX_TALENT),
      skill: clamp(cfg.talents.skill, 1, MAX_TALENT),
      burst: clamp(cfg.talents.burst, 1, MAX_TALENT),
    },
  };
}

function normalizeWeaponConfig(
  cfg: WeaponUpgradeConfig,
  costs: WeaponUpgradeCosts,
): WeaponUpgradeConfig {
  const ascension = clamp(cfg.ascension, 0, MAX_ASCENSION);
  const maxLevel = maxLevelForAscension(costs.promotes, ascension);
  return {
    level: clamp(cfg.level, 1, maxLevel),
    ascension,
  };
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
  const sorted = [...items].sort((a, b) => b.exp - a.exp);
  let remaining = expNeeded;
  const out: UpgradeCostItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i]!;
    const isLast = i === sorted.length - 1;
    if (item.exp <= 0) continue;
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
    level: 90,
    ascension: 6,
    talents: { normal: 9, skill: 9, burst: 9 },
  } satisfies CharacterUpgradeConfig,
  weaponStart: { level: 1, ascension: 0 } satisfies WeaponUpgradeConfig,
  weaponTarget: { level: 90, ascension: 6 } satisfies WeaponUpgradeConfig,
} as const;

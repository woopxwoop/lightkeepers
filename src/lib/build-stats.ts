/**
 * Approximate character sheet stats.
 *
 * Shared sources:
 * - Character bases + AvatarCurve / promote tables (`character-bases.json`,
 *   `character-stat-curves.json`) — roster uses real level/ascension
 * - Weapon L90 ATK + substat (`weapons.json`) for now
 * - Artifact mains (`ARTIFACT_MAIN_STAT_VALUE` / flower+plume flats)
 *
 * Two entry points:
 * - {@link computeBuildSheetStats} — gcsim / investment builds (L90 bake)
 * - {@link computeRosterSheetStats} — GOOD inventory + roster level curve
 *
 * Does **not** include artifact set bonuses or weapon passives (conditional).
 */
import characterBasesRaw from "$lib/data/character-bases.json";
import characterStatCurvesRaw from "$lib/data/character-stat-curves.json";
import { weaponByKey, type WeaponData } from "$lib/equipment-data";
import type { InventoryArtifact } from "$lib/definitions";
import type { CharacterBuild } from "$lib/types/investment";

export type CharacterPromoteStep = {
  asc: number;
  hp: number;
  atk: number;
  def: number;
  stats: Record<string, number>;
};

export interface CharacterBaseStats {
  name_id: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  ascension: Record<string, number>;
  baseCritRate: number;
  baseCritDMG: number;
  /** Pre-curve AvatarExcel flats (present after curve extract). */
  hpBase?: number;
  atkBase?: number;
  defBase?: number;
  growCurves?: { hp: string; atk: string; def: string };
  promotes?: CharacterPromoteStep[];
}

export const characterBaseByKey = new Map(
  Object.entries(characterBasesRaw as Record<string, CharacterBaseStats>),
);

/** GROW_CURVE_* → level string → multiplier. */
export const characterStatCurves = characterStatCurvesRaw as Record<
  string,
  Record<string, number>
>;

function roundStat(n: number): number {
  return Math.round(n * 10) / 10;
}

function curveMult(growCurve: string, level: number): number {
  const bag = characterStatCurves[growCurve];
  if (!bag) return 1;
  return bag[String(level)] ?? bag[String(Math.min(90, level))] ?? 1;
}

/**
 * Resolve HP/ATK/DEF (+ ascension secondaries) for a roster level / promote.
 * Falls back to the baked L90 row when curve fields are missing.
 */
export function resolveCharacterBaseStats(
  characterKey: string,
  level = 90,
  ascension = 6,
): CharacterBaseStats | null {
  const row = characterBaseByKey.get(characterKey);
  if (!row) return null;
  if (
    row.hpBase == null ||
    row.atkBase == null ||
    row.defBase == null ||
    !row.growCurves ||
    !row.promotes?.length
  ) {
    return row;
  }

  const lv = Math.max(1, Math.min(100, Math.floor(level)));
  const asc = Math.max(0, Math.min(6, Math.floor(ascension)));
  const promote =
    row.promotes.find((p) => p.asc === asc) ??
    row.promotes[asc] ??
    row.promotes[row.promotes.length - 1]!;

  return {
    ...row,
    level: lv,
    hp: roundStat(
      row.hpBase * curveMult(row.growCurves.hp, lv) + promote.hp,
    ),
    atk: roundStat(
      row.atkBase * curveMult(row.growCurves.atk, lv) + promote.atk,
    ),
    def: roundStat(
      row.defBase * curveMult(row.growCurves.def, lv) + promote.def,
    ),
    ascension: { ...promote.stats },
  };
}

/** L90 artifact main-stat values (GOOD StatKey → number). Percents are fractions. */
export const ARTIFACT_MAIN_STAT_VALUE: Record<string, number> = {
  hp_: 0.466,
  atk_: 0.466,
  def_: 0.583,
  eleMas: 187,
  enerRech_: 0.518,
  critRate_: 0.311,
  critDMG_: 0.622,
  heal_: 0.359,
  physical_dmg_: 0.583,
  pyro_dmg_: 0.466,
  hydro_dmg_: 0.466,
  dendro_dmg_: 0.466,
  electro_dmg_: 0.466,
  anemo_dmg_: 0.466,
  cryo_dmg_: 0.466,
  geo_dmg_: 0.466,
};

const FLOWER_HP = 4780;
const PLUME_ATK = 311;

/** Per-roll substat values used by gcsim OptimFull defaults. */
export const SUBSTAT_ROLL_VALUE: Record<string, number> = {
  def_: 0.062,
  def: 19.68,
  hp: 253.94,
  hp_: 0.0496,
  atk: 16.54,
  atk_: 0.0496,
  enerRech_: 0.0551,
  eleMas: 19.82,
  critRate_: 0.0331,
  critDMG_: 0.0662,
};

/** Artifact substat keys only (excludes elemental DMG / heal / physical mains). */
export const ARTIFACT_SUBSTAT_KEYS = new Set(Object.keys(SUBSTAT_ROLL_VALUE));

/**
 * Max rolls of one substat on one piece for goal display. OptimFull ignores
 * piece mains and can over-allocate — UI clamps to 3 × eligible pieces
 * (e.g. EM/EM/EM → 6 EM on flower+plume; ATK/ATK/CR → 12 CR max).
 */
export const MAX_SUBSTAT_ROLLS_PER_PIECE = 3;

export function isArtifactSubstatKey(key: string): boolean {
  return ARTIFACT_SUBSTAT_KEYS.has(key);
}

export type MainStatSlots = {
  sands?: string;
  goblet?: string;
  circlet?: string;
};

/**
 * Pieces that can hold ``stat`` as a substat given flower/plume mains and the
 * three selectable mains (EM/EM/EM → only flower + plume for EM).
 */
export function eligibleSubstatPieceCount(
  stat: string,
  mainStats: MainStatSlots | null | undefined,
): number {
  let n = 0;
  // Flower main is flat HP; plume main is flat ATK.
  if (stat !== "hp") n += 1;
  if (stat !== "atk") n += 1;
  for (const slot of ["sands", "goblet", "circlet"] as const) {
    if (mainStats?.[slot] !== stat) n += 1;
  }
  return n;
}

export function maxSubstatRolls(
  stat: string,
  mainStats: MainStatSlots | null | undefined,
): number {
  return (
    MAX_SUBSTAT_ROLLS_PER_PIECE * eligibleSubstatPieceCount(stat, mainStats)
  );
}

/** Cap each OptimFull roll count to what artifact pieces can actually hold. */
export function clampSubstatRolls(
  rolls: Record<string, number> | null | undefined,
  mainStats: MainStatSlots | null | undefined,
): Record<string, number> {
  if (!rolls) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(rolls)) {
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
    const n = Math.floor(raw);
    if (!ARTIFACT_SUBSTAT_KEYS.has(key)) {
      out[key] = n;
      continue;
    }
    const capped = Math.min(n, maxSubstatRolls(key, mainStats));
    if (capped > 0) out[key] = capped;
  }
  return out;
}

export const WEAPON_PROP_TO_GOOD: Record<string, string> = {
  FIGHT_PROP_HP_PERCENT: "hp_",
  FIGHT_PROP_ATTACK_PERCENT: "atk_",
  FIGHT_PROP_DEFENSE_PERCENT: "def_",
  FIGHT_PROP_CRITICAL: "critRate_",
  FIGHT_PROP_CRITICAL_HURT: "critDMG_",
  FIGHT_PROP_CHARGE_EFFICIENCY: "enerRech_",
  FIGHT_PROP_ELEMENT_MASTERY: "eleMas",
  FIGHT_PROP_PHYSICAL_ADD_HURT: "physical_dmg_",
  FIGHT_PROP_FIRE_ADD_HURT: "pyro_dmg_",
  FIGHT_PROP_WATER_ADD_HURT: "hydro_dmg_",
  FIGHT_PROP_GRASS_ADD_HURT: "dendro_dmg_",
  FIGHT_PROP_ELEC_ADD_HURT: "electro_dmg_",
  FIGHT_PROP_WIND_ADD_HURT: "anemo_dmg_",
  FIGHT_PROP_ICE_ADD_HURT: "cryo_dmg_",
  FIGHT_PROP_ROCK_ADD_HURT: "geo_dmg_",
  FIGHT_PROP_HEAL_ADD: "heal_",
};

export interface SheetStatBag {
  flatHp: number;
  flatAtk: number;
  flatDef: number;
  hpPct: number;
  atkPct: number;
  defPct: number;
  eleMas: number;
  /** Absolute ER (1.0 = 100%). */
  enerRech: number;
  critRate: number;
  critDMG: number;
  dmgBonus: Record<string, number>;
  heal: number;
  /** Character L90 HP (pre-artifact). */
  hpBase: number;
  /** Character L90 ATK + weapon base ATK. */
  atkBase: number;
  /** Character L90 DEF. */
  defBase: number;
  hp: number;
  atk: number;
  def: number;
}

function add(bag: Record<string, number>, key: string, amount: number): void {
  if (!amount) return;
  bag[key] = (bag[key] ?? 0) + amount;
}

/**
 * GOOD inventory stores percents as display units (10.5 = 10.5%).
 * Sheet math uses fractions (0.105). Flat keys stay as-is.
 */
export function goodInventoryStatToSheet(key: string, value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (key.endsWith("_")) return value / 100;
  return value;
}

type SheetAccum = {
  flatHp: number;
  flatAtk: number;
  flatDef: number;
  hpPct: number;
  atkPct: number;
  defPct: number;
  eleMas: number;
  enerRech: number;
  critRate: number;
  critDMG: number;
  heal: number;
  dmgBonus: Record<string, number>;
};

function emptyAccum(base: CharacterBaseStats): SheetAccum {
  return {
    flatHp: 0,
    flatAtk: 0,
    flatDef: 0,
    hpPct: 0,
    atkPct: 0,
    defPct: 0,
    eleMas: 0,
    enerRech: 1,
    critRate: base.baseCritRate,
    critDMG: base.baseCritDMG,
    heal: 0,
    dmgBonus: {},
  };
}

function applySheetStat(acc: SheetAccum, key: string, amount: number): void {
  if (!amount) return;
  if (key === "hp") acc.flatHp += amount;
  else if (key === "atk") acc.flatAtk += amount;
  else if (key === "def") acc.flatDef += amount;
  else if (key === "hp_") acc.hpPct += amount;
  else if (key === "atk_") acc.atkPct += amount;
  else if (key === "def_") acc.defPct += amount;
  else if (key === "eleMas") acc.eleMas += amount;
  else if (key === "enerRech_") acc.enerRech += amount;
  else if (key === "critRate_") acc.critRate += amount;
  else if (key === "critDMG_") acc.critDMG += amount;
  else if (key === "heal_") acc.heal += amount;
  else if (key.endsWith("_dmg_")) add(acc.dmgBonus, key, amount);
}

function applyAscension(acc: SheetAccum, base: CharacterBaseStats): void {
  for (const [k, v] of Object.entries(base.ascension)) {
    applySheetStat(acc, k, v);
  }
}

function applyWeaponSub(acc: SheetAccum, weapon: WeaponData | undefined): void {
  if (!weapon?.subStat) return;
  const good = WEAPON_PROP_TO_GOOD[weapon.subStat.propType];
  if (!good) return;
  applySheetStat(acc, good, weapon.subStat.value);
}

function finalizeSheet(
  acc: SheetAccum,
  base: CharacterBaseStats,
  weaponAtk: number,
): SheetStatBag {
  const hpBase = base.hp;
  const atkBase = base.atk + weaponAtk;
  const defBase = base.def;
  return {
    flatHp: acc.flatHp,
    flatAtk: acc.flatAtk,
    flatDef: acc.flatDef,
    hpPct: acc.hpPct,
    atkPct: acc.atkPct,
    defPct: acc.defPct,
    eleMas: acc.eleMas,
    enerRech: acc.enerRech,
    critRate: acc.critRate,
    critDMG: acc.critDMG,
    dmgBonus: acc.dmgBonus,
    heal: acc.heal,
    hpBase,
    atkBase,
    defBase,
    hp: hpBase * (1 + acc.hpPct) + acc.flatHp,
    atk: atkBase * (1 + acc.atkPct) + acc.flatAtk,
    def: defBase * (1 + acc.defPct) + acc.flatDef,
  };
}

/**
 * Compute approximate total stats for one CharacterBuild.
 * Returns null when the character base row is missing.
 */
export function computeBuildSheetStats(
  build: CharacterBuild,
): SheetStatBag | null {
  const base = characterBaseByKey.get(build.key);
  if (!base) return null;
  const weapon: WeaponData | undefined = weaponByKey.get(build.weapon.key);
  const acc = emptyAccum(base);

  applyAscension(acc, base);
  applyWeaponSub(acc, weapon);

  // Investment builds always assume a full +20 flower / plume.
  acc.flatHp += FLOWER_HP;
  acc.flatAtk += PLUME_ATK;

  for (const key of Object.values(build.main_stats)) {
    const v = ARTIFACT_MAIN_STAT_VALUE[key];
    if (v == null) continue;
    applySheetStat(acc, key, v);
  }

  for (const [key, count] of Object.entries(
    clampSubstatRolls(build.substat_rolls, build.main_stats),
  )) {
    const per = SUBSTAT_ROLL_VALUE[key];
    if (per == null || !count) continue;
    applySheetStat(acc, key, per * count);
  }

  return finalizeSheet(acc, base, weapon?.baseAtk ?? 0);
}

export type RosterSheetInput = {
  /** GOOD character key (e.g. `HuTao`). */
  characterKey: string;
  /** Roster level (1–90+). Defaults to 90 when omitted. */
  level?: number;
  /** Roster ascension / promote (0–6). Defaults to 6 when omitted. */
  ascension?: number;
  weaponKey?: string | null;
  pieces: readonly (InventoryArtifact | null | undefined)[];
};

/**
 * Sheet totals from roster + GOOD inventory pieces.
 * Character HP/ATK/DEF follow AvatarCurve at {@link RosterSheetInput.level}
 * and promote bonuses at {@link RosterSheetInput.ascension}.
 * Mains use L90 +20 constants (same as card display). Substats use inventory
 * values (percents ÷ 100). Missing flower/plume → no flat main for that slot.
 * Weapon ATK/substat still use the L90 weapon table.
 */
export function computeRosterSheetStats(
  input: RosterSheetInput,
): SheetStatBag | null {
  const base = resolveCharacterBaseStats(
    input.characterKey,
    input.level ?? 90,
    input.ascension ?? 6,
  );
  if (!base) return null;
  const weaponKey = input.weaponKey ?? "";
  const weapon: WeaponData | undefined = weaponKey
    ? weaponByKey.get(weaponKey)
    : undefined;
  const acc = emptyAccum(base);

  applyAscension(acc, base);
  applyWeaponSub(acc, weapon);

  for (const piece of input.pieces) {
    if (!piece) continue;
    const mainKey = piece.mainStatKey;
    if (mainKey === "hp" && piece.slotKey === "flower") {
      acc.flatHp += FLOWER_HP;
    } else if (mainKey === "atk" && piece.slotKey === "plume") {
      acc.flatAtk += PLUME_ATK;
    } else {
      const mainVal = ARTIFACT_MAIN_STAT_VALUE[mainKey];
      if (mainVal != null) applySheetStat(acc, mainKey, mainVal);
    }
    for (const sub of piece.substats) {
      applySheetStat(
        acc,
        sub.key,
        goodInventoryStatToSheet(sub.key, sub.value),
      );
    }
  }

  return finalizeSheet(acc, base, weapon?.baseAtk ?? 0);
}

export function formatSheetStat(
  key:
    | "hp"
    | "atk"
    | "def"
    | "eleMas"
    | "enerRech"
    | "critRate"
    | "critDMG"
    | string,
  value: number,
): string {
  if (key === "hp" || key === "atk" || key === "def" || key === "eleMas") {
    return Math.round(value).toLocaleString();
  }
  if (
    key === "enerRech" ||
    key === "critRate" ||
    key === "critDMG" ||
    key === "heal" ||
    key.endsWith("_dmg_") ||
    key.endsWith("_")
  ) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toFixed(1);
}

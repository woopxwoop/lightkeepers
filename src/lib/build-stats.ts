/**
 * Approximate character sheet stats for a gcsim CharacterBuild.
 *
 * Sources:
 * - Character L90 bases + ascension (`character-bases.json`)
 * - Weapon L90 ATK + substat (`weapons.json`)
 * - Artifact flower/plume flats + sands/goblet/circlet mains (gcsim constants)
 * - Substat roll counts × per-roll values (OptimFull defaults)
 *
 * Does **not** include artifact set bonuses or weapon passives (conditional).
 */
import characterBasesRaw from "$lib/data/character-bases.json";
import { weaponByKey, type WeaponData } from "$lib/equipment-data";
import type { CharacterBuild } from "$lib/types/investment";

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
}

export const characterBaseByKey = new Map(
  Object.entries(characterBasesRaw as Record<string, CharacterBaseStats>),
);

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
 * piece mains and can over-allocate — UI clamps to 4 × eligible pieces
 * (e.g. EM/EM/EM → 8 EM on flower+plume; ATK/ATK/CR → 16 CR max).
 */
export const MAX_SUBSTAT_ROLLS_PER_PIECE = 4;

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
  return MAX_SUBSTAT_ROLLS_PER_PIECE * eligibleSubstatPieceCount(stat, mainStats);
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

const WEAPON_PROP_TO_GOOD: Record<string, string> = {
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
 * Compute approximate total stats for one CharacterBuild.
 * Returns null when the character base row is missing.
 */
export function computeBuildSheetStats(
  build: CharacterBuild,
): SheetStatBag | null {
  const base = characterBaseByKey.get(build.key);
  if (!base) return null;
  const weapon: WeaponData | undefined = weaponByKey.get(build.weapon.key);

  let flatHp = FLOWER_HP;
  let flatAtk = PLUME_ATK;
  let flatDef = 0;
  let hpPct = 0;
  let atkPct = 0;
  let defPct = 0;
  let eleMas = 0;
  let enerRech = 1;
  let critRate = base.baseCritRate;
  let critDMG = base.baseCritDMG;
  let heal = 0;
  const dmgBonus: Record<string, number> = {};

  for (const [k, v] of Object.entries(base.ascension)) {
    if (k === "eleMas") eleMas += v;
    else if (k === "enerRech_") enerRech += v;
    else if (k === "critRate_") critRate += v;
    else if (k === "critDMG_") critDMG += v;
    else if (k === "heal_") heal += v;
    else if (k === "hp_") hpPct += v;
    else if (k === "atk_") atkPct += v;
    else if (k === "def_") defPct += v;
    else if (k.endsWith("_dmg_")) add(dmgBonus, k, v);
  }

  if (weapon?.subStat) {
    const good = WEAPON_PROP_TO_GOOD[weapon.subStat.propType];
    const v = weapon.subStat.value;
    if (good === "hp_") hpPct += v;
    else if (good === "atk_") atkPct += v;
    else if (good === "def_") defPct += v;
    else if (good === "eleMas") eleMas += v;
    else if (good === "enerRech_") enerRech += v;
    else if (good === "critRate_") critRate += v;
    else if (good === "critDMG_") critDMG += v;
    else if (good === "heal_") heal += v;
    else if (good?.endsWith("_dmg_")) add(dmgBonus, good, v);
  }

  for (const key of Object.values(build.main_stats)) {
    const v = ARTIFACT_MAIN_STAT_VALUE[key];
    if (v == null) continue;
    if (key === "hp_") hpPct += v;
    else if (key === "atk_") atkPct += v;
    else if (key === "def_") defPct += v;
    else if (key === "eleMas") eleMas += v;
    else if (key === "enerRech_") enerRech += v;
    else if (key === "critRate_") critRate += v;
    else if (key === "critDMG_") critDMG += v;
    else if (key === "heal_") heal += v;
    else if (key.endsWith("_dmg_")) add(dmgBonus, key, v);
  }

  for (const [key, count] of Object.entries(
    clampSubstatRolls(build.substat_rolls, build.main_stats),
  )) {
    const per = SUBSTAT_ROLL_VALUE[key];
    if (per == null || !count) continue;
    const v = per * count;
    if (key === "hp") flatHp += v;
    else if (key === "atk") flatAtk += v;
    else if (key === "def") flatDef += v;
    else if (key === "hp_") hpPct += v;
    else if (key === "atk_") atkPct += v;
    else if (key === "def_") defPct += v;
    else if (key === "eleMas") eleMas += v;
    else if (key === "enerRech_") enerRech += v;
    else if (key === "critRate_") critRate += v;
    else if (key === "critDMG_") critDMG += v;
  }

  const weaponAtk = weapon?.baseAtk ?? 0;
  const hpBase = base.hp;
  const atkBase = base.atk + weaponAtk;
  const defBase = base.def;
  const hp = hpBase * (1 + hpPct) + flatHp;
  const atk = atkBase * (1 + atkPct) + flatAtk;
  const def = defBase * (1 + defPct) + flatDef;

  return {
    flatHp,
    flatAtk,
    flatDef,
    hpPct,
    atkPct,
    defPct,
    eleMas,
    enerRech,
    critRate,
    critDMG,
    dmgBonus,
    heal,
    hpBase,
    atkBase,
    defBase,
    hp,
    atk,
    def,
  };
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

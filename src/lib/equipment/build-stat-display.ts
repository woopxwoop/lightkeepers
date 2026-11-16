/**
 * Display rows / labels for the roster build card's stat sheet, weapon, and
 * artifact main stats. Reads the lazy base-stat tables; callers re-run on
 * `equipment.version`.
 */

import { translateStatKey } from "#lib/utils.js";
import type { WeaponData } from "#lib/equipment/equipment-data.js";
import {
  ARTIFACT_MAIN_STAT_VALUE,
  WEAPON_PROP_TO_GOOD,
  artifactMainValue,
  type ResolvedWeaponStats,
  type SheetStatBag,
} from "#lib/equipment/build-stats.js";

export type SheetStatRow = {
  key: string;
  label: string;
  icon: string;
  value: number | null;
};

export type WeaponSubstatDisplay = {
  label: string;
  text: string;
  iconKey: string | null;
};

/** Star glyph count, clamped to 0–5. */
export function starCount(stars: number | undefined): number {
  return Math.max(0, Math.min(5, stars ?? 0));
}

/** Core sheet rows, then positive DMG bonuses highest first. */
export function sheetStatRows(sheet: SheetStatBag | null): SheetStatRow[] {
  const core: SheetStatRow[] = [
    { key: "hp", label: "HP", icon: "hp", value: sheet?.hp ?? null },
    { key: "atk", label: "ATK", icon: "atk", value: sheet?.atk ?? null },
    { key: "def", label: "DEF", icon: "def", value: sheet?.def ?? null },
    {
      key: "eleMas",
      label: "Elemental Mastery",
      icon: "eleMas",
      value: sheet?.eleMas ?? null,
    },
    {
      key: "critRate",
      label: "CRIT Rate",
      icon: "critRate_",
      value: sheet?.critRate ?? null,
    },
    {
      key: "critDMG",
      label: "CRIT DMG",
      icon: "critDMG_",
      value: sheet?.critDMG ?? null,
    },
    {
      key: "enerRech",
      label: "Energy Recharge",
      icon: "enerRech_",
      value: sheet?.enerRech ?? null,
    },
  ];
  if (!sheet) return core;
  const dmg = Object.entries(sheet.dmgBonus)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({
      key,
      label: translateStatKey(key),
      icon: key,
      value,
    }));
  return [...core, ...dmg];
}

/** Main from ReliquaryLevel for this piece's rarity/level (GOOD has no stored value). */
export function artifactMainStatText(piece: {
  mainStatKey: string;
  rarity: number;
  level: number;
}): string {
  const key = piece.mainStatKey;
  const v =
    artifactMainValue(key, piece.rarity, piece.level) ??
    ARTIFACT_MAIN_STAT_VALUE[key];
  if (v == null) return translateStatKey(key);
  if (key === "hp" || key === "atk" || key === "def" || key === "eleMas") {
    return String(Math.round(v));
  }
  if (key.endsWith("_")) return `${(v * 100).toFixed(1)}%`;
  return String(Math.round(v));
}

export function weaponBaseAtk(
  resolved: ResolvedWeaponStats | null,
): number | null {
  return resolved != null ? Math.round(resolved.baseAtk) : null;
}

/** Weapon secondary stat; label prefers the baked `weapons.json` name. */
export function weaponSubstatDisplay(
  resolved: ResolvedWeaponStats | null,
  weapon: WeaponData | null,
): WeaponSubstatDisplay | null {
  const s = resolved?.subStat;
  if (!s) return null;
  const baked = weapon?.subStat;
  const goodKey = WEAPON_PROP_TO_GOOD[s.propType] ?? null;
  return {
    label: baked?.label ?? translateStatKey(goodKey ?? s.propType),
    text: s.isPercent
      ? `${(s.value * 100).toFixed(1)}%`
      : String(Math.round(s.value)),
    iconKey: goodKey,
  };
}

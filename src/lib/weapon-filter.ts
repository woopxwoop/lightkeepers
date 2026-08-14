/**
 * Weapon pick filters — rarity + type chips (planner GoalPickModal).
 */
import { CHARACTER_WEAPON_TYPES } from "$lib/character-filter";
import { weaponTypeLabel } from "$lib/utils";

export const WEAPON_FILTER_TYPES = CHARACTER_WEAPON_TYPES;

/** Default planner weapon pick: 4★ and 5★ only. */
export function defaultWeaponRarityFilter(): Set<string> {
  return new Set(["4", "5"]);
}

export type WeaponFilterState = {
  rarity?: Set<string>;
  types?: Set<string>;
};

export type WeaponFilterRow = {
  id: number;
  name: string;
  /** Catalog / equipment rarity (1–5). */
  rarity: number;
  /** Display label (`Sword`, …) when known. */
  typeLabel: string | null;
};

export function weaponFiltersActive(state: WeaponFilterState): boolean {
  return (state.rarity?.size ?? 0) > 0 || (state.types?.size ?? 0) > 0;
}

export function filterWeapons<T extends WeaponFilterRow>(
  weapons: readonly T[],
  state: WeaponFilterState = {},
): T[] {
  const rarity = state.rarity ?? new Set<string>();
  const types = state.types ?? new Set<string>();

  return weapons.filter((w) => {
    const matchesRarity =
      rarity.size === 0 || rarity.has(String(w.rarity));
    const matchesType =
      types.size === 0 ||
      (w.typeLabel != null && types.has(w.typeLabel));
    return matchesRarity && matchesType;
  });
}

/** Resolve type label from equipment `weaponType` enum or display name. */
export function weaponFilterTypeLabel(
  weaponType: string | null | undefined,
): string | null {
  if (!weaponType) return null;
  const label = weaponTypeLabel(weaponType);
  return (WEAPON_FILTER_TYPES as readonly string[]).includes(label)
    ? label
    : null;
}

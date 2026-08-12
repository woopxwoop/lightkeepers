/**
 * Merge live + beta upgrade-cost catalogs.
 * Live wins on character `name_id` / weapon `id` / material id; beta-only rows are appended.
 * Curves stay from live (shared EXP tables).
 */

import type {
  CharacterUpgradeCosts,
  UpgradeCostsCatalog,
  UpgradeMaterialMeta,
  WeaponUpgradeCosts,
} from "$lib/types/upgrade-costs";

function sortedCharacters(
  characters: CharacterUpgradeCosts[],
): CharacterUpgradeCosts[] {
  return [...characters].sort((a, b) =>
    a.name_id < b.name_id ? -1 : a.name_id > b.name_id ? 1 : 0,
  );
}

function sortedWeapons(weapons: WeaponUpgradeCosts[]): WeaponUpgradeCosts[] {
  return [...weapons].sort((a, b) => a.id - b.id);
}

export function mergeUpgradeCostCatalogs(
  live: UpgradeCostsCatalog,
  beta: UpgradeCostsCatalog | null | undefined,
): UpgradeCostsCatalog {
  if (!beta) {
    return {
      curves: live.curves,
      materials: live.materials,
      characters: sortedCharacters(live.characters),
      weapons: sortedWeapons(live.weapons),
    };
  }

  const charById = new Map(live.characters.map((c) => [c.name_id, c] as const));
  for (const c of beta.characters) {
    if (!charById.has(c.name_id)) charById.set(c.name_id, c);
  }

  const weaponById = new Map(live.weapons.map((w) => [w.id, w] as const));
  for (const w of beta.weapons) {
    if (!weaponById.has(w.id)) weaponById.set(w.id, w);
  }

  const materials: Record<string, UpgradeMaterialMeta> = {
    ...beta.materials,
    ...live.materials,
  };

  return {
    curves: live.curves,
    materials,
    characters: sortedCharacters([...charById.values()]),
    weapons: sortedWeapons([...weaponById.values()]),
  };
}

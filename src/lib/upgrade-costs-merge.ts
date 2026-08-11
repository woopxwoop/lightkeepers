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

export function mergeUpgradeCostCatalogs(
  live: UpgradeCostsCatalog,
  beta: UpgradeCostsCatalog | null | undefined,
): UpgradeCostsCatalog {
  if (!beta) return live;

  const charById = new Map(
    live.characters.map((c) => [c.name_id, c] as const),
  );
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

  const characters = [...charById.values()].sort((a, b) =>
    a.name_id.localeCompare(b.name_id),
  ) as CharacterUpgradeCosts[];
  const weapons = [...weaponById.values()].sort(
    (a, b) => a.id - b.id,
  ) as WeaponUpgradeCosts[];

  return {
    curves: live.curves,
    materials,
    characters,
    weapons,
  };
}

import { assetUrl } from "$lib/asset-urls";
import type { CalculatorGoal } from "$lib/types/calculator-goals";
import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";
import { maxLevelForAscension } from "$lib/upgrade-costs";
import { getCharacterPortrait } from "$lib/utils";

/** Square icon for a planner goal row. */
export function goalRowIcon(
  goal: CalculatorGoal,
  catalog: UpgradeCostsCatalog | null,
): string | null {
  if (goal.kind === "character") return getCharacterPortrait(goal.name_id);
  const icon = catalog?.weapons.find((w) => w.id === goal.weapon_id)?.icon;
  return assetUrl(icon ?? null);
}

/** Level / talent line under the goal name. */
export function goalRowSummary(
  goal: CalculatorGoal,
  catalog: UpgradeCostsCatalog | null,
): string {
  const promotes =
    goal.kind === "character"
      ? (catalog?.characters.find((c) => c.name_id === goal.name_id)
          ?.promotes ?? [])
      : (catalog?.weapons.find((w) => w.id === goal.weapon_id)?.promotes ?? []);
  const cap = (ascension: number) => maxLevelForAscension(promotes, ascension);
  const lv = `Lv ${goal.start.level}/${cap(goal.start.ascension)} → ${goal.target.level}/${cap(goal.target.ascension)}`;
  if (goal.kind !== "character") return lv;
  const s = goal.start.talents;
  const t = goal.target.talents;
  return `${lv}, ${s.normal}/${s.skill}/${s.burst} → ${t.normal}/${t.skill}/${t.burst}`;
}

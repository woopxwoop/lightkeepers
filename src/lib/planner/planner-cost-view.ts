import {
  aggregateGoalCosts,
  costsForGoal,
  emptyAggregate,
} from "#lib/planner/calculator-goals.js";
import {
  collapseCraftRanks,
  craftRanksCanExpand,
  expItemsNeeded,
} from "#lib/planner/upgrade-costs.js";
import type {
  AggregatedUpgradeCosts,
  CalculatorGoal,
} from "#lib/types/calculator-goals.js";
import type {
  UpgradeCostItem,
  UpgradeCostsCatalog,
  UpgradeMaterialSource,
} from "#lib/types/upgrade-costs.js";

export type CostScope = "all" | "selected" | "starred";

export type PlannerMaterialRow = {
  id: string;
  count: number;
  name: string;
  icon: string;
  rankLevel: number;
  sources: UpgradeMaterialSource[];
};

/** Cost bag for the chosen scope; goals pending removal never count. */
export function scopedGoalCosts({
  scope,
  goals,
  selectedGoal,
  starred,
  pendingRemoveIds,
  catalog,
}: {
  scope: CostScope;
  goals: CalculatorGoal[];
  selectedGoal: CalculatorGoal | null | undefined;
  starred: CalculatorGoal[];
  pendingRemoveIds: ReadonlySet<string>;
  catalog: UpgradeCostsCatalog;
}): AggregatedUpgradeCosts {
  const activeGoals = goals.filter((g) => !pendingRemoveIds.has(g.id));
  if (scope === "selected") {
    if (!selectedGoal || pendingRemoveIds.has(selectedGoal.id)) {
      return emptyAggregate();
    }
    return costsForGoal(selectedGoal, catalog);
  }
  if (scope === "starred") {
    return aggregateGoalCosts(starred, catalog);
  }
  return aggregateGoalCosts(activeGoals, catalog);
}

/** Character EXP books covering `exp`. */
export function characterExpBooks(
  exp: number,
  catalog: UpgradeCostsCatalog,
): UpgradeCostItem[] {
  if (exp <= 0) return [];
  return expItemsNeeded(
    exp,
    catalog.curves.avatarExpItems.map((it) => ({ id: it.id, exp: it.exp })),
  );
}

/** Weapon enhancement ores covering `exp`. */
export function weaponExpOres(
  exp: number,
  catalog: UpgradeCostsCatalog,
): UpgradeCostItem[] {
  if (exp <= 0) return [];
  return expItemsNeeded(
    exp,
    catalog.curves.weaponExpItems.map((it) => ({ id: it.id, exp: it.exp })),
  );
}

/**
 * Display rows for a material bag sorted by id. Collapsed shows craftable
 * ranks folded into their top tier (only when folding changes anything).
 */
export function materialRows(
  materials: Record<string, number>,
  catalog: UpgradeCostsCatalog,
  ranksExpanded: boolean,
): PlannerMaterialRow[] {
  const bag =
    ranksExpanded || !craftRanksCanExpand(materials, catalog)
      ? materials
      : collapseCraftRanks(materials, catalog);
  return Object.entries(bag)
    .filter(([, count]) => count > 0)
    .map(([id, count]) => {
      const meta = catalog.materials[id];
      return {
        id,
        count,
        name: meta?.name ?? `Material ${id}`,
        icon: meta?.icon ?? `UI_ItemIcon_${id}`,
        rankLevel: meta?.rankLevel ?? 1,
        sources: meta?.sources ?? [],
      };
    })
    .sort((a, b) => Number(a.id) - Number(b.id));
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

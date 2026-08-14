/**
 * Shared planner goal add / retarget / side-patch helpers.
 * Persistence stays in `calculator-goals-snapshot.ts`.
 */

import { loadCharacterSummary } from "$lib/app/character-summary";
import {
  appendGoal,
  createCharacterGoal,
  createWeaponGoal,
  MAX_CALCULATOR_GOALS,
} from "$lib/calculator-goals";
import type {
  CharacterOwned,
  CharacterPortraitRef,
  InventoryWeapon,
} from "$lib/definitions";
import { isStaleBuildSummary } from "$lib/stale-build-summary";
import type {
  CalculatorGoal,
  CalculatorGoalsState,
  CharacterCalculatorGoal,
  WeaponCalculatorGoal,
} from "$lib/types/calculator-goals";
import type {
  CharacterUpgradeConfig,
  UpgradeCostsCatalog,
  UpgradePromoteStep,
} from "$lib/types/upgrade-costs";
import { plannerTargetFromBuilds } from "$lib/planner-targets";
import {
  lowestInventoryWeaponByKey,
  plannerStartFromOwnedWeapon,
} from "$lib/roster-inventory";
import {
  progressToCharacterStart,
  rosterProgressForNameId,
} from "$lib/roster-progress";
import { isOwnedNameId, plannerSimKey, toGoodKey } from "$lib/utils";
import {
  orderCharacterConfigs,
  orderWeaponConfigs,
} from "$lib/upgrade-costs";

export type PlannerPickOption = { value: string; label: string };

export type AppendPlannerGoalResult =
  | { ok: true; state: CalculatorGoalsState; goal: CalculatorGoal }
  | { ok: false; error: string };

export type CharacterSidePatch = Partial<{
  level: number;
  ascension: number;
  talents: Partial<{ normal: number; skill: number; burst: number }>;
}>;

export type WeaponSidePatch = Partial<{ level: number; ascension: number }>;

const NOT_IN_CATALOG = "This character isn't in the planner catalog yet.";

export function resolveCatalogCharacterId(
  catalog: UpgradeCostsCatalog,
  nameId: string,
): string | undefined {
  if (catalog.characters.some((c) => c.name_id === nameId)) return nameId;
  if (nameId === "PlayerBoy" || nameId === "PlayerGirl") {
    return (
      catalog.characters.find((c) => c.name_id === "PlayerBoy-Pyro")
        ?.name_id ??
      catalog.characters.find((c) => c.name_id.startsWith("PlayerBoy-"))
        ?.name_id
    );
  }
  return undefined;
}

export function plannerCharacterOptions(
  catalog: UpgradeCostsCatalog | null,
  ownedIds: ReadonlySet<string>,
  sortOwnedFirst: boolean,
): PlannerPickOption[] {
  const opts = (catalog?.characters ?? []).map((c) => ({
    value: c.name_id,
    label: c.name,
  }));
  if (!sortOwnedFirst) return opts;
  const owned: PlannerPickOption[] = [];
  const rest: PlannerPickOption[] = [];
  for (const opt of opts) {
    (isOwnedNameId(opt.value, ownedIds) ? owned : rest).push(opt);
  }
  return [...owned, ...rest];
}

export function plannerWeaponOptions(
  catalog: UpgradeCostsCatalog | null,
): PlannerPickOption[] {
  return (catalog?.weapons ?? []).map((w) => ({
    value: String(w.id),
    label: `${w.name} (${w.rankLevel}★)`,
  }));
}

export function pickModalCharacter(
  nameId: string,
  catalog: UpgradeCostsCatalog | null,
  owned: readonly CharacterOwned[],
): CharacterPortraitRef | undefined {
  const row = catalog?.characters.find((c) => c.name_id === nameId);
  if (row) {
    return {
      name_id: row.name_id,
      name: row.name,
      element: row.element,
    };
  }
  const exact = owned.find((c) => c.name_id === nameId);
  if (exact) return exact;
  if (nameId.startsWith("PlayerBoy-") || nameId.startsWith("PlayerGirl-")) {
    return owned.find(
      (c) => c.name_id === "PlayerBoy" || c.name_id === "PlayerGirl",
    );
  }
  return undefined;
}

export function appendCatalogCharacterGoal(
  state: CalculatorGoalsState,
  catalog: UpgradeCostsCatalog,
  nameId: string,
  opts: {
    owned: readonly CharacterOwned[];
    weapons: readonly InventoryWeapon[] | null;
    starred?: boolean;
  },
): AppendPlannerGoalResult {
  const resolved = resolveCatalogCharacterId(catalog, nameId);
  if (!resolved) return { ok: false, error: NOT_IN_CATALOG };
  const row = catalog.characters.find((c) => c.name_id === resolved);
  if (!row) return { ok: false, error: NOT_IN_CATALOG };
  const progress = rosterProgressForNameId(
    [...opts.owned],
    resolved,
    opts.weapons,
  );
  const goal = createCharacterGoal(resolved, {
    ...(progress ? { start: progressToCharacterStart(progress) } : {}),
    ...(opts.starred ? { starred: true } : {}),
  });
  const next = appendGoal(state, goal);
  if (next.goals.length === state.goals.length) {
    return {
      ok: false,
      error: `You can have at most ${MAX_CALCULATOR_GOALS} goals.`,
    };
  }
  return { ok: true, state: next, goal };
}

export function appendCatalogWeaponGoal(
  state: CalculatorGoalsState,
  catalog: UpgradeCostsCatalog,
  weaponId: number,
  opts: {
    owned: readonly CharacterOwned[];
    weapons: readonly InventoryWeapon[] | null;
    starred?: boolean;
  },
): AppendPlannerGoalResult {
  if (!catalog.weapons.some((w) => w.id === weaponId)) {
    return { ok: false, error: "This weapon isn't in the planner catalog yet." };
  }
  const row = catalog.weapons.find((w) => w.id === weaponId);
  const key = row ? toGoodKey(row.name) : "";
  const fromBag = key
    ? lowestInventoryWeaponByKey(opts.weapons ?? [], key)
    : null;
  const fromRoster = opts.owned.find(
    (c) => c.isOwned && c.progress?.weapon?.key === key,
  )?.progress?.weapon;
  const start = plannerStartFromOwnedWeapon(fromBag ?? fromRoster);
  const goal = createWeaponGoal(weaponId, {
    ...(start ? { start } : {}),
    ...(opts.starred ? { starred: true } : {}),
  });
  const next = appendGoal(state, goal);
  if (next.goals.length === state.goals.length) {
    return {
      ok: false,
      error: `You can have at most ${MAX_CALCULATOR_GOALS} goals.`,
    };
  }
  return { ok: true, state: next, goal };
}

export function patchCharacterGoalSide(
  goal: CharacterCalculatorGoal,
  promotes: UpgradePromoteStep[],
  side: "start" | "target",
  patch: CharacterSidePatch,
): CharacterCalculatorGoal {
  const prev = goal[side];
  const next = {
    level: patch.level ?? prev.level,
    ascension: patch.ascension ?? prev.ascension,
    talents: {
      normal: patch.talents?.normal ?? prev.talents.normal,
      skill: patch.talents?.skill ?? prev.talents.skill,
      burst: patch.talents?.burst ?? prev.talents.burst,
    },
  };
  const preferAscension =
    patch.ascension !== undefined &&
    patch.level === undefined &&
    patch.talents === undefined;
  const preferLevel =
    patch.level !== undefined &&
    patch.ascension === undefined &&
    patch.talents === undefined;
  return {
    ...goal,
    ...orderCharacterConfigs(
      side === "start" ? next : goal.start,
      side === "target" ? next : goal.target,
      promotes,
      {
        preferStartAscension: side === "start" && preferAscension,
        preferStartLevel: side === "start" && preferLevel,
        preferTargetAscension: side === "target" && preferAscension,
        preferTargetLevel: side === "target" && preferLevel,
      },
    ),
  };
}

export function patchWeaponGoalSide(
  goal: WeaponCalculatorGoal,
  promotes: UpgradePromoteStep[],
  side: "start" | "target",
  patch: WeaponSidePatch,
): WeaponCalculatorGoal {
  const prev = goal[side];
  const next = {
    level: patch.level ?? prev.level,
    ascension: patch.ascension ?? prev.ascension,
  };
  const preferAscension =
    patch.ascension !== undefined && patch.level === undefined;
  const preferLevel =
    patch.level !== undefined && patch.ascension === undefined;
  return {
    ...goal,
    ...orderWeaponConfigs(
      side === "start" ? next : goal.start,
      side === "target" ? next : goal.target,
      promotes,
      {
        preferStartAscension: side === "start" && preferAscension,
        preferStartLevel: side === "start" && preferLevel,
        preferTargetAscension: side === "target" && preferAscension,
        preferTargetLevel: side === "target" && preferLevel,
      },
    ),
  };
}

export function retargetCharacterGoal(
  goal: CharacterCalculatorGoal,
  name_id: string,
  promotes: UpgradePromoteStep[] | undefined,
): CharacterCalculatorGoal {
  if (!promotes) return { ...goal, name_id };
  return {
    ...goal,
    name_id,
    ...orderCharacterConfigs(goal.start, goal.target, promotes),
  };
}

export function retargetWeaponGoal(
  goal: WeaponCalculatorGoal,
  weapon_id: number,
  promotes: UpgradePromoteStep[] | undefined,
): WeaponCalculatorGoal {
  if (!promotes) return { ...goal, weapon_id };
  return {
    ...goal,
    weapon_id,
    ...orderWeaponConfigs(goal.start, goal.target, promotes),
  };
}

export async function fetchPlannerTargetFromBuilds(
  nameId: string,
  promotes: UpgradePromoteStep[],
  simKey: string,
): Promise<CharacterUpgradeConfig | null> {
  if (isStaleBuildSummary(nameId)) return null;
  try {
    const builds = await loadCharacterSummary(simKey);
    if (builds?.upToDate === false) return null;
    return plannerTargetFromBuilds(builds, promotes);
  } catch {
    return null;
  }
}

export function simKeyForCatalogCharacter(
  catalog: UpgradeCostsCatalog | null,
  nameId: string,
): string {
  const row = catalog?.characters.find((c) => c.name_id === nameId);
  return plannerSimKey(nameId, row?.name);
}

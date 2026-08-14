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
  characterMatchesChipFilters,
  type OwnershipFilter,
} from "$lib/character-filter";
import {
  filterWeapons,
  weaponFilterTypeLabel,
  type WeaponFilterState,
} from "$lib/weapon-filter";
import {
  MAX_ASCENSION,
  MAX_LEVEL,
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

/** True when target is ahead of start on at least one upgrade axis. */
function characterTargetAhead(
  start: CharacterUpgradeConfig,
  target: CharacterUpgradeConfig,
): boolean {
  return (
    target.level > start.level ||
    target.ascension > start.ascension ||
    target.talents.normal > start.talents.normal ||
    target.talents.skill > start.talents.skill ||
    target.talents.burst > start.talents.burst
  );
}

function weaponTargetAhead(
  start: { level: number; ascension: number },
  target: { level: number; ascension: number },
): boolean {
  return target.level > start.level || target.ascension > start.ascension;
}

/**
 * After GOOD/roster start is applied, lift target so it is not behind start.
 * If that leaves a zero-progress goal, push target toward max (90/6).
 */
function characterGoalWithOwnedStart(
  nameId: string,
  start: CharacterUpgradeConfig,
  promotes: UpgradePromoteStep[],
  starred?: boolean,
): CharacterCalculatorGoal {
  const base = createCharacterGoal(nameId, {
    start,
    ...(starred ? { starred: true } : {}),
  });
  let ordered = orderCharacterConfigs(base.start, base.target, promotes);
  if (!characterTargetAhead(ordered.start, ordered.target)) {
    ordered = orderCharacterConfigs(
      ordered.start,
      {
        level: MAX_LEVEL,
        ascension: MAX_ASCENSION,
        talents: ordered.target.talents,
      },
      promotes,
    );
  }
  return { ...base, ...ordered };
}

function weaponGoalWithOwnedStart(
  weaponId: number,
  start: { level: number; ascension: number },
  promotes: UpgradePromoteStep[],
  starred?: boolean,
): WeaponCalculatorGoal {
  const base = createWeaponGoal(weaponId, {
    start,
    ...(starred ? { starred: true } : {}),
  });
  let ordered = orderWeaponConfigs(base.start, base.target, promotes);
  if (!weaponTargetAhead(ordered.start, ordered.target)) {
    ordered = orderWeaponConfigs(
      ordered.start,
      { level: MAX_LEVEL, ascension: MAX_ASCENSION },
      promotes,
    );
  }
  return { ...base, ...ordered };
}

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

/**
 * Keep pick options that pass character chip filters.
 * Roster supplies rarity / weapon_type; catalog covers element; ownedIds for ownership.
 */
export function filterPlannerCharacterPickOptions(
  options: readonly PlannerPickOption[],
  roster: readonly CharacterOwned[],
  catalog: UpgradeCostsCatalog | null,
  ownedIds: ReadonlySet<string>,
  state: {
    rarity?: Set<string>;
    elements?: Set<string>;
    weapons?: Set<string>;
    ownership?: OwnershipFilter;
  },
): PlannerPickOption[] {
  const byNameId = new Map(roster.map((c) => [c.name_id, c]));
  return options.filter((opt) => {
    const cat = catalog?.characters.find((c) => c.name_id === opt.value);
    const owned = byNameId.get(opt.value);
    const travelerBase =
      !owned &&
      (opt.value.startsWith("PlayerBoy-") || opt.value.startsWith("PlayerGirl-"))
        ? (byNameId.get("PlayerBoy") ?? byNameId.get("PlayerGirl"))
        : undefined;
    const base = owned ?? travelerBase;
    const row = {
      rarity: base?.rarity ?? 0,
      element: cat?.element ?? base?.element ?? null,
      weapon_type: base?.weapon_type ?? null,
      isOwned: isOwnedNameId(opt.value, ownedIds),
    };
    return characterMatchesChipFilters(row, state);
  });
}

export function filterPlannerWeaponPickOptions(
  options: readonly PlannerPickOption[],
  catalog: UpgradeCostsCatalog | null,
  state: WeaponFilterState,
  resolveWeapon: (
    id: number,
  ) => { stars: number; weaponType: string } | undefined,
): PlannerPickOption[] {
  const byId = new Map(
    (catalog?.weapons ?? []).map((w) => [String(w.id), w] as const),
  );
  const rows = options.map((opt) => {
    const w = byId.get(opt.value);
    const id = Number(opt.value);
    const meta = Number.isFinite(id) ? resolveWeapon(id) : undefined;
    return {
      option: opt,
      id,
      name: w?.name ?? opt.label,
      rarity: meta?.stars ?? w?.rankLevel ?? 0,
      typeLabel: weaponFilterTypeLabel(meta?.weaponType ?? null),
    };
  });
  const kept = new Set(
    filterWeapons(rows, state).map((r) => r.option.value),
  );
  return options.filter((o) => kept.has(o.value));
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
  const goal = progress
    ? characterGoalWithOwnedStart(
        resolved,
        progressToCharacterStart(progress),
        row.promotes,
        opts.starred,
      )
    : createCharacterGoal(resolved, {
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
  const row = catalog.weapons.find((w) => w.id === weaponId);
  if (!row) {
    return { ok: false, error: "This weapon isn't in the planner catalog yet." };
  }
  const key = toGoodKey(row.name);
  const fromBag = lowestInventoryWeaponByKey(opts.weapons ?? [], key);
  const fromRoster = opts.owned.find(
    (c) => c.isOwned && c.progress?.weapon?.key === key,
  )?.progress?.weapon;
  const start = plannerStartFromOwnedWeapon(fromBag ?? fromRoster);
  const goal = start
    ? weaponGoalWithOwnedStart(weaponId, start, row.promotes, opts.starred)
    : createWeaponGoal(weaponId, {
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
  } catch (err) {
    console.debug("[planner] loadCharacterSummary failed:", err);
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

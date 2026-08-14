/**
 * Calculator goals — create, normalize, and aggregate upgrade costs.
 * Persistence lives in `calculator-goals-snapshot.ts`.
 */

import {
  MAX_ASCENSION,
  MAX_LEVEL,
  MAX_TALENT,
  UPGRADE_DEFAULTS,
  diffCharacterUpgrade,
  diffWeaponUpgrade,
} from "$lib/upgrade-costs";
import type {
  AggregatedUpgradeCosts,
  CalculatorGoal,
  CalculatorGoalsState,
  CharacterCalculatorGoal,
  WeaponCalculatorGoal,
} from "$lib/types/calculator-goals";
import type {
  CharacterUpgradeConfig,
  UpgradeCostResult,
  UpgradeCostsCatalog,
  WeaponUpgradeConfig,
} from "$lib/types/upgrade-costs";

export const CALCULATOR_GOALS_VERSION = 1 as const;
export const MAX_CALCULATOR_GOALS = 64;
export const MAX_GOAL_ID_LENGTH = 64;

export function emptyGoalsState(): CalculatorGoalsState {
  return { version: CALCULATOR_GOALS_VERSION, goals: [], selectedId: null };
}

export function newGoalId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneCharConfig(
  cfg: CharacterUpgradeConfig = UPGRADE_DEFAULTS.characterStart,
): CharacterUpgradeConfig {
  return {
    level: cfg.level,
    ascension: cfg.ascension,
    talents: { ...cfg.talents },
  };
}

function cloneWeaponConfig(
  cfg: WeaponUpgradeConfig = UPGRADE_DEFAULTS.weaponStart,
): WeaponUpgradeConfig {
  return { level: cfg.level, ascension: cfg.ascension };
}

export function createCharacterGoal(
  name_id: string,
  overrides?: Partial<
    Pick<CharacterCalculatorGoal, "start" | "target" | "id" | "starred">
  >,
): CharacterCalculatorGoal {
  return {
    id: overrides?.id ?? newGoalId(),
    kind: "character",
    name_id,
    start: cloneCharConfig(overrides?.start ?? UPGRADE_DEFAULTS.characterStart),
    target: cloneCharConfig(
      overrides?.target ?? UPGRADE_DEFAULTS.characterTarget,
    ),
    ...(overrides?.starred ? { starred: true as const } : {}),
  };
}

export function createWeaponGoal(
  weapon_id: number,
  overrides?: Partial<
    Pick<WeaponCalculatorGoal, "start" | "target" | "id" | "starred">
  >,
): WeaponCalculatorGoal {
  return {
    id: overrides?.id ?? newGoalId(),
    kind: "weapon",
    weapon_id,
    start: cloneWeaponConfig(overrides?.start ?? UPGRADE_DEFAULTS.weaponStart),
    target: cloneWeaponConfig(
      overrides?.target ?? UPGRADE_DEFAULTS.weaponTarget,
    ),
    ...(overrides?.starred ? { starred: true as const } : {}),
  };
}

function starredFlag(value: unknown): true | undefined {
  return value === true ? true : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseIntInRange(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) {
    return fallback;
  }
  return n;
}

function parseCharacterConfig(
  value: unknown,
  fallback: CharacterUpgradeConfig,
): CharacterUpgradeConfig {
  if (!isRecord(value)) return cloneCharConfig(fallback);
  const talents = isRecord(value.talents) ? value.talents : {};
  return {
    level: parseIntInRange(value.level, 1, MAX_LEVEL, fallback.level),
    ascension: parseIntInRange(
      value.ascension,
      0,
      MAX_ASCENSION,
      fallback.ascension,
    ),
    talents: {
      normal: parseIntInRange(
        talents.normal,
        1,
        MAX_TALENT,
        fallback.talents.normal,
      ),
      skill: parseIntInRange(
        talents.skill,
        1,
        MAX_TALENT,
        fallback.talents.skill,
      ),
      burst: parseIntInRange(
        talents.burst,
        1,
        MAX_TALENT,
        fallback.talents.burst,
      ),
    },
  };
}

function parseWeaponConfig(
  value: unknown,
  fallback: WeaponUpgradeConfig,
): WeaponUpgradeConfig {
  if (!isRecord(value)) return cloneWeaponConfig(fallback);
  return {
    level: parseIntInRange(value.level, 1, MAX_LEVEL, fallback.level),
    ascension: parseIntInRange(
      value.ascension,
      0,
      MAX_ASCENSION,
      fallback.ascension,
    ),
  };
}

/** Lenient parse for localStorage / cloud payloads; drops invalid entries. */
export function parseGoalsState(raw: unknown): CalculatorGoalsState {
  if (!isRecord(raw)) return emptyGoalsState();

  const goalsRaw = Array.isArray(raw.goals) ? raw.goals : [];
  const goals: CalculatorGoal[] = [];
  const seenIds = new Set<string>();

  for (const item of goalsRaw) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== "string" || item.id.length === 0) continue;
    if (item.id.length > MAX_GOAL_ID_LENGTH) continue;
    if (seenIds.has(item.id)) continue;

    if (item.kind === "character") {
      if (typeof item.name_id !== "string" || item.name_id.length === 0) {
        continue;
      }
      seenIds.add(item.id);
      goals.push({
        id: item.id,
        kind: "character",
        name_id: item.name_id,
        start: parseCharacterConfig(
          item.start,
          UPGRADE_DEFAULTS.characterStart,
        ),
        target: parseCharacterConfig(
          item.target,
          UPGRADE_DEFAULTS.characterTarget,
        ),
        ...(starredFlag(item.starred) ? { starred: true as const } : {}),
      });
      continue;
    }

    if (item.kind === "weapon") {
      const weaponId =
        typeof item.weapon_id === "number"
          ? item.weapon_id
          : typeof item.weapon_id === "string"
            ? Number(item.weapon_id)
            : NaN;
      if (
        !Number.isFinite(weaponId) ||
        !Number.isInteger(weaponId) ||
        weaponId <= 0
      ) {
        continue;
      }
      seenIds.add(item.id);
      goals.push({
        id: item.id,
        kind: "weapon",
        weapon_id: weaponId,
        start: parseWeaponConfig(item.start, UPGRADE_DEFAULTS.weaponStart),
        target: parseWeaponConfig(item.target, UPGRADE_DEFAULTS.weaponTarget),
        ...(starredFlag(item.starred) ? { starred: true as const } : {}),
      });
    }
  }

  const capped = goals.slice(0, MAX_CALCULATOR_GOALS);
  const selectedId =
    typeof raw.selectedId === "string" &&
    capped.some((g) => g.id === raw.selectedId)
      ? raw.selectedId
      : (capped[0]?.id ?? null);

  return {
    version: CALCULATOR_GOALS_VERSION,
    goals: capped,
    selectedId,
  };
}

export function cloneGoalsState(
  state: CalculatorGoalsState,
): CalculatorGoalsState {
  return parseGoalsState(JSON.parse(JSON.stringify(state)) as unknown);
}

/** Deep-clone a single goal (for immutable edits). */
export function cloneGoal(goal: CalculatorGoal): CalculatorGoal {
  if (goal.kind === "character") {
    return {
      id: goal.id,
      kind: "character",
      name_id: goal.name_id,
      start: cloneCharConfig(goal.start),
      target: cloneCharConfig(goal.target),
      ...(goal.starred ? { starred: true as const } : {}),
    };
  }
  return {
    id: goal.id,
    kind: "weapon",
    weapon_id: goal.weapon_id,
    start: cloneWeaponConfig(goal.start),
    target: cloneWeaponConfig(goal.target),
    ...(goal.starred ? { starred: true as const } : {}),
  };
}

export function toggleGoalStarred(goal: CalculatorGoal): CalculatorGoal {
  const next = cloneGoal(goal);
  if (next.starred) delete next.starred;
  else next.starred = true;
  return next;
}

/** Goals marked for the farming itinerary / Starred cost scope. */
export function starredGoals(goals: CalculatorGoal[]): CalculatorGoal[] {
  return goals.filter((g) => g.starred);
}

export function addMaterials(
  into: Record<string, number>,
  from: Record<string, number>,
): void {
  for (const [id, count] of Object.entries(from)) {
    if (count <= 0) continue;
    into[id] = (into[id] ?? 0) + count;
  }
}

export function emptyAggregate(): AggregatedUpgradeCosts {
  return { mora: 0, characterExp: 0, weaponExp: 0, materials: {} };
}

export function addCharacterResult(
  aggregate: AggregatedUpgradeCosts,
  result: UpgradeCostResult,
): void {
  aggregate.mora += result.mora;
  aggregate.characterExp += result.exp;
  addMaterials(aggregate.materials, result.materials);
}

export function addWeaponResult(
  aggregate: AggregatedUpgradeCosts,
  result: UpgradeCostResult,
): void {
  aggregate.mora += result.mora;
  aggregate.weaponExp += result.exp;
  addMaterials(aggregate.materials, result.materials);
}

/** Merge one aggregate bag into another (mora, both exp pools, materials). */
export function addAggregate(
  into: AggregatedUpgradeCosts,
  from: AggregatedUpgradeCosts,
): void {
  into.mora += from.mora;
  into.characterExp += from.characterExp;
  into.weaponExp += from.weaponExp;
  addMaterials(into.materials, from.materials);
}

/** Start→target bag for one goal; missing catalog rows contribute nothing. */
export function costsForGoal(
  goal: CalculatorGoal,
  catalog: UpgradeCostsCatalog,
): AggregatedUpgradeCosts {
  const agg = emptyAggregate();
  if (goal.kind === "character") {
    const row = catalog.characters.find((c) => c.name_id === goal.name_id);
    if (!row) return agg;
    addCharacterResult(
      agg,
      diffCharacterUpgrade(row, catalog.curves, goal.start, goal.target),
    );
    return agg;
  }
  const row = catalog.weapons.find((w) => w.id === goal.weapon_id);
  if (!row) return agg;
  addWeaponResult(
    agg,
    diffWeaponUpgrade(row, catalog.curves, goal.start, goal.target),
  );
  return agg;
}

/** Sum start→target bags for a goal list. */
export function aggregateGoalCosts(
  goals: CalculatorGoal[],
  catalog: UpgradeCostsCatalog,
): AggregatedUpgradeCosts {
  const agg = emptyAggregate();
  for (const goal of goals) {
    addAggregate(agg, costsForGoal(goal, catalog));
  }
  return agg;
}

/**
 * Apply cloud goals over a local state, keeping `selectedId` when still valid.
 */
export function applyCloudGoals(
  local: CalculatorGoalsState,
  cloudGoals: CalculatorGoal[],
): CalculatorGoalsState {
  const next = parseGoalsState({
    version: CALCULATOR_GOALS_VERSION,
    goals: cloudGoals,
    selectedId: local.selectedId,
  });
  return next;
}

/** Pick a goal by id (or null). */
export function findGoal(
  state: CalculatorGoalsState,
  id: string | null,
): CalculatorGoal | null {
  if (!id) return null;
  return state.goals.find((g) => g.id === id) ?? null;
}

/** Replace one goal in the list (immutable). */
export function replaceGoal(
  state: CalculatorGoalsState,
  goal: CalculatorGoal,
): CalculatorGoalsState {
  return {
    ...state,
    goals: state.goals.map((g) => (g.id === goal.id ? cloneGoal(goal) : g)),
  };
}

/** Remove a goal; re-pick selectedId if needed. */
export function removeGoal(
  state: CalculatorGoalsState,
  id: string,
): CalculatorGoalsState {
  const goals = state.goals.filter((g) => g.id !== id);
  const selectedId =
    state.selectedId === id ? (goals[0]?.id ?? null) : state.selectedId;
  return { version: CALCULATOR_GOALS_VERSION, goals, selectedId };
}

/** Move a goal to another index; no-op if the indices are invalid. */
export function moveGoal(
  state: CalculatorGoalsState,
  fromIndex: number,
  toIndex: number,
): CalculatorGoalsState {
  const n = state.goals.length;
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= n ||
    toIndex >= n ||
    fromIndex === toIndex
  ) {
    return state;
  }
  const goals = [...state.goals];
  const [item] = goals.splice(fromIndex, 1);
  if (!item) return state;
  goals.splice(toIndex, 0, item);
  return {
    version: CALCULATOR_GOALS_VERSION,
    goals,
    selectedId: state.selectedId,
  };
}

/** Append a goal (respects max); selects it. */
export function appendGoal(
  state: CalculatorGoalsState,
  goal: CalculatorGoal,
): CalculatorGoalsState {
  if (state.goals.length >= MAX_CALCULATOR_GOALS) return state;
  const goals = [...state.goals, cloneGoal(goal)];
  return {
    version: CALCULATOR_GOALS_VERSION,
    goals,
    selectedId: goal.id,
  };
}

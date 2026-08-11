/**
 * Calculator goals — create, normalize, and aggregate upgrade costs.
 * Persistence lives in `calculator-goals-snapshot.ts`.
 */

import { UPGRADE_DEFAULTS } from "$lib/upgrade-costs";
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
  WeaponUpgradeConfig,
} from "$lib/types/upgrade-costs";

export const CALCULATOR_GOALS_VERSION = 1 as const;
export const MAX_CALCULATOR_GOALS = 64;

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
    Pick<CharacterCalculatorGoal, "start" | "target" | "id">
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
  };
}

export function createWeaponGoal(
  weapon_id: number,
  overrides?: Partial<Pick<WeaponCalculatorGoal, "start" | "target" | "id">>,
): WeaponCalculatorGoal {
  return {
    id: overrides?.id ?? newGoalId(),
    kind: "weapon",
    weapon_id,
    start: cloneWeaponConfig(overrides?.start ?? UPGRADE_DEFAULTS.weaponStart),
    target: cloneWeaponConfig(
      overrides?.target ?? UPGRADE_DEFAULTS.weaponTarget,
    ),
  };
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
    level: parseIntInRange(value.level, 1, 90, fallback.level),
    ascension: parseIntInRange(value.ascension, 0, 6, fallback.ascension),
    talents: {
      normal: parseIntInRange(
        talents.normal,
        1,
        10,
        fallback.talents.normal,
      ),
      skill: parseIntInRange(talents.skill, 1, 10, fallback.talents.skill),
      burst: parseIntInRange(talents.burst, 1, 10, fallback.talents.burst),
    },
  };
}

function parseWeaponConfig(
  value: unknown,
  fallback: WeaponUpgradeConfig,
): WeaponUpgradeConfig {
  if (!isRecord(value)) return cloneWeaponConfig(fallback);
  return {
    level: parseIntInRange(value.level, 1, 90, fallback.level),
    ascension: parseIntInRange(value.ascension, 0, 6, fallback.ascension),
  };
}

/** Lenient parse for localStorage / cloud payloads; drops invalid entries. */
export function parseGoalsState(raw: unknown): CalculatorGoalsState {
  if (!isRecord(raw)) return emptyGoalsState();

  const goalsRaw = Array.isArray(raw.goals) ? raw.goals : [];
  const goals: CalculatorGoal[] = [];

  for (const item of goalsRaw) {
    if (!isRecord(item)) continue;
    if (typeof item.id !== "string" || item.id.length === 0) continue;

    if (item.kind === "character") {
      if (typeof item.name_id !== "string" || item.name_id.length === 0) {
        continue;
      }
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
      if (!Number.isFinite(weaponId) || !Number.isInteger(weaponId)) continue;
      goals.push({
        id: item.id,
        kind: "weapon",
        weapon_id: weaponId,
        start: parseWeaponConfig(item.start, UPGRADE_DEFAULTS.weaponStart),
        target: parseWeaponConfig(item.target, UPGRADE_DEFAULTS.weaponTarget),
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

export function cloneGoalsState(state: CalculatorGoalsState): CalculatorGoalsState {
  return parseGoalsState(JSON.parse(JSON.stringify(state)) as unknown);
}

/** Deep-clone a single goal (for immutable edits). */
export function cloneGoal(goal: CalculatorGoal): CalculatorGoal {
  if (goal.kind === "character") {
    return {
      ...goal,
      start: cloneCharConfig(goal.start),
      target: cloneCharConfig(goal.target),
    };
  }
  return {
    ...goal,
    start: cloneWeaponConfig(goal.start),
    target: cloneWeaponConfig(goal.target),
  };
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

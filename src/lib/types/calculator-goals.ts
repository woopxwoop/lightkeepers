/**
 * Calculator upgrade goals — multi-item plans with per-goal start/target.
 * Persisted via localStorage + `/api/calculator-goals` (auth).
 */

import type {
  CharacterUpgradeConfig,
  WeaponUpgradeConfig,
} from "$lib/types/upgrade-costs";

export type CharacterCalculatorGoal = {
  id: string;
  kind: "character";
  name_id: string;
  start: CharacterUpgradeConfig;
  target: CharacterUpgradeConfig;
  /** Included in the farming itinerary and the Starred cost scope. */
  starred?: boolean;
};

export type WeaponCalculatorGoal = {
  id: string;
  kind: "weapon";
  /** Weapon catalog id (numeric). */
  weapon_id: number;
  start: WeaponUpgradeConfig;
  target: WeaponUpgradeConfig;
  /** Included in the farming itinerary and the Starred cost scope. */
  starred?: boolean;
};

export type CalculatorGoal = CharacterCalculatorGoal | WeaponCalculatorGoal;

/** Local persisted blob. Cloud stores `goals` only; `selectedId` is local. */
export type CalculatorGoalsState = {
  version: 1;
  goals: CalculatorGoal[];
  selectedId: string | null;
};

export type AggregatedUpgradeCosts = {
  mora: number;
  characterExp: number;
  weaponExp: number;
  materials: Record<string, number>;
};

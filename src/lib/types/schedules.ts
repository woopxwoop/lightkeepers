/**
 * Abyss / Stygian schedule shapes shared by sync scripts and the static API.
 *
 * Sync builds these from Dimbreath Excel (schedule meta + floor/level ids) merged
 * with Lunaris JSON (chamber monsters / Stygian fearless bosses). Stored in
 * `lunaris_abyss_versions.floors` and `lunaris_stygian_versions.levels`.
 */

/** Chamber monster as stored in abyss floors JSONB (Lunaris-shaped). */
export interface ScheduleMonster {
  id: number;
  describeId: number;
  name: string;
  icon: string;
  hp: number;
}

/**
 * Star conditions. Lunaris uses `{ completionCondition, value }`; older rows
 * may be strings. Treated as opaque JSON by the product UI today.
 */
export type AbyssCondition =
  | string
  | {
      completionCondition: string;
      value: number;
      [key: string]: unknown;
    };

export interface AbyssChamberRecord {
  levelId: number;
  monsterLevel: number;
  conditions: AbyssCondition[];
  firstHalfMonsters: ScheduleMonster[];
  secondHalfMonsters: ScheduleMonster[];
}

export interface AbyssFloorRecord {
  floorId: number;
  floorIndex: number;
  chambers: AbyssChamberRecord[];
}

/** Payload written to `lunaris_abyss_versions` (minus ys version). */
export interface MergedAbyssSchedule {
  scheduleId: number;
  openTime: string;
  closeTime: string;
  buffName: string | null;
  /** UI_TowerBlessing_* — not a DB column today; useful for tooling / future. */
  buffIcon: string | null;
  floors: AbyssFloorRecord[];
}

/** Fearless-level boss config (subset of Lunaris levelConfigs). */
export interface StygianBossConfig {
  id: number;
  specialMonsterIcon: string;
  enLevelName: string;
  description?: string | null;
  [key: string]: unknown;
}

export interface StygianLevelRecord {
  id: number;
  monsterLevel: number;
  levelConfigs: StygianBossConfig[];
  [key: string]: unknown;
}

/** Payload written to `lunaris_stygian_versions` (minus ys version). */
export interface MergedStygianSchedule {
  scheduleId: number;
  openTime: string;
  closeTime: string;
  /** Usually a game version string like `"6.7"` (Lunaris); Dimbreath may differ. */
  challengeName: string | null;
  levels: StygianLevelRecord[];
}

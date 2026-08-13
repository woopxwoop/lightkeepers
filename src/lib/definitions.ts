import type { Tables, Database } from "$lib/types/database.types";

export type Character = Tables<"characters">;
export type CharacterOwned = Character & { isOwned: boolean };

export type AbyssTeam =
  Database["public"]["Functions"]["get_teams_with_characters_subset"]["Returns"][number];
export type StygianTeam =
  Database["public"]["Functions"]["get_teams_with_characters_subset_stygian"]["Returns"][number];

export type NearMissStygianTeam =
  Database["public"]["Functions"]["get_near_miss_stygian_teams"]["Returns"][number];
export type NearMissStygianPair =
  Database["public"]["Functions"]["get_near_miss_stygian_pairs"]["Returns"][number];

export type AbyssVersion = Tables<"abyss_versions">;
export type StygianVersion = Tables<"stygian_versions">;
export type Enemy = Tables<"enemies">;

/** Per-version ownership/usage point (Stygian analytics series). */
export type CharacterUsageSeriesPoint =
  Database["public"]["Functions"]["get_character_usage_series_stygian"]["Returns"][number];

/** Per-version ownership/usage point (Abyss analytics series). */
export type CharacterUsageSeriesPointAbyss =
  Database["public"]["Functions"]["get_character_usage_series_abyss"]["Returns"][number];

export type CharacterTopTeamByVersionAbyss =
  Database["public"]["Functions"]["get_character_top_teams_by_version_abyss"]["Returns"][number];
export type CharacterTopTeamByVersionStygian =
  Database["public"]["Functions"]["get_character_top_teams_by_version_stygian"]["Returns"][number];

export type CharacterAnalyticsMode = "abyss" | "stygian";

export type CharacterAnalyticsPayload =
  | {
      nameId: string;
      mode: "abyss";
      usage: CharacterUsageSeriesPointAbyss[];
      teams: CharacterTopTeamByVersionAbyss[];
    }
  | {
      nameId: string;
      mode: "stygian";
      usage: CharacterUsageSeriesPoint[];
      teams: CharacterTopTeamByVersionStygian[];
    };

/** Per-appearance top team vs a Stygian boss (slot-ranked). */
export type StygianEnemyTopTeam =
  Database["public"]["Functions"]["get_top_teams_for_stygian_enemy"]["Returns"][number];

export type StygianEnemyTeamsPayload = {
  enemyId: number;
  teams: StygianEnemyTopTeam[];
};

/** Index card for `/tools/stygian/enemies` (Stygian appearances only). */
export type StygianEnemyListItem = {
  id: number;
  enemy_name: string | null;
  asset: string | null;
  appearance_count: number;
  latest_version_number: number;
  latest_version_name: string | null;
  /** Every Stygian version_number this enemy appeared in. */
  version_numbers: number[];
};

export type StygianEnemyCycleOption = {
  version_number: number;
  version_name: string | null;
};

// Re-export CDN kit / enemy contracts for discoverability.
export type {
  CharacterKit,
  CharacterKitIndex,
  CharacterKitIndexEntry,
} from "$lib/types/character-kit";
export type { EnemyIndex, EnemyIndexEntry } from "$lib/types/enemy";

// ── Shared payload shapes used by /api/static, layout data, and consumers ────

export type StygianEnemies = {
  top: Enemy | null;
  middle: Enemy | null;
  bottom: Enemy | null;
};

export type AbyssChamberEnemy = {
  id: number;
  name: string;
  asset: string | null;
};

export type AbyssChamberEnemies = {
  chamber: number;
  monsterLevel: number;
  enemies: AbyssChamberEnemy[];
};

export type AbyssEnemies = {
  top: AbyssChamberEnemies[];
  bottom: AbyssChamberEnemies[];
  buffName: string | null;
  openTime: string | null;
};

export type StygianSchedule = {
  scheduleId: number;
  openTime: string | null;
  closeTime: string | null;
  challengeName: string | null;
} | null;

/** One verified clear video row (stygian.moe ingest). */
export type StygianClearVideo = Pick<
  Tables<"stygian_team_clear_videos">,
  | "clear_key"
  | "team_key"
  | "enemy_id"
  | "difficulty"
  | "cost"
  | "time_s"
  | "video_url"
  | "char_names"
>;

export type StygianClearVideoPair = {
  team_key: string;
  enemy_id: number;
};

export type StygianClearVideosPayload = {
  clears: StygianClearVideo[];
};

/** One non-dominated clear on a team×enemy cost/time frontier. */
export type StygianClearFrontierPoint = {
  /** Scrape cost (stygian.moe). */
  c: number;
  /** Clear time in seconds. */
  t: number;
};

/** Row fields needed to pick a clear under a scrape-cost limit. */
export type StygianCheapClearFrontier = {
  frontier: StygianClearFrontierPoint[] | null;
};

/**
 * Owned team × boss clear stats (`p_max_cost` overload).
 * `frontier` is Json from PostgREST; callers normalize via team-cost helpers.
 */
export type StygianCheapClearRow = StygianTeam & {
  enemy_id: number;
  min_cost: number | null;
  frontier: StygianClearFrontierPoint[] | null;
};

export type StygianCheapClearsPayload = {
  rows: StygianCheapClearRow[];
};

/** Difficulty used for cost-capped video-clear seating. */
export type StygianClearDifficulty = "Fearless" | "Dire";

export const STYGIAN_CHEAP_CLEARS_DIFFICULTY = "Fearless" as const satisfies StygianClearDifficulty;

export const STYGIAN_CLEAR_DIFFICULTY_OPTIONS: ReadonlyArray<{
  value: StygianClearDifficulty;
  label: string;
}> = [
  { value: "Fearless", label: "Fearless" },
  { value: "Dire", label: "Dire" },
];

export function isStygianClearDifficulty(
  value: unknown,
): value is StygianClearDifficulty {
  return value === "Fearless" || value === "Dire";
}

/** Default max clear cost when filtering before time ranking. */
export const STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST = 0;

/**
 * Stygian board seating source.
 * - yshelper: usage × affinity solver
 * - hybrid: YSHelper boards, prefer those with more C0R0 clear seats
 * - video: clear videos under the cost cap (scrape cost as labeled; dev)
 * - video-c0r0: same, but only baseline (character floor + 0.5)
 */
export type StygianSolverMode =
  | "yshelper"
  | "hybrid"
  | "video"
  | "video-c0r0";

/** Modes shown on `/tools/stygian` (Fearless only). */
export type StygianSolverModeRelease = Exclude<StygianSolverMode, "video">;

export const STYGIAN_SOLVER_MODE_OPTIONS: ReadonlyArray<{
  value: StygianSolverMode;
  label: string;
}> = [
  { value: "yshelper", label: "YSHelper" },
  { value: "hybrid", label: "Hybrid" },
  { value: "video", label: "Video clears" },
  { value: "video-c0r0", label: "Video clears C0R0" },
];

/** Production Stygian board dropdown. */
export const STYGIAN_SOLVER_MODE_OPTIONS_RELEASE: ReadonlyArray<{
  value: StygianSolverModeRelease;
  label: string;
}> = [
  { value: "hybrid", label: "Hybrid (New)" },
  { value: "yshelper", label: "Usage Rate" },
  { value: "video-c0r0", label: "Video Clears C0R0" },
];

export function isStygianSolverMode(value: unknown): value is StygianSolverMode {
  return (
    value === "yshelper" ||
    value === "hybrid" ||
    value === "video" ||
    value === "video-c0r0"
  );
}

export function isStygianSolverModeRelease(
  value: unknown,
): value is StygianSolverModeRelease {
  return value === "yshelper" || value === "hybrid" || value === "video-c0r0";
}

/** Map stored prefs onto the production mode set (drops experimental `video`). */
export function toStygianSolverModeRelease(
  value: StygianSolverMode,
): StygianSolverModeRelease {
  return isStygianSolverModeRelease(value) ? value : "hybrid";
}

export type { TierBoard, TierListEntry, TierListPayload } from "$lib/tierlist";

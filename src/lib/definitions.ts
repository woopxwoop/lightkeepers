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

export type { TierBoard, TierListEntry, TierListPayload } from "$lib/tierlist";

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

export type { TierBoard, TierListEntry, TierListPayload } from "$lib/tierlist";

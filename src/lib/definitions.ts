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

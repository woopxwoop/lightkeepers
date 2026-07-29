import type {
  StygianTeam,
  NearMissStygianTeam,
  NearMissStygianPair,
} from "$lib/definitions";

export type PullSuggestion = {
  character: string;
  characterName: string | undefined;
  unlocksTeams: number;
  /** Top unlocked teams by avg usage (for the expand cycle). */
  topTeams: StygianTeam[];
  bestTeam: StygianTeam;
  score: number;
  avgUsage: number;
};

export type PairSuggestion = {
  charA: string;
  charAName: string | undefined;
  charB: string;
  charBName: string | undefined;
  pmi: number;
  avgUsage: number;
  unlocksTeams: number;
  /** Top unlocked teams by avg usage (for the expand cycle). */
  topTeams: StygianTeam[];
  bestTeam: StygianTeam;
  score: number;
};

/** Unlocked team must itself be meta-relevant (avg usage %). */
export const MIN_PULL_TEAM_USAGE = 10;

/** Floor so non-positive PMI pairs still order by avgUsage. */
const PMI_SCORE_FLOOR = 1e-6;

/** How many popular unlocked teams the pulls expand pager can cycle. */
const TOP_TEAMS_SHOWN = 4;

function nearMissToTeam(
  team: NearMissStygianTeam | NearMissStygianPair,
): StygianTeam {
  return {
    team_key: team.team_key,
    version_number: 0,
    avg_usage_rate: team.avg_usage_rate,
    usage_total: team.usage_total,
    usage_rate: team.usage_rate,
    field_1_rate: team.field_1_rate,
    field_2_rate: team.field_2_rate,
    field_3_rate: team.field_3_rate,
    members: team.members,
    members_names: team.members_names,
    has_total: 0,
  };
}

/**
 * Ranks pull suggestions by unlocked-team usage × how many teams they open.
 *
 * When `allowedCharacters` is set, only those name_ids are considered
 * (e.g. limited cream from the standouts board).
 */
export function computePullSuggestions(
  nearMissTeams: NearMissStygianTeam[],
  maxSuggestions = 3,
  allowedCharacters?: ReadonlySet<string>,
): PullSuggestion[] {
  const byCharacter = new Map<string, NearMissStygianTeam[]>();
  for (const team of nearMissTeams) {
    if (!team.missing_character) continue;
    if (allowedCharacters && !allowedCharacters.has(team.missing_character)) {
      continue;
    }
    const existing = byCharacter.get(team.missing_character) ?? [];
    existing.push(team);
    byCharacter.set(team.missing_character, existing);
  }

  const suggestions: PullSuggestion[] = [];

  for (const [character, unlocked] of byCharacter) {
    const fours = unlocked.filter((t) => (t.members ?? []).length === 4);
    if (fours.length === 0) continue;

    const ranked = [...fours].sort(
      (a, b) => (b.avg_usage_rate ?? 0) - (a.avg_usage_rate ?? 0),
    );
    const topNearMiss = ranked[0]!;

    const unlockedUsage = topNearMiss.avg_usage_rate ?? 0;
    if (unlockedUsage < MIN_PULL_TEAM_USAGE) continue;

    const score =
      Math.pow(unlockedUsage / 100, 0.3) * Math.log1p(fours.length);

    const topTeams = ranked.slice(0, TOP_TEAMS_SHOWN).map(nearMissToTeam);

    suggestions.push({
      character,
      characterName: topNearMiss.missing_character_name,
      score,
      unlocksTeams: fours.length,
      topTeams,
      bestTeam: topTeams[0]!,
      avgUsage: unlockedUsage,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, maxSuggestions);
}

export type { NearMissStygianTeam } from "$lib/definitions";
export type NearMissPairTeam = NearMissStygianPair;

/**
 * Ranks pair pull suggestions by avg usage × PMI.
 *
 * When `allowedCharacters` is set, both missing characters must be in the set.
 */
export function computePairSuggestions(
  nearMissPairs: NearMissPairTeam[],
  maxSuggestions = 3,
  allowedCharacters?: ReadonlySet<string>,
): PairSuggestion[] {
  const byPair = new Map<string, NearMissPairTeam[]>();
  for (const team of nearMissPairs) {
    if (!team.missing_character_a || !team.missing_character_b) continue;
    if (
      allowedCharacters &&
      (!allowedCharacters.has(team.missing_character_a) ||
        !allowedCharacters.has(team.missing_character_b))
    ) {
      continue;
    }
    const key = [team.missing_character_a, team.missing_character_b]
      .sort()
      .join("|||");
    const existing = byPair.get(key) ?? [];
    existing.push(team);
    byPair.set(key, existing);
  }

  const suggestions: PairSuggestion[] = [];

  for (const [, teams] of byPair) {
    const fours = teams.filter((t) => (t.members ?? []).length === 4);
    if (fours.length === 0) continue;

    const ranked = [...fours].sort(
      (a, b) => (b.avg_usage_rate ?? 0) - (a.avg_usage_rate ?? 0),
    );
    const topTeam = ranked[0]!;

    const avgUsage = topTeam.avg_usage_rate ?? 0;
    const pmi = topTeam.pmi ?? 0;

    if (avgUsage < MIN_PULL_TEAM_USAGE) continue;

    const score =
      avgUsage * Math.pow(Math.max(pmi, PMI_SCORE_FLOOR), 0.3);

    const topTeams = ranked.slice(0, TOP_TEAMS_SHOWN).map(nearMissToTeam);

    suggestions.push({
      charA: topTeam.missing_character_a!,
      charAName: topTeam.missing_character_a_name,
      charB: topTeam.missing_character_b!,
      charBName: topTeam.missing_character_b_name,
      pmi,
      avgUsage,
      unlocksTeams: fours.length,
      topTeams,
      bestTeam: topTeams[0]!,
      score,
    });
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
}

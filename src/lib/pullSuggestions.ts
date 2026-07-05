import type {
  StygianTeam,
  NearMissStygianTeam,
  NearMissStygianPair,
} from "$lib/definitions";

export type PullSuggestion = {
  character: string;
  characterName: string | undefined;
  improvement: number;
  unlocksTeams: number;
  bestTeam: StygianTeam;
  score: number;
  currentBestTeam: StygianTeam | null;
  avgUsage: number;
};

export type PairSuggestion = {
  charA: string;
  charAName: string | undefined;
  charB: string;
  charBName: string | undefined;
  pmi: number;
  avgUsage: number;
  improvement: number;
  unlocksTeams: number;
  bestTeam: StygianTeam;
  currentBestTeam: StygianTeam | null;
  score: number;
};

/**
 * Ranks pull suggestions by marginal improvement:
 *   improvement = best_unlocked_team.usage_total
 *               - best currently-owned team sharing the same 3 members
 *
 * Measures how much the missing character actually adds over what you
 * could already run with those 3 characters + someone you own.
 */
export function computePullSuggestions(
  nearMissTeams: NearMissStygianTeam[],
  ownedTeams: StygianTeam[],
  maxSuggestions = 3,
): PullSuggestion[] {
  // Group near-miss teams by missing character
  const byCharacter = new Map<string, NearMissStygianTeam[]>();
  for (const team of nearMissTeams) {
    if (!team.missing_character) continue;
    const existing = byCharacter.get(team.missing_character) ?? [];
    existing.push(team);
    byCharacter.set(team.missing_character, existing);
  }

  const suggestions: PullSuggestion[] = [];

  for (const [character, unlocked] of byCharacter) {
    // Best near-miss team for this character
    const topNearMiss = [...unlocked].sort(
      (a, b) => (b.avg_usage_rate ?? 0) - (a.avg_usage_rate ?? 0),
    )[0];

    if (topNearMiss.members.length !== 4) continue;

    const unlockedUsage = topNearMiss.avg_usage_rate ?? 0;

    // The 3 owned members in this near-miss team
    const ownedMembers = (topNearMiss.members ?? []).filter(
      (m) => m !== character,
    );

    // Best currently-owned team that contains all 3 of those members
    const bestCurrentAlternative = ownedTeams
      .filter((t) => ownedMembers.every((m) => (t.members ?? []).includes(m)))
      .filter((t) => t.members.length == 4)
      .sort((a, b) => (b.avg_usage_rate ?? 0) - (a.avg_usage_rate ?? 0))[0];

    const alternativeUsage = bestCurrentAlternative?.avg_usage_rate ?? 0;

    const improvement = unlockedUsage - alternativeUsage;

    if (improvement <= 0) continue;

    const score =
      improvement *
      Math.pow(unlockedUsage / 100, 0.3) *
      Math.log1p(unlocked.length);

    const bestTeam: StygianTeam = {
      team_key: topNearMiss.team_key,
      version_number: 0,
      avg_usage_rate: topNearMiss.avg_usage_rate,
      usage_total: topNearMiss.usage_total,
      usage_rate: topNearMiss.usage_rate,
      field_1_rate: topNearMiss.field_1_rate,
      field_2_rate: topNearMiss.field_2_rate,
      field_3_rate: topNearMiss.field_3_rate,
      members: topNearMiss.members,
      members_names: topNearMiss.members_names,
      has_total: 0,
    };

    suggestions.push({
      character,
      characterName: topNearMiss.missing_character_name,
      improvement,
      score,
      unlocksTeams: unlocked.length,
      bestTeam,
      currentBestTeam: bestCurrentAlternative ?? null,
      avgUsage: topNearMiss.avg_usage_rate,
    } as PullSuggestion);
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, maxSuggestions);
}

// Re-export the DB-generated near-miss types for consumers of this module
export type { NearMissStygianTeam } from "$lib/definitions";
export type NearMissPairTeam = NearMissStygianPair;

/**
 * Ranks pair pull suggestions by:
 *   score = (avgUsage + improvement) * log(1 + unlocksTeams) * pmi^0.3
 *
 * Adding improvement alongside avgUsage means niche pairs (e.g. Lauma+Nefer
 * for players without Columbina) still surface even when population usage is
 * suppressed by better alternatives other players have.
 */
export function computePairSuggestions(
  nearMissPairs: NearMissPairTeam[],
  ownedTeams: StygianTeam[],
  singleSuggestions: PullSuggestion[] = [],
  maxSuggestions = 3,
): PairSuggestion[] {
  const byPair = new Map<string, NearMissPairTeam[]>();
  for (const team of nearMissPairs) {
    if (!team.missing_character_a || !team.missing_character_b) continue;
    const key = [team.missing_character_a, team.missing_character_b]
      .sort()
      .join("|||");
    const existing = byPair.get(key) ?? [];
    existing.push(team);
    byPair.set(key, existing);
  }

  const suggestions: PairSuggestion[] = [];

  for (const [, teams] of byPair) {
    const topTeam = [...teams].sort(
      (a, b) => (b.avg_usage_rate ?? 0) - (a.avg_usage_rate ?? 0),
    )[0];

    const charA = topTeam.missing_character_a!;
    const charB = topTeam.missing_character_b!;

    const avgUsage = topTeam.avg_usage_rate ?? 0;
    const pmi = topTeam.pmi ?? 0;

    const ownedMembers = (topTeam.members ?? []).filter(
      (m) => m !== charA && m !== charB,
    );

    // Best team with ownedMembers + charA (one half of the pair)
    const bestWithA = ownedTeams
      .filter((t) =>
        [...ownedMembers, charA].every((m) => (t.members ?? []).includes(m)),
      )
      .sort((a, b) => (b.avg_usage_rate ?? 0) - (a.avg_usage_rate ?? 0))[0];

    // Best team with ownedMembers + charB (other half of the pair)
    const bestWithB = ownedTeams
      .filter((t) =>
        [...ownedMembers, charB].every((m) => (t.members ?? []).includes(m)),
      )
      .sort((a, b) => (b.avg_usage_rate ?? 0) - (a.avg_usage_rate ?? 0))[0];

    // Best single-character alternative — pulling either one alone
    const bestCurrentAlternative =
      (bestWithA?.avg_usage_rate ?? 0) >= (bestWithB?.avg_usage_rate ?? 0)
        ? (bestWithA ?? bestWithB ?? null)
        : (bestWithB ?? bestWithA ?? null);

    const alternativeUsage = bestCurrentAlternative?.avg_usage_rate ?? 0;
    const improvement = avgUsage - alternativeUsage;

    if (improvement <= 0) continue;

    const score = (avgUsage + improvement) * Math.pow(pmi, 0.3);

    const bestTeam: StygianTeam = {
      team_key: topTeam.team_key,
      version_number: 0,
      avg_usage_rate: topTeam.avg_usage_rate,
      usage_total: topTeam.usage_total,
      usage_rate: topTeam.usage_rate,
      field_1_rate: topTeam.field_1_rate,
      field_2_rate: topTeam.field_2_rate,
      field_3_rate: topTeam.field_3_rate,
      members: topTeam.members,
      members_names: topTeam.members_names,
      has_total: 0,
    };

    suggestions.push({
      charA,
      charAName: topTeam.missing_character_a_name,
      charB,
      charBName: topTeam.missing_character_b_name,
      pmi,
      avgUsage,
      improvement,
      unlocksTeams: teams.length,
      bestTeam,
      currentBestTeam: bestCurrentAlternative ?? null,
      score,
    });
  }

  return suggestions
    .sort((a, b) => b.score - a.score)
    .filter((a) => a.avgUsage >= 10)
    .slice(0, maxSuggestions);
}

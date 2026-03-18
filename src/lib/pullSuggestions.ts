import type { StygianTeam } from "$lib/definitions";

export type PullSuggestion = {
  character: string;
  improvement: number;
  unlocksTeams: number;
  bestTeam: StygianTeam;
  score: number;
  currentBestTeam: StygianTeam | null;
};

export type PairSuggestion = {
  charA: string;
  charB: string;
  pmi: number;
  avgUsage: number; // avg_usage_total of best unlocked team — primary signal
  unlocksTeams: number;
  bestTeam: StygianTeam;
  score: number; // avgUsage * pmi — used for ranking
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
      (a, b) =>
        (b.avg_usage_total ?? b.usage_total ?? 0) -
        (a.avg_usage_total ?? a.usage_total ?? 0),
    )[0];

    const unlockedUsage =
      topNearMiss.avg_usage_total ?? topNearMiss.usage_total ?? 0;

    // The 3 owned members in this near-miss team
    const ownedMembers = (topNearMiss.members ?? []).filter(
      (m) => m !== character,
    );

    // Best currently-owned team that contains all 3 of those members
    const bestCurrentAlternative = ownedTeams
      .filter((t) => ownedMembers.every((m) => (t.members ?? []).includes(m)))
      .sort(
        (a, b) =>
          (b.avg_usage_total ?? b.usage_total ?? 0) -
          (a.avg_usage_total ?? a.usage_total ?? 0),
      )[0];

    const alternativeUsage =
      bestCurrentAlternative?.avg_usage_total ??
      bestCurrentAlternative?.usage_total ??
      0;
    const improvement = unlockedUsage - alternativeUsage;

    if (improvement <= 0) continue;

    // Geometric mean
    const score = improvement * unlockedUsage;

    const bestTeam: StygianTeam = {
      team_key: topNearMiss.team_key,
      version_number: topNearMiss.ret_version_number,
      usage_total: topNearMiss.usage_total,
      usage_rate_top: topNearMiss.usage_rate_top,
      usage_rate_middle: topNearMiss.usage_rate_middle,
      usage_rate_bottom: topNearMiss.usage_rate_bottom,
      members: topNearMiss.members,
      avg_usage_total: topNearMiss.avg_usage_total,
    };

    suggestions.push({
      character,
      improvement,
      score,
      unlocksTeams: unlocked.length,
      bestTeam,
      currentBestTeam: bestCurrentAlternative ?? null,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, maxSuggestions);
}

// Type returned by the Supabase RPC
export type NearMissStygianTeam = {
  team_key: string;
  ret_version_number: number;
  usage_total: number;
  usage_rate_top: number;
  usage_rate_middle: number;
  usage_rate_bottom: number;
  members: string[];
  missing_character: string;
  avg_usage_total: number;
};

// Type returned by the pair near-miss RPC
export type NearMissPairTeam = {
  team_key: string;
  ret_version_number: number;
  usage_total: number;
  usage_rate_top: number;
  usage_rate_middle: number;
  usage_rate_bottom: number;
  members: string[];
  missing_char_a: string | null;
  missing_char_b: string | null;
  avg_usage_total: number;
  pmi: number;
};

/**
 * Ranks pair pull suggestions by avg_usage_total of the best team they
 * unlock, weighted by PMI so high-synergy pairs rank above coincidental ones.
 * No improvement comparison — pairs unlock new archetypes, not incremental upgrades.
 */
export function computePairSuggestions(
  nearMissPairs: NearMissPairTeam[],
  maxSuggestions = 3,
): PairSuggestion[] {
  const byPair = new Map<string, NearMissPairTeam[]>();
  for (const team of nearMissPairs) {
    if (!team.missing_char_a || !team.missing_char_b) continue;
    const key = [team.missing_char_a, team.missing_char_b].sort().join("|||");
    const existing = byPair.get(key) ?? [];
    existing.push(team);
    byPair.set(key, existing);
  }

  const suggestions: PairSuggestion[] = [];

  for (const [, teams] of byPair) {
    const topTeam = [...teams].sort(
      (a, b) =>
        (b.avg_usage_total ?? b.usage_total ?? 0) -
        (a.avg_usage_total ?? a.usage_total ?? 0),
    )[0];

    const charA = topTeam.missing_char_a!;
    const charB = topTeam.missing_char_b!;
    const avgUsage = topTeam.avg_usage_total ?? topTeam.usage_total ?? 0;
    const pmi = topTeam.pmi ?? 0;

    // Rank by team quality weighted by synergy — avoids surfacing weak teams
    // just because the pair happens to appear together often
    const score = avgUsage * (1 + pmi);

    const bestTeam: StygianTeam = {
      team_key: topTeam.team_key,
      version_number: topTeam.ret_version_number,
      usage_total: topTeam.usage_total,
      usage_rate_top: topTeam.usage_rate_top,
      usage_rate_middle: topTeam.usage_rate_middle,
      usage_rate_bottom: topTeam.usage_rate_bottom,
      members: topTeam.members,
      avg_usage_total: topTeam.avg_usage_total,
    };

    suggestions.push({
      charA,
      charB,
      pmi,
      avgUsage,
      unlocksTeams: teams.length,
      bestTeam,
      score,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, maxSuggestions);
}

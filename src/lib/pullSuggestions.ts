import type { StygianTeam } from "$lib/definitions";

export type PullSuggestion = {
  character: string;
  improvement: number; // unlocked usage - best current alternative
  unlocksTeams: number;
  bestTeam: StygianTeam;
  score: number; // improvement * unlockedUsage — used for ranking
  currentBestTeam: StygianTeam | null;
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

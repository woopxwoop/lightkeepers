import type { Character, StygianTeam } from "#lib/definitions.js";
import type { RosterFetchStatus } from "#lib/stores/teams.js";
import type {
  NearMissPairTeam,
  NearMissStygianTeam,
  PairSuggestion,
  PullSuggestion,
} from "#lib/boards/pullSuggestions.js";
import {
  computePairSuggestions,
  computePullSuggestions,
} from "#lib/boards/pullSuggestions.js";
import type { TierListEntry } from "#lib/boards/tierlist.js";

export type PullPageState = "waiting" | "done" | "empty" | "error";

export type PullView = {
  pageState: PullPageState;
  suggestions: PullSuggestion[];
  pairSuggestions: PairSuggestion[];
};

export type PullViewInputs = {
  hydrated: boolean;
  ownedCount: number;
  teamsOwnedStatus: RosterFetchStatus;
  nearMissStatus: RosterFetchStatus;
  tierSettled: boolean;
  nearMissTeams: NearMissStygianTeam[];
  nearMissPairs: NearMissPairTeam[];
  creamPullIds: ReadonlySet<string> | undefined;
};

/**
 * One read of the fetch statuses. A teams or near-miss error stays an
 * error after the other request succeeds. Tier failure still ranks, with
 * the cream filter off.
 */
export function resolvePullView(inputs: PullViewInputs): PullView {
  const empty = {
    suggestions: [] as PullSuggestion[],
    pairSuggestions: [] as PairSuggestion[],
  };
  if (!inputs.hydrated) {
    return { pageState: "waiting", ...empty };
  }
  if (inputs.ownedCount === 0) {
    return { pageState: "empty", ...empty };
  }
  if (
    inputs.teamsOwnedStatus === "error" ||
    inputs.nearMissStatus === "error"
  ) {
    return { pageState: "error", ...empty };
  }
  if (
    inputs.teamsOwnedStatus !== "ready" ||
    inputs.nearMissStatus !== "ready" ||
    !inputs.tierSettled
  ) {
    return { pageState: "waiting", ...empty };
  }
  try {
    const suggestions = computePullSuggestions(
      inputs.nearMissTeams,
      3,
      inputs.creamPullIds,
    );
    const pairSuggestions = computePairSuggestions(
      inputs.nearMissPairs,
      3,
      inputs.creamPullIds,
    );
    const pageState: PullPageState =
      suggestions.length > 0 || pairSuggestions.length > 0 ? "done" : "empty";
    return { pageState, suggestions, pairSuggestions };
  } catch (error) {
    console.error("pull suggestion ranking failed:", error);
    return { pageState: "error", ...empty };
  }
}

/** Returns the same set when nothing changed, so re-ranking is a no-op. */
export function nextRevealed(
  revealed: Set<string>,
  ids: string[],
): Set<string> {
  const live = new Set(ids);
  const kept = [...revealed].filter((id) => live.has(id));
  return kept.length === revealed.size ? revealed : new Set(kept);
}

export function pairKey(suggestion: PairSuggestion): string {
  return `${suggestion.charA}|${suggestion.charB}`;
}

export function singleRowId(character: string): string {
  return `pull-single-${character}`;
}

export function pairRowId(key: string): string {
  return `pull-pair-${key}`;
}

/** Teammates beside the pull target(s), which already lead the row. */
export function remainingMembers(
  team: StygianTeam | undefined,
  exclude: string[],
): string[] {
  const skip = new Set(exclude);
  return (team?.members ?? []).filter((member) => !skip.has(member));
}

export function safeTeamIndex(
  indices: Record<string, number>,
  id: string,
  teams: StygianTeam[],
): number {
  const current = indices[id] ?? 0;
  return teams.length === 0 ? 0 : Math.min(current, teams.length - 1);
}

/** Everything one ledger row renders, minus the reveal/cycle UI state. */
export type LedgerRowModel = {
  /** Key into the revealed set and team-index map. */
  indexKey: string;
  rowId: string;
  targets: { nameId: string; name: string; rarity: number }[];
  mates: string[];
  mateCount: number;
  teams: StygianTeam[];
  teamIdx: number;
  cycleTeam: StygianTeam | undefined;
};

type RarityLookup = ReadonlyMap<string, Pick<Character, "rarity">>;

export function singleLedgerRow(
  suggestion: PullSuggestion,
  mapping: RarityLookup,
  indices: Record<string, number>,
): LedgerRowModel {
  const teamIdx = safeTeamIndex(
    indices,
    suggestion.character,
    suggestion.topTeams,
  );
  const cycleTeam = suggestion.topTeams[teamIdx];
  return {
    indexKey: suggestion.character,
    rowId: singleRowId(suggestion.character),
    targets: [
      {
        nameId: suggestion.character,
        name: suggestion.characterName ?? suggestion.character,
        rarity: mapping.get(suggestion.character)?.rarity ?? 5,
      },
    ],
    mates: remainingMembers(cycleTeam, [suggestion.character]),
    mateCount: 3,
    teams: suggestion.topTeams,
    teamIdx,
    cycleTeam,
  };
}

export function pairLedgerRow(
  suggestion: PairSuggestion,
  mapping: RarityLookup,
  indices: Record<string, number>,
): LedgerRowModel {
  const key = pairKey(suggestion);
  const teamIdx = safeTeamIndex(indices, key, suggestion.topTeams);
  const cycleTeam = suggestion.topTeams[teamIdx];
  return {
    indexKey: key,
    rowId: pairRowId(key),
    targets: [
      {
        nameId: suggestion.charA,
        name: suggestion.charAName ?? suggestion.charA,
        rarity: mapping.get(suggestion.charA)?.rarity ?? 5,
      },
      {
        nameId: suggestion.charB,
        name: suggestion.charBName ?? suggestion.charB,
        rarity: mapping.get(suggestion.charB)?.rarity ?? 5,
      },
    ],
    mates: remainingMembers(cycleTeam, [suggestion.charA, suggestion.charB]),
    mateCount: 2,
    teams: suggestion.topTeams,
    teamIdx,
    cycleTeam,
  };
}

/** Next team index when paging a row; wraps both ways. */
export function cycledTeamIndex(
  current: number | undefined,
  count: number,
  direction: -1 | 1,
): number {
  const clamped = Math.min(current ?? 0, count - 1);
  return (clamped + direction + count) % count;
}

export function usagePct(entry: TierListEntry): string {
  return `${entry.score.toFixed(entry.score >= 10 ? 0 : 1)}%`;
}

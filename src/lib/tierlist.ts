/**
 * Stygian "cream of the crop" from average among-owner usage rate.
 *
 * Source: `character_usage_avg_stygian`. Boards:
 *   - fiveStar  → limited 5★ (wish targets)
 *   - fourStar  → non-limited (4★ + standard-banner 5★; build priorities)
 *
 * Cutoff: relative largest gap on the sorted usage curve, searched in ranks
 * 8–16 (limited) / 24–32 (non-limited) and clamped to those ceilings
 * (or fewer if the board is small).
 */

/** Documented averaging window for the usage view (matches DB). */
export const TIER_LIST_WINDOW_CYCLES = 5;

/** Inclusive search window for the gap cut (1-based ranks). */
export const CREAM_SEARCH_LO = 8;
export const CREAM_SEARCH_HI = 16;
/** Hard floor / ceiling on how many characters we show (limited 5★). */
export const CREAM_MIN = 8;
export const CREAM_MAX = 16;
/** Non-limited board can run longer — more 4★ / standard 5★ to surface. */
export const CREAM_NONLIMITED_MIN = 24;
export const CREAM_NONLIMITED_SEARCH_LO = 24;
export const CREAM_NONLIMITED_SEARCH_HI = 32;
export const CREAM_NONLIMITED_MAX = 32;

/**
 * Permanently available 5★ on the standard wish.
 * Keep in sync when Mihoyo adds a new standard-pool 5★.
 * (Jean = Qin, Yumemizuki Mizuki = Mizuki in our name_ids.)
 */
export const STANDARD_BANNER_5STAR_IDS = new Set([
  "Qin",
  "Diluc",
  "Qiqi",
  "Mona",
  "Keqing",
  "Tighnari",
  "Dehya",
  "Mizuki",
]);

export type TierBoard = "fiveStar" | "fourStar";

export type TierListEntry = {
  nameId: string;
  name: string;
  score: number;
  cycles: number;
  rank: number;
};

export type TierListPayload = {
  windowCycles: number;
  cutoffMethod: "relative-gap";
  fiveStar: TierListEntry[];
  fourStar: TierListEntry[];
  fiveStarCutoff: number;
  fourStarCutoff: number;
};

export type CharacterUsageRow = {
  character_id: number;
  avg_usage_rate: number;
  cycles: number;
};

export type CharacterMeta = {
  game_id: number;
  name_id: string;
  name: string | null;
  rarity: number | null;
};

/** Limited event-banner 5★ (pull targets). */
export function isLimitedFiveStar(c: CharacterMeta): boolean {
  if (c.rarity !== 5) return false;
  const id = c.name_id;
  if (STANDARD_BANNER_5STAR_IDS.has(id)) return false;
  if (id === "Aloy" || id.startsWith("Player")) return false;
  return true;
}

/** 4★ + standard / free 5★ (build priorities, not wish targets). */
export function isNonLimited(c: CharacterMeta): boolean {
  if (c.rarity === 4) return true;
  if (c.rarity !== 5) return false;
  return !isLimitedFiveStar(c);
}

/**
 * Pick cream size k from scores sorted descending.
 * Maximizes relative gap (u_k − u_{k+1}) / u_k for k in [searchLo, searchHi].
 */
export function creamCutoff(
  scoresDesc: number[],
  searchLo = CREAM_SEARCH_LO,
  searchHi = CREAM_SEARCH_HI,
  minK = CREAM_MIN,
  maxK = CREAM_MAX,
): number {
  const n = scoresDesc.length;
  if (n === 0) return 0;
  if (n <= minK) return n;

  const lo = Math.max(1, Math.min(searchLo, n - 1));
  const hi = Math.max(lo, Math.min(searchHi, n - 1));

  let bestK = Math.min(Math.max(minK, lo), Math.min(maxK, n));
  let bestGap = -1;

  for (let k = lo; k <= hi; k++) {
    const u = scoresDesc[k - 1]!;
    const next = scoresDesc[k]!;
    if (!(u > 0)) continue;
    const rel = (u - next) / u;
    if (rel > bestGap) {
      bestGap = rel;
      bestK = k;
    }
  }

  return Math.min(Math.max(bestK, minK), Math.min(maxK, n));
}

type ScoredChar = {
  nameId: string;
  name: string;
  score: number;
  cycles: number;
};

/**
 * Rank one board and keep only the cream cut.
 */
export function computeCreamBoard(
  usageByGameId: Map<number, CharacterUsageRow>,
  characters: CharacterMeta[],
  opts?: {
    searchLo?: number;
    searchHi?: number;
    minK?: number;
    maxK?: number;
  },
): { entries: TierListEntry[]; cutoff: number } {
  const scored: ScoredChar[] = [];

  for (const c of characters) {
    const row = usageByGameId.get(c.game_id);
    if (
      !row ||
      typeof row.avg_usage_rate !== "number" ||
      !(row.avg_usage_rate > 0)
    ) {
      continue;
    }
    scored.push({
      nameId: c.name_id,
      name: c.name ?? c.name_id,
      score: row.avg_usage_rate,
      cycles: row.cycles ?? 0,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  const cutoff = creamCutoff(
    scored.map((s) => s.score),
    opts?.searchLo,
    opts?.searchHi,
    opts?.minK,
    opts?.maxK,
  );
  const entries = scored.slice(0, cutoff).map((s, i) => ({
    ...s,
    rank: i + 1,
  }));

  return { entries, cutoff };
}

/**
 * Build limited-5★ and non-limited cream boards from avg usage + catalog.
 * Payload keys stay `fiveStar` / `fourStar` for API stability.
 */
export function computeTierList(
  usageRows: CharacterUsageRow[],
  characters: CharacterMeta[],
): TierListPayload {
  const usageByGameId = new Map<number, CharacterUsageRow>();
  let maxCycles = 0;
  for (const row of usageRows) {
    if (row.character_id == null) continue;
    usageByGameId.set(row.character_id, row);
    if (row.cycles > maxCycles) maxCycles = row.cycles;
  }

  const limited = computeCreamBoard(
    usageByGameId,
    characters.filter(isLimitedFiveStar),
  );
  const nonLimited = computeCreamBoard(
    usageByGameId,
    characters.filter(isNonLimited),
    {
      searchLo: CREAM_NONLIMITED_SEARCH_LO,
      searchHi: CREAM_NONLIMITED_SEARCH_HI,
      minK: CREAM_NONLIMITED_MIN,
      maxK: CREAM_NONLIMITED_MAX,
    },
  );

  return {
    windowCycles: maxCycles > 0 ? maxCycles : TIER_LIST_WINDOW_CYCLES,
    cutoffMethod: "relative-gap",
    fiveStar: limited.entries,
    fourStar: nonLimited.entries,
    fiveStarCutoff: limited.cutoff,
    fourStarCutoff: nonLimited.cutoff,
  };
}

/**
 * Server-side gcsim character build summary from CDN (cached).
 * Source: `sim/characters/{GoodKey}.json.gz` (synced by gcsim-r2).
 *
 * Concurrent misses share one request (kit-style inflight map). Definitive
 * absences (404/410/empty body) are cached as null; transport / 5xx failures
 * stay uncached so the next request retries.
 */
import type {
  CharacterIndex,
  CharacterLiquidSubstats,
  CharacterStatRank,
} from "$lib/types/investment";
import { getSimCharacterSummaryUrl } from "$lib/utils";
import { LRUCache } from "$lib/server/cache";
import { fetchWithTimeout } from "$lib/cdn-fetch";

const summaryCache = new LRUCache<CharacterIndex | null>(200, 15 * 60 * 1000);
const summaryInflight = new Map<string, Promise<CharacterIndex | null>>();

const EMPTY_LIQUID: CharacterLiquidSubstats = {
  teams: 0,
  configs: 0,
  mean: {},
  ranked: [],
};

/** No sim/guide body — merge tombstone, not a stale-but-present summary. */
export function isSummaryTombstone(
  summary: CharacterIndex | null | undefined,
): boolean {
  if (!summary || summary.upToDate !== false) return false;
  return !Array.isArray(summary.weapons);
}

function asStatRanks(value: unknown): CharacterStatRank[] {
  return Array.isArray(value) ? (value as CharacterStatRank[]) : [];
}

/** Fill missing legacy main_stats / liquid shapes so Builds UI can iterate safely. */
export function normalizeCharacterSummary(
  summary: CharacterIndex,
): CharacterIndex {
  const mains =
    summary.main_stats && typeof summary.main_stats === "object"
      ? summary.main_stats
      : null;
  summary.main_stats = {
    sands: asStatRanks(mains?.sands),
    goblet: asStatRanks(mains?.goblet),
    circlet: asStatRanks(mains?.circlet),
  };

  const liquid = summary.substat_rolls_liquid;
  if (!liquid || typeof liquid !== "object") {
    summary.substat_rolls_liquid = {
      ...EMPTY_LIQUID,
      mean: {},
      ranked: [],
    };
  } else {
    summary.substat_rolls_liquid = {
      teams:
        typeof liquid.teams === "number" && Number.isFinite(liquid.teams)
          ? liquid.teams
          : 0,
      configs:
        typeof liquid.configs === "number" && Number.isFinite(liquid.configs)
          ? liquid.configs
          : 0,
      mean:
        liquid.mean && typeof liquid.mean === "object" ? liquid.mean : {},
      ranked: Array.isArray(liquid.ranked) ? liquid.ranked : [],
    };
  }

  return summary;
}

/**
 * Drop merge tombstones. Stale-but-present summaries (`upToDate: false` with
 * a body, e.g. Yae after a kit buff) are returned so the UI can hide numbers.
 * Legacy CDN rows get empty main_stats / liquid defaults before Builds reads.
 */
export function liveCharacterSummary(
  summary: CharacterIndex | null | undefined,
): CharacterIndex | null {
  if (!summary || isSummaryTombstone(summary)) return null;
  return normalizeCharacterSummary(summary);
}

export async function getCharacterSummary(
  goodKey: string,
): Promise<CharacterIndex | null> {
  if (!goodKey) return null;

  const cached = summaryCache.get(goodKey);
  if (cached !== undefined) return cached;

  const inflight = summaryInflight.get(goodKey);
  if (inflight) return inflight;

  const pending = loadSummaryFromCdn(goodKey).finally(() => {
    summaryInflight.delete(goodKey);
  });
  summaryInflight.set(goodKey, pending);
  return pending;
}

async function loadSummaryFromCdn(
  goodKey: string,
): Promise<CharacterIndex | null> {
  const res = await fetchWithTimeout(getSimCharacterSummaryUrl(goodKey));

  if (res.status === 404 || res.status === 410) {
    summaryCache.set(goodKey, null);
    return null;
  }
  if (!res.ok) {
    throw new Error(
      `character summary ${goodKey} unavailable: HTTP ${res.status}`,
    );
  }

  // Empty successful responses (204 / empty 200) are definitive absences.
  if (res.status === 204) {
    summaryCache.set(goodKey, null);
    return null;
  }
  const raw = await res.text();
  if (!raw.trim()) {
    summaryCache.set(goodKey, null);
    return null;
  }

  const summary = liveCharacterSummary(JSON.parse(raw) as CharacterIndex);
  summaryCache.set(goodKey, summary);
  return summary;
}

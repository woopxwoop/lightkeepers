/**
 * Server-side gcsim character build summary from CDN (cached).
 * Source: `sim/characters/{GoodKey}.json.gz` (synced by gcsim-r2).
 * Aggregate index: `sim/characters.json.gz` via {@link getCharacterIndexFile}.
 *
 * Concurrent misses share one request (kit-style inflight map). Definitive
 * absences (404/410/empty body) are cached as null; transport / 5xx failures
 * stay uncached so the next request retries.
 */
import { gunzip } from "node:zlib";
import { promisify } from "node:util";
import type {
  CharacterIndex,
  CharacterIndexFile,
  CharacterLiquidSubstats,
  CharacterStatRank,
} from "$lib/types/investment";
import {
  getSimCharacterSummaryUrl,
  getSimCharactersIndexUrl,
} from "$lib/utils";
import { LRUCache } from "$lib/server/cache";
import { fetchWithTimeout } from "$lib/cdn-fetch";

const gunzipAsync = promisify(gunzip);

const summaryCache = new LRUCache<CharacterIndex | null>(200, 15 * 60 * 1000);
const summaryInflight = new Map<string, Promise<CharacterIndex | null>>();
const indexCache = new LRUCache<CharacterIndexFile>(1, 15 * 60 * 1000, {
  redisNamespace: "character-index",
});

const EMPTY_LIQUID: CharacterLiquidSubstats = {
  teams: 0,
  configs: 0,
  mean: {},
  ranked: [],
};

function cancelUpstreamBody(res: Response): void {
  try {
    void res.body?.cancel()?.catch(() => {
      /* ignore async cancel failures; preserve original error path */
    });
  } catch {
    /* ignore sync cancel failures; preserve original error path */
  }
}

/** No sim/guide body — merge tombstone, not a stale-but-present summary. */
export function isSummaryTombstone(
  summary: CharacterIndex | null | undefined,
): boolean {
  if (!summary || summary.upToDate !== false) return false;
  return !Array.isArray(summary.weapons);
}

function asNonNegativeSafeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isSafeInteger(value) || value < 0) return null;
  return value;
}

function asStatRanks(value: unknown): CharacterStatRank[] {
  if (!Array.isArray(value)) return [];
  const out: CharacterStatRank[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const key = (entry as { key?: unknown }).key;
    const teams = asNonNegativeSafeInt((entry as { teams?: unknown }).teams);
    if (typeof key !== "string" || !key) continue;
    if (teams == null) continue;
    out.push({ key, teams });
  }
  return out;
}

function asLiquidRanks(value: unknown): CharacterLiquidSubstats["ranked"] {
  if (!Array.isArray(value)) return [];
  const out: CharacterLiquidSubstats["ranked"] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const key = (entry as { key?: unknown }).key;
    const mean = (entry as { mean?: unknown }).mean;
    if (typeof key !== "string" || !key) continue;
    if (typeof mean !== "number" || !Number.isFinite(mean)) continue;
    out.push({ key, mean });
  }
  return out;
}

/** Mean bag: nonempty keys → finite numbers only; arrays / junk → {}. */
function asLiquidMean(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!key) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    out[key] = raw;
  }
  return out;
}

/** Fill missing legacy main_stats / liquid shapes so Builds UI can iterate safely. */
export function normalizeCharacterSummary(
  summary: CharacterIndex,
): CharacterIndex {
  const mains =
    summary.main_stats && typeof summary.main_stats === "object"
      ? summary.main_stats
      : null;
  const liquid = summary.substat_rolls_liquid;

  return {
    ...summary,
    main_stats: {
      sands: asStatRanks(mains?.sands),
      goblet: asStatRanks(mains?.goblet),
      circlet: asStatRanks(mains?.circlet),
    },
    substat_rolls_liquid:
      !liquid || typeof liquid !== "object"
        ? {
            ...EMPTY_LIQUID,
            mean: {},
            ranked: [],
          }
        : {
            teams: asNonNegativeSafeInt(liquid.teams) ?? 0,
            configs: asNonNegativeSafeInt(liquid.configs) ?? 0,
            mean: asLiquidMean(liquid.mean),
            ranked: asLiquidRanks(liquid.ranked),
          },
  };
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
    cancelUpstreamBody(res);
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`character summary ${goodKey}: invalid JSON`);
  }

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new Error(`character summary ${goodKey}: invalid payload`);
  }

  const summary = liveCharacterSummary(parsed as CharacterIndex);
  summaryCache.set(goodKey, summary);
  return summary;
}

function isGzipped(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

/**
 * Normalize the aggregate `characters.json` map: drop tombstones, fill legacy
 * shapes, skip malformed rows.
 */
export function normalizeCharacterIndexFile(
  raw: CharacterIndexFile,
): CharacterIndexFile {
  const characters: Record<string, CharacterIndex> = {};
  const source =
    raw?.characters && typeof raw.characters === "object"
      ? raw.characters
      : {};
  for (const [key, entry] of Object.entries(source)) {
    if (!key || !entry || typeof entry !== "object") continue;
    const live = liveCharacterSummary({ ...entry, key: entry.key || key });
    if (!live) continue;
    characters[key] = live;
  }
  return {
    characters,
    ...(raw.impact_tiers ? { impact_tiers: raw.impact_tiers } : {}),
  };
}

async function fetchCharacterIndexFile(): Promise<CharacterIndexFile> {
  const res = await fetchWithTimeout(getSimCharactersIndexUrl());
  if (!res.ok) throw new Error(`character index CDN HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const text = isGzipped(buf)
    ? (await gunzipAsync(buf)).toString("utf-8")
    : buf.toString("utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("character index: invalid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("character index: invalid payload");
  }
  return normalizeCharacterIndexFile(parsed as CharacterIndexFile);
}

/** One CDN pull for all Builds summaries (Audit / account grading). */
export async function getCharacterIndexFile(): Promise<CharacterIndexFile> {
  return indexCache.getOrSet("character-index", fetchCharacterIndexFile);
}

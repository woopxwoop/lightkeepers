/**
 * Upgrade-cost catalog from R2, served by `/api/upgrade-costs`.
 *
 * Merges live + beta catalogs so CB characters (Odette / Alyosha) appear
 * alongside live Dimbreath rows — live wins on id. Beta is soft-fail so a
 * missing CB upload never breaks the planner. L1 + Valkey, 15 min SWR.
 */
import { error } from "@sveltejs/kit";
import { LRUCache } from "#lib/server/cache.js";
import { fetchWithTimeout } from "#lib/cdn-fetch.js";
import {
  upgradeCostsFileUrl,
  type UpgradeCostsChannel,
} from "#lib/asset-urls.js";
import { mergeUpgradeCostCatalogs } from "#lib/planner/upgrade-costs-merge.js";
import type {
  CharacterUpgradeCosts,
  UpgradeCostsCatalog,
  UpgradeCurves,
  UpgradeMaterialMeta,
  WeaponUpgradeCosts,
} from "#lib/types/upgrade-costs.js";

type CatalogFile = Parameters<typeof upgradeCostsFileUrl>[0];

const cache = new LRUCache<UpgradeCostsCatalog>(1, 15 * 60 * 1000, {
  redisNamespace: "upgrade-costs",
  staleWhileRevalidate: true,
});
const CACHE_KEY = "upgrade-costs";

async function fetchJson<T>(
  file: CatalogFile,
  channel: UpgradeCostsChannel,
): Promise<T> {
  const res = await fetchWithTimeout(upgradeCostsFileUrl(file, channel));
  if (!res.ok) {
    throw error(502, `CDN ${channel}/${file} returned HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function fetchLiveCatalog(): Promise<UpgradeCostsCatalog> {
  const [curves, materials, characters, weapons] = await Promise.all([
    fetchJson<UpgradeCurves>("curves.json", "live"),
    fetchJson<Record<string, UpgradeMaterialMeta>>("materials.json", "live"),
    fetchJson<CharacterUpgradeCosts[]>("characters.json", "live"),
    fetchJson<WeaponUpgradeCosts[]>("weapons.json", "live"),
  ]);
  return { curves, materials, characters, weapons };
}

/** One beta file, or null when absent / failing (logged). Never throws. */
async function tryFetchBetaJson<T>(file: CatalogFile): Promise<T | null> {
  try {
    const res = await fetchWithTimeout(upgradeCostsFileUrl(file, "beta"));
    if (res.status === 404 || res.status === 410) return null;
    if (!res.ok) {
      console.warn(
        `/api/upgrade-costs: beta ${file} HTTP ${res.status} — skipping beta merge`,
      );
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`/api/upgrade-costs: beta ${file} failed — skipping`, err);
    return null;
  }
}

/** Full beta catalog, or null unless every file loaded. */
async function fetchBetaCatalog(): Promise<UpgradeCostsCatalog | null> {
  const [curves, materials, characters, weapons] = await Promise.all([
    tryFetchBetaJson<UpgradeCurves>("curves.json"),
    tryFetchBetaJson<Record<string, UpgradeMaterialMeta>>("materials.json"),
    tryFetchBetaJson<CharacterUpgradeCosts[]>("characters.json"),
    tryFetchBetaJson<WeaponUpgradeCosts[]>("weapons.json"),
  ]);
  if (!curves || !materials || !characters || !weapons) return null;
  return { curves, materials, characters, weapons };
}

/** Live catalog merged with beta (cached). Live failures throw. */
export function getUpgradeCostsCatalog(): Promise<UpgradeCostsCatalog> {
  return cache.getOrSet(CACHE_KEY, async () => {
    const [live, beta] = await Promise.all([
      fetchLiveCatalog(),
      fetchBetaCatalog(),
    ]);
    return mergeUpgradeCostCatalogs(live, beta);
  });
}

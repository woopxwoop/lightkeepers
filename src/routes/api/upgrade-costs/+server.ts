/**
 * GET /api/upgrade-costs
 *
 * Proxies upgrade-cost JSON from R2 so the browser isn't blocked by CDN CORS
 * (same pattern as `/api/investment`). Merges live + beta catalogs so CB chars
 * (Odette / Alyosha) appear alongside live Dimbreath rows — live wins on id.
 */
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { LRUCache } from "$lib/server/cache";
import { upgradeCostsFileUrl, type UpgradeCostsChannel } from "$lib/asset-urls";
import { mergeUpgradeCostCatalogs } from "$lib/upgrade-costs-merge";
import type {
  CharacterUpgradeCosts,
  UpgradeCostsCatalog,
  UpgradeCurves,
  UpgradeMaterialMeta,
  WeaponUpgradeCosts,
} from "$lib/types/upgrade-costs";

const cache = new LRUCache<UpgradeCostsCatalog>(1, 15 * 60 * 1000);
const CACHE_KEY = "upgrade-costs";

async function fetchJson<T>(
  file: Parameters<typeof upgradeCostsFileUrl>[0],
  channel: UpgradeCostsChannel,
): Promise<T> {
  const res = await fetch(upgradeCostsFileUrl(file, channel));
  if (!res.ok) {
    throw error(502, `CDN ${channel}/${file} returned HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function fetchChannelCatalog(
  channel: UpgradeCostsChannel,
): Promise<UpgradeCostsCatalog> {
  const [curves, materials, characters, weapons] = await Promise.all([
    fetchJson<UpgradeCurves>("curves.json", channel),
    fetchJson<Record<string, UpgradeMaterialMeta>>("materials.json", channel),
    fetchJson<CharacterUpgradeCosts[]>("characters.json", channel),
    fetchJson<WeaponUpgradeCosts[]>("weapons.json", channel),
  ]);
  return { curves, materials, characters, weapons };
}

async function tryFetchBetaJson<T>(
  file: Parameters<typeof upgradeCostsFileUrl>[0],
): Promise<T | null> {
  const res = await fetch(upgradeCostsFileUrl(file, "beta"));
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) {
    console.warn(
      `/api/upgrade-costs: beta ${file} HTTP ${res.status} — skipping beta merge`,
    );
    return null;
  }
  return (await res.json()) as T;
}

/** Soft-fail beta so missing CB upload doesn't break the planner. */
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

async function fetchCatalog(): Promise<UpgradeCostsCatalog> {
  const [live, beta] = await Promise.all([
    fetchChannelCatalog("live"),
    fetchBetaCatalog(),
  ]);
  return mergeUpgradeCostCatalogs(live, beta);
}

export const GET: RequestHandler = async () => {
  try {
    const payload = await cache.getOrSet(CACHE_KEY, fetchCatalog);
    return json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("/api/upgrade-costs:", err);
    throw error(502, "Failed to fetch upgrade costs from CDN");
  }
};

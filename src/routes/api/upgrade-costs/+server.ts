/**
 * GET /api/upgrade-costs
 *
 * Proxies upgrade-cost JSON from R2 so the browser isn't blocked by CDN CORS
 * (same pattern as `/api/investment`).
 */
import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { LRUCache } from "$lib/server/cache";
import { upgradeCostsFileUrl } from "$lib/asset-urls";
import type {
  CharacterUpgradeCosts,
  UpgradeCostsCatalog,
  UpgradeCurves,
  UpgradeMaterialMeta,
  WeaponUpgradeCosts,
} from "$lib/types/upgrade-costs";

const cache = new LRUCache<UpgradeCostsCatalog>(1, 15 * 60 * 1000);
const CACHE_KEY = "upgrade-costs";

async function fetchJson<T>(file: Parameters<typeof upgradeCostsFileUrl>[0]): Promise<T> {
  const res = await fetch(upgradeCostsFileUrl(file));
  if (!res.ok) {
    throw error(502, `CDN ${file} returned HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function fetchCatalog(): Promise<UpgradeCostsCatalog> {
  const [curves, materials, characters, weapons] = await Promise.all([
    fetchJson<UpgradeCurves>("curves.json"),
    fetchJson<Record<string, UpgradeMaterialMeta>>("materials.json"),
    fetchJson<CharacterUpgradeCosts[]>("characters.json"),
    fetchJson<WeaponUpgradeCosts[]>("weapons.json"),
  ]);
  return { curves, materials, characters, weapons };
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

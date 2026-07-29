/**
 * Database-backed Abyss / Stygian version checks.
 *
 * Version tables change only on sync, so the full supported sets are cached
 * (L1 + optional Valkey) and membership is checked in memory.
 */

import { error } from "@sveltejs/kit";
import { LRUCache } from "$lib/server/cache";
import { serverDb } from "$lib/server/supabaseServer";

const TTL_15_MIN = 15 * 60 * 1000;

const abyssVersionsCache = new LRUCache<number[]>(1, TTL_15_MIN, {
  redisNamespace: "abyss_versions",
});
const stygianVersionsCache = new LRUCache<number[]>(1, TTL_15_MIN, {
  redisNamespace: "stygian_versions",
});

async function loadAbyssVersions(): Promise<number[]> {
  return abyssVersionsCache.getOrSet("all", async () => {
    const { data, error: err } = await serverDb
      .from("abyss_versions")
      .select("version_number");
    if (err) throw err;
    return (data ?? []).map((row) => row.version_number);
  });
}

async function loadStygianVersions(): Promise<number[]> {
  return stygianVersionsCache.getOrSet("all", async () => {
    const { data, error: err } = await serverDb
      .from("stygian_versions")
      .select("version_number");
    if (err) throw err;
    return (data ?? []).map((row) => row.version_number);
  });
}

/** Whether an Abyss version exists in the database-supported domain. */
export async function isSupportedAbyssVersion(
  version: number,
): Promise<boolean> {
  const versions = await loadAbyssVersions();
  return versions.includes(version);
}

/** Whether a Stygian version exists in the database-supported domain. */
export async function isSupportedStygianVersion(
  version: number,
): Promise<boolean> {
  const versions = await loadStygianVersions();
  return versions.includes(version);
}

/**
 * Require a supported Stygian version.
 * Lookup failures → 500; unsupported → 400 with the caller's message.
 */
export async function requireSupportedStygianVersion(
  version: number,
  unsupportedMessage = "stygianVersion must be a number.",
): Promise<void> {
  let supported: boolean;
  try {
    supported = await isSupportedStygianVersion(version);
  } catch (e) {
    console.error("[version-validation] stygian version lookup failed:", e);
    throw error(500, "Internal server error");
  }
  if (!supported) throw error(400, unsupportedMessage);
}

/**
 * Require supported Abyss and Stygian versions.
 * Lookup failures → 500; either unsupported → 400 with the caller's message.
 */
export async function requireSupportedAbyssAndStygianVersions(
  abyssVersion: number,
  stygianVersion: number,
  unsupportedMessage = "abyssVersion and stygianVersion must be numbers.",
): Promise<void> {
  let supportedVersions: [boolean, boolean];
  try {
    supportedVersions = await Promise.all([
      isSupportedAbyssVersion(abyssVersion),
      isSupportedStygianVersion(stygianVersion),
    ]);
  } catch (e) {
    console.error("[version-validation] version lookup failed:", e);
    throw error(500, "Internal server error");
  }
  if (!supportedVersions[0] || !supportedVersions[1]) {
    throw error(400, unsupportedMessage);
  }
}

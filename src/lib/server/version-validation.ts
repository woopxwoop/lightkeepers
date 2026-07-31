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

type VersionRows = {
  data: { version_number: number }[] | null;
  error: unknown;
};

/**
 * One cached version domain (a `*_versions` table).
 *
 * `fetchVersions` stays a closure at the call site so the table name is a
 * literal and the generated row types still apply.
 */
function createVersionDomain(
  redisNamespace: string,
  fetchVersions: () => PromiseLike<VersionRows>,
) {
  const cache = new LRUCache<number[]>(1, TTL_15_MIN, { redisNamespace });

  async function load(): Promise<number[]> {
    return cache.getOrSet("all", async () => {
      const { data, error: err } = await fetchVersions();
      if (err) throw err;
      return (data ?? []).map((row) => row.version_number);
    });
  }

  return {
    async isSupported(version: number): Promise<boolean> {
      const versions = await load();
      return versions.includes(version);
    },
  };
}

const abyssVersions = createVersionDomain("abyss_versions", () =>
  serverDb.from("abyss_versions").select("version_number"),
);

const stygianVersions = createVersionDomain("stygian_versions", () =>
  serverDb.from("stygian_versions").select("version_number"),
);

/** Whether an Abyss version exists in the database-supported domain. */
export async function isSupportedAbyssVersion(
  version: number,
): Promise<boolean> {
  return abyssVersions.isSupported(version);
}

/** Whether a Stygian version exists in the database-supported domain. */
export async function isSupportedStygianVersion(
  version: number,
): Promise<boolean> {
  return stygianVersions.isSupported(version);
}

/**
 * Require every checked version to be supported.
 * Lookup failures → 500; any unsupported → 400 with the caller's message.
 */
async function requireSupportedVersions(
  checks: Promise<boolean>[],
  logLabel: string,
  unsupportedMessage: string,
): Promise<void> {
  let supported: boolean[];
  try {
    supported = await Promise.all(checks);
  } catch (e) {
    console.error(`[version-validation] ${logLabel} lookup failed:`, e);
    throw error(500, "Internal server error");
  }
  if (supported.some((ok) => !ok)) throw error(400, unsupportedMessage);
}

/** Require a supported Stygian version. */
export async function requireSupportedStygianVersion(
  version: number,
  unsupportedMessage = "stygianVersion is not a supported version.",
): Promise<void> {
  await requireSupportedVersions(
    [isSupportedStygianVersion(version)],
    "stygian version",
    unsupportedMessage,
  );
}

/** Require supported Abyss and Stygian versions. */
export async function requireSupportedAbyssAndStygianVersions(
  abyssVersion: number,
  stygianVersion: number,
  unsupportedMessage = "abyssVersion and stygianVersion are not supported versions.",
): Promise<void> {
  await requireSupportedVersions(
    [
      isSupportedAbyssVersion(abyssVersion),
      isSupportedStygianVersion(stygianVersion),
    ],
    "version",
    unsupportedMessage,
  );
}

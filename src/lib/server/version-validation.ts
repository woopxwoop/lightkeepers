/**
 * Database-backed Abyss / Stygian version checks.
 *
 * Version tables change only on sync, so the full supported sets are cached
 * (L1 + optional Valkey) and membership is checked in memory.
 */

import { error } from "@sveltejs/kit";
import { LRUCache } from "#lib/server/cache.js";
import { serverDb } from "#lib/server/supabaseServer.js";

const TTL_15_MIN = 15 * 60 * 1000;

/** A version table read fine but had no rows. Never cached. */
class EmptyVersionTable extends Error {}

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
    try {
      return await cache.getOrSet("all", async () => {
        const { data, error: err } = await fetchVersions();
        if (err) throw err;
        const versions = (data ?? []).map((row) => row.version_number);
        // Throwing keeps an empty table out of L1 and Valkey: the sync that
        // fills it shows on the next request, not 15 minutes later.
        if (versions.length === 0) throw new EmptyVersionTable();
        return versions;
      });
    } catch (err) {
      if (err instanceof EmptyVersionTable) return [];
      throw err;
    }
  }

  return {
    async isSupported(version: number): Promise<boolean> {
      const versions = await load();
      return versions.includes(version);
    },
    async latest(): Promise<number | null> {
      const versions = await load();
      if (versions.length === 0) return null;
      return Math.max(...versions);
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
async function isSupportedAbyssVersion(version: number): Promise<boolean> {
  return abyssVersions.isSupported(version);
}

/** Whether a Stygian version exists in the database-supported domain. */
async function isSupportedStygianVersion(version: number): Promise<boolean> {
  return stygianVersions.isSupported(version);
}

/** Latest Abyss version_number, or null when the table is empty. */
export async function getLatestAbyssVersionNumber(): Promise<number | null> {
  return abyssVersions.latest();
}

/** Latest Stygian version_number, or null when the table is empty. */
export async function getLatestStygianVersionNumber(): Promise<number | null> {
  return stygianVersions.latest();
}

/**
 * Latest versions for the root layout, which every page renders through.
 * A DB error or an empty table gives null (logged) instead of failing every
 * page; the client then takes its versions from `/api/static`. Never -1.
 */
export async function getLayoutVersionNumbers(): Promise<{
  abyss: number | null;
  stygian: number | null;
}> {
  const settle = async (
    label: string,
    latest: () => Promise<number | null>,
  ): Promise<number | null> => {
    try {
      const version = await latest();
      if (version == null) console.error(`layout: ${label}_versions is empty`);
      return version;
    } catch (err) {
      console.error(`layout: ${label}_versions lookup failed`, err);
      return null;
    }
  };
  const [abyss, stygian] = await Promise.all([
    settle("abyss", getLatestAbyssVersionNumber),
    settle("stygian", getLatestStygianVersionNumber),
  ]);
  return { abyss, stygian };
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

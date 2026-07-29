/**
 * Roster-keyed Supabase RPC calls behind rpcCache.
 *
 * Owns the cache key, the null-data fallback, and the "log the real error,
 * return a generic 500" boundary so PostgREST details never reach clients.
 */

import { error, isHttpError } from "@sveltejs/kit";
import { buildRpcKey, rpcCache } from "$lib/server/cache";

type RpcResponse<TRow> = {
  data: TRow[] | null;
  error: { message: string } | null;
};

export type CachedRosterRpc<TRow> = {
  /** Cache-key prefix. May differ from the RPC name when extra args affect results. */
  cacheName: string;
  versionNumber: number;
  characters: string[];
  run: () => PromiseLike<RpcResponse<TRow>>;
};

/** Cached roster-scoped RPC. Returns `[]` for null data; failures become 500. */
export async function cachedRosterRpc<TRow>({
  cacheName,
  versionNumber,
  characters,
  run,
}: CachedRosterRpc<TRow>): Promise<TRow[]> {
  const key = buildRpcKey(cacheName, versionNumber, characters);
  try {
    const rows = await rpcCache.getOrSet(key, async () => {
      const { data, error: err } = await run();
      if (err) throw err;
      return data ?? [];
    });
    return rows as TRow[];
  } catch (e) {
    if (isHttpError(e)) throw e;
    console.error(`[rpc] ${cacheName} failed:`, e);
    throw error(500, "Internal server error");
  }
}

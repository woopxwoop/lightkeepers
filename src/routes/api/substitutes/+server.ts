import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { serverDb } from "$lib/server/supabaseServer";
import {
  rpcCache,
  apiRateLimiter,
  getClientIp,
  buildRpcKey,
} from "$lib/server/cache";

type SubstitutesBody = {
  characterName: string;
  versionNumber: number;
};

type RpcSubstituteRow = {
  substitute_character: string;
  usage_ratio: number;
  observed_cores: number;
};

export const POST: RequestHandler = async ({ request }) => {
  const ip = getClientIp(request);
  if (!apiRateLimiter.check(ip)) {
    throw error(429, "Too many requests — please wait a moment.");
  }

  let body: SubstitutesBody;
  try {
    body = await request.json();
  } catch {
    throw error(400, "Invalid JSON body.");
  }

  const { characterName, versionNumber } = body;
  if (!characterName || typeof characterName !== "string") {
    throw error(400, "characterName is required.");
  }
  if (typeof versionNumber !== "number") {
    throw error(400, "versionNumber must be a number.");
  }

  const cacheKey = buildRpcKey("substitutes_stygian_v2", versionNumber, [
    characterName,
  ]);

  const substitutes = await rpcCache.getOrSet(cacheKey, async () => {
    const { data, error: err } = await (serverDb as any).rpc(
      "get_character_substitutes_stygian_v2",
      {
        p_character_name: characterName,
        p_version_number: versionNumber,
      },
    );

    if (err) {
      throw new Error(err.message);
    }

    return (data ?? []) as RpcSubstituteRow[];
  });

  return json({ substitutes });
};

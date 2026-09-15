/**
 * GET /api/character-index
 *
 * Proxies `sim/characters.json.gz` (aggregate Builds summaries) so account
 * surfaces can grade many characters without N× `/api/character-summary/[key]`.
 *
 * Cache: CF s-maxage=300 + server L1/Valkey in getCharacterIndexFile().
 * No per-IP rate limit — same class as `/api/investment`.
 */
import { json, error, isHttpError } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getCharacterIndexFile } from "$lib/server/character-summary";

export const GET: RequestHandler = async () => {
  try {
    const payload = await getCharacterIndexFile();
    return json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    if (isHttpError(err)) throw err;
    console.error("/api/character-index:", err);
    throw error(502, "Failed to fetch character index from CDN");
  }
};

/**
 * GET /api/tcg-cards
 *
 * Proxies `characters/tcg-cards.json` (name_ids with TCG card art).
 * Always includes manual Traveler (`PlayerBoy`). Same cache class as investment.
 */
import { error, isHttpError } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getTcgCardsFile } from "#lib/server/tcg-cards.js";

export const GET: RequestHandler = async () => {
  try {
    const payload = await getTcgCardsFile();
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    if (isHttpError(err)) throw err;
    console.error("/api/tcg-cards:", err);
    throw error(502, "Failed to fetch TCG card index from CDN");
  }
};

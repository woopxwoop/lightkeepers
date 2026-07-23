import type { PageServerLoad } from "./$types";
import type { StygianEnemies, StygianSchedule } from "$lib/definitions";

const emptyStygianEnemies: StygianEnemies = {
  top: null,
  middle: null,
  bottom: null,
};

/**
 * Keep this payload small so client nav from home isn't blocked on shipping
 * the full stygian team list. Meta teams load via ensureStaticBoards() on the client.
 */
export const load: PageServerLoad = async ({ fetch }) => {
  const staticRes = await fetch("/api/static");
  const staticData = staticRes.ok ? await staticRes.json() : null;

  return {
    seo: {
      title: "Stygian Teams — Lightkeepers",
      description:
        "Recommended Stygian Onslaught team compositions for Genshin Impact.",
    },
    stygianEnemies: (staticData?.stygianEnemies ??
      emptyStygianEnemies) as StygianEnemies,
    stygianSchedule: (staticData?.stygianSchedule ?? null) as StygianSchedule | null,
  };
};

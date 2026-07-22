import type { PageServerLoad } from "./$types";
import type { AbyssEnemies } from "$lib/definitions";

const emptyAbyssEnemies: AbyssEnemies = {
  top: [],
  bottom: [],
  buffName: null,
  openTime: null,
};

export const load: PageServerLoad = async ({ fetch }) => {
  const staticRes = await fetch("/api/static");
  const staticData = staticRes.ok ? await staticRes.json() : null;

  return {
    seo: {
      title: "Abyss Teams — Lightkeepers",
      description:
        "Recommended Spiral Abyss team compositions for Genshin Impact.",
    },
    allTeamsAbyss: staticData?.allTeamsAbyss ?? [],
    abyssEnemies: (staticData?.abyssEnemies ?? emptyAbyssEnemies) as AbyssEnemies,
  };
};

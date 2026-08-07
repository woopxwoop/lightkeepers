import type { PageServerLoad } from "./$types";
import { isPlaywrightE2e } from "$lib/server/e2e";
import { e2eStygianEnemyList } from "$lib/e2e/fixtures";
import { listStygianEnemyAppearances } from "$lib/server/stygian-enemies";

export const load: PageServerLoad = async () => {
  const enemies = isPlaywrightE2e()
    ? e2eStygianEnemyList()
    : await listStygianEnemyAppearances();

  return {
    enemies,
    seo: {
      title: "Stygian Enemies — Lightkeepers",
      description:
        "Historical best teams for Stygian Onslaught bosses across past cycles.",
    },
  };
};

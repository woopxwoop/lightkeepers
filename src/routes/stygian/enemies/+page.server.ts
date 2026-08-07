import type { PageServerLoad } from "./$types";
import { isPlaywrightE2e } from "$lib/server/e2e";
import { e2eStygianEnemyCycles, e2eStygianEnemyList } from "$lib/e2e/fixtures";
import { listStygianEnemyAppearances } from "$lib/server/stygian-enemies";

export const load: PageServerLoad = async () => {
  const { enemies, cycles } = isPlaywrightE2e()
    ? { enemies: e2eStygianEnemyList(), cycles: e2eStygianEnemyCycles() }
    : await listStygianEnemyAppearances();

  return {
    enemies,
    cycles,
    seo: {
      title: "Stygian Enemies — Lightkeepers",
      description:
        "Historical best teams for Stygian Onslaught bosses across past cycles.",
    },
  };
};

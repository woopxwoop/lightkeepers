import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { isPlaywrightE2e } from "#lib/server/e2e.js";
import { E2E_STYGIAN_ENEMY } from "#lib/e2e/fixtures.js";
import { requireEnemyId } from "#lib/server/request-validation.js";
import { loadStygianEnemy } from "#lib/server/stygian-enemies.js";

export const load: PageServerLoad = async ({ params }) => {
  let enemyId: number;
  try {
    enemyId = requireEnemyId(params.id);
  } catch {
    throw error(404, "Enemy not found");
  }

  const enemy = isPlaywrightE2e()
    ? enemyId === E2E_STYGIAN_ENEMY.id
      ? E2E_STYGIAN_ENEMY
      : (() => {
          throw error(404, "Enemy not found");
        })()
    : await loadStygianEnemy(enemyId);

  const name = enemy.enemy_name ?? "Enemy";
  return {
    enemy,
    seo: {
      title: `${name} — Stygian Teams — Lightkeepers`,
      description: `Historical top teams for ${name} in Stygian Onslaught.`,
    },
  };
};

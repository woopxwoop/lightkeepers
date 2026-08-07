/**
 * SSR helpers for `/stygian/enemies` — Stygian boss appearances only.
 */

import { error } from "@sveltejs/kit";
import { serverDb } from "$lib/server/supabaseServer";
import { assertNoDbError } from "$lib/server/request-validation";
import type {
  Enemy,
  StygianEnemyCycleOption,
  StygianEnemyListItem,
} from "$lib/definitions";

export async function listStygianEnemyAppearances(): Promise<{
  enemies: StygianEnemyListItem[];
  cycles: StygianEnemyCycleOption[];
}> {
  const [appearancesRes, versionsRes] = await Promise.all([
    serverDb.from("stygian_version_enemies").select("enemy_id, version_number"),
    serverDb.from("stygian_versions").select("version_number, version_name"),
  ]);
  assertNoDbError("enemies index appearances", appearancesRes.error);
  assertNoDbError("enemies index versions", versionsRes.error);

  const appearances = appearancesRes.data ?? [];
  const versionRows = versionsRes.data ?? [];
  const versionName = new Map(
    versionRows.map((v) => [v.version_number, v.version_name ?? null]),
  );

  const appearedVersions = new Set(appearances.map((r) => r.version_number));
  const cycles: StygianEnemyCycleOption[] = [...appearedVersions]
    .sort((a, b) => b - a)
    .map((version_number) => ({
      version_number,
      version_name: versionName.get(version_number) ?? null,
    }));

  if (appearances.length === 0) return { enemies: [], cycles: [] };

  const byEnemy = new Map<number, { versions: Set<number>; latest: number }>();
  for (const row of appearances) {
    const prev = byEnemy.get(row.enemy_id);
    if (!prev) {
      byEnemy.set(row.enemy_id, {
        versions: new Set([row.version_number]),
        latest: row.version_number,
      });
    } else {
      prev.versions.add(row.version_number);
      if (row.version_number > prev.latest) prev.latest = row.version_number;
    }
  }

  const ids = [...byEnemy.keys()];
  const enemiesRes = await serverDb
    .from("enemies")
    .select("id, enemy_name, asset")
    .in("id", ids);
  assertNoDbError("enemies index enemies", enemiesRes.error);

  const enemyMap = new Map(
    (enemiesRes.data ?? []).map((e) => [e.id, e] as const),
  );

  const enemies: StygianEnemyListItem[] = [];
  for (const [id, stats] of byEnemy) {
    const enemy = enemyMap.get(id);
    if (!enemy) continue;
    const version_numbers = [...stats.versions].sort((a, b) => b - a);
    enemies.push({
      id,
      enemy_name: enemy.enemy_name,
      asset: enemy.asset,
      appearance_count: version_numbers.length,
      latest_version_number: stats.latest,
      latest_version_name: versionName.get(stats.latest) ?? null,
      version_numbers,
    });
  }

  enemies.sort((a, b) => {
    if (b.latest_version_number !== a.latest_version_number) {
      return b.latest_version_number - a.latest_version_number;
    }
    return (a.enemy_name ?? "").localeCompare(b.enemy_name ?? "");
  });
  return { enemies, cycles };
}

export async function loadStygianEnemy(enemyId: number): Promise<Enemy> {
  const enemyRes = await serverDb
    .from("enemies")
    .select("*")
    .eq("id", enemyId)
    .maybeSingle();
  assertNoDbError("enemy detail", enemyRes.error);
  if (!enemyRes.data) throw error(404, "Enemy not found");

  const appearanceRes = await serverDb
    .from("stygian_version_enemies")
    .select("enemy_id")
    .eq("enemy_id", enemyId)
    .limit(1);
  assertNoDbError("enemy detail appearances", appearanceRes.error);
  if (!appearanceRes.data?.length) {
    throw error(404, "Enemy has no Stygian appearances");
  }

  return enemyRes.data;
}

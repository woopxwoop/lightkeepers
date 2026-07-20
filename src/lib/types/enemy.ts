/**
 * Enemy index JSON served from R2 / CDN.
 *
 *   genshin/data/enemies/index.json — EnemyIndex
 *
 * Built from Supabase `enemies` rows (schedule sync populates `asset` +
 * `icon_path`) and uploaded by `scripts/sync/character-images-r2.ts`.
 *
 * `icon` is the R2 stem under `genshin/ui/{icon}.webp` — typically a game
 * `UI_*` name (`UI_MonsterIcon_*`, `UI_Img_LeyLineChallenge_*`).
 * Resolve with `enemyIconUrl` / `getEnemyAsset`.
 *
 * Product UI still loads live enemy slots from `/api/static` (Supabase);
 * this index is for tooling and a stable icon map.
 */

/** One row in `enemies/index.json`. */
export interface EnemyIndexEntry {
  id: number;
  name: string | null;
  /** Stem under `genshin/ui/{icon}.webp`. */
  icon: string;
  /**
   * Lunaris asset folder used at sync time (`monstericon` | `leyline`).
   * Not needed by the frontend CDN URL.
   */
  lunaris_path: string | null;
  description: string | null;
}

/** Full `index.json` payload. */
export type EnemyIndex = EnemyIndexEntry[];

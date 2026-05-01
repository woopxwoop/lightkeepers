import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database.types.js";
import { EnkaClient } from "enka-network-api";
import sharp from "sharp";

const {
  PUBLIC_SUPABASE_URL,
  PRIVATE_SUPABASE_KEY,
  R2_ACCOUNT_ID,
  CF_API_TOKEN,
  R2_BUCKET,
  R2_PREFIX = "characters",
  ENEMY_R2_PREFIX = "enemies",
  IMAGE_MAX_WIDTH = "1024",
  IMAGE_WEBP_QUALITY = "80",
} = process.env;

for (const [key, value] of Object.entries({ PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_KEY, R2_ACCOUNT_ID, R2_BUCKET, CF_API_TOKEN })) {
  if (!value) throw new Error(`Missing required env var: ${key}`);
}

const MAX_WIDTH = Number(IMAGE_MAX_WIDTH);
const WEBP_QUALITY = Number(IMAGE_WEBP_QUALITY);

const db = createClient<Database>(PUBLIC_SUPABASE_URL!, PRIVATE_SUPABASE_KEY!, {
  auth: { persistSession: false },
});

function parseFlag(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value == null) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function dedupe(values: (string | undefined | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getEnkaPortraitCandidates(enkaCharacter: any): string[] {
  if (!enkaCharacter) return [];
  return dedupe([
    enkaCharacter?.icon?.url,
    enkaCharacter?.avatar?.icon?.url,
    enkaCharacter?.costume?.icon?.url,
  ]);
}

function getTemplateCandidates(nameId: string): {
  portrait: string[];
  coop: string[];
} {
  const safe = encodeURIComponent(nameId);
  return {
    portrait: dedupe([`https://enka.network/ui/UI_AvatarIcon_${safe}.png`]),
    coop: dedupe([
      `https://api.lunaris.moe/data/assets/coopimg/UI_CoopImg_${safe}.webp`,
    ]),
  };
}

interface FetchedImage {
  sourceUrl: string;
  buffer: Buffer;
  isWebp: boolean;
}

async function fetchFirstImageBuffer(
  urls: string[],
): Promise<FetchedImage | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "lightkeepers-image-sync/1.0" },
      });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.startsWith("image/") &&
        !contentType.startsWith("application/octet-stream") &&
        !contentType.startsWith("binary/octet-stream")
      )
        continue;
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) continue;
      return {
        sourceUrl: url,
        buffer: Buffer.from(arrayBuffer),
        isWebp:
          contentType.startsWith("image/webp") ||
          url.toLowerCase().endsWith(".webp"),
      };
    } catch {
      // Try next candidate source.
    }
  }
  return null;
}

async function optimizeToWebp(
  input: Buffer,
  { sourceIsWebp = false } = {},
): Promise<Buffer> {
  const pipeline = sharp(input).rotate().resize({
    width: MAX_WIDTH,
    withoutEnlargement: true,
    fit: "inside",
  });
  if (sourceIsWebp) {
    return pipeline.webp({ lossless: true }).toBuffer();
  }
  return pipeline.webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer();
}

async function uploadToR2(key: string, body: Buffer): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`R2 upload failed: ${resp.status} ${resp.statusText} - ${text}`);
  }
}

async function existsInR2(key: string): Promise<boolean> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    method: "HEAD",
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
  });
  if (resp.ok) return true;
  if (resp.status === 404) return false;
  throw new Error(`R2 existence check failed for "${key}": ${resp.status} ${resp.statusText}`);
}

async function getEnemiesFromDb() {
  const { data, error } = await db
    .from("enemies")
    .select("id, enemy_name, asset")
    .order("enemy_name", { ascending: true });
  if (error) throw error;
  return (data ?? []).filter(
    (e): e is { id: number; enemy_name: string | null; asset: string } =>
      typeof e.asset === "string" && e.asset.length > 0,
  );
}

async function processEnemy(
  enemy: { id: number; enemy_name: string | null; asset: string },
  { force = false } = {},
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const asset = enemy.asset;
  const label = `${enemy.enemy_name ?? "unknown"} (${asset})`;
  const key = `${ENEMY_R2_PREFIX}/${asset}.webp`;

  if (!force && (await existsInR2(key))) {
    console.log(`  skip (exists): ${key}`);
    return { ok: true, skipped: true };
  }

  const url = `https://api.lunaris.moe/data/assets/leyline/${encodeURIComponent(asset)}.png`;
  const result = await fetchFirstImageBuffer([url]);

  if (!result) {
    console.warn(`- skip ${label}: no image source found`);
    return { ok: false, reason: "no-source" };
  }

  const optimized = await optimizeToWebp(result.buffer, {
    sourceIsWebp: result.isWebp,
  });
  await uploadToR2(key, optimized);
  console.log(`  enemy -> ${key} (${result.sourceUrl})`);
  return { ok: true };
}

async function getCharactersFromDb() {
  const { data, error } = await db
    .from("characters")
    .select("game_id, name, name_id")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildEnkaByNameId(): Promise<{
  map: Map<string, any>;
  close: () => void;
}> {
  const enka = new EnkaClient({ defaultLanguage: "en" });
  enka.cachedAssetsManager.cacheDirectoryPath = "./cache";
  enka.cachedAssetsManager.cacheDirectorySetup();
  await enka.cachedAssetsManager.fetchAllContents();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map<string, any>();
  for (const char of enka.getAllCharacters()) {
    if (!char?._nameId) continue;
    if (!map.has(char._nameId)) map.set(char._nameId, char);
  }

  return { map, close: () => enka.close() };
}

async function processCharacter(
  character: {
    game_id: number;
    name: string | null;
    name_id: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  enkaByNameId: Map<string, any>,
  { force = false } = {},
): Promise<{ ok: boolean; skipped?: boolean; reason?: string }> {
  const label = `${character.name ?? "Unknown"} (${character.name_id})`;

  if (!character.name_id) {
    console.warn(`- skip ${character.name}: missing name_id`);
    return { ok: false, reason: "missing-name-id" };
  }

  const nameId = character.name_id;
  const portraitKey = `${R2_PREFIX}/${nameId}/portrait.webp`;
  const coopKey = `${R2_PREFIX}/${nameId}/coop.webp`;

  const [needsPortrait, needsCoop] = force
    ? [true, true]
    : await Promise.all([
        existsInR2(portraitKey).then((e) => !e),
        existsInR2(coopKey).then((e) => !e),
      ]);

  if (!needsPortrait && !needsCoop) {
    console.log(`  skip (exists): ${portraitKey}, ${coopKey}`);
    return { ok: true, skipped: true };
  }

  const enkaChar = enkaByNameId.get(nameId);
  const templates = getTemplateCandidates(nameId);

  const portrait = needsPortrait
    ? await fetchFirstImageBuffer(
        dedupe([...getEnkaPortraitCandidates(enkaChar), ...templates.portrait]),
      )
    : null;

  const coop = needsCoop ? await fetchFirstImageBuffer(templates.coop) : null;

  if (needsPortrait && !portrait) {
    console.warn(`- skip ${label}: portrait source not found`);
    return { ok: false, reason: "missing-portrait" };
  }

  if (needsCoop && !coop) {
    console.warn(`- skip ${label}: coop source not found`);
    return { ok: false, reason: "missing-coop" };
  }

  if (portrait) {
    const optimized = await optimizeToWebp(portrait.buffer, { sourceIsWebp: portrait.isWebp });
    await uploadToR2(portraitKey, optimized);
    console.log(`  portrait -> ${portraitKey} (${portrait.sourceUrl})`);
  }

  if (coop) {
    const optimized = await optimizeToWebp(coop.buffer, { sourceIsWebp: coop.isWebp });
    await uploadToR2(coopKey, optimized);
    console.log(`  coop -> ${coopKey} (${coop.sourceUrl})`);
  }

  return { ok: true };
}

async function main() {
  const dryRun = parseFlag("DRY_RUN", false);
  const force = parseFlag("FORCE", false);
  const syncCharacters = parseFlag("CHARACTERS", true);
  const syncEnemies = parseFlag("ENEMIES", true);
  if (dryRun) console.log("DRY_RUN=true (uploads disabled)");
  if (force) console.log("FORCE=true (skipping existence checks)");

  let success = 0;
  let failed = 0;
  let enemySuccess = 0;
  let enemyFailed = 0;

  if (syncCharacters) {
    console.log("\n── Characters ───────────────────────────────");
    const characters = await getCharactersFromDb();
    console.log(`Loaded ${characters.length} characters from Supabase.`);

    const { map: enkaByNameId, close } = await buildEnkaByNameId();
    console.log(`Loaded ${enkaByNameId.size} characters from Enka cache.`);

    try {
      for (const character of characters) {
        console.log(
          `\nProcessing ${character.name ?? "Unknown"} (${character.name_id})`,
        );

        if (dryRun) {
          const templates = getTemplateCandidates(character.name_id);
          console.log(`  portrait candidates: ${templates.portrait.length}`);
          console.log(`  coop candidates: ${templates.coop.length}`);
          continue;
        }

        const result = await processCharacter(character, enkaByNameId, {
          force,
        });
        if (result.ok) success += 1;
        else failed += 1;
      }
    } finally {
      close();
    }
  }

  if (syncEnemies) {
    console.log("\n── Enemies ──────────────────────────────────");
    const enemies = await getEnemiesFromDb();
    console.log(`Loaded ${enemies.length} enemies from Supabase.`);

    for (const enemy of enemies) {
      console.log(
        `\nProcessing enemy ${enemy.enemy_name ?? "unknown"} (${enemy.asset})`,
      );

      if (dryRun) {
        console.log(
          `  url: https://api.lunaris.moe/data/assets/leyline/${enemy.asset}.png`,
        );
        continue;
      }

      const result = await processEnemy(enemy, { force });
      if (result.ok) enemySuccess += 1;
      else enemyFailed += 1;
    }
  }

  console.log("\nDone.");
  if (syncCharacters)
    console.log(`Characters — success: ${success}, failed: ${failed}`);
  if (syncEnemies)
    console.log(`Enemies    — success: ${enemySuccess}, failed: ${enemyFailed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { EnkaClient } from "enka-network-api";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";

const {
  PUBLIC_SUPABASE_URL,
  PRIVATE_SUPABASE_KEY,
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  CF_API_TOKEN,
  R2_BUCKET,
  R2_PREFIX = "characters",
  ENEMY_R2_PREFIX = "enemies",
  IMAGE_MAX_WIDTH = "1024",
  IMAGE_WEBP_QUALITY = "80",
} = process.env;

const requiredEnv = {
  PUBLIC_SUPABASE_URL,
  PRIVATE_SUPABASE_KEY,
  R2_ACCOUNT_ID,
  R2_BUCKET,
};

for (const [key, value] of Object.entries(requiredEnv)) {
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

// If CF_API_TOKEN is provided, we can use it instead of S3 HMAC keys.
const useApiToken = Boolean(CF_API_TOKEN && CF_API_TOKEN.length > 0);
if (!useApiToken) {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      "Missing R2 HMAC credentials (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY) and no CF_API_TOKEN provided",
    );
  }
}

const MAX_WIDTH = Number(IMAGE_MAX_WIDTH);
const WEBP_QUALITY = Number(IMAGE_WEBP_QUALITY);

const db = createClient(PUBLIC_SUPABASE_URL, PRIVATE_SUPABASE_KEY, {
  auth: {
    persistSession: false,
  },
});

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

function parseFlag(name, defaultValue = false) {
  const value = process.env[name];
  if (value == null) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function getEnkaPortraitCandidates(enkaCharacter) {
  if (!enkaCharacter) return [];

  const fromKnownProps = [
    enkaCharacter?.icon?.url,
    enkaCharacter?.avatar?.icon?.url,
    enkaCharacter?.costume?.icon?.url,
  ];

  return dedupe(fromKnownProps);
}

function getTemplateCandidates(nameId) {
  const safe = encodeURIComponent(nameId);

  return {
    portrait: dedupe([`https://enka.network/ui/UI_AvatarIcon_${safe}.png`]),
    coop: dedupe([
      `https://api.lunaris.moe/data/assets/coopimg/UI_CoopImg_${safe}.webp`,
    ]),
  };
}

async function fetchFirstImageBuffer(urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "lightkeepers-image-sync/1.0",
        },
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

async function optimizeToWebp(input, { sourceIsWebp = false } = {}) {
  const pipeline = sharp(input).rotate().resize({
    width: MAX_WIDTH,
    withoutEnlargement: true,
    fit: "inside",
  });

  // Already-WebP sources: resize only, keep lossless to avoid generation loss.
  if (sourceIsWebp) {
    return pipeline.webp({ lossless: true }).toBuffer();
  }

  return pipeline.webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer();
}

async function uploadToR2(key, body) {
  if (useApiToken) {
    // Upload via Cloudflare HTTP API using Bearer token
    const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(
      key,
    )}`;

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
      throw new Error(
        `R2 HTTP upload failed: ${resp.status} ${resp.statusText} - ${text}`,
      );
    }
    return;
  }

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

async function existsInR2(key) {
  if (useApiToken) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
      method: "HEAD",
      headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
    });
    return resp.ok;
  }

  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch (e) {
    if (e.name === "NotFound" || e.$metadata?.httpStatusCode === 404) return false;
    throw e;
  }
}

async function getEnemiesFromDb() {
  const { data, error } = await db
    .from("enemies")
    .select("id, name, lunaris_asset")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []).filter((e) => e.lunaris_asset);
}

async function processEnemy(enemy, { force = false } = {}) {
  const asset = enemy.lunaris_asset;
  const label = `${enemy.name ?? "unknown"} (${asset})`;
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
    .select("id, name, name_id, character_id")
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function buildEnkaByNameId() {
  const enka = new EnkaClient({ defaultLanguage: "en" });
  enka.cachedAssetsManager.cacheDirectoryPath = "./cache";
  enka.cachedAssetsManager.cacheDirectorySetup();
  await enka.cachedAssetsManager.fetchAllContents();

  const map = new Map();
  for (const char of enka.getAllCharacters()) {
    if (!char?._nameId) continue;
    if (!map.has(char._nameId)) map.set(char._nameId, char);
  }

  return {
    map,
    close: () => enka.close(),
  };
}

async function processCharacter(character, enkaByNameId, { force = false } = {}) {
  const label = `${character.name} (${character.name_id})`;

  if (!character.name_id) {
    console.warn(`- skip ${character.name}: missing name_id`);
    return { ok: false, reason: "missing-name-id" };
  }

  const nameId = character.name_id;
  const portraitKey = `${R2_PREFIX}/${nameId}/portrait.webp`;
  const coopKey = `${R2_PREFIX}/${nameId}/coop.webp`;

  const [portraitExists, coopExists] = await Promise.all([
    existsInR2(portraitKey),
    existsInR2(coopKey),
  ]);

  const needsPortrait = force || !portraitExists;
  const needsCoop = force || !coopExists;

  if (!needsPortrait && !needsCoop) {
    console.log(`  skip (exists): ${portraitKey}, ${coopKey}`);
    return { ok: true, skipped: true };
  }

  const enkaChar = enkaByNameId.get(nameId);
  const templates = getTemplateCandidates(nameId);

  const portrait = needsPortrait
    ? await fetchFirstImageBuffer(dedupe([
        ...getEnkaPortraitCandidates(enkaChar),
        ...templates.portrait,
      ]))
    : null;

  const coop = needsCoop
    ? await fetchFirstImageBuffer(templates.coop)
    : null;

  if (needsPortrait && !portrait && needsCoop && !coop) {
    console.warn(`- skip ${label}: no portrait/coop source found`);
    return { ok: false, reason: "no-source" };
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
        console.log(`\nProcessing ${character.name} (${character.name_id ?? "n/a"})`);

        if (dryRun) {
          const templates = getTemplateCandidates(character.name_id ?? "");
          console.log(`  portrait candidates: ${templates.portrait.length}`);
          console.log(`  coop candidates: ${templates.coop.length}`);
          continue;
        }

        const result = await processCharacter(character, enkaByNameId, { force });
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
      console.log(`\nProcessing enemy ${enemy.name ?? "unknown"} (${enemy.lunaris_asset})`);

      if (dryRun) {
        console.log(`  url: https://api.lunaris.moe/data/assets/leyline/${enemy.lunaris_asset}.png`);
        continue;
      }

      const result = await processEnemy(enemy, { force });
      if (result.ok) enemySuccess += 1;
      else enemyFailed += 1;
    }
  }

  console.log("\nDone.");
  if (syncCharacters) console.log(`Characters — success: ${success}, failed: ${failed}`);
  if (syncEnemies) console.log(`Enemies    — success: ${enemySuccess}, failed: ${enemyFailed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

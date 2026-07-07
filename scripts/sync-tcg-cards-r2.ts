import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/types/database.types.js";
import sharp from "sharp";
import { readdir } from "node:fs/promises";
import { join, basename } from "node:path";

/**
 * R2 object key prefix for card uploads.
 *
 * Must match the `/characters/` path segment in src/lib/utils.ts
 * (`CHARACTERS_CDN_BASE`). Changing this without also updating the frontend's
 * `getCharacterCard()` will silently break all card images.
 */
const R2_PREFIX = "characters";

const {
  PUBLIC_SUPABASE_URL,
  PRIVATE_SUPABASE_KEY,
  R2_ACCOUNT_ID,
  CF_API_TOKEN,
  R2_BUCKET,
  // ── Source: local directory ────────────────────────────────────────────
  TCG_CARDS_DIR,
  // ── Source: Google Drive API (no OAuth needed for public folders) ──────
  GOOGLE_DRIVE_API_KEY,
  TCG_DRIVE_FOLDER_ID = "1bXJp9WHiZq2LfxAiPfkI2tie_A6IXhVI",
  // ── Image processing ───────────────────────────────────────────────────
  IMAGE_MAX_WIDTH = "1024",
  IMAGE_WEBP_QUALITY = "80",
} = process.env;

function parseFlag(name: string, defaultValue = false): boolean {
  const value = process.env[name];
  if (value == null) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const DRY_RUN = parseFlag("DRY_RUN", false);

// ── Validation ──────────────────────────────────────────────────────────

for (const [key, value] of Object.entries({
  PUBLIC_SUPABASE_URL,
  PRIVATE_SUPABASE_KEY,
})) {
  if (!value) throw new Error(`Missing required env var: ${key}`);
}

// R2 credentials aren't needed for a dry run (no uploads).
if (!DRY_RUN) {
  for (const [key, value] of Object.entries({
    R2_ACCOUNT_ID,
    R2_BUCKET,
    CF_API_TOKEN,
  })) {
    if (!value) throw new Error(`Missing required env var: ${key}`);
  }
}

if (!TCG_CARDS_DIR && !GOOGLE_DRIVE_API_KEY) {
  throw new Error(
    "Either TCG_CARDS_DIR (local directory) or GOOGLE_DRIVE_API_KEY (Drive API) must be set.",
  );
}

const MAX_WIDTH = Number(IMAGE_MAX_WIDTH);
const WEBP_QUALITY = Number(IMAGE_WEBP_QUALITY);

if (!Number.isInteger(MAX_WIDTH) || MAX_WIDTH < 1) {
  throw new Error(
    `IMAGE_MAX_WIDTH must be a positive integer, got: ${IMAGE_MAX_WIDTH}`,
  );
}
if (!Number.isInteger(WEBP_QUALITY) || WEBP_QUALITY < 1 || WEBP_QUALITY > 100) {
  throw new Error(
    `IMAGE_WEBP_QUALITY must be an integer 1–100, got: ${IMAGE_WEBP_QUALITY}`,
  );
}

const db = createClient<Database>(PUBLIC_SUPABASE_URL!, PRIVATE_SUPABASE_KEY!, {
  auth: { persistSession: false },
});

// ── Concurrency pool ────────────────────────────────────────────────────

/** Run async `fn` for each item with at most `limit` concurrent executions. */
async function asyncPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await fn(items[i]);
      } catch (err) {
        results[i] = { ok: false, reason: String(err) } as R;
      }
    }
  };

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ── R2 helpers ──────────────────────────────────────────────────────────

const R2_UPLOAD_TIMEOUT_MS = 30_000;
const R2_LIST_TIMEOUT_MS = 15_000;

async function uploadToR2(key: string, body: Buffer): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), R2_UPLOAD_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
      body: new Uint8Array(body),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(
        `R2 upload failed: ${resp.status} ${resp.statusText} - ${text}`,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

/** List all object keys under a prefix. */
async function listR2Keys(prefix: string): Promise<Set<string>> {
  const keys = new Set<string>();
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ prefix, per_page: "1000" });
    if (cursor) params.set("cursor", cursor);

    const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects?${params}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), R2_LIST_TIMEOUT_MS);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: any;
    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`R2 list failed: ${resp.status}`);
      body = await resp.json();
    } finally {
      clearTimeout(timer);
    }
    if (!body.success)
      throw new Error(`R2 list failed: ${JSON.stringify(body.errors)}`);

    for (const obj of body.result ?? []) keys.add(obj.key);
    cursor = body.result_info?.cursor;
  } while (cursor);

  return keys;
}

// ── Database ────────────────────────────────────────────────────────────

interface CharacterRecord {
  game_id: number;
  name: string | null;
  name_id: string;
}

async function getCharactersFromDb(): Promise<CharacterRecord[]> {
  const { data, error } = await db
    .from("characters")
    .select("game_id, name, name_id")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// ── Name matching ────────────────────────────────────────────────────────

const TCG_FILENAME_RE = /^UI_Gcg_CardFace_Char_Avatar_(.+)\.png$/i;

/**
 * Extract the character name from a TCG card filename.
 * "UI_Gcg_CardFace_Char_Avatar_Hu Tao.png" → "Hu Tao"
 * Returns null if the filename doesn't match the expected pattern.
 */
function extractCharacterName(filename: string): string | null {
  const match = basename(filename).match(TCG_FILENAME_RE);
  return match?.[1] ?? null;
}

/**
 * Match an extracted display name to a DB character record.
 *
 * Tries in order:
 * 1. Exact match on `name` (e.g. "Hu Tao" → name "Hu Tao")
 * 2. Spaces → underscores match on `name_id` (e.g. "Hu Tao" → name_id "Hu_Tao")
 * 3. Strip variant suffix and retry both (e.g. "FurinaPneuma" → "Furina")
 */
function matchCharacter(
  extracted: string,
  characters: CharacterRecord[],
): CharacterRecord | null {
  // 1. Direct match on display name
  const byName = characters.find((c) => c.name === extracted);
  if (byName) return byName;

  // 2. Match on name_id (spaces → underscores: "Hu Tao" → "Hu_Tao")
  const nameIdForm = extracted.replace(/\s+/g, "_");
  const byNameId = characters.find((c) => c.name_id === nameIdForm);
  if (byNameId) return byNameId;

  // 3. Strip variant suffixes and retry
  const base = extracted
    .replace(/0[0-9]+$/, "")
    .replace(/Pneuma$/i, "")
    .replace(/Ousia$/i, "");

  if (base !== extracted) {
    const byBaseName = characters.find((c) => c.name === base);
    if (byBaseName) return byBaseName;
    const byBaseNameId = characters.find((c) => c.name_id === base);
    if (byBaseNameId) return byBaseNameId;
  }

  return null;
}

// ── Google Drive API ────────────────────────────────────────────────────

const DRIVE_TIMEOUT_MS = 60_000;

interface DriveFile {
  id: string;
  name: string;
}

/**
 * List all PNG files in a public Google Drive folder using an API key.
 */
async function listDriveFiles(
  folderId: string,
  apiKey: string,
): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set(
      "q",
      `'${folderId}' in parents and trashed = false and mimeType = 'image/png'`,
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("fields", "files(id, name), nextPageToken");
    url.searchParams.set("pageSize", "1000");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DRIVE_TIMEOUT_MS);

    let resp: Response;
    try {
      resp = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(
        `Drive API list failed: ${resp.status} ${resp.statusText} — ${text}`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await resp.json();
    for (const f of body.files ?? []) {
      if (f.id && f.name) {
        allFiles.push({ id: f.id, name: f.name });
      }
    }
    pageToken = body.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/**
 * Download a single file from Google Drive into a Buffer (no disk write).
 */
async function downloadDriveFile(
  fileId: string,
  apiKey: string,
): Promise<Buffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DRIVE_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { "User-Agent": "lightkeepers-tcg-sync/1.0" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    throw new Error(
      `Drive download failed: ${resp.status} ${resp.statusText} for file ${fileId}`,
    );
  }

  const arrayBuffer = await resp.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error(`Drive download returned empty body for file ${fileId}`);
  }

  return Buffer.from(arrayBuffer);
}

// ── Image processing ─────────────────────────────────────────────────────

async function optimizeToWebp(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toBuffer();
}

// ── Main sync logic ──────────────────────────────────────────────────────

interface SyncResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
}

interface CardMatch {
  fileId: string;
  filename: string;
  character: CharacterRecord;
  isVariant: boolean;
}

/**
 * Download a matched TCG card from Drive, convert to WebP, and upload to R2.
 * Everything happens in memory — no disk round-trip.
 */
async function processCard(
  match: CardMatch,
  apiKey: string | undefined, // undefined when using local files
  existingKeys: Set<string>,
  { force = false } = {},
): Promise<SyncResult> {
  const label = `${match.character.name ?? "Unknown"} (${match.character.name_id}) ← ${match.filename}`;
  const cardKey = `${R2_PREFIX}/${match.character.name_id}/card.webp`;

  if (!force && existingKeys.has(cardKey)) {
    console.log(`  skip (exists): ${cardKey}`);
    return { ok: true, skipped: true };
  }

  // Get the raw PNG buffer — from Drive API or local disk
  let buffer: Buffer;
  if (apiKey) {
    buffer = await downloadDriveFile(match.fileId, apiKey);
  } else {
    const { readFile } = await import("node:fs/promises");
    buffer = await readFile(match.fileId); // fileId is actually the local path in this mode
    if (buffer.length === 0) {
      console.warn(`- skip ${label}: file is empty`);
      return { ok: false, reason: "empty-file" };
    }
  }

  const optimized = await optimizeToWebp(buffer);
  await uploadToR2(cardKey, optimized);
  console.log(`  card → ${cardKey} (${match.filename})`);
  return { ok: true };
}

/**
 * Match Drive/local files to DB characters and deduplicate
 * (preferring primary cards over variants).
 */
function resolveMatches(
  files: { name: string; id: string }[],
  characters: CharacterRecord[],
): { uploads: CardMatch[]; unmatched: string[]; missingCharacters: CharacterRecord[] } {
  const matches: CardMatch[] = [];
  const unmatched: string[] = [];

  for (const file of files) {
    const extracted = extractCharacterName(file.name);
    if (!extracted) {
      console.warn(`  - skip ${file.name}: filename doesn't match TCG pattern`);
      unmatched.push(file.name);
      continue;
    }

    const character = matchCharacter(extracted, characters);
    if (!character) {
      console.warn(`  - skip ${file.name}: no DB match for "${extracted}"`);
      unmatched.push(file.name);
      continue;
    }

    const base = extracted
      .replace(/0[0-9]+$/, "")
      .replace(/Pneuma$/i, "")
      .replace(/Ousia$/i, "");
    const isVariant = base !== extracted;

    matches.push({
      fileId: file.id,
      filename: file.name,
      character,
      isVariant,
    });
  }

  // Deduplicate: prefer primary card over variants
  const seen = new Map<string, CardMatch>();
  for (const match of matches) {
    const existing = seen.get(match.character.name_id);
    if (!existing) {
      seen.set(match.character.name_id, match);
    } else if (!match.isVariant && existing.isVariant) {
      console.warn(
        `  prefer primary: ${match.filename} over variant ${existing.filename}`,
      );
      seen.set(match.character.name_id, match);
    }
  }

  // Find DB characters that have no TCG card at all
  const matchedIds = new Set(seen.keys());
  const missingCharacters = characters.filter((c) => !matchedIds.has(c.name_id));

  return { uploads: Array.from(seen.values()), unmatched, missingCharacters };
}

async function main() {
  const force = parseFlag("FORCE", false);
  const concurrency = Math.max(1, Number(process.env.CONCURRENCY) || 5);

  if (DRY_RUN) console.log("DRY_RUN=true (uploads disabled)");
  if (force) console.log("FORCE=true (skipping existence checks)");
  console.log(`Concurrency: ${concurrency}`);

  // ── Load characters from DB ──────────────────────────────────────────
  console.log("\n── Characters ───────────────────────────────");
  const characters = await getCharactersFromDb();
  console.log(`Loaded ${characters.length} characters from Supabase.`);

  // ── Discover files (Drive API or local directory) ────────────────────
  let files: { name: string; id: string }[];
  let apiKey: string | undefined;

  if (GOOGLE_DRIVE_API_KEY) {
    console.log("\n── Google Drive ─────────────────────────────");
    console.log(`Listing files in folder ${TCG_DRIVE_FOLDER_ID} …`);
    const driveFiles = await listDriveFiles(
      TCG_DRIVE_FOLDER_ID!,
      GOOGLE_DRIVE_API_KEY,
    );
    console.log(`Found ${driveFiles.length} PNG files on Drive.`);
    files = driveFiles.map((f) => ({ name: f.name, id: f.id }));
    apiKey = GOOGLE_DRIVE_API_KEY;
  } else {
    console.log("\n── Local directory ─────────────────────────");
    console.log(`Directory: ${TCG_CARDS_DIR}`);

    const allFiles = await readdir(TCG_CARDS_DIR!);
    const pngFiles = allFiles.filter((f) =>
      f.toLowerCase().endsWith(".png"),
    );

    console.log(
      `Found ${pngFiles.length} PNG files (${allFiles.length - pngFiles.length} non-PNG skipped).`,
    );

    files = pngFiles.map((f) => ({
      name: f,
      id: join(TCG_CARDS_DIR!, f), // id doubles as the local path
    }));
    apiKey = undefined;
  }

  // ── Match files to characters ────────────────────────────────────────
  console.log("\n── Matching ────────────────────────────────");
  const { uploads, unmatched, missingCharacters } = resolveMatches(
    files,
    characters,
  );

  console.log(
    `Matched ${uploads.length} unique characters (${unmatched.length} files unmatched).`,
  );

  if (unmatched.length > 0) {
    console.log(`\nUnmatched files (${unmatched.length}):`);
    for (const f of unmatched) console.log(`  - ${f}`);
  }

  if (missingCharacters.length > 0) {
    console.log(
      `\nCharacters missing TCG card (${missingCharacters.length}):`,
    );
    for (const c of missingCharacters) {
      console.log(`  - ${c.name ?? "unnamed"} (${c.name_id})`);
    }
  }

  // ── Existing R2 inventory ────────────────────────────────────────────
  console.log("\n── R2 inventory ────────────────────────────");
  const existingKeys =
    DRY_RUN || force ? new Set<string>() : await listR2Keys(`${R2_PREFIX}/`);
  console.log(`Existing: ${existingKeys.size} character assets`);

  // ── Process & upload ─────────────────────────────────────────────────
  if (DRY_RUN) {
    console.log("\n── Dry run (would upload) ─────────────────");
    for (const match of uploads) {
      const key = `${R2_PREFIX}/${match.character.name_id}/card.webp`;
      console.log(`  ${match.filename} → ${key}`);
    }
  } else {
    console.log("\n── Processing & uploading ──────────────────");
    const results = await asyncPool(uploads, concurrency, (match) =>
      processCard(match, apiKey, existingKeys, { force }),
    );

    const success = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    const skipped = results.filter((r) => r.skipped).length;
    console.log(
      `\nDone. Success: ${success}, skipped: ${skipped}, failed: ${failed}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

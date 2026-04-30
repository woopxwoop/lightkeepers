/**
 * Smoke-tests the sync pipeline without writing anything to the DB or R2.
 *
 * Checks:
 *   1. Enka — client initializes, characters have expected fields, cross-ref with DB
 *   2. Lunaris — version API reachable, stygian info has the expected shape
 *   3. Images — name_id coverage in DB, sample image URLs are fetchable, R2 auth works
 *
 * Usage:
 *   PUBLIC_SUPABASE_URL=... PRIVATE_SUPABASE_KEY=... \
 *   R2_ACCOUNT_ID=... R2_BUCKET=... CF_API_TOKEN=... \
 *   npx tsx scripts/test-syncs.ts
 */

import "dotenv/config";
import { EnkaClient } from "enka-network-api";
import { supabase } from "./lib/supabase.js";
import { ok, check, assert, summary } from "./lib/test-runner.js";

const LUNARIS_VERSION_ROUTE = "https://api.lunaris.moe/data/version.json";
const BASE_LUNARIS_STYGIAN_ROUTE = "https://lunaris.moe/data/leylinechallenge";
const BASE_STYGIAN_ID = 5269001;
const FEARLESS_LEVEL = 4;

const WEAPON_TYPE_MAP: Record<string, string> = {
  WEAPON_SWORD_ONE_HAND: "Sword",
  WEAPON_CLAYMORE: "Claymore",
  WEAPON_POLE: "Polearm",
  WEAPON_CATALYST: "Catalyst",
  WEAPON_BOW: "Bow",
};

const NAME_OVERRIDES: Record<string, string> = { Ambor: "Amber" };
const DISPLAY_TO_DB = new Map(
  Object.entries(NAME_OVERRIDES).map(([db, display]) => [display, db]),
);

// ── Enka ──────────────────────────────────────────────────────────────────────

console.log("\n── Enka ─────────────────────────────────────────");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let enkaCharacters: any[] = [];
let enkaClose = () => {};

await check("Enka client initializes and fetches assets", async () => {
  const enka = new EnkaClient({ defaultLanguage: "en" });
  enka.cachedAssetsManager.cacheDirectoryPath = "./cache";
  enka.cachedAssetsManager.cacheDirectorySetup();
  await enka.cachedAssetsManager.fetchAllContents();
  enkaCharacters = [...enka.getAllCharacters()];
  enkaClose = () => enka.close();
  assert(enkaCharacters.length > 50, `only ${enkaCharacters.length} characters returned — expected 50+`);
  ok("Enka client initializes and fetches assets", `${enkaCharacters.length} characters`);
});

await check("all Enka characters have required fields", async () => {
  const relevant = enkaCharacters.filter((c) => c.element && !c.isMannequin);
  const missingNameId = relevant.filter((c) => !c._nameId);
  const missingWeaponType = relevant.filter((c) => !c.weaponType);
  const unknownWeaponTypes = relevant
    .map((c) => c.weaponType)
    .filter((wt) => wt && !(wt in WEAPON_TYPE_MAP));

  assert(missingNameId.length === 0, `${missingNameId.length} characters missing _nameId`);
  assert(missingWeaponType.length === 0, `${missingWeaponType.length} characters missing weaponType`);

  if (unknownWeaponTypes.length > 0) {
    const unique = [...new Set(unknownWeaponTypes)];
    throw new Error(`Unknown weapon types (add to WEAPON_TYPE_MAP): ${unique.join(", ")}`);
  }

  ok("all Enka characters have required fields", `${relevant.length} non-mannequin chars checked`);
});

await check("Enka characters match DB names (cross-reference)", async () => {
  const { data: dbChars, error } = await supabase
    .from("characters")
    .select("id, name");
  if (error) throw error;

  const nameToId = new Map(dbChars.map((c) => [c.name, c.id]));
  const relevant = enkaCharacters.filter((c) => c.element && !c.isMannequin && !c.isTraveler);

  const skipped: string[] = [];
  for (const char of relevant) {
    const displayName = char.name.get();
    const dbName = DISPLAY_TO_DB.get(displayName) ?? displayName;
    if (!nameToId.has(dbName)) skipped.push(dbName);
  }

  // Traveler check separately
  if (!nameToId.has("Traveler")) skipped.push("Traveler");

  const skipPct = relevant.length > 0 ? (skipped.length / relevant.length) * 100 : 0;
  if (skipped.length > 0) {
    console.log(`    unmatched: ${skipped.join(", ")}`);
  }
  // Fail if more than 5% of chars would be skipped — likely means DB is stale
  if (skipPct > 5) {
    throw new Error(
      `${skipped.length}/${relevant.length} Enka characters not found in DB (${skipPct.toFixed(1)}%) — add name overrides or run cron first`,
    );
  }

  ok("Enka characters match DB names", `${skipped.length} unmatched / ${relevant.length} total`);
});

enkaClose();

// ── Lunaris ───────────────────────────────────────────────────────────────────

console.log("\n── Lunaris ──────────────────────────────────────");

let latestStygianVersion: number | null = null;

await check("Lunaris version API is reachable", async () => {
  const res = await fetch(LUNARIS_VERSION_ROUTE);
  assert(res.ok, `HTTP ${res.status}`);
  const data = (await res.json()) as { version?: unknown };
  assert(typeof data.version === "string" && data.version.length > 0, "version field missing or empty");
  ok("Lunaris version API is reachable", `version: ${data.version}`);
});

await check("stygian_versions table has at least one row", async () => {
  const { data, error } = await supabase
    .from("stygian_versions")
    .select("version_number")
    .order("version_number", { ascending: false })
    .limit(1);
  if (error) throw error;
  assert(data && data.length > 0, "stygian_versions table is empty");
  latestStygianVersion = data[0].version_number;
  ok("stygian_versions table has at least one row", `latest: ${latestStygianVersion}`);
});

if (latestStygianVersion !== null) {
  await check("Lunaris stygian info has expected shape", async () => {
    const url = `${BASE_LUNARIS_STYGIAN_ROUTE}/${BASE_STYGIAN_ID + latestStygianVersion! + 1}.json`;
    const res = await fetch(url);
    assert(res.ok, `HTTP ${res.status} for ${url}`);
    const data = (await res.json()) as {
      scheduleId?: unknown;
      levels?: { levelConfigs?: { id: unknown; specialMonsterIcon: unknown; enLevelName: unknown }[] }[];
    };

    assert(typeof data.scheduleId === "number", "scheduleId is not a number");
    assert(Array.isArray(data.levels) && data.levels.length > FEARLESS_LEVEL, `levels array too short (need index ${FEARLESS_LEVEL})`);

    const configs = data.levels![FEARLESS_LEVEL].levelConfigs;
    assert(Array.isArray(configs) && configs.length >= 3, `levelConfigs needs at least 3 entries, got ${configs?.length ?? 0}`);

    for (const [i, cfg] of configs.entries()) {
      assert(typeof cfg.id === "number", `configs[${i}].id is not a number`);
      assert(typeof cfg.specialMonsterIcon === "string" && cfg.specialMonsterIcon.length > 0, `configs[${i}].specialMonsterIcon is empty`);
      assert(typeof cfg.enLevelName === "string" && cfg.enLevelName.length > 0, `configs[${i}].enLevelName is empty`);
    }

    ok("Lunaris stygian info has expected shape", `${configs.length} enemies at fearless level`);
  });
}

// ── Image sync ────────────────────────────────────────────────────────────────

console.log("\n── Image sync ───────────────────────────────────");

let sampleNameId: string | null = null;

await check("characters in DB have name_id populated", async () => {
  const { data, error } = await supabase
    .from("characters")
    .select("name, name_id");
  if (error) throw error;
  assert(data && data.length > 0, "characters table is empty");

  const missing = data.filter((c) => !c.name_id);
  if (missing.length > 0) {
    console.log(`    missing name_id: ${missing.map((c) => c.name).join(", ")}`);
  }
  // Warn but don't fail — new characters legitimately start without name_id
  if (missing.length > 3) {
    throw new Error(`${missing.length} characters missing name_id — run pnpm sync:enka`);
  }

  sampleNameId = data.find((c) => c.name_id)?.name_id ?? null;
  ok("characters in DB have name_id populated", `${data.length - missing.length}/${data.length} populated`);
});

if (sampleNameId) {
  const safe = encodeURIComponent(sampleNameId);

  await check("portrait URL is fetchable (sample character)", async () => {
    const url = `https://enka.network/ui/UI_AvatarIcon_${safe}.png`;
    const res = await fetch(url, { method: "HEAD", headers: { "user-agent": "lightkeepers-test/1.0" } });
    assert(res.ok, `HEAD ${url} returned ${res.status}`);
    ok("portrait URL is fetchable (sample character)", `${sampleNameId}`);
  });

  await check("coop image URL is fetchable (sample character)", async () => {
    const url = `https://api.lunaris.moe/data/assets/coopimg/UI_CoopImg_${safe}.webp`;
    const res = await fetch(url, { method: "HEAD", headers: { "user-agent": "lightkeepers-test/1.0" } });
    assert(res.ok, `HEAD ${url} returned ${res.status}`);
    ok("coop image URL is fetchable (sample character)", `${sampleNameId}`);
  });
}

await check("R2 credentials are configured and auth works", async () => {
  const { R2_ACCOUNT_ID, R2_BUCKET, CF_API_TOKEN } = process.env;
  assert(Boolean(R2_ACCOUNT_ID), "R2_ACCOUNT_ID not set");
  assert(Boolean(R2_BUCKET), "R2_BUCKET not set");
  assert(Boolean(CF_API_TOKEN), "CF_API_TOKEN not set");

  // Probe R2 auth with a HEAD on a known key — a 404 is fine, auth errors (401/403) are not
  const key = `characters/${sampleNameId ?? "test"}/portrait.webp`;
  const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "HEAD",
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
  });
  assert(res.status !== 401 && res.status !== 403, `R2 auth failed: ${res.status} ${res.statusText}`);

  ok("R2 credentials are configured and auth works", `bucket: ${R2_BUCKET}`);
});

summary();

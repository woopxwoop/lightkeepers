import "dotenv/config";
import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const {
  R2_ACCOUNT_ID,
  CF_API_TOKEN,
  R2_BUCKET,
  R2_SITE_PREFIX = "site",
  IMAGE_MAX_WIDTH = "1920",
  IMAGE_WEBP_QUALITY = "80",
} = process.env;

for (const key of ["R2_ACCOUNT_ID", "CF_API_TOKEN", "R2_BUCKET"] as const) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

const MAX_WIDTH = Number(IMAGE_MAX_WIDTH);
const WEBP_QUALITY = Number(IMAGE_WEBP_QUALITY);

const STATIC_DIR = resolve("static");

// ─── Active static PNGs referenced in the codebase ──────────────────────────

const ACTIVE = [
  "lightkeepers_dark",
  "team",
  "abyss_banner",
  "stygian_banner",
  "guoba_lightkeepers",
];

// ─── Helpers ────────────────────────────────────────────────────────────────

async function uploadToR2(key: string, body: Buffer): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: new Uint8Array(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `R2 upload failed: ${resp.status} ${resp.statusText} - ${text}`,
    );
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== Syncing site images to R2 (${R2_SITE_PREFIX}/) ===\n`);

  for (const name of ACTIVE) {
    const pngPath = resolve(STATIC_DIR, `${name}.png`);
    const key = `${R2_SITE_PREFIX}/${name}.webp`;

    console.log(`${name}.png → ${key}`);

    const input = readFileSync(pngPath);

    // Convert to WebP with resize
    const webp = await sharp(input)
      .resize({
        width: MAX_WIDTH,
        withoutEnlargement: true,
        fit: "inside",
      })
      .webp({ quality: WEBP_QUALITY, effort: 6 })
      .toBuffer();

    await uploadToR2(key, webp);

    const savedPct = ((1 - webp.length / input.length) * 100).toFixed(1);
    console.log(`  ✓ ${(webp.length / 1024).toFixed(0)} KB (was ${(input.length / 1024).toFixed(0)} KB, ${savedPct}% smaller)`);
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

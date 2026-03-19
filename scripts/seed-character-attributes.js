import { EnkaClient } from "enka-network-api";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.PRIVATE_SUPABASE_KEY;

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const WEAPON_TYPE_MAP = {
  WEAPON_SWORD_ONE_HAND: "Sword",
  WEAPON_CLAYMORE: "Claymore",
  WEAPON_POLE: "Polearm",
  WEAPON_CATALYST: "Catalyst",
  WEAPON_BOW: "Bow",
};

// DB name -> Enka display name mismatches
const NAME_OVERRIDES = {
  Ambor: "Amber",
  // add others here if the skipped list reveals more after switching to display names
};

// Invert it so we can look up by Enka display name -> DB name
const DISPLAY_TO_DB = new Map(
  Object.entries(NAME_OVERRIDES).map(([db, display]) => [display, db]),
);

async function main() {
  const enka = new EnkaClient({ defaultLanguage: "en" });

  console.log("Fetching Genshin assets...");
  await enka.cachedAssetsManager.fetchAllContents();

  const characters = enka.getAllCharacters();

  // Fetch existing characters from DB — we match on name (which uses _nameId convention)
  const { data: existing, error: fetchError } = await db
    .from("characters")
    .select("id, name");
  if (fetchError) throw fetchError;

  const nameToId = new Map(existing.map((c) => [c.name, c.id]));

  const updates = [];
  const skipped = [];
  let seenTraveler = false;
  for (const char of characters) {
    if (!char.element) continue;

    // For Traveler: DB only has one entry. Pick Anemo (first element variant)
    // and skip the rest.
    if (char.isTraveler) {
      if (seenTraveler) continue;
      seenTraveler = true;

      // DB likely stores Traveler as "Traveler" — find it
      const id = nameToId.get("Traveler");
      if (!id) {
        skipped.push("Traveler");
        continue;
      }
      updates.push({
        id,
        element: char.element.name.get(), // will be "Anemo" for first variant
        weapon_type: WEAPON_TYPE_MAP[char.weaponType] ?? char.weaponType,
      });
      continue;
    }

    if (char.isMannequin) continue;

    // For everyone else: _nameId matches DB name (e.g. "Ambor", "Fischl", etc.)
    const displayName = char.name.get();
    const dbName = DISPLAY_TO_DB.get(displayName) ?? displayName;
    const id = nameToId.get(dbName);

    if (!id) {
      skipped.push(`${dbName} (display: ${char.name.get()})`);
      continue;
    }

    updates.push({
      id,
      element: char.element.name.get(),
      weapon_type: WEAPON_TYPE_MAP[char.weaponType] ?? char.weaponType,
    });
  }

  if (skipped.length > 0) {
    console.warn(`\nSkipped ${skipped.length} characters (not found in DB):`);
    skipped.forEach((s) => console.warn(` - ${s}`));
  }

  console.log(`\nUpdating ${updates.length} characters...`);

  const BATCH = 50;
  for (let i = 0; i < updates.length; i += BATCH) {
    const batch = updates.slice(i, i + BATCH);

    for (const row of batch) {
      const { error } = await db
        .from("characters")
        .update({ element: row.element, weapon_type: row.weapon_type })
        .eq("id", row.id);
      if (error) throw error;
    }

    console.log(`  ${Math.min(i + BATCH, updates.length)}/${updates.length}`);
  }

  console.log("Done.");
  enka.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

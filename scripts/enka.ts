import { EnkaClient } from "enka-network-api";
import { supabase as db } from "./lib/supabase.js";

async function main() {
  const enka = new EnkaClient({ defaultLanguage: "en" });
  enka.cachedAssetsManager.cacheDirectoryPath = "./cache";
  enka.cachedAssetsManager.cacheDirectorySetup();
  await enka.cachedAssetsManager.fetchAllContents();

  const characters = enka.getAllCharacters();

  const rows: {
    game_id: number;
    name_id: string;
    name: string;
    element: string;
    weapon_type: string;
    rarity: number;
  }[] = [];

  let seenTraveler = false;

  for (const char of characters) {
    if (!char.element) continue;
    if (char.isMannequin) continue;

    if (char.isTraveler) {
      if (seenTraveler) continue;
      seenTraveler = true;
    }

    rows.push({
      game_id: char.id,
      name_id: char._nameId,
      name: char.isTraveler ? "Traveler" : char.name.get(),
      element: char.element.name.get(),
      weapon_type: char.weaponType,
      rarity: char.stars,
    });
  }

  console.log(`Upserting ${rows.length} characters...`);

  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db
      .from("characters")
      .upsert(rows.slice(i, i + BATCH), { onConflict: "game_id" });
    if (error) throw error;
    console.log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log("Done.");
  enka.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { EnkaClient } from "enka-network-api";

async function main() {
  const enka = new EnkaClient({ defaultLanguage: "en" });
  enka.cachedAssetsManager.cacheDirectoryPath = "./cache";
  enka.cachedAssetsManager.cacheDirectorySetup();

  console.log("Fetching Genshin assets...");
  await enka.cachedAssetsManager.fetchAllContents();

  const characters = enka.getAllCharacters();

  characters.forEach((character) => {
    console.log(character._nameId);
    console.log(character.name.get());
    console.log(character.id);
  });

  // console.log(characters);

  enka.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

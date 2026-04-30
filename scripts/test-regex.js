import { EnkaClient } from "enka-network-api";
import { createClient } from "@supabase/supabase-js";

// DB name -> Enka display name mismatches
const NAME_OVERRIDES = {
  Ambor: "Amber",
  // add others here if the skipped list reveals more after switching to display names
};

function tryToGetTextAssets(textAssets) {
  try {
    return textAssets.get();
  } catch (e) {
    return "";
  }
}

// Strip <color=...>...</color> and {LINK#...}...{/LINK} markup before matching
function cleanText(text) {
  return text
    .replace(/<color=#[0-9A-Fa-f]{8}>(.*?)<\/color>/g, "$1")
    .replace(/\{LINK#[^}]+\}(.*?)\{\/LINK\}/g, "$1")
    .replace(/<[^>]+>/g, "");
}

// Each pattern is intentionally broad — tighten per-attribute as you validate outputs.
// DPS / Sub_DPS / Support are heuristic and may need manual overrides.
const attributePatterns = {
  // Restores HP to party members
  Heal: /\bheal(?:s|ing|ed)?\b|restor(?:es?|ing) (?:HP|health)|regenerat(?:es?|ing) HP/i,

  // Creates a barrier that absorbs damage
  Shield: /\bshield\b/i,

  // Grants a flat DMG Bonus, or increases DMG% of party members (not self-only on-field)
  DMG_Buff:
    /\bgrants?\b.*\bDMG Bonus\b|increas(?:es?|ing).*\b(?:Elemental )?DMG Bonus\b|\bDMG Bonus\b.*\bincreas/i,

  // Increases ATK of party members
  ATK_Buff:
    /increas(?:es?|ing).*\bATK\b|\bATK\b.*\bincreas(?:es?|ing)|\bgrants?\b.*\bATK\b/i,

  // Increases DEF of party members
  Def_Buff: /increas(?:es?|ing).*\bDEF\b|\bDEF\b.*\bincreas(?:es?|ing)/i,

  // Increases attack / movement speed
  ATK_Speed_Buff: /\bATK SPD\b|\battack speed\b/i,

  // Increases Elemental Mastery of party members
  EM_Buff:
    /increas(?:es?|ing).*\bElemental Mastery\b|\bElemental Mastery\b.*\bincreas(?:es?|ing)|\bgrants?\b.*\bElemental Mastery\b/i,

  // Increases CRIT Rate or CRIT DMG
  CRIT_Buff:
    /increas(?:es?|ing).*\bCRIT\b|\bCRIT\b.*\bincreas(?:es?|ing)|\bgrants?\b.*\bCRIT/i,

  // Decreases enemy Elemental or Physical RES
  Resistance_Shred:
    /\bRES\b.*\bdecreas(?:es?|ing)\b|\bdecreas(?:es?|ing)\b.*\bRES\b|\bRES\b.*\breduc(?:es?|ing)\b|\breduc(?:es?|ing)\b.*\bRES\b/i,

  // Buffs reaction damage or triggers specific reactions
  Reaction_Buff:
    /\b(?:Swirl|Vaporize|Melt|Overloaded|Superconduct|Electro-Charged|Frozen|Crystallize|Bloom|Burgeon|Hyperbloom|Quicken|Aggravate|Spread|Burning|Lunar-Crystallize)\b.*\b(?:DMG|Bonus|increas)\b|\b(?:DMG|Bonus)\b.*\b(?:Swirl|Vaporize|Melt|Overloaded|Superconduct|Electro-Charged|Frozen|Crystallize|Bloom|Burgeon|Hyperbloom|Quicken|Aggravate|Spread|Burning|Lunar-Crystallize)\b/i,

  // Off-field DPS: deals damage while not the active character via summons/turrets
  Sub_DPS:
    /\b(?:summon|deploy|place|leave behind)\b.*\b(?:deal[s]? .*DMG|continu(?:es?|ously).*DMG)\b|(?:deal[s]?|dealing).*\bDMG\b.*\b(?:when.*not on the field|continuously|periodically)\b/i,

  // Unique game mechanic keywords
  Moonsign: /\bMoonsign\b/i,
  Hexerei: /\bHexerei\b/i,
  Nightsoul: /\bNightsoul\b/i,
};

// Returns the subset of attributePatterns keys that match any of the provided text blocks
function detectAttributes(texts) {
  const combined = texts.map(cleanText).join("\n");
  return Object.entries(attributePatterns)
    .filter(([, pattern]) => pattern.test(combined))
    .map(([attr]) => attr);
}

async function main() {
  const enka = new EnkaClient({ defaultLanguage: "en" });
  enka.cachedAssetsManager.cacheDirectoryPath = "./cache";
  enka.cachedAssetsManager.cacheDirectorySetup();
  enka.cachedAssetsManager.activateAutoCacheUpdater({
    instant: true, // Run the first update check immediately
    timeout: 60 * 60 * 1000, // 1 hour interval
    onUpdateStart: async () => {
      console.log("Updating Genshin Data...");
    },
    onUpdateEnd: async () => {
      enka.cachedAssetsManager.refreshAllData(); // Refresh memory
      console.log("Updating Completed!");
    },
  });

  const characters = enka.getAllCharacters();

  const updates = [];
  const skipped = [];
  let seenTraveler = false;
  for (const char of characters) {
    if (!char.element) continue;
    if (char.isMannequin) continue;

    const texts = [
      tryToGetTextAssets(char.elementalSkill.description),
      tryToGetTextAssets(char.elementalBurst.description),
      ...char.passiveTalents.map((t) => tryToGetTextAssets(t.description)),
    ];

    if (char.stars == 4) {
      texts.push(
        ...char.constellations.map((c) => tryToGetTextAssets(c.description)),
      );
    }

    texts.filter(Boolean);

    const detected = detectAttributes(texts);
    console.log(`${char.name.get()}: [${detected.join(", ")}]`);
  }

  enka.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

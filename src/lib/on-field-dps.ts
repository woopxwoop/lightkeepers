/**
 * Catalog `name_id`s treated as On-Field DPS for summary diversity.
 *
 * Seeded from Prydwen's Genshin "On-Field DPS" column
 * (https://www.prydwen.gg/genshin-impact/tier-list) — operator-maintained
 * snapshot, not scraped at runtime. Dual-role units that appear in that
 * column (e.g. Mavuika, Raiden) stay listed; pure supports / off-field
 * damage supports do not.
 *
 * Refresh when Prydwen reshuffles roles. Ids match `characters.name_id`
 * / team `members` (see `character-bases.json`), not GOOD keys.
 */
export const ON_FIELD_DPS_NAME_IDS: ReadonlySet<string> = new Set([
  // Apex / current meta carries
  "MarionetteNew", // Sandrone
  "Zibai",
  "Mavuika",
  "Nefer",
  "Flins",
  "Arlecchino",
  "Neuvillette",
  "SkirkNew", // Skirk
  "Varesa",
  "Varka",
  "Lohen",
  "Mualani",
  "Kinich",
  "Chasca",
  "Alhatham", // Alhaitham
  "Hutao",
  "Liney", // Lyney
  "Ganyu",
  "Clorinde",
  "Tartaglia",
  "Ayaka",
  "Venti",
  "Navia",
  "Wriothesley",
  "Itto",
  "Xiao",
  "Wanderer",
  "Yoimiya",
  "Shougun", // Raiden Shogun (on-field hypercarry)
  "Gaming",
  "Diluc",
  "Keqing",
  "Eula",
  "Cyno",
  "Ayato",
  "Tighnari",
  "Sethos",
  "Klee",
  "Feiyan", // Yanfei
  "Ningguang",
  "Razor",
  "Heizo", // Heizou
  "Mizuki",
  "Noel", // Noelle
  "Dehya",
  "Freminet",
  "Ambor", // Amber
  "Aloy",
  "Xinyan",
  "Kaeya",
  "Chongyun",
  "Beidou",
  "Lisa",
  "Kaveh",
]);

export function isOnFieldDps(nameId: string): boolean {
  return ON_FIELD_DPS_NAME_IDS.has(nameId);
}

/** On-field DPS members present on a team (order preserved, unique). */
export function onFieldMembers(
  members: readonly string[],
  onFieldDpsIds: ReadonlySet<string> = ON_FIELD_DPS_NAME_IDS,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of members) {
    if (!onFieldDpsIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Stable reorder: On-Field DPS members first (relative order kept), then the
 * rest. No-op when nobody on the team is allowlisted.
 */
export function orderMembersMainDpsFirst(
  members: readonly string[],
  onFieldDpsIds: ReadonlySet<string> = ON_FIELD_DPS_NAME_IDS,
): string[] {
  const carries: string[] = [];
  const rest: string[] = [];
  for (const id of members) {
    if (onFieldDpsIds.has(id)) carries.push(id);
    else rest.push(id);
  }
  if (carries.length === 0) return [...members];
  return [...carries, ...rest];
}

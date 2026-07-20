import weaponsRaw from "$lib/data/weapons.json";
import artifactSetsRaw from "$lib/data/artifact-sets.json";

export const WEAPON_TYPE_MAP = {
  WEAPON_SWORD_ONE_HAND: "Sword",
  WEAPON_CLAYMORE: "Claymore",
  WEAPON_POLE: "Polearm",
  WEAPON_CATALYST: "Catalyst",
  WEAPON_BOW: "Bow",
} as const;

/** Human label for a Dimbreath / Excel `weaponType` enum value. */
export function weaponTypeLabel(weaponType: string): string {
  return (
    WEAPON_TYPE_MAP[weaponType as keyof typeof WEAPON_TYPE_MAP] ?? weaponType
  );
}

const ASSOCIATION_LABELS: Record<string, string> = {
  ASSOC_TYPE_MONDSTADT: "Mondstadt",
  ASSOC_TYPE_LIYUE: "Liyue",
  ASSOC_TYPE_INAZUMA: "Inazuma",
  ASSOC_TYPE_SUMERU: "Sumeru",
  ASSOC_TYPE_FONTAINE: "Fontaine",
  ASSOC_TYPE_NATLAN: "Natlan",
  ASSOC_TYPE_FATUI: "Fatui",
  ASSOC_TYPE_RANGER: "Ranger",
  ASSOC_TYPE_MAINACTOR: "Traveler",
};

/** Region / faction label from Dimbreath `association` enum. */
export function associationLabel(association: string | null | undefined): string {
  if (!association) return "";
  return ASSOCIATION_LABELS[association] ?? association.replace(/^ASSOC_TYPE_/, "");
}

/**
 * `{LINK#S11215}Precision Hydronic Cooler{/LINK}` → inner text, or an
 * in-page `<a>` when `resolveLink` returns an href (e.g. `#kit-S11215`).
 * Empty links (`{LINK#…}{/LINK}`) are removed.
 */
function resolveGameLinks(
  text: string,
  resolveLink?: (ref: string) => string | null,
): string {
  return text.replace(
    /\{LINK#([^}]+)\}([\s\S]*?)\{\/LINK\}/gi,
    (_m, ref: string, inner: string) => {
      if (!inner) return "";
      const href = resolveLink?.(ref) ?? null;
      if (!href) return inner;
      const safe = href.replace(/"/g, "");
      return `<a href="${safe}" class="game-link">${inner}</a>`;
    },
  );
}

/** Strip Hoyoverse `<color=#…>…</color>` and `{LINK#…}…{/LINK}` tags; keep inner text. */
export function stripColorTags(text: string): string {
  return resolveGameLinks(
    text
      .replace(/<\/?color[^>]*>/gi, "")
      .replace(/\r\n/g, "\n"),
  ).trim();
}

/**
 * Convert in-game description markup to safe HTML for `{@html}`.
 * Supports `<color=#AARRGGBB>`, `<i>`, `{LINK#…}…{/LINK}`, and newlines.
 *
 * Pass `resolveLink` to turn skill/passive/const refs into in-page anchors
 * (`S` → skill, `P` → passive, `T` → constellation). Unknown refs (e.g. `N`)
 * stay as plain text.
 */
export function formatGameDescriptionHtml(
  text: string,
  opts?: { resolveLink?: (ref: string) => string | null },
): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withMarkup = escaped
    .replace(/&lt;color=#([0-9A-Fa-f]{6,8})&gt;/gi, (_m, hex: string) => {
      // Hoyoverse uses #RRGGBB or #RRGGBBAA (alpha last).
      const rgb = hex.length === 8 ? hex.slice(0, 6) : hex;
      return `<span style="color:#${rgb}">`;
    })
    .replace(/&lt;\/color&gt;/gi, "</span>")
    .replace(/&lt;i&gt;/gi, "<em>")
    .replace(/&lt;\/i&gt;/gi, "</em>");
  return resolveGameLinks(withMarkup, opts?.resolveLink)
    .replace(/\\n/g, "<br>")
    .replace(/\n/g, "<br>");
}

/** Characters released within this many days are considered "new". */
export const NEW_CHARACTER_DAYS = 20;

/**
 * Whether a character was released recently enough to be flagged as "new".
 * Characters with no `released_at` are not considered new.
 */
export function isNewCharacter(releasedAt: string | null | undefined): boolean {
  if (!releasedAt) return false;
  // Normalize space-separated timestamps (e.g. "2026-06-29 16:00:00+00")
  // to ISO 8601 format so `new Date()` parses reliably across runtimes.
  const released = new Date(releasedAt.replace(" ", "T"));
  if (isNaN(released.getTime())) return false;
  const cutoff = Date.now() - NEW_CHARACTER_DAYS * 86_400_000;
  return released.getTime() > cutoff;
}

const CDN_BASE = "https://images.lightkeepers.moe";
const GENSIN_UI_BASE = `${CDN_BASE}/genshin/ui`;

function genshinUiUrl(uiName: string): string {
  return `${GENSIN_UI_BASE}/${encodeURIComponent(uiName)}.webp`;
}

export function getCharacterPortrait(nameId: string) {
  return genshinUiUrl(`UI_AvatarIcon_${nameId}`);
}

export function getCharacterCoop(nameId: string) {
  return genshinUiUrl(`UI_CoopImg_${nameId}`);
}

/**
 * TCG character card art. Synced by `scripts/sync/tcg-cards-r2.ts` to
 * `characters/{name_id}/card.webp` (not genshin/ui — keep that prefix for TCG).
 */
export function getCharacterCard(nameId: string) {
  return `${CDN_BASE}/characters/${encodeURIComponent(nameId)}/card.webp`;
}

export function getCharacterGachaSplash(nameId: string) {
  return genshinUiUrl(`UI_Gacha_AvatarImg_${nameId}`);
}

/** CDN URL for a skill / talent UI_* icon name from character kit JSON. */
export function getUiAssetUrl(uiName: string) {
  return genshinUiUrl(uiName.replace(/\.(png|webp|jpe?g)$/i, ""));
}

/**
 * Enemy icon URL. `assetId` is the DB `enemies.asset` stem (UI_MonsterIcon_*,
 * UI_Img_LeyLineChallenge_*, …) — same flat genshin/ui layout as other textures.
 */
export function getEnemyAsset(assetId: string) {
  return genshinUiUrl(assetId.replace(/\.(png|webp|jpe?g)$/i, ""));
}

// ── GOOD key helpers ────────────────────────────────────────────────────────
//
// GOOD keys are PascalCase derived by removing all symbols from the name and
// capitalising each word (e.g. "Gladiator's Finale" → "GladiatorsFinale",
// "Wolf-Fang" → "WolfFang", "The Catch" → "TheCatch").

/**
 * Derive a GOOD key from a human-readable name by stripping symbols and spaces.
 * Compatible with character `name`, weapon `name`, and artifact set `name`.
 */
export function toGoodKey(name: string | null): string {
  return (name ?? "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/**
 * Build a Map from GOOD key → object with a `name` field.
 * Generic so it works for Characters, weapons, and artifact sets alike.
 */
export function buildGoodKeyMap<T extends { name: string | null }>(
  items: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = toGoodKey(item.name);
    if (key) map.set(key, item);
  }
  return map;
}

// ── Static weapon & artifact data ───────────────────────────────────────────

export interface WeaponData {
  id: number;
  name: string;
  stars: number;
  weaponType: string;
  icon: string;
  awakenIcon: string;
  splashIcon: string;
  /** Ascended base ATK at level 90. */
  baseAtk: number;
  /** Secondary stat at level 90, or null. */
  subStat: {
    propType: string;
    label: string;
    value: number;
    isPercent: boolean;
  } | null;
  /** Passive refinements R1–R5 (empty when none). */
  refinements: { rank: number; description: string }[];
}

export interface ArtifactSetData {
  id: number;
  name: string;
  icon: string;
  bonuses: { needCount: number; description: string }[];
}

/** Pre-built: GOOD weapon key → WeaponData */
export const weaponByKey = buildGoodKeyMap(weaponsRaw as WeaponData[]);

/** Pre-built: GOOD artifact set key → ArtifactSetData */
export const artifactSetByKey = buildGoodKeyMap(artifactSetsRaw as ArtifactSetData[]);

/**
 * Community baseline treats 4★ weapons as R0 — refinement is rarely ranked.
 * Unknown keys are treated as not-4★ so we don't invent R0 for missing data.
 */
export function isFourStarWeapon(weaponKey: string): boolean {
  const weapon = weaponByKey.get(weaponKey);
  return weapon ? weapon.stars <= 4 : false;
}

/** Refinement to show in UI (always 0 for 4★ weapons). */
export function displayWeaponRefinement(
  weaponKey: string,
  refinement: number,
): number {
  return isFourStarWeapon(weaponKey) ? 0 : refinement;
}

/**
 * Format constellation + refinement for investment cards.
 * 4★ weapons always show R0.
 */
export function formatInvestmentCR(
  cons: number,
  refinement: number,
  weaponKey: string,
): string {
  return `C${cons}R${displayWeaponRefinement(weaponKey, refinement)}`;
}

/** Weapon GOOD keys longest-first — avoids partial replacements in labels. */
const WEAPON_KEYS_BY_LENGTH = [...weaponByKey.keys()].sort(
  (a, b) => b.length - a.length,
);

/**
 * Replace GOOD weapon keys in an investment sim label with display names.
 * Leaves character keys / C/R tokens alone.
 */
export function humanizeInvestmentLabel(label: string): string {
  if (!label) return label;
  let out = label;
  for (const key of WEAPON_KEYS_BY_LENGTH) {
    if (!out.includes(key)) continue;
    const name = weaponByKey.get(key)?.name;
    if (!name) continue;
    out = out.split(key).join(name);
  }
  return out;
}

// ── Stat key → English ──────────────────────────────────────────────────────
//
// gcsim uses internal stat keys defined in the GOOD interface.
// This map translates them to human-readable English labels.

const STAT_KEY_MAP: Record<string, string> = {
  // Flat
  hp: "HP",
  atk: "ATK",
  def: "DEF",
  // Percentage
  hp_: "HP%",
  atk_: "ATK%",
  def_: "DEF%",
  // Elemental DMG
  pyro_dmg_: "Pyro DMG Bonus",
  hydro_dmg_: "Hydro DMG Bonus",
  cryo_dmg_: "Cryo DMG Bonus",
  electro_dmg_: "Electro DMG Bonus",
  anemo_dmg_: "Anemo DMG Bonus",
  geo_dmg_: "Geo DMG Bonus",
  dendro_dmg_: "Dendro DMG Bonus",
  physical_dmg_: "Physical DMG Bonus",
  // Special
  eleMas: "Elemental Mastery",
  enerRech_: "Energy Recharge",
  critRate_: "CRIT Rate",
  critDMG_: "CRIT DMG",
  heal_: "Healing Bonus",
};

/** Translate a gcsim stat key into a readable English label. */
export function translateStatKey(key: string): string {
  if (!key) return key;
  // Direct match
  if (STAT_KEY_MAP[key]) return STAT_KEY_MAP[key];
  // Normalize: trim trailing underscores and try again
  const trimmed = key.replace(/_+$/, "");
  if (STAT_KEY_MAP[trimmed]) return STAT_KEY_MAP[trimmed];
  return key;
}

/**
 * Lunaris attribute / element icon stems (mirrored to `genshin/ui/{stem}.webp`
 * by `scripts/sync/stat-icons-r2.ts`). GOOD percent variants share the flat glyph.
 */
const STAT_ICON_STEM: Record<string, string> = {
  hp: "hp",
  hp_: "hp",
  atk: "atk",
  atk_: "atk",
  def: "def",
  def_: "def",
  critRate_: "critrate",
  critDMG_: "critdmg",
  eleMas: "em",
  enerRech_: "er",
  heal_: "healing",
  physical_dmg_: "physical",
  pyro_dmg_: "pyro",
  hydro_dmg_: "hydro",
  cryo_dmg_: "cryo",
  electro_dmg_: "electro",
  anemo_dmg_: "anemo",
  geo_dmg_: "geo",
  dendro_dmg_: "dendro",
};

/** CDN URL for a GOOD / gcsim stat key icon, or null if unknown. */
export function statIconUrl(statKey: string): string | null {
  const stem = STAT_ICON_STEM[statKey];
  if (!stem) return null;
  return genshinUiUrl(stem);
}

/** Element display name → Lunaris icon stem. */
const ELEMENT_ICON_STEM: Record<string, string> = {
  Pyro: "pyro",
  Hydro: "hydro",
  Anemo: "anemo",
  Electro: "electro",
  Dendro: "dendro",
  Cryo: "cryo",
  Geo: "geo",
};

/** CDN URL for an element icon (e.g. `"Anemo"` → `anemo.webp`). */
export function elementIconUrl(element: string | null | undefined): string | null {
  if (!element) return null;
  const stem = ELEMENT_ICON_STEM[element] ?? ELEMENT_ICON_STEM[
    element.charAt(0).toUpperCase() + element.slice(1).toLowerCase()
  ];
  return stem ? genshinUiUrl(stem) : null;
}

/** Excel / label weapon type → Lunaris icon stem. */
const WEAPON_TYPE_ICON_STEM: Record<string, string> = {
  WEAPON_SWORD_ONE_HAND: "sword",
  WEAPON_CLAYMORE: "claymore",
  WEAPON_POLE: "polearm",
  WEAPON_CATALYST: "catalyst",
  WEAPON_BOW: "bow",
  Sword: "sword",
  Claymore: "claymore",
  Polearm: "polearm",
  Catalyst: "catalyst",
  Bow: "bow",
};

/** CDN URL for a weapon-type icon. */
export function weaponTypeIconUrl(
  weaponType: string | null | undefined,
): string | null {
  if (!weaponType) return null;
  const stem = WEAPON_TYPE_ICON_STEM[weaponType];
  return stem ? genshinUiUrl(stem) : null;
}

/** Artifact slot icon stems (Lunaris `icons/Icon_*`, mirrored to genshin/ui). */
const ARTIFACT_SLOT_ICON: Record<"sands" | "goblet" | "circlet", string> = {
  sands: "Icon_Sands_of_Eon",
  goblet: "Icon_Goblet_of_Eonothem",
  circlet: "Icon_Circlet_of_Logos",
};

/** CDN URL for an artifact main-stat slot icon. */
export function artifactSlotIconUrl(
  slot: "sands" | "goblet" | "circlet",
): string {
  return genshinUiUrl(ARTIFACT_SLOT_ICON[slot]);
}

/**
 * Build a character namecard background URL pointing at our CDN.
 * Synced as `genshin/ui/UI_NameCardPic_{name_id}_P.webp`.
 */
export function getNamecardUrl(nameId: string): string {
  return genshinUiUrl(`UI_NameCardPic_${nameId}_P`);
}

// ── gcsim CDN URLs ──────────────────────────────────────────────────────────

const SIM_BASE = "https://images.lightkeepers.moe/sim";
const SIM_CONFIGS_BASE = "https://images.lightkeepers.moe/sim-configs";

/**
 * Build a URL to the gcsim config.txt for a given simulation state key.
 * Configs are synced by `scripts/sync/gcsim-r2.ts` and stored as
 * `sim-configs/{state_key}/config.txt` in R2 with immutable caching.
 */
export function getSimConfigUrl(stateKey: string): string {
  return `${SIM_CONFIGS_BASE}/${encodeURIComponent(stateKey)}/config.txt`;
}

/**
 * Aggregate character config summaries (`sim/characters.json.gz`).
 * Synced by `scripts/sync/gcsim-r2.ts` from `output/characters.json`.
 */
export function getSimCharactersIndexUrl(): string {
  return `${SIM_BASE}/characters.json.gz`;
}

/**
 * Per-character config summary (`sim/characters/{Key}.json.gz`).
 * Synced from `output/characters/{Key}.json`. Gzipped like the aggregate;
 * fetch with normal `fetch()` — browsers decode Content-Encoding: gzip.
 */
export function getSimCharacterSummaryUrl(characterKey: string): string {
  return `${SIM_BASE}/characters/${encodeURIComponent(characterKey)}.json.gz`;
}

/**
 * Character / weapon upgrade cost tables (CDN).
 * fetch via `$lib/asset-urls` + `$lib/app/upgrade-costs` (`/api/upgrade-costs` proxy) — not ESM-bundled.
 */

/** One material stack in a cost row. */
export type UpgradeCostItem = {
  id: number;
  count: number;
};

export type UpgradePromoteStep = {
  /** 0–6 for characters / weapons. */
  promoteLevel: number;
  mora: number;
  unlockMaxLevel: number;
  items: UpgradeCostItem[];
};

export type UpgradeTalentLevelCost = {
  /** Talent level this row unlocks (1–10). */
  level: number;
  mora: number;
  items: UpgradeCostItem[];
};

export type UpgradeTalentTrack = {
  proudSkillGroupId: number;
  levels: UpgradeTalentLevelCost[];
};

export type CharacterUpgradeCosts = {
  name_id: string;
  game_id: number;
  name: string;
  /** Vision / Traveler resonance. Traveler kits use `PlayerBoy-{Element}`. */
  element: string;
  avatarPromoteId: number;
  promotes: UpgradePromoteStep[];
  talents: {
    normal: UpgradeTalentTrack;
    skill: UpgradeTalentTrack;
    burst: UpgradeTalentTrack;
  };
};

export type WeaponUpgradeCosts = {
  id: number;
  name: string;
  rankLevel: number;
  weaponPromoteId: number;
  icon: string;
  promotes: UpgradePromoteStep[];
};

export type UpgradeMaterialSourceKind =
  "boss" | "elite" | "common" | "weekly" | "domain";

export type UpgradeMaterialWeekday =
  "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/** World/weekly boss, enemy family, or weekday domain that drops this material. */
export type UpgradeMaterialSource = {
  kind: UpgradeMaterialSourceKind;
  name: string;
  /** `UI_MonsterIcon_*` from the handbook / monster describe table. */
  icon?: string;
  /** Talent-book / weapon-mat domains: Mon/Thu/Sun, etc. */
  days?: UpgradeMaterialWeekday[];
};

export type UpgradeMaterialMeta = {
  id: number;
  name: string;
  icon: string;
  rankLevel: number;
  sources?: UpgradeMaterialSource[];
  /**
   * 3 of this item craft into 1 of `craftIntoId`.
   * Talent books, weapon mats, elemental gems, elite, and common drops.
   */
  craftIntoId?: number;
};

export type UpgradeCurves = {
  /** Index = level; value = EXP to go from that level → next. Level 90 is unused leftover. */
  avatarLevelExp: number[];
  /** Rarity 1–5 → same level→next EXP array. */
  weaponLevelExpByRarity: Record<string, number[]>;
  /** Character EXP books (Hero's Wit, etc.). */
  avatarExpItems: Array<UpgradeCostItem & { exp: number }>;
  /** Weapon ores. */
  weaponExpItems: Array<UpgradeCostItem & { exp: number }>;
};

export type UpgradeCostsCatalog = {
  characters: CharacterUpgradeCosts[];
  weapons: WeaponUpgradeCosts[];
  materials: Record<string, UpgradeMaterialMeta>;
  curves: UpgradeCurves;
};

export type CharacterUpgradeConfig = {
  level: number;
  /** Ascension / promote level 0–6. */
  ascension: number;
  talents: {
    normal: number;
    skill: number;
    burst: number;
  };
};

export type WeaponUpgradeConfig = {
  level: number;
  ascension: number;
};

export type UpgradeCostResult = {
  mora: number;
  /** Raw EXP points needed (books/ores computed separately for display). */
  exp: number;
  /** Material id → count. */
  materials: Record<string, number>;
};

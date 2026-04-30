export const WEAPON_TYPE_MAP: Record<string, string> = {
  WEAPON_SWORD_ONE_HAND: "Sword",
  WEAPON_CLAYMORE: "Claymore",
  WEAPON_POLE: "Polearm",
  WEAPON_CATALYST: "Catalyst",
  WEAPON_BOW: "Bow",
}

// DB name -> Enka display name mismatches (add entries as new characters reveal gaps)
export const NAME_OVERRIDES: Record<string, string> = {
  Ambor: "Amber",
}

export const DISPLAY_TO_DB = new Map(
  Object.entries(NAME_OVERRIDES).map(([db, display]) => [display, db]),
)

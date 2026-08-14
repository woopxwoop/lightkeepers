import type { CharacterOwned } from "$lib/definitions";
import { ELEMENT_NAMES } from "$lib/element-colors";
import { weaponTypeLabel } from "$lib/utils";

export const CHARACTER_ELEMENTS = ELEMENT_NAMES;

export const CHARACTER_WEAPON_TYPES = [
  "Sword",
  "Catalyst",
  "Bow",
  "Claymore",
  "Polearm",
] as const;

export type OwnershipFilter = "all" | "owned" | "unowned";
export type CharacterSortKey = "name" | "release_date" | "game_id";

export type CharacterFilterState = {
  search?: string;
  rarity?: Set<string>;
  elements?: Set<string>;
  weapons?: Set<string>;
  ownership?: OwnershipFilter;
  sortBy?: CharacterSortKey;
  sortAsc?: boolean;
};

/** Toggle membership in a string set (immutable). */
export function toggleFilterSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function releaseTime(releasedAt: string | null | undefined): number | null {
  if (!releasedAt) return null;
  const t = new Date(releasedAt.replace(" ", "T")).getTime();
  return Number.isNaN(t) ? null : t;
}

function isTravelerNameId(nameId: string | null | undefined): boolean {
  if (!nameId) return false;
  return (
    nameId === "PlayerBoy" ||
    nameId === "PlayerGirl" ||
    nameId.startsWith("PlayerBoy-") ||
    nameId.startsWith("PlayerGirl-")
  );
}

/** CB / unreleased rows pin to the front of release-date sort; Traveler does not. */
function isUnreleasedReleasePin(c: CharacterOwned): boolean {
  const releasedAt = c.released_at;
  if (releasedAt != null && releasedAt !== "") return false;
  return !isTravelerNameId(c.name_id);
}

/**
 * Filter + sort a character roster for browse / roster grids.
 * Release-date: empty `released_at` (non-Traveler) always first; then dated
 * ascending/descending; Traveler nulls follow normal null placement in that group.
 * Ties break on game_id.
 */
export function filterAndSortCharacters(
  characters: CharacterOwned[],
  state: CharacterFilterState = {},
): CharacterOwned[] {
  const search = (state.search ?? "").trim().toLowerCase();
  const rarity = state.rarity ?? new Set<string>();
  const elements = state.elements ?? new Set<string>();
  const weapons = state.weapons ?? new Set<string>();
  const ownership = state.ownership ?? "all";
  const sortBy = state.sortBy ?? "name";
  const sortAsc = state.sortAsc ?? true;

  const filtered = characters.filter((c) => {
    const matchesRarity =
      rarity.size === 0 ||
      (rarity.has("5") && c.rarity === 5) ||
      (rarity.has("4") && c.rarity === 4);
    const matchesElement =
      elements.size === 0 || (c.element != null && elements.has(c.element));
    const matchesWeapon =
      weapons.size === 0 ||
      (c.weapon_type != null && weapons.has(weaponTypeLabel(c.weapon_type)));
    const matchesOwnership =
      ownership === "all" ||
      (ownership === "owned" && c.isOwned) ||
      (ownership === "unowned" && !c.isOwned);
    const matchesSearch =
      search === "" || (c.name ?? "").toLowerCase().includes(search);
    return (
      matchesRarity &&
      matchesElement &&
      matchesWeapon &&
      matchesOwnership &&
      matchesSearch
    );
  });

  return filtered.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "game_id") {
      cmp = (a.game_id ?? 0) - (b.game_id ?? 0);
    } else if (sortBy === "release_date") {
      const pinA = isUnreleasedReleasePin(a);
      const pinB = isUnreleasedReleasePin(b);
      if (pinA !== pinB) {
        // Unreleased non-Travelers stay first even when newest-first (desc).
        return pinA ? -1 : 1;
      }

      const ta = releaseTime(a.released_at);
      const tb = releaseTime(b.released_at);
      if (ta === null && tb === null) cmp = (a.game_id ?? 0) - (b.game_id ?? 0);
      else if (ta === null) cmp = -1;
      else if (tb === null) cmp = 1;
      else {
        cmp = ta - tb;
        if (cmp === 0) cmp = (a.game_id ?? 0) - (b.game_id ?? 0);
      }
    } else {
      cmp = (a.name ?? "").localeCompare(b.name ?? "");
      if (cmp === 0) cmp = (a.game_id ?? 0) - (b.game_id ?? 0);
    }
    return sortAsc ? cmp : -cmp;
  });
}

export function characterFiltersActive(state: CharacterFilterState): boolean {
  return (
    (state.rarity?.size ?? 0) > 0 ||
    (state.elements?.size ?? 0) > 0 ||
    (state.weapons?.size ?? 0) > 0 ||
    (state.ownership ?? "all") !== "all"
  );
}

/** Chip filters only (search is owned by the pick modal). */
export function characterMatchesChipFilters(
  c: Pick<CharacterOwned, "rarity" | "element" | "weapon_type" | "isOwned">,
  state: Omit<CharacterFilterState, "search" | "sortBy" | "sortAsc"> = {},
): boolean {
  const rarity = state.rarity ?? new Set<string>();
  const elements = state.elements ?? new Set<string>();
  const weapons = state.weapons ?? new Set<string>();
  const ownership = state.ownership ?? "all";

  const matchesRarity =
    rarity.size === 0 ||
    (rarity.has("5") && c.rarity === 5) ||
    (rarity.has("4") && c.rarity === 4);
  const matchesElement =
    elements.size === 0 || (c.element != null && elements.has(c.element));
  const matchesWeapon =
    weapons.size === 0 ||
    (c.weapon_type != null && weapons.has(weaponTypeLabel(c.weapon_type)));
  const matchesOwnership =
    ownership === "all" ||
    (ownership === "owned" && c.isOwned) ||
    (ownership === "unowned" && !c.isOwned);

  return matchesRarity && matchesElement && matchesWeapon && matchesOwnership;
}

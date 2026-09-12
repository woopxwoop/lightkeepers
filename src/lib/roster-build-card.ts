/**
 * Map roster progress + GOOD inventory into a read-only build card view.
 * Combat-sheet totals are computed in build-stats (`computeRosterSheetStats`).
 */

import type {
  CharacterOwned,
  InventoryArtifact,
  InventoryArtifactSlot,
  InventoryWeapon,
  RosterProgress,
  RosterWeapon,
} from "$lib/definitions";
import type { InvestmentBuildKitIcons } from "$lib/investment-build-card";
import {
  INVENTORY_ARTIFACT_SLOTS,
  artifactsForLocation,
  cloneInventoryArtifact,
  equippedWeaponForLocation,
  inventoryWeaponToRoster,
} from "$lib/roster-inventory";
import {
  DEFAULT_ROSTER_PROGRESS,
  cloneRosterProgress,
  cloneRosterWeapon,
  goodKeysForRosterName,
} from "$lib/roster-progress";

export type RosterBuildSetCount = {
  setKey: string;
  count: number;
};

export type RosterBuildView = {
  character: CharacterOwned;
  /** GOOD location key used for inventory joins. */
  locationKey: string;
  progress: RosterProgress;
  weapon: RosterWeapon | null;
  piecesBySlot: Record<InventoryArtifactSlot, InventoryArtifact | null>;
  setCounts: RosterBuildSetCount[];
  kit: InvestmentBuildKitIcons | null;
};

/** Count equipped pieces by setKey, highest first; drop singles for 2pc display. */
export function setCountsFromPieces(
  pieces: readonly (InventoryArtifact | null)[],
): RosterBuildSetCount[] {
  const tally = new Map<string, number>();
  for (const piece of pieces) {
    if (!piece) continue;
    tally.set(piece.setKey, (tally.get(piece.setKey) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([setKey, count]) => ({ setKey, count }))
    .filter((row) => row.count >= 2)
    .sort((a, b) => b.count - a.count || a.setKey.localeCompare(b.setKey));
}

function emptyPiecesBySlot(): Record<
  InventoryArtifactSlot,
  InventoryArtifact | null
> {
  return {
    flower: null,
    plume: null,
    sands: null,
    goblet: null,
    circlet: null,
  };
}

function piecesBySlotFromLocation(
  artifacts: readonly InventoryArtifact[],
  locationKey: string,
): Record<InventoryArtifactSlot, InventoryArtifact | null> {
  const next = emptyPiecesBySlot();
  if (!locationKey) return next;
  for (const piece of artifactsForLocation(artifacts, locationKey)) {
    next[piece.slotKey] = cloneInventoryArtifact(piece);
  }
  return next;
}

function resolveLocationKey(
  character: CharacterOwned,
  weapons: readonly InventoryWeapon[],
  artifacts: readonly InventoryArtifact[],
): string {
  const keys = goodKeysForRosterName(character.name ?? null);
  for (const key of keys) {
    if (equippedWeaponForLocation(weapons, key)) return key;
    if (artifactsForLocation(artifacts, key).length > 0) return key;
  }
  return keys[0] ?? "";
}

/**
 * Build a presentational view for {@link RosterBuildCard}.
 * Prefers inventory weapon at location over `progress.weapon`.
 */
export function rosterBuildViewFromOwned(
  character: CharacterOwned,
  weapons: readonly InventoryWeapon[] = [],
  artifacts: readonly InventoryArtifact[] = [],
  kit: InvestmentBuildKitIcons | null = null,
): RosterBuildView {
  const locationKey = resolveLocationKey(character, weapons, artifacts);
  const progress =
    cloneRosterProgress(character.progress) ?? {
      ...DEFAULT_ROSTER_PROGRESS,
      talents: { ...DEFAULT_ROSTER_PROGRESS.talents },
    };

  let weapon: RosterWeapon | null = null;
  if (locationKey) {
    const equipped = equippedWeaponForLocation(weapons, locationKey);
    if (equipped) weapon = inventoryWeaponToRoster(equipped);
  }
  if (!weapon) weapon = cloneRosterWeapon(progress.weapon);

  const piecesBySlot = piecesBySlotFromLocation(artifacts, locationKey);
  const setCounts = setCountsFromPieces(
    INVENTORY_ARTIFACT_SLOTS.map((slot) => piecesBySlot[slot]),
  );

  return {
    character,
    locationKey,
    progress: { ...progress, weapon },
    weapon,
    piecesBySlot,
    setCounts,
    kit,
  };
}

/** Format a GOOD substat / mainstat numeric for display. */
export function formatGoodStatValue(key: string, value: number): string {
  if (key.endsWith("_")) {
    const n = Number.isFinite(value) ? value : 0;
    return `${n.toFixed(1)}%`;
  }
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export { INVENTORY_ARTIFACT_SLOTS };

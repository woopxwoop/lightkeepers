/**
 * Client fetch for GOOD inventory slices.
 *
 * Planner / Pulls call `loadRosterWeapons()`. Character Builds calls
 * `loadRosterArtifacts()`. Not part of layout bootstrap.
 */

import type { InventoryArtifact, InventoryWeapon } from "$lib/definitions";
import {
  cloneInventoryArtifact,
  cloneInventoryWeapon,
} from "$lib/roster-inventory";

let weaponsCached: InventoryWeapon[] | null = null;
let artifactsCached: InventoryArtifact[] | null = null;
let weaponsPending: Promise<InventoryWeapon[]> | null = null;
let artifactsPending: Promise<InventoryArtifact[]> | null = null;

export function getRosterWeaponsCached(): InventoryWeapon[] | null {
  return weaponsCached;
}

export function getRosterArtifactsCached(): InventoryArtifact[] | null {
  return artifactsCached;
}

/** Seed slices after GOOD import (logged-in POST or logged-out memory). */
export function setRosterInventory(input: {
  weapons?: InventoryWeapon[];
  artifacts?: InventoryArtifact[];
}): void {
  if (input.weapons) {
    weaponsCached = input.weapons.map(cloneInventoryWeapon);
    weaponsPending = null;
  }
  if (input.artifacts) {
    artifactsCached = input.artifacts.map(cloneInventoryArtifact);
    artifactsPending = null;
  }
}

export function clearRosterInventory(): void {
  weaponsCached = null;
  artifactsCached = null;
  weaponsPending = null;
  artifactsPending = null;
}

async function fetchSlice<T>(
  url: string,
  key: "weapons" | "artifacts",
): Promise<T[]> {
  const res = await fetch(url);
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  return Array.isArray(data[key]) ? (data[key] as T[]) : [];
}

export function loadRosterWeapons(): Promise<InventoryWeapon[]> {
  if (weaponsCached) return Promise.resolve(weaponsCached);
  if (weaponsPending) return weaponsPending;

  weaponsPending = fetchSlice<InventoryWeapon>("/api/roster/weapons", "weapons")
    .then((rows) => {
      weaponsCached = rows.map(cloneInventoryWeapon);
      return weaponsCached;
    })
    .finally(() => {
      weaponsPending = null;
    });

  return weaponsPending;
}

export function loadRosterArtifacts(): Promise<InventoryArtifact[]> {
  if (artifactsCached) return Promise.resolve(artifactsCached);
  if (artifactsPending) return artifactsPending;

  artifactsPending = fetchSlice<InventoryArtifact>(
    "/api/roster/artifacts",
    "artifacts",
  )
    .then((rows) => {
      artifactsCached = rows.map(cloneInventoryArtifact);
      return artifactsCached;
    })
    .finally(() => {
      artifactsPending = null;
    });

  return artifactsPending;
}

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
/** Bumped on clear/seed so in-flight fetches cannot overwrite fresher state. */
let weaponsGeneration = 0;
let artifactsGeneration = 0;

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
    weaponsGeneration += 1;
    weaponsCached = input.weapons.map(cloneInventoryWeapon);
    weaponsPending = null;
  }
  if (input.artifacts) {
    artifactsGeneration += 1;
    artifactsCached = input.artifacts.map(cloneInventoryArtifact);
    artifactsPending = null;
  }
}

export function clearRosterInventory(): void {
  weaponsGeneration += 1;
  artifactsGeneration += 1;
  weaponsCached = null;
  artifactsCached = null;
  weaponsPending = null;
  artifactsPending = null;
}

async function fetchSlice<T>(
  url: string,
  key: "weapons" | "artifacts",
): Promise<{ unauthorized: true } | { unauthorized: false; rows: T[] }> {
  const res = await fetch(url);
  if (res.status === 401) return { unauthorized: true };
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  const rows = Array.isArray(data[key]) ? (data[key] as T[]) : [];
  return { unauthorized: false, rows };
}

export function loadRosterWeapons(): Promise<InventoryWeapon[]> {
  if (weaponsCached) return Promise.resolve(weaponsCached);
  if (weaponsPending) return weaponsPending;

  const generation = weaponsGeneration;
  const request = fetchSlice<InventoryWeapon>("/api/roster/weapons", "weapons")
    .then((result) => {
      if (generation !== weaponsGeneration) {
        return weaponsCached ?? [];
      }
      if (result.unauthorized) return [];
      weaponsCached = result.rows.map(cloneInventoryWeapon);
      return weaponsCached;
    })
    .finally(() => {
      if (weaponsPending === request) weaponsPending = null;
    });

  weaponsPending = request;
  return request;
}

export function loadRosterArtifacts(): Promise<InventoryArtifact[]> {
  if (artifactsCached) return Promise.resolve(artifactsCached);
  if (artifactsPending) return artifactsPending;

  const generation = artifactsGeneration;
  const request = fetchSlice<InventoryArtifact>(
    "/api/roster/artifacts",
    "artifacts",
  )
    .then((result) => {
      if (generation !== artifactsGeneration) {
        return artifactsCached ?? [];
      }
      if (result.unauthorized) return [];
      artifactsCached = result.rows.map(cloneInventoryArtifact);
      return artifactsCached;
    })
    .finally(() => {
      if (artifactsPending === request) artifactsPending = null;
    });

  artifactsPending = request;
  return request;
}

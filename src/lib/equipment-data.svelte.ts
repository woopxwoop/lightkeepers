/**
 * Component-side access to the lazily loaded equipment tables.
 *
 * Starts the one-time JSON load and tracks `equipmentVersion` so leaf
 * components re-resolve weapons once the data arrives, without any
 * caller-side `{#key $equipmentVersion}` wrapper.
 *
 * Call from component initialization (these register an `onMount` hook).
 */

import { onMount } from "svelte";
import { get } from "svelte/store";
import {
  ensureEquipmentData,
  equipmentVersion,
  weaponByKey,
  weaponIconSrc,
  artifactSetByKey,
  type WeaponData,
  type ArtifactSetData,
} from "$lib/equipment-data";
import { artifactIconUrl } from "$lib/asset-urls";

export type EquipmentData = {
  /** Bumps when the tables finish loading. Read it to take a dependency. */
  readonly version: number;
};

/** Trigger the lazy load and track load completion. */
export function useEquipmentData(): EquipmentData {
  let version = $state(get(equipmentVersion));

  onMount(() => {
    const unsubscribe = equipmentVersion.subscribe((next) => {
      version = next;
    });
    void ensureEquipmentData().catch((error) => {
      console.error("[equipment-data] load failed:", error);
      version += 1;
    });
    return unsubscribe;
  });

  return {
    get version() {
      return version;
    },
  };
}

export type WeaponLookup = {
  /** Null until the tables load, and for unknown keys. */
  readonly weapon: WeaponData | null;
  /** Null unless an icon is actually displayable. */
  readonly icon: string | null;
};

/**
 * Resolve a weapon from a GOOD key, re-reading after the lazy load.
 * `weaponKey` is a getter so prop changes stay reactive.
 */
export function useWeapon(weaponKey: () => string): WeaponLookup {
  const equipment = useEquipmentData();

  return {
    get weapon() {
      void equipment.version;
      return weaponByKey.get(weaponKey()) ?? null;
    },
    get icon() {
      void equipment.version;
      return weaponIconSrc(weaponKey());
    },
  };
}

export type ArtifactSetLookup = {
  /** Null until the tables load, and for unknown keys. */
  readonly set: ArtifactSetData | null;
  /** Null unless an icon is actually displayable. */
  readonly icon: string | null;
};

/**
 * Resolve an artifact set from a GOOD key, re-reading after the lazy load.
 * `setKey` is a getter so prop changes stay reactive.
 */
export function useArtifactSet(setKey: () => string): ArtifactSetLookup {
  const equipment = useEquipmentData();

  return {
    get set() {
      void equipment.version;
      const key = setKey();
      return key ? (artifactSetByKey.get(key) ?? null) : null;
    },
    get icon() {
      void equipment.version;
      const key = setKey();
      if (!key) return null;
      const set = artifactSetByKey.get(key);
      return set ? artifactIconUrl(set.icon) : null;
    },
  };
}

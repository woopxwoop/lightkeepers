/**
 * Component-side access to the lazily loaded equipment tables.
 *
 * Starts the one-time JSON load and tracks `equipmentVersion` so leaf
 * components re-resolve weapons once the data arrives, without any
 * caller-side `{#key $equipmentVersion}` wrapper.
 * A failed load leaves the version on the last successful tables and sets
 * `failed`, so a first load that never succeeds is still finished.
 *
 * Call from component initialization (these register an `onMount` hook).
 */

import { onMount } from "svelte";
import { get } from "svelte/store";
import {
  ensureBaseStatData,
  ensureEquipmentData,
  equipmentLoadFailed,
  equipmentVersion,
  weaponByKey,
  weaponIconSrc,
  artifactSetByKey,
  artifactSetIconSrc,
  type WeaponData,
  type ArtifactSetData,
} from "#lib/equipment/equipment-data.js";

export type EquipmentData = {
  /** Bumps when a load commits. Unchanged when a load fails. */
  readonly version: number;
  /** True when the latest load failed. Version still means the last success. */
  readonly failed: boolean;
};

/**
 * Trigger the lazy load and track load completion.
 * `baseStats: true` also loads the stat-sheet tables (build-stats consumers).
 */
export function useEquipmentData(
  opts: { baseStats?: boolean } = {},
): EquipmentData {
  let version = $state(get(equipmentVersion));
  let failed = $state(get(equipmentLoadFailed));

  onMount(() => {
    const unsubscribeVersion = equipmentVersion.subscribe((next) => {
      version = next;
    });
    const unsubscribeFailed = equipmentLoadFailed.subscribe((next) => {
      failed = next;
    });
    void ensureEquipmentData().catch((error) => {
      console.error("[equipment-data] load failed:", error);
    });
    if (opts.baseStats) {
      void ensureBaseStatData().catch((error) => {
        console.error("[equipment-data] base stats load failed:", error);
      });
    }
    return () => {
      unsubscribeVersion();
      unsubscribeFailed();
    };
  });

  return {
    get version() {
      return version;
    },
    get failed() {
      return failed;
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
      void equipment.failed;
      return weaponByKey.get(weaponKey()) ?? null;
    },
    get icon() {
      void equipment.version;
      void equipment.failed;
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
      void equipment.failed;
      const key = setKey();
      return key ? (artifactSetByKey.get(key) ?? null) : null;
    },
    get icon() {
      void equipment.version;
      void equipment.failed;
      const key = setKey();
      return key ? artifactSetIconSrc(key) : null;
    },
  };
}

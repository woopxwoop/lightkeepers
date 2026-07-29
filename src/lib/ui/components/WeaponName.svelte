<script lang="ts">
  /**
   * Display name for a GOOD weapon key; falls back to the key until loaded.
   */
  import { onMount } from "svelte";
  import {
    ensureEquipmentData,
    equipmentVersion,
    weaponByKey,
  } from "$lib/equipment-data";

  let {
    weaponKey,
  }: {
    weaponKey: string;
  } = $props();

  onMount(() => {
    void ensureEquipmentData();
  });

  let name = $derived.by(() => {
    $equipmentVersion;
    return weaponByKey.get(weaponKey)?.name ?? weaponKey;
  });
</script>

{name}

<script lang="ts">
  /**
   * Weapon icon from a GOOD key. Empty until equipment JSON loads, then
   * updates without a parent {#key $equipmentVersion}.
   */
  import { onMount } from "svelte";
  import {
    ensureEquipmentData,
    equipmentVersion,
    weaponByKey,
  } from "$lib/equipment-data";
  import { weaponIconUrl } from "$lib/asset-urls";

  let {
    weaponKey,
    class: className = "",
    alt,
  }: {
    weaponKey: string;
    class?: string;
    /** Defaults to the resolved weapon name (or key while loading). */
    alt?: string;
  } = $props();

  onMount(() => {
    void ensureEquipmentData();
  });

  let weapon = $derived.by(() => {
    $equipmentVersion;
    return weaponByKey.get(weaponKey) ?? null;
  });

  let src = $derived(weapon ? weaponIconUrl(weapon.awakenIcon) : null);
  let resolvedAlt = $derived(alt ?? weapon?.name ?? weaponKey);
</script>

{#if src}
  <img src={src} alt={resolvedAlt} class={className} loading="lazy" />
{/if}

<script lang="ts">
  /**
   * Weapon icon from a GOOD key. Empty until equipment JSON loads, then
   * updates without a parent {#key $equipmentVersion}.
   */
  import { useWeapon } from "$lib/equipment-data.svelte";

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

  const lookup = useWeapon(() => weaponKey);

  let src = $derived(lookup.icon);
  let resolvedAlt = $derived(alt ?? lookup.weapon?.name ?? weaponKey);
</script>

{#if src}
  <img {src} alt={resolvedAlt} class={className} loading="lazy" />
{/if}

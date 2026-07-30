<script lang="ts">
  /**
   * Display name for a GOOD weapon key; falls back to the key until loaded.
   */
  import { useWeapon } from "$lib/equipment-data.svelte";

  let {
    weaponKey,
  }: {
    weaponKey: string;
  } = $props();

  const lookup = useWeapon(() => weaponKey);

  let name = $derived(lookup.weapon?.name ?? weaponKey);
</script>

{name}

<script lang="ts">
  /**
   * Portrait-corner weapon icon + refinement badge.
   * Subscribes to equipmentVersion so lazy JSON load updates without a
   * caller-side {#key $equipmentVersion} wrapper.
   */
  import { onMount } from "svelte";
  import {
    displayWeaponRefinement,
    ensureEquipmentData,
    equipmentVersion,
    weaponByKey,
  } from "$lib/equipment-data";
  import { weaponIconUrl } from "$lib/asset-urls";
  import WeaponTooltip from "$lib/ui/components/WeaponTooltip.svelte";

  let {
    weaponKey,
    refinement,
  }: {
    weaponKey: string;
    refinement: number;
  } = $props();

  onMount(() => {
    void ensureEquipmentData();
  });

  let weapon = $derived.by(() => {
    $equipmentVersion;
    return weaponByKey.get(weaponKey) ?? null;
  });

  let icon = $derived(weapon ? weaponIconUrl(weapon.awakenIcon) : null);

  let refine = $derived(
    displayWeaponRefinement(weaponKey, refinement, {
      weaponShown: Boolean(icon),
    }),
  );
</script>

{#if icon}
  <div class="weapon group">
    <img
      src={icon}
      alt={weapon?.name ?? "Weapon"}
      class="weapon-img"
      loading="lazy"
    />
    {#if refine !== null}
      <span class="weapon-r">R{refine}</span>
    {/if}
    <WeaponTooltip {weapon} refinement={refine} />
  </div>
{/if}

<style>
  .weapon {
    position: absolute;
    top: 0.35rem;
    left: 0.35rem;
    z-index: 20;
    width: 28%;
    aspect-ratio: 1;
    border-radius: 0.2rem;
    overflow: hidden;
    pointer-events: auto;
    cursor: pointer;
    background: color-mix(in srgb, var(--background-color) 72%, transparent);
    border: var(--border-width) solid rgba(255, 255, 255, 0.28);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  }

  .weapon-img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 0.1rem;
  }

  .weapon-r {
    position: absolute;
    right: 0.1rem;
    bottom: 0.05rem;
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1;
    color: var(--accent-1);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  }
</style>

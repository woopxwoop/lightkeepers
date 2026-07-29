<script lang="ts">
  /**
   * C#R# string that respects 5★ refinement rules after equipment data loads.
   */
  import { onMount } from "svelte";
  import {
    ensureEquipmentData,
    equipmentVersion,
    formatInvestmentCR,
  } from "$lib/equipment-data";

  let {
    cons,
    refinement,
    weaponKey,
  }: {
    cons: number;
    refinement: number;
    weaponKey: string;
  } = $props();

  onMount(() => {
    void ensureEquipmentData();
  });

  let text = $derived.by(() => {
    $equipmentVersion;
    return formatInvestmentCR(cons, refinement, weaponKey);
  });
</script>

{text}

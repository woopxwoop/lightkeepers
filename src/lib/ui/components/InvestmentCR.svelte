<script lang="ts">
  /**
   * C#R# string that respects 5★ refinement rules after equipment data loads.
   */
  import { formatInvestmentCR } from "$lib/equipment-data";
  import { useEquipmentData } from "$lib/equipment-data.svelte";

  let {
    cons,
    refinement,
    weaponKey,
  }: {
    cons: number;
    refinement: number;
    weaponKey: string;
  } = $props();

  const equipment = useEquipmentData();

  let text = $derived.by(() => {
    void equipment.version;
    return formatInvestmentCR(cons, refinement, weaponKey);
  });
</script>

{text}

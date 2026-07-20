<script lang="ts">
  import {
    artifactSetByKey,
    type ArtifactSetData,
  } from "$lib/utils";
  import HoverTooltip from "./HoverTooltip.svelte";

  let {
    setKey,
    set = null,
  }: {
    /** GOOD artifact set key — looked up in `artifactSetByKey` when `set` is omitted. */
    setKey?: string;
    set?: ArtifactSetData | null;
  } = $props();

  let resolved = $derived(
    set ?? (setKey ? (artifactSetByKey.get(setKey) ?? null) : null),
  );
</script>

{#if resolved}
  <HoverTooltip class="max-w-64">
    <div class="text-xs font-medium leading-tight">{resolved.name}</div>
    {#each resolved.bonuses as bonus}
      <div class="text-[0.65rem] leading-snug mt-1 opacity-85">
        <span class="font-semibold">{bonus.needCount}-Piece:</span>
        {bonus.description}
      </div>
    {/each}
  </HoverTooltip>
{/if}

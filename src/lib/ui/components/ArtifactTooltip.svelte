<script lang="ts">
  import {
    artifactSetByKey,
    type ArtifactSetData,
  } from "$lib/utils";
  import HoverTooltip from "./HoverTooltip.svelte";

  let {
    setKey,
    set = null,
    pieceCount = null,
  }: {
    /** GOOD artifact set key — looked up in `artifactSetByKey` when `set` is omitted. */
    setKey?: string;
    set?: ArtifactSetData | null;
    /** When set, label which piece bonus this recommendation uses (2 or 4). */
    pieceCount?: number | null;
  } = $props();

  let resolved = $derived(
    set ?? (setKey ? (artifactSetByKey.get(setKey) ?? null) : null),
  );
</script>

{#if resolved}
  <HoverTooltip class="max-w-64">
    <div class="text-xs font-medium leading-tight">
      {resolved.name}{#if pieceCount != null}
        {" "}· {pieceCount}pc{/if}
    </div>
    {#each resolved.bonuses as bonus}
      {#if pieceCount == null || bonus.needCount <= pieceCount}
        <div class="text-[0.65rem] leading-snug mt-1 opacity-85">
          <span class="font-semibold">{bonus.needCount}-Piece:</span>
          {bonus.description}
        </div>
      {/if}
    {/each}
  </HoverTooltip>
{/if}

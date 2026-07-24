<script lang="ts">
  import { artifactSetByKey, type ArtifactSetData } from "$lib/equipment-data";
  import GameText from "./GameText.svelte";
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
    <div class="text-sm font-medium leading-tight">
      {resolved.name}{#if pieceCount != null}
        {" "}· {pieceCount}pc{/if}
    </div>
    {#each resolved.bonuses as bonus}
      {#if pieceCount == null || bonus.needCount <= pieceCount}
        <div class="mt-1.5">
          <div class="text-[0.65rem] font-medium leading-tight opacity-90">
            {bonus.needCount}-Piece
          </div>
          <GameText class="text-[0.65rem] mt-0.5" text={bonus.description} />
        </div>
      {/if}
    {/each}
  </HoverTooltip>
{/if}

<script lang="ts">
  import { useArtifactSet } from "$lib/equipment-data.svelte";
  import type { ArtifactSetData } from "$lib/equipment-data";
  import GameText from "./GameText.svelte";
  import HoverTooltip from "./HoverTooltip.svelte";

  let {
    setKey,
    set = null,
    pieceCount = null,
  }: {
    /** GOOD artifact set key — looked up when `set` is omitted. */
    setKey?: string;
    set?: ArtifactSetData | null;
    /** When set, label which piece bonus this recommendation uses (2 or 4). */
    pieceCount?: number | null;
  } = $props();

  const lookup = useArtifactSet(() => setKey ?? "");

  let resolved = $derived(set ?? lookup.set);

  let title = $derived(
    resolved
      ? pieceCount != null
        ? `${resolved.name} · ${pieceCount}pc`
        : resolved.name
      : "",
  );
</script>

{#if resolved}
  <HoverTooltip class="max-w-64" label={title}>
    <div class="tip-detail-text font-medium">{title}</div>
    {#each resolved.bonuses as bonus}
      {#if pieceCount == null || bonus.needCount <= pieceCount}
        <div class="mt-1.5">
          <div
            class="tip-detail-text tip-detail-text--small font-medium opacity-90"
          >
            {bonus.needCount}-Piece
          </div>
          <GameText
            class="tip-detail-text tip-detail-text--small mt-0.5 opacity-85"
            text={bonus.description}
          />
        </div>
      {/if}
    {/each}
  </HoverTooltip>
{/if}

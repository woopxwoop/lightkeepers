<script lang="ts">
  import { onMount } from "svelte";
  import {
    artifactSetByKey,
    equipmentVersion,
    ensureEquipmentData,
    type ArtifactSetData,
  } from "$lib/equipment-data";
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

  onMount(() => {
    void ensureEquipmentData();
  });

  let resolved = $derived.by(() => {
    $equipmentVersion;
    return set ?? (setKey ? (artifactSetByKey.get(setKey) ?? null) : null);
  });

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

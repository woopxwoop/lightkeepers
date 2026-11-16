<script lang="ts">
  import {
    dpsDisplayName,
    type DisplayGroup,
  } from "#lib/boards/summary-columns.js";
  import type { Tables } from "#lib/types/database.types.js";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";
  import FeaturedTeam from "#lib/ui/components/summary-tool/FeaturedTeam.svelte";

  let {
    group,
    mapping,
    onclose,
  }: {
    group: DisplayGroup | null;
    mapping: Map<string, Tables<"characters">>;
    onclose: () => void;
  } = $props();
</script>

<ModalSheet
  open={!!group}
  {onclose}
  labelledby="alts-modal-title"
  size="sheet"
  nested
>
  {#snippet head()}
    {#if group}
      <h2 id="alts-modal-title" class="section-title alts-title">
        {dpsDisplayName(mapping, group.mainDps)} teams
      </h2>
    {/if}
  {/snippet}
  {#if group}
    <p class="section-lede alts-lede">
      {1 + group.alternates.length} team{group.alternates.length === 0
        ? ""
        : "s"} for {dpsDisplayName(mapping, group.mainDps)}.
    </p>
    <ul class="alts-grid">
      <li class="alts-grid-item">
        <FeaturedTeam team={group.primary} {mapping} />
      </li>
      {#each group.alternates as alt, j (alt.team_key ?? j)}
        <li class="alts-grid-item">
          <FeaturedTeam team={alt} {mapping} alt />
        </li>
      {/each}
    </ul>
  {/if}
</ModalSheet>

<style>
  .alts-title,
  .alts-lede {
    margin: 0;
  }

  .alts-grid {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .alts-grid-item {
    min-width: 0;
  }

  @media (max-width: 36rem) {
    .alts-grid {
      gap: 0.4rem;
    }
  }
</style>

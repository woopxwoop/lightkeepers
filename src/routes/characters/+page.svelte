<script lang="ts">
  import { charactersOwned, animationsEnabled } from "$lib/stores";
  import BrowseFlipCard from "$lib/ui/components/BrowseFlipCard.svelte";
  import CharacterFilterBar from "$lib/ui/components/CharacterFilterBar.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import {
    filterAndSortCharacters,
    type CharacterSortKey,
    type OwnershipFilter,
  } from "$lib/character-filter";

  let rarityFilter = $state<Set<string>>(new Set());
  let elementFilter = $state<Set<string>>(new Set());
  let weaponFilter = $state<Set<string>>(new Set());
  let ownershipFilter = $state<OwnershipFilter>("all");
  let search = $state("");
  let sortBy = $state<CharacterSortKey>("release_date");
  let sortAsc = $state(false);

  let visible = $derived(
    filterAndSortCharacters($charactersOwned, {
      search,
      rarity: rarityFilter,
      elements: elementFilter,
      weapons: weaponFilter,
      ownership: ownershipFilter,
      sortBy,
      sortAsc,
    }),
  );
</script>

<PageShell class="gap-6 {$animationsEnabled ? '' : 'no-page-anim'}">
  <header class="page-head">
    <h1 class="page-title">Characters</h1>
    <p class="page-hint">View character build guides</p>
  </header>

  <CharacterFilterBar
    bind:search
    bind:rarityFilter
    bind:elementFilter
    bind:weaponFilter
    bind:ownershipFilter
    bind:sortBy
    bind:sortAsc
  />

  <p class="page-meta">{visible.length} shown</p>

  {#if visible.length === 0}
    <EmptyState message="No characters match." />
  {:else}
    <div class="character-grid">
      {#each visible as char (char.name_id)}
        <BrowseFlipCard
          character={char}
          href="/characters/{char.name_id}"
          dimmed={!char.isOwned}
        />
      {/each}
    </div>
  {/if}
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .page-title {
    font-family: var(--font-display);
    font-size: var(--h2-size);
    font-weight: 600;
    letter-spacing: var(--tracking-title);
    text-transform: uppercase;
    color: var(--foreground-color);
  }

  .page-hint {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .page-meta {
    font-size: var(--text-xs);
    color: var(--foreground-mid);
  }

  .character-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-2);
  }

  @media (min-width: 640px) {
    .character-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (min-width: 768px) {
    .character-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }

  @media (min-width: 1024px) {
    .character-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }

  :global(.page-shell.no-page-anim) {
    --sk-animation: none;
    --pulse-animation: none;
  }
</style>

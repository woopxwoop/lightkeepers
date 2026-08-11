<script lang="ts">
  import { untrack } from "svelte";
  import { browser } from "$app/environment";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import {
    charactersOwned,
    charactersHydrated,
    animationsEnabled,
  } from "$lib/stores";
  import BrowseFlipCard from "$lib/ui/components/BrowseFlipCard.svelte";
  import CharacterFilterBar from "$lib/ui/components/CharacterFilterBar.svelte";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import PageTrail from "$lib/ui/components/PageTrail.svelte";
  import EmptyState from "$lib/ui/components/EmptyState.svelte";
  import LoadingState from "$lib/ui/components/LoadingState.svelte";
  import {
    CHARACTER_ELEMENTS,
    CHARACTER_WEAPON_TYPES,
    filterAndSortCharacters,
    type CharacterSortKey,
    type OwnershipFilter,
  } from "$lib/character-filter";
  import {
    nextSearchPath,
    readEnum,
    readList,
    sameSet,
  } from "$lib/query-state";

  const RARITIES = ["4", "5"];
  const OWNERSHIP_KEYS = ["all", "owned", "unowned"] as const;
  const SORT_KEYS = ["release_date", "name", "game_id"] as const;

  /**
   * Whether any filter is actually narrowing the list. Parsed values, not raw
   * params: `?element=Bogus` or `?owned=all` carry no filter, and the write
   * effect strips them anyway.
   */
  function anyFilterActive(
    rarity: string[],
    elements: string[],
    weapons: string[],
    owned: OwnershipFilter,
  ): boolean {
    return (
      rarity.length > 0 ||
      elements.length > 0 ||
      weapons.length > 0 ||
      owned !== "all"
    );
  }

  const initialRarity = readList(page.url, "rarity", RARITIES);
  const initialElements = readList(page.url, "element", CHARACTER_ELEMENTS);
  const initialWeapons = readList(page.url, "weapon", CHARACTER_WEAPON_TYPES);
  const initialOwned = readEnum(page.url, "owned", OWNERSHIP_KEYS, "all");

  let rarityFilter = $state(new Set(initialRarity));
  let elementFilter = $state(new Set(initialElements));
  let weaponFilter = $state(new Set(initialWeapons));
  let ownershipFilter = $state<OwnershipFilter>(initialOwned);
  let search = $state(page.url.searchParams.get("q") ?? "");
  let sortBy = $state<CharacterSortKey>(
    readEnum(page.url, "sort", SORT_KEYS, "release_date"),
  );
  let sortAsc = $state(page.url.searchParams.get("dir") === "asc");
  let filtersOpen = $state(
    anyFilterActive(
      initialRarity,
      initialElements,
      initialWeapons,
      initialOwned,
    ),
  );

  /**
   * A link to this same route (e.g. the nav bar while filters are applied)
   * reuses this component, so the URL can change under seeded state. Rebuild
   * from the URL, untracked so typing can't re-trigger this, and declared
   * before the write effect so stale values are never mirrored back.
   *
   * Only real differences are assigned: the write path trims `q` and drops
   * defaults, and reassigning those would fight the search input.
   */
  $effect(() => {
    const url = page.url;
    untrack(() => {
      const rarity = readList(url, "rarity", RARITIES);
      if (!sameSet(rarityFilter, rarity)) rarityFilter = new Set(rarity);

      const elements = readList(url, "element", CHARACTER_ELEMENTS);
      if (!sameSet(elementFilter, elements)) elementFilter = new Set(elements);

      const weapons = readList(url, "weapon", CHARACTER_WEAPON_TYPES);
      if (!sameSet(weaponFilter, weapons)) weaponFilter = new Set(weapons);

      const owned = readEnum(url, "owned", OWNERSHIP_KEYS, "all");
      if (owned !== ownershipFilter) ownershipFilter = owned;

      const hasFilters = anyFilterActive(rarity, elements, weapons, owned);
      if (hasFilters !== filtersOpen) filtersOpen = hasFilters;

      const q = url.searchParams.get("q") ?? "";
      if (q !== search.trim()) search = q;

      const sort = readEnum(url, "sort", SORT_KEYS, "release_date");
      if (sort !== sortBy) sortBy = sort;

      const asc = url.searchParams.get("dir") === "asc";
      if (asc !== sortAsc) sortAsc = asc;
    });
  });

  $effect(() => {
    if (!browser) return;

    const next = nextSearchPath(page.url, {
      q: search.trim(),
      rarity: [...rarityFilter].sort(),
      element: [...elementFilter].sort(),
      weapon: [...weaponFilter].sort(),
      owned: ownershipFilter === "all" ? null : ownershipFilter,
      sort: sortBy === "release_date" ? null : sortBy,
      dir: sortAsc ? "asc" : null,
    });
    if (next) replaceState(next, page.state);
  });

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
    <PageTrail items={[{ label: "Characters" }]} />
    <h1 class="page-title">Characters</h1>
    <p class="page-meta">View character build guides</p>
  </header>

  {#if !$charactersHydrated}
    <LoadingState message="Loading characters…" />
  {:else}
    <CharacterFilterBar
      bind:search
      bind:rarityFilter
      bind:elementFilter
      bind:weaponFilter
      bind:ownershipFilter
      bind:sortBy
      bind:sortAsc
      bind:filtersOpen
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
  {/if}
</PageShell>

<style>
  .page-head {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
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

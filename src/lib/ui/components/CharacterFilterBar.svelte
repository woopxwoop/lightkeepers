<script lang="ts">
  import { slide } from "svelte/transition";
  import { ELEMENT_COLORS } from "$lib/element-colors";
  import {
    CHARACTER_ELEMENTS,
    CHARACTER_WEAPON_TYPES,
    characterFiltersActive,
    toggleFilterSet,
    type CharacterSortKey,
    type OwnershipFilter,
  } from "$lib/character-filter";
  import IconFilter from "$lib/ui/icons/IconFilter.svelte";
  import IconChevronDown from "$lib/ui/icons/IconChevronDown.svelte";
  import Select from "$lib/ui/components/Select.svelte";

  const SORT_OPTIONS = [
    { value: "name", label: "Alphabetical" },
    { value: "release_date", label: "Release Date" },
    { value: "game_id", label: "Game ID" },
  ] as const;

  let {
    search = $bindable(""),
    rarityFilter = $bindable(new Set<string>()),
    elementFilter = $bindable(new Set<string>()),
    weaponFilter = $bindable(new Set<string>()),
    ownershipFilter = $bindable("all" as OwnershipFilter),
    sortBy = $bindable("name" as CharacterSortKey),
    sortAsc = $bindable(true),
    filtersOpen = $bindable(false),
    showSearch = true,
    showSort = true,
    class: className = "",
  }: {
    search?: string;
    rarityFilter?: Set<string>;
    elementFilter?: Set<string>;
    weaponFilter?: Set<string>;
    ownershipFilter?: OwnershipFilter;
    sortBy?: CharacterSortKey;
    sortAsc?: boolean;
    filtersOpen?: boolean;
    /** When false, omit the search field (pick modal keeps its own). */
    showSearch?: boolean;
    /** When false, omit sort controls. */
    showSort?: boolean;
    class?: string;
  } = $props();

  let isFiltered = $derived(
    characterFiltersActive({
      rarity: rarityFilter,
      elements: elementFilter,
      weapons: weaponFilter,
      ownership: ownershipFilter,
    }),
  );

  function toggleOwnership(value: "owned" | "unowned") {
    ownershipFilter = ownershipFilter === value ? "all" : value;
  }
</script>

<div class="filter-bar {className}">
  <div class="toolbar">
    {#if showSearch}
      <input
        type="search"
        placeholder="Search…"
        bind:value={search}
        class="search-input"
        aria-label="Search characters"
      />
    {/if}
    <button
      type="button"
      class="tool-btn"
      class:active={filtersOpen || isFiltered}
      onclick={() => (filtersOpen = !filtersOpen)}
      aria-expanded={filtersOpen}
    >
      <IconFilter size={14} />
      Filters
    </button>
    {#if showSort}
      <Select
        options={[...SORT_OPTIONS]}
        bind:value={sortBy}
        trigger="Sort"
        aria-label="Sort by"
      />
      <button
        type="button"
        class="tool-btn"
        onclick={() => (sortAsc = !sortAsc)}
        aria-label={sortAsc ? "Ascending" : "Descending"}
        title={sortAsc ? "Ascending" : "Descending"}
      >
        <span class:chevron-flip={sortAsc}>
          <IconChevronDown size={12} strokeWidth={2.5} />
        </span>
      </button>
    {/if}
  </div>

  {#if filtersOpen}
    <div class="filters-panel" transition:slide={{ duration: 180 }}>
      <div class="chip-row">
        {#each CHARACTER_ELEMENTS as el}
          <button
            type="button"
            class="chip"
            class:chip-active={elementFilter.has(el)}
            style={elementFilter.has(el)
              ? `border-color: ${ELEMENT_COLORS[el]}; color: ${ELEMENT_COLORS[el]};`
              : ""}
            onclick={() => (elementFilter = toggleFilterSet(elementFilter, el))}
            >{el}</button
          >
        {/each}
      </div>
      <div class="chip-row">
        {#each CHARACTER_WEAPON_TYPES as wt}
          <button
            type="button"
            class="chip"
            class:chip-active={weaponFilter.has(wt)}
            onclick={() => (weaponFilter = toggleFilterSet(weaponFilter, wt))}
            >{wt}</button
          >
        {/each}
      </div>
      <div class="chip-row">
        <button
          type="button"
          class="chip"
          class:chip-active={rarityFilter.has("5")}
          onclick={() => (rarityFilter = toggleFilterSet(rarityFilter, "5"))}
          >5★</button
        >
        <button
          type="button"
          class="chip"
          class:chip-active={rarityFilter.has("4")}
          onclick={() => (rarityFilter = toggleFilterSet(rarityFilter, "4"))}
          >4★</button
        >
        <button
          type="button"
          class="chip"
          class:chip-active={ownershipFilter === "owned"}
          onclick={() => toggleOwnership("owned")}>Owned</button
        >
        <button
          type="button"
          class="chip"
          class:chip-active={ownershipFilter === "unowned"}
          onclick={() => toggleOwnership("unowned")}>Unowned</button
        >
      </div>
    </div>
  {/if}
</div>

<style>
  .filter-bar {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .search-input {
    flex: 1;
    min-width: 10rem;
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--foreground-color);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    outline: none;
  }

  .search-input::placeholder {
    color: var(--foreground-mid);
  }

  .search-input:focus {
    border-color: rgba(255, 255, 255, 0.32);
  }

  .tool-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .tool-btn:hover,
  .tool-btn.active {
    color: var(--foreground-color);
    border-color: rgba(255, 255, 255, 0.32);
    background: var(--surface-quiet);
  }

  .chevron-flip {
    display: inline-flex;
    transform: rotate(180deg);
  }

  .filters-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .chip {
    padding: 0.25rem 0.55rem;
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .chip:hover {
    color: var(--foreground-color);
    border-color: rgba(255, 255, 255, 0.32);
  }

  .chip-active {
    color: var(--foreground-color);
    border-color: rgba(255, 255, 255, 0.4);
    background: var(--surface-quiet);
  }
</style>

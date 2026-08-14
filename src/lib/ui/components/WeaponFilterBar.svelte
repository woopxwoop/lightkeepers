<script lang="ts">
  import { slide } from "svelte/transition";
  import { toggleFilterSet } from "$lib/character-filter";
  import { WEAPON_FILTER_TYPES, weaponFiltersActive } from "$lib/weapon-filter";
  import IconFilter from "$lib/ui/icons/IconFilter.svelte";

  let {
    rarityFilter = $bindable(new Set<string>()),
    typeFilter = $bindable(new Set<string>()),
    filtersOpen = $bindable(false),
    class: className = "",
  }: {
    rarityFilter?: Set<string>;
    typeFilter?: Set<string>;
    filtersOpen?: boolean;
    class?: string;
  } = $props();

  let isFiltered = $derived(
    weaponFiltersActive({ rarity: rarityFilter, types: typeFilter }),
  );
</script>

<div class="filter-bar {className}">
  <div class="toolbar">
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
  </div>

  {#if filtersOpen}
    <div class="filters-panel" transition:slide={{ duration: 180 }}>
      <div class="chip-row">
        {#each WEAPON_FILTER_TYPES as wt}
          <button
            type="button"
            class="chip"
            class:chip-active={typeFilter.has(wt)}
            aria-pressed={typeFilter.has(wt)}
            onclick={() => (typeFilter = toggleFilterSet(typeFilter, wt))}
            >{wt}</button
          >
        {/each}
      </div>
      <div class="chip-row">
        <button
          type="button"
          class="chip"
          class:chip-active={rarityFilter.has("5")}
          aria-pressed={rarityFilter.has("5")}
          onclick={() => (rarityFilter = toggleFilterSet(rarityFilter, "5"))}
          >5★</button
        >
        <button
          type="button"
          class="chip"
          class:chip-active={rarityFilter.has("4")}
          aria-pressed={rarityFilter.has("4")}
          onclick={() => (rarityFilter = toggleFilterSet(rarityFilter, "4"))}
          >4★</button
        >
        <button
          type="button"
          class="chip"
          class:chip-active={rarityFilter.has("3")}
          aria-pressed={rarityFilter.has("3")}
          onclick={() => (rarityFilter = toggleFilterSet(rarityFilter, "3"))}
          >3★</button
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

  .filters-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    background: var(--surface-quiet);
    border: var(--border-width) solid rgba(255, 255, 255, 0.1);
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .chip {
    padding: 0.28rem 0.6rem;
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
    color: var(--foreground-mid);
    background: transparent;
    border: var(--border-width) solid rgba(255, 255, 255, 0.18);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .chip:hover {
    color: var(--foreground-color);
    border-color: rgba(255, 255, 255, 0.32);
  }

  .chip-active {
    color: var(--foreground-color);
    border-color: rgba(255, 255, 255, 0.45);
    background: color-mix(in srgb, var(--foreground-color) 10%, transparent);
  }
</style>

<script module lang="ts">
  export type PickModalOption = {
    value: string;
    label: string;
  };
</script>

<script lang="ts">
  /**
   * Large pick dialog — search + dense tile grid.
   * Used by Planner / itinerary (+ Character / + Weapon) and demos.
   */
  import type { Snippet } from "svelte";
  import ModalSheet from "#lib/ui/components/ModalSheet.svelte";

  let {
    open = false,
    title,
    searchPlaceholder = "Search…",
    options = [] as PickModalOption[],
    query = $bindable(""),
    art = "portrait",
    showNames = true,
    onClose,
    onChoose,
    tile,
    toolbar,
    filters,
  }: {
    open?: boolean;
    title: string;
    searchPlaceholder?: string;
    options?: PickModalOption[];
    query?: string;
    /** Portrait (3:4) for characters; square for weapon icons. */
    art?: "portrait" | "square";
    showNames?: boolean;
    onClose: () => void;
    onChoose: (value: string) => void;
    /** Leading art for each option (portrait, weapon icon, …). */
    tile: Snippet<[PickModalOption]>;
    /** Optional controls beside the title (filters, toggles). */
    toolbar?: Snippet;
    /** Optional chip filters between search and the grid. */
    filters?: Snippet;
  } = $props();

  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  });
</script>

<ModalSheet
  {open}
  onclose={onClose}
  label={title}
  nested
  initialFocus=".pick-search"
  size="sheet"
>
  {#snippet head()}
    <h2 class="section-title pick-title">{title}</h2>
    {#if toolbar}
      <div class="pick-toolbar">
        {@render toolbar()}
      </div>
    {/if}
  {/snippet}

  <input
    class="pick-search"
    type="search"
    bind:value={query}
    placeholder={searchPlaceholder}
    aria-label={searchPlaceholder}
  />

  {#if filters}
    <div class="pick-filters">
      {@render filters()}
    </div>
  {/if}

  <div class="pick-grid" data-art={art}>
    {#each filtered as opt (opt.value)}
      <button
        type="button"
        class="pick-tile"
        title={opt.label}
        onclick={() => onChoose(opt.value)}
      >
        <span class="pick-tile-art">
          {@render tile(opt)}
          {#if showNames}
            <span class="pick-tile-name">{opt.label}</span>
          {/if}
        </span>
      </button>
    {:else}
      <p class="section-lede pick-empty">No matches.</p>
    {/each}
  </div>
</ModalSheet>

<style>
  .pick-title {
    margin: 0;
    flex: 1;
    min-width: 0;
  }

  .pick-toolbar {
    flex-shrink: 0;
  }

  .pick-search {
    flex-shrink: 0;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
    background: var(--background-mid);
    color: var(--foreground-color);
    font-size: var(--text-sm);
  }

  .pick-search:focus {
    outline: none;
    border-color: var(--accent-1);
    box-shadow: 0 0 0 1px var(--accent-1);
  }

  .pick-filters {
    flex-shrink: 0;
  }

  .pick-grid {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
    gap: 0.5rem;
    align-content: start;
    padding: 0.05rem 0.15rem 0.2rem 0;
  }

  .pick-grid[data-art="square"] {
    grid-template-columns: repeat(auto-fill, minmax(5.75rem, 1fr));
  }

  .pick-tile {
    display: block;
    padding: 0;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    min-width: 0;
  }

  .pick-tile-art {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 3 / 4;
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--background-mid);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 9%, transparent);
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease;
  }

  .pick-grid[data-art="square"] .pick-tile-art {
    aspect-ratio: 1;
  }

  .pick-tile:hover .pick-tile-art,
  .pick-tile:focus-visible .pick-tile-art {
    border-color: var(--accent-1);
    box-shadow: 0 0 0 1px var(--accent-1);
  }

  .pick-tile:focus-visible {
    outline: none;
  }

  .pick-tile-art :global(.char-card),
  .pick-tile-art :global(.weapon-tile) {
    width: 100%;
    height: 100%;
    border-radius: 0;
    pointer-events: none;
    box-shadow: none !important;
  }

  .pick-tile-art :global(.char-card::after) {
    display: none;
  }

  /* Leave CharacterIcon crop/zoom alone — do not force object-fit: cover. */
  .pick-tile-art :global(.weapon-tile img) {
    width: 100%;
    height: 100%;
    object-fit: contain;
    padding: 14%;
    box-sizing: border-box;
    display: block;
  }

  .pick-tile-name {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 2;
    padding: 0.35rem 0.4rem;
    background: rgba(2, 6, 11, 0.82);
    color: var(--foreground-color);
    font-size: var(--text-xs);
    line-height: 1.2;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pick-empty {
    grid-column: 1 / -1;
    margin: 0.75rem 0 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .pick-tile-art {
      transition: none;
    }
  }
</style>

<script module lang="ts">
  export type PickModalOption = {
    value: string;
    label: string;
  };
</script>

<script lang="ts">
  /**
   * Full-viewport pick dialog — search + dense tile grid.
   * Used by Planner (+ Character / + Weapon) and demos.
   */
  import type { Snippet } from "svelte";
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import IconX from "$lib/ui/icons/IconX.svelte";

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
  } = $props();

  let searchEl: HTMLInputElement | null = $state(null);

  let filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  });

  $effect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    void tick().then(() => searchEl?.focus());
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  });

  const motion = $derived(prefersReducedMotion.current ? 0 : undefined);
</script>

{#if open}
  <div class="pick-root" data-art={art}>
    <button
      type="button"
      class="pick-backdrop"
      tabindex="-1"
      aria-label="Close"
      onclick={onClose}
      transition:fade={{ duration: motion ?? 160 }}
    ></button>
    <div
      class="pick-panel"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      transition:scale={{ duration: motion ?? 200, start: 0.98 }}
    >
      <header class="pick-head">
        <h2 class="section-title pick-title">{title}</h2>
        <button
          type="button"
          class="pick-close"
          onclick={onClose}
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
      </header>

      <input
        class="pick-search"
        type="search"
        bind:this={searchEl}
        bind:value={query}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
      />

      <div class="pick-grid">
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
    </div>
  </div>
{/if}

<style>
  .pick-root {
    /* Above NavBar (z-100) so the panel isn’t clipped by the fixed nav. */
    position: fixed;
    inset: 0;
    z-index: 120;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .pick-backdrop {
    position: absolute;
    inset: 0;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    background: color-mix(in oklab, black 62%, transparent);
    backdrop-filter: blur(4px);
    pointer-events: auto;
  }

  .pick-panel {
    position: relative;
    z-index: 1;
    width: min(90vw, 64rem);
    height: min(88vh, 48rem);
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 0.75rem 0.85rem 0.85rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--background-color);
    box-shadow: 0 22px 56px color-mix(in oklab, black 50%, transparent);
    pointer-events: auto;
  }

  .pick-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .pick-title {
    margin: 0;
  }

  .pick-close {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
  }

  .pick-close:hover {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 26%, transparent);
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

  .pick-grid {
    flex: 1;
    min-height: 0;
    overflow: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr));
    gap: 0.5rem;
    align-content: start;
    padding: 0.05rem 0.15rem 0.2rem 0;
    scrollbar-width: thin;
    scrollbar-color: color-mix(
        in srgb,
        var(--foreground-color) 22%,
        transparent
      )
      transparent;
  }

  .pick-grid::-webkit-scrollbar {
    width: 0.55rem;
  }

  .pick-grid::-webkit-scrollbar-track {
    background: transparent;
  }

  .pick-grid::-webkit-scrollbar-thumb {
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .pick-grid::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--foreground-color) 36%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .pick-root[data-art="square"] .pick-grid {
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

  .pick-root[data-art="square"] .pick-tile-art {
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

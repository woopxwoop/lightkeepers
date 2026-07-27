<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Character, CharacterOwned } from "$lib/definitions";
  import CharacterIcon from "$lib/ui/components/CharacterIcon.svelte";
  import { elementBg, elementColor } from "$lib/element-colors";

  let {
    character,
    href,
    onclick,
    pressed = false,
    dimmed = false,
    tintBackground = false,
    class: className = "",
    title,
    badge,
    meta,
    children,
  }: {
    character: CharacterOwned | Character | undefined;
    /** When set, the card renders as a link. */
    href?: string;
    /** When set (and no href), the card renders as a toggle button. */
    onclick?: (e: MouseEvent) => void;
    /** Selection / owned pressed state for button mode. */
    pressed?: boolean;
    /** Dim overlay (unowned / unavailable). */
    dimmed?: boolean;
    /** Soft element-tinted tile background (teams list/detail). */
    tintBackground?: boolean;
    class?: string;
    title?: string;
    /** Top-right badge (NEW, ★, etc.). */
    badge?: Snippet;
    /** Bottom overlay content (name, C/R, rarity line). */
    meta?: Snippet;
    children?: Snippet;
  } = $props();

  let shine = $derived(elementColor(character?.element, "transparent"));
  let bg = $derived(
    tintBackground ? elementBg(character?.element) : "var(--background-color)",
  );
  let tip = $derived(title ?? character?.name ?? "");
  let shellClass = $derived(
    `char-card relative overflow-hidden ${className}`.trim(),
  );
</script>

{#snippet body()}
  {@render badge?.()}

  <div class="portrait">
    {#if character}
      <CharacterIcon {character} loading="lazy" />
    {:else}
      {@render children?.()}
    {/if}
  </div>

  {#if meta}
    <div class="overlay absolute bottom-0 left-0 right-0 z-10">
      {@render meta()}
    </div>
  {/if}

  {#if dimmed}
    <div class="dim absolute inset-0 z-[5]"></div>
  {/if}
{/snippet}

{#if href}
  <a
    {href}
    class="{shellClass} no-underline"
    style="--shine: {shine}; background: {bg};"
    title={tip || undefined}
  >
    {@render body()}
  </a>
{:else if onclick}
  <button
    type="button"
    class={shellClass}
    class:is-pressed={pressed}
    style="--shine: {shine}; background: {bg};"
    title={tip || undefined}
    aria-pressed={pressed}
    {onclick}
  >
    {@render body()}
  </button>
{:else}
  <div
    class={shellClass}
    style="--shine: {shine}; background: {bg};"
    title={tip || undefined}
  >
    {@render body()}
  </div>
{/if}

<style>
  .char-card {
    aspect-ratio: 3 / 4;
    border-radius: var(--radius-md);
    display: block;
    width: 100%;
    padding: 0;
    border: none;
    text-align: left;
    cursor: inherit;
    /* Transform + opacity only — don't tween box-shadow (paint). */
    transition:
      transform 0.2s ease,
      outline-color var(--control-duration) var(--control-ease);
  }

  button.char-card {
    cursor: pointer;
  }

  button.char-card.is-pressed {
    outline: var(--border-width) solid rgba(255, 255, 255, 0.4);
    outline-offset: -1px;
  }

  .char-card::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: radial-gradient(
      ellipse 100% 70% at 50% 60%,
      var(--shine) 0%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity 0.35s ease;
    pointer-events: none;
    z-index: 10;
  }

  .char-card:hover {
    box-shadow: 0 0 28px 4px color-mix(in srgb, var(--shine) 28%, transparent);
    will-change: transform;
    z-index: 5;
  }

  .char-card:hover::after {
    opacity: 0.3;
  }

  .portrait {
    width: 100%;
    height: 100%;
  }

  .portrait :global(img) {
    display: block;
  }

  .overlay {
    padding: 1.5rem 0.375rem 0.375rem;
    background: linear-gradient(
      to top,
      rgba(2, 6, 11, 0.92) 0%,
      rgba(2, 6, 11, 0.55) 55%,
      transparent 100%
    );
  }

  .dim {
    background: rgba(2, 6, 11, 0.55);
  }
</style>

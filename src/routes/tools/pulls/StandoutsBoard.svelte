<script lang="ts">
  import { onDestroy } from "svelte";
  import { get } from "svelte/store";
  import { animationsEnabled } from "#lib/stores/preferences.js";
  import { usagePct } from "#lib/boards/pull-view.js";
  import type { TierListEntry } from "#lib/boards/tierlist.js";
  import type { Character } from "#lib/definitions.js";
  import WishSlot from "#lib/ui/components/WishSlot.svelte";
  import EmptyState from "#lib/ui/components/EmptyState.svelte";
  import IconChevronDown from "#lib/ui/icons/IconChevronDown.svelte";

  let {
    id,
    label,
    entries,
    mapping,
    ownedIds,
  }: {
    id: string;
    label: string;
    entries: TierListEntry[];
    mapping: Map<string, Character>;
    ownedIds: Set<string>;
  } = $props();

  const STANDOUT_DEAL_MS = 180;
  const STANDOUT_STAGGER_MS = 35;

  let expanded = $state(false);
  let collapsing = $state(false);
  let collapseTimer: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    if (collapseTimer) clearTimeout(collapseTimer);
    collapseTimer = undefined;
  });

  let shown = $derived(expanded || collapsing);
  let restCount = $derived(Math.max(0, entries.length - 1));

  function toggle(count = 1) {
    if (collapsing) return;

    if (expanded) {
      collapsing = true;

      if (collapseTimer) clearTimeout(collapseTimer);

      const wait = !get(animationsEnabled)
        ? 1
        : STANDOUT_DEAL_MS + Math.max(0, count - 1) * STANDOUT_STAGGER_MS;
      collapseTimer = setTimeout(() => {
        collapseTimer = undefined;
        expanded = false;
        collapsing = false;
      }, wait);
      return;
    }

    expanded = true;
  }
</script>

<div class="standouts">
  <p class="eyebrow standouts-status">Most used {label}</p>
  {#if entries.length === 0}
    <EmptyState message="No standouts on this board yet." />
  {:else}
    <div
      class="standouts-deck"
      class:open={shown}
      class:collapsing
      id="standouts-deck-{id}"
      style="--n: {entries.length};"
    >
      <ol class="standouts-deck-list">
        {#each entries as entry, i (entry.nameId)}
          {@const owned = ownedIds.has(entry.nameId)}
          {@const character = mapping.get(entry.nameId)}
          <li
            class="standout"
            style="--i: {i};"
            aria-hidden={!shown && i > 0 ? true : undefined}
            aria-label="{entry.name}, {usagePct(entry)} average usage"
            title="{entry.name} · {usagePct(entry)} avg usage"
          >
            <WishSlot
              nameId={entry.nameId}
              name={entry.name}
              rarity={character?.rarity ?? 5}
              dimmed={!owned}
              loading={i === 0 ? "eager" : "lazy"}
              onclick={!shown && i === 0 && restCount > 0
                ? () => toggle(entries.length)
                : undefined}
              cue={!shown && i === 0 && restCount > 0 ? "Expand" : undefined}
            />
          </li>
        {/each}
        {#if restCount > 0}
          <li class="standout-toggle-cell">
            <button
              type="button"
              class="eyebrow standouts-toggle"
              aria-expanded={shown}
              aria-controls="standouts-deck-{id}"
              disabled={collapsing}
              onclick={() => toggle(entries.length)}
            >
              <span class="standouts-toggle-label">
                {shown ? "Collapse" : "Expand"}
              </span>
              <span class="standouts-toggle-chevron" class:open={shown}>
                <IconChevronDown size={18} strokeWidth={2.25} />
              </span>
            </button>
          </li>
        {/if}
      </ol>
    </div>
  {/if}
</div>

<style>
  .standouts {
    --standout-w: clamp(4.75rem, 18vw, 5.5rem);
    --standout-gap-x: 0.55rem;
    --standout-gap-y: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .standouts-status {
    font-weight: 500;
  }

  .standouts-deck {
    --deal-stagger: 85ms;
    --deal-duration: 480ms;
    /* Keep stacked WishSlot z-index local so it can't climb over the nav. */
    isolation: isolate;
    min-width: 0;
  }

  .standouts-deck-list {
    display: grid;
    margin: 0;
    padding: 0.35rem 0.15rem 0.5rem;
    list-style: none;
    align-items: center;
  }

  /* Collapsed: stack in col 1, expand control tucked beside the lead. */
  .standouts-deck:not(.open) .standouts-deck-list {
    width: fit-content;
    grid-template-columns: var(--standout-w) auto;
    column-gap: 0.35rem;
    min-height: calc(var(--standout-w) * 16 / 5 + 12px);
  }

  .standouts-deck:not(.open) .standout {
    grid-area: 1 / 1;
    width: var(--standout-w);
    transform: translate(
      calc(min(var(--i), 4) * 3px),
      calc(min(var(--i), 4) * 3px)
    );
    z-index: calc(5 - var(--i));
    animation: none;
    transition: none;
  }

  .standouts-deck:not(.open) .standout:first-child {
    z-index: 6;
    opacity: 1;
  }

  .standouts-deck:not(.open) .standout:not(:first-child) {
    pointer-events: none;
  }

  .standouts-deck:not(.open) .standout:nth-child(n + 6) {
    opacity: 0;
  }

  .standouts-deck:not(.open) .standout-toggle-cell {
    grid-area: 1 / 2;
    align-self: center;
    justify-self: start;
  }

  /* Expanded (and mid-collapse): flow right/down. */
  .standouts-deck.open .standouts-deck-list {
    grid-template-columns: repeat(auto-fill, minmax(var(--standout-w), 1fr));
    gap: var(--standout-gap-y) var(--standout-gap-x);
  }

  .standouts-deck.open .standout {
    position: relative;
    z-index: 1;
    width: auto;
    pointer-events: auto;
    transition: none;
  }

  .standouts-deck.open .standout:first-child {
    transform: none;
    opacity: 1;
    animation: none;
  }

  .standouts-deck.open:not(.collapsing) .standout:not(:first-child) {
    /* `both` keeps opacity 0 during the stagger delay so layout teleports stay hidden. */
    animation: standout-deal var(--deal-duration) cubic-bezier(0.22, 1, 0.36, 1)
      both;
    animation-delay: calc(var(--i) * var(--deal-stagger));
  }

  /* Collapse: keep the grid, pack last → first, then drop to the stack. */
  .standouts-deck.open.collapsing {
    --deal-stagger: 35ms;
    --deal-duration: 180ms;
  }

  .standouts-deck.open.collapsing .standout:not(:first-child) {
    pointer-events: none;
    animation: standout-pack var(--deal-duration) cubic-bezier(0.22, 1, 0.36, 1)
      both;
    animation-delay: calc((var(--n) - 1 - var(--i)) * var(--deal-stagger));
  }

  @keyframes standout-deal {
    from {
      opacity: 0;
      transform: translate(-0.85rem, -0.55rem) scale(0.94);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes standout-pack {
    from {
      opacity: 1;
      transform: none;
    }
    to {
      opacity: 0;
      transform: translate(-0.85rem, -0.55rem) scale(0.94);
    }
  }

  .standout-toggle-cell {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    min-width: 0;
  }

  .standouts-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    padding: 0.55rem 0.85rem;
    color: var(--foreground-mid);
    background: transparent;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: var(--control-transition);
  }

  .standouts-toggle:disabled {
    opacity: 0.55;
    cursor: wait;
  }

  .standouts-toggle:hover:not(:disabled) {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .standouts-toggle-label {
    line-height: 1;
  }

  .standouts-toggle-chevron {
    display: inline-flex;
    transform: rotate(-90deg);
    transition: transform 220ms ease;
  }

  .standouts-toggle-chevron.open {
    transform: rotate(90deg);
  }

  .standout {
    min-width: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .standouts-deck {
      --deal-stagger: 0ms;
      --deal-duration: 1ms;
    }

    .standouts-deck .standout {
      transition: none;
      animation: none !important;
    }

    .standouts-deck.open .standout:not(:first-child) {
      opacity: 1;
      transform: none;
    }

    .standouts-toggle-chevron {
      transition: none;
    }
  }

  @media (max-width: 640px) {
    .standouts {
      --standout-w: clamp(3.85rem, 22vw, 4.75rem);
      --standout-gap-x: 0.35rem;
      --standout-gap-y: 0.65rem;
    }
  }
</style>

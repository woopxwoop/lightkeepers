<script lang="ts">
  /**
   * Multi-select which planner goals feed the farming itinerary.
   * Nested above the itinerary sheet (z-130).
   */
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import { assetUrl } from "$lib/asset-urls";
  import { getCharacterPortrait } from "$lib/utils";
  import { itineraryGoalLabel } from "$lib/planner-itinerary";
  import type { CalculatorGoal } from "$lib/types/calculator-goals";
  import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";

  let {
    open = false,
    goals = [] as CalculatorGoal[],
    focusIds,
    catalog = null,
    onClose,
    onToggle,
    onSelectAll,
    onSelectNone,
  }: {
    open?: boolean;
    goals?: CalculatorGoal[];
    focusIds: Set<string>;
    catalog?: UpgradeCostsCatalog | null;
    onClose: () => void;
    onToggle: (id: string) => void;
    onSelectAll: () => void;
    onSelectNone: () => void;
  } = $props();

  let panelEl: HTMLDivElement | null = $state(null);
  const motion = $derived(prefersReducedMotion.current ? 0 : undefined);

  $effect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    let active = true;
    void tick().then(() => {
      if (!active || !open) return;
      panelEl?.querySelector<HTMLElement>(".goals-close")?.focus();
    });
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (panelEl) trapTabKey(event, panelEl);
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      active = false;
      window.removeEventListener("keydown", onKey, true);
      if (previous?.isConnected) previous.focus();
    };
  });

  function goalIcon(goal: CalculatorGoal): string | null {
    if (goal.kind === "character") return getCharacterPortrait(goal.name_id);
    const icon = catalog?.weapons.find((w) => w.id === goal.weapon_id)?.icon;
    return assetUrl(icon ?? null);
  }
</script>

{#if open}
  <div class="goals-root">
    <button
      type="button"
      class="goals-backdrop"
      tabindex="-1"
      aria-label="Close"
      onclick={onClose}
      transition:fade={{ duration: motion ?? 160 }}
    ></button>
    <div
      class="goals-panel"
      bind:this={panelEl}
      role="dialog"
      aria-modal="true"
      aria-label="Goals"
      tabindex="-1"
      transition:scale={{ duration: motion ?? 200, start: 0.98 }}
    >
      <div class="goals-head">
        <h2 class="section-title">Goals</h2>
        <button
          type="button"
          class="back-link goals-bulk"
          onclick={onSelectAll}
        >
          All
        </button>
        <button
          type="button"
          class="back-link goals-bulk"
          onclick={onSelectNone}
        >
          None
        </button>
        <button
          type="button"
          class="goals-close"
          onclick={onClose}
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
      </div>
      <ul class="goals-list">
        {#each goals as goal (goal.id)}
          {@const icon = goalIcon(goal)}
          <li>
            <button
              type="button"
              class="goal-row"
              class:is-on={focusIds.has(goal.id)}
              aria-pressed={focusIds.has(goal.id)}
              onclick={() => onToggle(goal.id)}
            >
              {#if icon}
                <img
                  class="goal-icon"
                  src={icon}
                  alt=""
                  width="32"
                  height="32"
                  loading="lazy"
                />
              {:else}
                <span class="goal-icon goal-icon-fallback"></span>
              {/if}
              <span class="meta-name">{itineraryGoalLabel(goal, catalog)}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}

<style>
  .goals-root {
    /* Above itinerary sheet (z-120) and NavBar (z-100). */
    position: fixed;
    inset: 0;
    z-index: 130;
    display: grid;
    place-items: center;
    padding: clamp(0.75rem, 2vw, 1.25rem);
    pointer-events: none;
  }

  .goals-backdrop {
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

  .goals-panel {
    position: relative;
    z-index: 1;
    width: min(24rem, 100%);
    max-height: min(32rem, calc(100vh - 2rem));
    overflow: hidden;
    padding: 1rem 1.05rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    border-radius: var(--radius-lg);
    border: var(--border-width) solid rgba(255, 255, 255, 0.22);
    background: var(--background-mid);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    pointer-events: auto;
  }

  .goals-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .goals-head .section-title {
    flex: 1;
    min-width: 0;
    margin: 0;
  }

  .goals-bulk {
    margin: 0;
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font: inherit;
  }

  .goals-close {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    flex-shrink: 0;
  }

  .goals-close:hover {
    color: var(--foreground-color);
    background: var(--surface-quiet);
  }

  .goals-list {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-height: 0;
  }

  .goal-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    padding: 0.35rem 0.5rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid rgba(255, 255, 255, 0.14);
    background: transparent;
    color: var(--foreground-mid);
    cursor: pointer;
    text-align: left;
    transition: var(--control-transition);
  }

  .goal-row.is-on {
    color: var(--foreground-color);
    border-color: var(--accent-1);
    background: var(--surface-selected);
  }

  .goal-row .meta-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .goal-icon {
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .goal-icon-fallback {
    display: block;
    background: var(--surface-quiet);
  }
</style>

<script lang="ts">
  /**
   * Star, add, configure, and delete planner goals for the farming itinerary.
   * Nested above the itinerary sheet (z-130). Draft until Save.
   */
  import { tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { trapTabKey } from "$lib/ui/focus-trap";
  import IconX from "$lib/ui/icons/IconX.svelte";
  import Button from "$lib/ui/components/Button.svelte";
  import GoalList from "$lib/ui/components/GoalList.svelte";
  import type { CalculatorGoal } from "$lib/types/calculator-goals";
  import type { UpgradeCostsCatalog } from "$lib/types/upgrade-costs";

  let {
    open = false,
    goals = [],
    catalog = null,
    dirty = false,
    saving = false,
    saveError = "",
    addError = "",
    removedIds = new Set<string>(),
    suspendKeys = false,
    onClose,
    onStar,
    onReorder,
    onStarAll,
    onStarNone,
    onAddCharacter,
    onAddWeapon,
    onConfigure,
    onRemove,
    onSave,
    onCancel,
  }: {
    open?: boolean;
    goals?: CalculatorGoal[];
    catalog?: UpgradeCostsCatalog | null;
    dirty?: boolean;
    saving?: boolean;
    saveError?: string;
    addError?: string;
    removedIds?: ReadonlySet<string>;
    /** When a nested pick/configure overlay is open, skip Escape / tab trap. */
    suspendKeys?: boolean;
    onClose: () => void;
    onStar: (id: string) => void;
    onReorder: (from: number, to: number) => void;
    onStarAll: () => void;
    onStarNone: () => void;
    onAddCharacter: () => void;
    onAddWeapon: () => void;
    onConfigure: (id: string) => void;
    onRemove: (id: string) => void;
    onSave: () => void;
    onCancel: () => void;
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
      if (suspendKeys) return;
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
          class="goals-close"
          onclick={onClose}
          aria-label="Close"
        >
          <IconX size={18} />
        </button>
      </div>
      <div class="goals-actions">
        <Button
          variant="secondary"
          disabled={!catalog}
          onclick={onAddCharacter}>+ Character</Button
        >
        <Button
          variant="secondary"
          disabled={!catalog}
          onclick={onAddWeapon}>+ Weapon</Button
        >
        <Button variant="secondary" onclick={onStarAll}>Star all</Button>
        <Button variant="secondary" onclick={onStarNone}>Unstar all</Button>
      </div>
      {#if addError}
        <p class="save-error" role="alert">{addError}</p>
      {/if}
      <div class="goals-list">
        {#if goals.length === 0}
          <p class="section-lede">
            Add a character or weapon goal to start planning.
          </p>
        {:else}
          <GoalList
            {goals}
            {catalog}
            {removedIds}
            onStar={onStar}
            {onReorder}
            {onConfigure}
            {onRemove}
          />
        {/if}
      </div>
      {#if dirty || saveError}
        <div class="goals-foot">
          {#if saveError}
            <span class="save-error" role="alert">{saveError}</span>
          {/if}
          {#if dirty}
            <div class="goals-save">
              <Button variant="ghost" disabled={saving} onclick={onCancel}
                >Cancel</Button
              >
              <Button variant="primary" disabled={saving} onclick={onSave}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          {/if}
        </div>
      {/if}
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
    width: min(32rem, 100%);
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

  .goals-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
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
    overflow-y: auto;
    min-height: 0;
    scrollbar-width: thin;
    scrollbar-color: color-mix(
        in srgb,
        var(--foreground-color) 22%,
        transparent
      )
      transparent;
  }

  .goals-list .section-lede {
    margin: 0;
  }

  .goals-list::-webkit-scrollbar {
    width: 0.55rem;
  }

  .goals-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .goals-list::-webkit-scrollbar-thumb {
    border-radius: var(--radius-pill);
    background: color-mix(in srgb, var(--foreground-color) 22%, transparent);
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .goals-list::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--foreground-color) 36%, transparent);
    background-clip: padding-box;
  }

  .goals-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem 0.75rem;
    flex-shrink: 0;
    padding-top: 0.15rem;
  }

  .goals-save {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
  }

  .save-error {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: var(--text-xs);
    color: color-mix(in srgb, #e07070 85%, var(--foreground-color));
  }
</style>

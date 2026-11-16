<script lang="ts">
  import { auditPath } from "#lib/ui/nav-links.js";
  import GoalList from "#lib/ui/components/GoalList.svelte";
  import type { CalculatorGoal } from "#lib/types/calculator-goals.js";
  import type { UpgradeCostsCatalog } from "#lib/types/upgrade-costs.js";

  let {
    goals,
    catalog,
    selectedId,
    removedIds,
    addError,
    addCue,
    onPick,
    onSelect,
    onStar,
    onReorder,
    onConfigure,
    onRemove,
  }: {
    goals: CalculatorGoal[];
    catalog: UpgradeCostsCatalog;
    selectedId: string | null;
    removedIds: ReadonlySet<string>;
    addError: string;
    /** Pulse the add buttons while nothing is selected or being picked. */
    addCue: boolean;
    onPick: (kind: "character" | "weapon") => void;
    onSelect: (id: string) => void;
    onStar: (id: string) => void;
    onReorder: (from: number, to: number) => void;
    onConfigure: (id: string) => void;
    onRemove: (id: string) => void;
  } = $props();
</script>

<aside class="goals-panel">
  <div class="goals-head">
    <h2 class="section-title">Goals</h2>
    <div class="goals-actions">
      <button
        type="button"
        class="ghost-btn"
        class:add-cue={addCue}
        onclick={() => onPick("character")}
      >
        + Character
      </button>
      <button
        type="button"
        class="ghost-btn"
        class:add-cue={addCue}
        onclick={() => onPick("weapon")}
      >
        + Weapon
      </button>
    </div>
  </div>

  {#if addError}
    <p class="save-error">{addError}</p>
  {/if}

  {#if goals.length === 0}
    <p class="section-lede">
      Add a character or weapon goal to start planning costs, or
      <a class="lede-link" href={auditPath}>get suggestions from Build Audit</a
      >.
    </p>
  {:else}
    <GoalList
      {goals}
      {catalog}
      {selectedId}
      {removedIds}
      {onSelect}
      {onStar}
      {onReorder}
      {onConfigure}
      {onRemove}
    />
  {/if}
</aside>

<style>
  .goals-panel {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    min-width: 0;
  }

  .goals-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 0.75rem;
  }

  .goals-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .ghost-btn {
    padding: 0.3rem 0.65rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 18%, transparent);
    background: transparent;
    color: var(--foreground-mid);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
  }

  .ghost-btn:hover {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 28%, transparent);
  }

  .ghost-btn.add-cue {
    color: var(--foreground-color);
    border-color: var(--accent-1);
    animation: add-cue-pulse 1.6s ease-in-out infinite;
  }

  @keyframes add-cue-pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent-1) 0%, transparent);
    }
    50% {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-1) 35%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ghost-btn.add-cue {
      animation: none;
    }
  }

  .lede-link {
    color: var(--foreground-color);
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  .save-error {
    font-size: var(--text-xs);
    color: color-mix(in srgb, #e07070 85%, var(--foreground-color));
  }
</style>

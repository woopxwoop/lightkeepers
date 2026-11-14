<script lang="ts">
  import Select from "#lib/ui/components/Select.svelte";
  import IconChevronDown from "#lib/ui/icons/IconChevronDown.svelte";
  import { handleKeyboardClick, handlePointerAction } from "#lib/ui/pointer.js";
  import {
    STYGIAN_SOLVER_MODE_OPTIONS_RELEASE,
    type StygianSolverMode,
  } from "#lib/definitions.js";

  let {
    count,
    ready,
    safeIndex,
    modeHint,
    solverMode,
    onsolvermode,
    onstep,
  }: {
    /** Displayable solutions. */
    count: number;
    /** Roster / clears settled, so the count and pager apply. */
    ready: boolean;
    safeIndex: number;
    modeHint: string;
    solverMode: StygianSolverMode;
    onsolvermode: (value: StygianSolverMode) => void;
    onstep: (delta: number) => void;
  } = $props();
</script>

<div class="board-head">
  <div class="board-head-left">
    {#if count > 0 && ready}
      <span class="eyebrow board-eyebrow">
        Solution {safeIndex + 1}
        <span class="board-eyebrow-total">of {count}</span>
      </span>
    {:else}
      <span class="eyebrow board-eyebrow">Solutions</span>
    {/if}
    <p class="mode-hint">{modeHint}</p>
  </div>

  <div class="board-actions">
    <Select
      class="solver-mode-select"
      aria-label="Stygian solution source"
      fit="value"
      options={[...STYGIAN_SOLVER_MODE_OPTIONS_RELEASE]}
      bind:value={() => solverMode, onsolvermode}
    />
    {#if count > 1 && ready}
      <div class="pager">
        <button
          type="button"
          class="pager-btn"
          aria-label="Previous solution"
          disabled={safeIndex === 0}
          onpointerdown={(event) =>
            handlePointerAction(event, () => onstep(-1))}
          onclick={(event) => handleKeyboardClick(event, () => onstep(-1))}
        >
          <IconChevronDown size={16} strokeWidth={2.25} />
        </button>
        <button
          type="button"
          class="pager-btn pager-btn-next"
          aria-label="Next solution"
          disabled={safeIndex === count - 1}
          onpointerdown={(event) => handlePointerAction(event, () => onstep(1))}
          onclick={(event) => handleKeyboardClick(event, () => onstep(1))}
        >
          <IconChevronDown size={16} strokeWidth={2.25} />
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .board-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-width) solid var(--border-subtle);
    background: var(--surface-inset);
  }

  @media (max-width: 640px) {
    .board-head {
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-3);
    }
  }

  .board-head-left {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
    min-width: 0;
    flex: 1 1 auto;
  }

  .board-eyebrow {
    color: var(--foreground-color);
    white-space: nowrap;
  }

  .board-eyebrow-total {
    color: var(--foreground-mid);
    font-weight: 500;
  }

  .mode-hint {
    margin: 0;
    max-width: 28rem;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--foreground-mid);
  }

  .board-actions,
  .pager {
    display: flex;
    align-items: center;
  }

  .board-actions {
    gap: var(--space-2);
    flex-shrink: 0;
    min-width: 0;
  }

  @media (max-width: 640px) {
    .board-actions {
      flex: 1 1 auto;
      justify-content: flex-end;
    }

    .board-actions :global(.solver-mode-select) {
      min-width: 0;
      max-width: min(10.5rem, 46vw);
    }

    .board-actions :global(.solver-mode-select .select-trigger) {
      max-width: 100%;
    }
  }

  .pager {
    gap: 0.25rem;
  }

  .pager-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid var(--border-default);
    color: var(--foreground-mid);
    background: var(--surface-raised);
    transition: var(--control-transition);
  }

  .pager-btn :global(svg) {
    transform: rotate(90deg);
  }

  .pager-btn-next :global(svg) {
    transform: rotate(-90deg);
  }

  .pager-btn:hover:not(:disabled) {
    color: var(--accent-1);
    border-color: var(--border-strong);
  }

  .pager-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
</style>

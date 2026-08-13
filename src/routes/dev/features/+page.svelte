<script lang="ts">
  import { STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST } from "$lib/definitions";
  import PageShell from "$lib/ui/components/PageShell.svelte";
  import StygianSolutionBoard from "$lib/ui/components/StygianSolutionBoard.svelte";

  let { data } = $props();
  let mapping = $derived(data.mapping);
  let maxCost = $state(STYGIAN_CHEAP_CLEARS_DEFAULT_MAX_COST);
</script>

<PageShell class="gap-6">
  <header class="page-head">
    <div class="page-head-text">
      <h1 class="page-title">Features</h1>
      <p class="page-meta">
        Stygian board with YSHelper / video-clear seating modes and a cost cap
        for Fearless clears.
      </p>
    </div>
    <label class="cost-cap">
      <span class="cost-cap-label">Max cost</span>
      <input
        class="cost-cap-input"
        type="number"
        min="0"
        max="10000"
        step="1"
        bind:value={maxCost}
      />
    </label>
  </header>

  <StygianSolutionBoard {mapping} {maxCost} variant="dev" />
</PageShell>

<style>
  .page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .cost-cap {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--text-sm);
    color: var(--foreground-mid);
  }

  .cost-cap-label {
    white-space: nowrap;
  }

  .cost-cap-input {
    width: 5.5rem;
    padding: 0.35rem 0.5rem;
    border-radius: var(--radius-md);
    border: var(--border-width) solid
      color-mix(in srgb, var(--foreground-color) 14%, transparent);
    background: var(--background-mid);
    color: var(--foreground-color);
    font: inherit;
    font-variant-numeric: tabular-nums;
  }

  .cost-cap-input:focus {
    outline: none;
    border-color: var(--accent-1);
    box-shadow: 0 0 0 1px var(--accent-1);
  }
</style>

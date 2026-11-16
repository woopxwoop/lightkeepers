<script lang="ts">
  import type { AggregatedUpgradeCosts } from "#lib/types/calculator-goals.js";
  import type { UpgradeCostsCatalog } from "#lib/types/upgrade-costs.js";
  import {
    formatCount,
    type CostScope,
  } from "#lib/planner/planner-cost-view.js";
  import PlannerCostLists from "./PlannerCostLists.svelte";

  let {
    catalog,
    aggregate,
    costScope = $bindable(),
    ranksExpanded = $bindable(),
    goalCount,
    starredCount,
  }: {
    catalog: UpgradeCostsCatalog;
    aggregate: AggregatedUpgradeCosts | null;
    costScope: CostScope;
    ranksExpanded: boolean;
    goalCount: number;
    starredCount: number;
  } = $props();
</script>

<div class="results-panel">
  <div class="results-head">
    <h2 class="section-title">Required</h2>
    <div class="scope-row" role="group" aria-label="Cost scope">
      <button
        type="button"
        class="scope-btn"
        class:active={costScope === "all"}
        aria-pressed={costScope === "all"}
        onclick={() => (costScope = "all")}>All goals</button
      >

      <button
        type="button"
        class="scope-btn"
        class:active={costScope === "selected"}
        aria-pressed={costScope === "selected"}
        onclick={() => (costScope = "selected")}>Selected</button
      >

      <button
        type="button"
        class="scope-btn"
        class:active={costScope === "starred"}
        aria-pressed={costScope === "starred"}
        onclick={() => (costScope = "starred")}>Starred</button
      >
    </div>
  </div>

  {#if costScope === "starred" && starredCount > 0}
    <p class="section-lede">
      Starred goals appear here and on the farming itinerary.
    </p>
  {/if}

  {#if aggregate}
    <ul class="totals">
      <li>
        <span class="meta-sub">Mora</span>
        <span class="meta-name">{formatCount(aggregate.mora)}</span>
      </li>
      {#if aggregate.characterExp > 0}
        <li>
          <span class="meta-sub">Character EXP</span>
          <span class="meta-name">{formatCount(aggregate.characterExp)}</span>
        </li>
      {/if}
      {#if aggregate.weaponExp > 0}
        <li>
          <span class="meta-sub">Weapon EXP</span>
          <span class="meta-name">{formatCount(aggregate.weaponExp)}</span>
        </li>
      {/if}
    </ul>

    <PlannerCostLists
      {catalog}
      {aggregate}
      bind:ranksExpanded
      {goalCount}
      {costScope}
      {starredCount}
    />
  {/if}
</div>

<style>
  .results-panel {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    min-width: 0;
  }

  .results-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 0.75rem;
  }

  .scope-btn {
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

  .scope-btn:hover {
    color: var(--foreground-color);
    border-color: color-mix(in srgb, var(--foreground-color) 28%, transparent);
  }

  .scope-btn.active {
    background: var(--surface-selected);
    color: var(--foreground-color);
    border-color: var(--accent-1);
  }

  .scope-row {
    display: flex;
    gap: 0.35rem;
  }

  .totals {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.35rem 1.25rem;
  }

  .totals li {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.35rem 0;
    border-bottom: 1px solid
      color-mix(in srgb, var(--foreground-color) 12%, transparent);
  }
</style>

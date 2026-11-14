<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    simMissing,
    children,
  }: {
    title: string;
    /** Guide-sourced section with no simulation behind it yet. */
    simMissing: boolean;
    children: Snippet;
  } = $props();
</script>

<section class="board-section">
  <h2 class="section-title">
    {title}
    {#if simMissing}
      <span class="meta-sub">(no simulation data yet)</span>
    {/if}
  </h2>
  <ul class="talent-priority-list">
    {@render children()}
  </ul>
</section>

<style>
  .talent-priority-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .talent-priority-list :global(.talent-priority-row + .talent-priority-row) {
    border-top: var(--border-width) solid rgba(255, 255, 255, 0.1);
  }
</style>

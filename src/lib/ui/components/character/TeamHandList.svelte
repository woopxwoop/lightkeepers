<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<ol class="team-hands">
  {@render children()}
</ol>

<style>
  .team-hands {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  @media (min-width: 1024px) {
    .team-hands {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: var(--space-6);
      row-gap: var(--space-5);
    }
  }

  .team-hands :global(.team-hand-row) {
    position: relative;
    z-index: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
    min-width: 0;
  }

  .team-hands :global(.team-hand-row:hover),
  .team-hands :global(.team-hand-row:focus-within) {
    z-index: 5;
  }

  .team-hands :global(.team-hand-row .hand) {
    --card-width: min(7.25rem, 25%);
    width: 100%;
  }

  .team-hands :global(.team-hand-row .hand-flat) {
    justify-content: flex-start;
    align-items: flex-end;
    padding: 0.35rem 0 0;
    overflow: hidden;
  }

  @media (min-width: 1024px) {
    .team-hands :global(.team-hand-row .hand) {
      --card-width: min(6.5rem, 25%);
    }
  }

  .team-hands :global(.team-hand-footer) {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: flex-start;
    gap: var(--space-2) var(--space-3);
    min-height: 1.25rem;
    padding: 0;
  }

  .team-hands :global(.team-hand-meta) {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4rem;
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
    color: var(--foreground-mid);
  }

  .team-hands :global(.team-hand-rank) {
    font-family: var(--font-display);
    font-weight: 600;
    color: var(--foreground-mid);
    font-variant-numeric: tabular-nums;
  }
</style>
